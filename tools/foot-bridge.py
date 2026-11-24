"""Independent XIAO BLE receiver: calibrated jogging cycles -> localhost SSE."""
import argparse
import asyncio
import json
from pathlib import Path
import signal
import threading
import time
import uuid
from http.server import ThreadingHTTPServer

from foot_protocol import SERVICE_UUID, SAMPLE_UUID, IDENTITY_UUID, SampleDecoder
from jog_detector import JogDetector
from motion_sse import EventHub, Handler as SseHandler


class FootPump(EventHub):
    def __init__(self, profile, address=None, classifier=None):
        super().__init__()
        self.profile = profile
        self.address = address
        self.stopped = threading.Event()
        self.link = {'type':'link', 'transport':'xiao-ble', 'connected':False, 'state':'scanning'}
        self.last_sample_ms = None
        self.total_cycles = 0
        self.missing = 0
        self.running = False
        self.activity = None
        self.classifier_error = None
        self.classifier = classifier
        if self.classifier is None:
            try:
                from ankle_classifier import AnkleClassifier
                self.classifier = AnkleClassifier()
            except (ImportError, OSError, ValueError):
                self.classifier_error = 'model_unavailable'

    def set_link(self, state, **details):
        self.running = False
        self.activity = None
        if self.classifier:self.classifier.reset()
        self.link = {'type':'link','transport':'xiao-ble','state':state,'connected':state=='connected',**details}
        self.broadcast(self.link)
        print(json.dumps(self.link),flush=True)

    def health(self):
        return {'ok':True,'source':'xiao-ble','pace_protocol':1,'activity_protocol':1,
                'classifier_ready':self.classifier is not None,'classifier_error':self.classifier_error,
                'activity':self.activity,**self.link,'calibration_identity':self.profile['identity'],
                'total_cycles':self.total_cycles,'missing_notifications':self.missing,'running':self.running,
                'last_sample_age_ms':None if self.last_sample_ms is None else time.time_ns()//1000000-self.last_sample_ms}

    def add_client(self):
        client = super().add_client()
        client.put_nowait(json.dumps(self.link))
        return client

    def run(self):
        asyncio.run(self.receive_loop())

    async def receive_loop(self):
        from bleak import BleakClient, BleakScanner
        while not self.stopped.is_set():
            try:
                self.set_link('scanning')
                found = await BleakScanner.discover(timeout=4,return_adv=True,service_uuids=[SERVICE_UUID])
                candidates = [d for d,a in found.values() if SERVICE_UUID in [s.lower() for s in a.service_uuids]
                    and (not self.address or d.address.lower()==self.address.lower())]
                if len(candidates)!=1:
                    if len(candidates)>1:
                        self.set_link('ambiguous')
                    await asyncio.sleep(1)
                    continue
                async with BleakClient(candidates[0],timeout=20,winrt={'use_cached_services':False}) as client:
                    identity=(await client.read_gatt_char(IDENTITY_UUID)).decode('ascii')
                    if identity != self.profile['identity']:
                        raise ValueError('Sensor identity does not match the ankle calibration')
                    decoder=SampleDecoder()
                    detector=JogDetector(self.profile)
                    session=uuid.uuid4().hex
                    sequence=0
                    pace_sent=0
                    anchor=None
                    last_received=time.monotonic()

                    def receive(_,data):
                        nonlocal sequence,anchor,last_received,pace_sent
                        try:
                            sample=decoder.decode(data)
                        except ValueError:
                            return
                        if sample is None:
                            return
                        now=time.monotonic()
                        if anchor is None:
                            anchor=(now,sample['t_ms'])
                        age=now-anchor[0]-((sample['t_ms']-anchor[1])&0xffffffff)/1000
                        if age>.35 or age<-.35:
                            anchor=(now,sample['t_ms'])
                            detector.reset()
                            if self.classifier:self.classifier.reset()
                            self.activity=None
                            self.running=False
                            return
                        last_received=now
                        self.last_sample_ms=time.time_ns()//1000000
                        self.missing=decoder.dropped
                        cycles=detector.accept(sample)
                        self.running=detector.running
                        if self.classifier:
                            activity=self.classifier.accept(sample)
                            if activity is not None:
                                self.activity={'type':'activity','source':'xiao-foot',**activity,
                                    'event_id':f'{session}:activity:{sample["seq"]}:{sample["t_ms"]}',
                                    't_ms':sample['t_ms'],'sent_at_ms':self.last_sample_ms}
                                self.broadcast(self.activity)
                        if now-pace_sent >= .2:
                            pace_sent=now
                            self.broadcast({'type':'pace','source':'xiao-foot',
                                'event_id':f'{session}:pace:{sample["seq"]}:{sample["t_ms"]}',
                                't_ms':sample['t_ms'],'sent_at_ms':self.last_sample_ms,
                                **detector.pace(sample['t_ms'])})
                        if cycles:
                            sequence+=1
                            self.total_cycles+=cycles
                            event={'type':'motion','action':'run','cycle':'single_foot','cycles':cycles,
                                't_ms':sample['t_ms'],'event_id':f'{session}:{sequence}',
                                'sent_at_ms':self.last_sample_ms,'source':'xiao-foot'}
                            self.broadcast(event)
                            print(json.dumps(event),flush=True)

                    await client.start_notify(SAMPLE_UUID,receive)
                    self.set_link('connected',identity=identity,address=candidates[0].address)
                    try:
                        while client.is_connected and not self.stopped.is_set():
                            await asyncio.sleep(.2)
                            if time.monotonic()-last_received>2:
                                raise TimeoutError('Foot sensor telemetry stalled')
                    finally:
                        if client.is_connected:
                            await client.stop_notify(SAMPLE_UUID)
            except Exception as error:
                self.set_link('disconnected',error=str(error))
            finally:
                if self.link['connected']:
                    self.set_link('disconnected')
            if not self.stopped.is_set():
                await asyncio.sleep(1)
        self.set_link('disconnected')


def main():
    if hasattr(signal,'SIGBREAK'):
        signal.signal(signal.SIGBREAK,signal.default_int_handler)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--calibration',type=Path,required=True)
    parser.add_argument('--address')
    parser.add_argument('--port',type=int,default=8768)
    args=parser.parse_args()
    profile=json.loads(args.calibration.read_text(encoding='utf-8'))
    if profile.get('schema')!='xiao-ankle-calibration/v1':
        parser.error('Expected an ankle calibration profile')
    JogDetector(profile)  # Validate detector settings before opening the port.
    pump=FootPump(profile,args.address)
    class Handler(SseHandler):
        pass
    Handler.pump=pump
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    server.daemon_threads=True
    worker=threading.Thread(target=pump.run,name='foot-ble-reader',daemon=True)
    worker.start()
    print(f'Foot bridge: http://127.0.0.1:{args.port}/events',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pump.stopped.set()
        worker.join(timeout=24)
        server.server_close()
    return 0


if __name__=='__main__':
    raise SystemExit(main())
