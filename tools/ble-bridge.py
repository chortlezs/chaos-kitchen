"""Receive Kitchen BLE notifications and expose the existing localhost SSE API.

No USB access, no ESP-Iris ownership and no Windows manual pairing required.
"""
import argparse
import asyncio
import json
import re
import signal
import threading
import time
from http.server import ThreadingHTTPServer

from ble_protocol import Decoder, SERVICE_UUID, EVENT_UUID, IDENTITY_UUID

from motion_sse import EventHub, Handler as SseHandler
from screen_protocol import SCREEN_UUID, encode_screen


class BlePump(EventHub):
    def __init__(self, device_mac=None):
        super().__init__()
        self.stopped = threading.Event()
        self.device_mac = device_mac.replace(':', '').lower() if device_mac else None
        self.link = {'type': 'link', 'transport': 'ble', 'state': 'scanning', 'connected': False}
        self.last_event_ms = None
        self.screen_supported = False
        self.screen_lock = threading.Lock()
        self.screen_pending = None
        self.screen_writes = 0
        self.screen_last = None

    def queue_screen(self, value):
        frame=encode_screen(value)
        if not self.link['connected'] or not self.screen_supported:
            return False
        with self.screen_lock:
            self.screen_pending=(time.monotonic(),frame)
        return True

    def set_link(self, state, **details):
        with self.screen_lock:
            self.screen_pending=None
        if state!='connected':
            self.screen_supported=False
        self.link = {'type': 'link', 'transport': 'ble', 'state': state,
                     'connected': state == 'connected', **details}
        self.broadcast(self.link)
        print(json.dumps(self.link, ensure_ascii=False), flush=True)

    def add_client(self):
        client = super().add_client()
        client.put_nowait(json.dumps(self.link, ensure_ascii=False))
        return client

    def health(self):
        return {'ok': True, 'source': 'ble', **self.link,
                'screen_supported':self.screen_supported,'screen_writes':self.screen_writes,
                'screen_last':self.screen_last,
                'last_event_age_ms': None if self.last_event_ms is None else
                time.time_ns() // 1000000 - self.last_event_ms}

    def stop(self):
        self.stopped.set()

    def run(self):
        asyncio.run(self.receive_loop())

    async def receive_loop(self):
        from bleak import BleakClient, BleakScanner
        while not self.stopped.is_set():
            try:
                self.set_link('scanning')
                found = await BleakScanner.discover(timeout=4, return_adv=True,
                                                    service_uuids=[SERVICE_UUID])
                candidates = []
                for device, advertisement in found.values():
                    if SERVICE_UUID not in [s.lower() for s in advertisement.service_uuids]:
                        continue
                    name = (advertisement.local_name or device.name or '').lower()
                    if self.device_mac and not name.endswith(self.device_mac[-4:]):
                        continue
                    candidates.append(device)
                if not candidates:
                    await asyncio.sleep(1)
                    continue
                if len(candidates) > 1:
                    self.set_link('ambiguous', error='Multiple Kitchen boards found; pass --device-mac.')
                    await asyncio.sleep(3)
                    continue
                device = candidates[0]
                self.set_link('connecting', address=device.address)
                async with BleakClient(device, timeout=15) as client:
                    identity = (await client.read_gatt_char(IDENTITY_UUID)).decode('ascii')
                    if not re.fullmatch(r'kitchen_link:v1:[0-9a-f]{12}', identity):
                        raise ValueError('Unexpected Kitchen BLE identity')
                    if self.device_mac and identity.split(':')[-1] != self.device_mac:
                        raise ValueError('BLE identity does not match selected board')
                    decoder = Decoder()
                    last_received = time.monotonic()

                    def receive(_characteristic, data):
                        nonlocal last_received
                        try:
                            stamp = time.time_ns() // 1000000
                            event = decoder.decode(data, stamp)
                        except ValueError as error:
                            print(f'Ignoring BLE packet: {error}', flush=True)
                            return
                        if event is not None:
                            last_received = time.monotonic()
                            self.last_event_ms = stamp
                            self.broadcast(event)

                    await client.start_notify(EVENT_UUID, receive)
                    self.set_link('connected', address=device.address, identity=identity)
                    services=getattr(client,'services',None)
                    self.screen_supported=bool(services and services.get_characteristic(SCREEN_UUID))
                    while client.is_connected and not self.stopped.is_set():
                        await asyncio.sleep(.08)
                        with self.screen_lock:
                            pending=self.screen_pending;self.screen_pending=None
                        if pending and time.monotonic()-pending[0]<1 and self.screen_supported:
                            await client.write_gatt_char(SCREEN_UUID,pending[1],response=True)
                            self.screen_writes+=1
                            self.screen_last={'stage':pending[1][1],'theme':pending[1][2],'dish':pending[1][3]}
                        if time.monotonic() - last_received > 3:
                            raise TimeoutError('No fresh motion heartbeat for 3 seconds')
                    if client.is_connected:
                        await client.stop_notify(EVENT_UUID)
            except Exception as error:
                self.set_link('disconnected', error=str(error))
            finally:
                if self.link['connected']:
                    self.set_link('disconnected')
            if not self.stopped.is_set():
                await asyncio.sleep(1)
        self.set_link('disconnected')


def main():
    if hasattr(signal, 'SIGBREAK'):
        signal.signal(signal.SIGBREAK, signal.default_int_handler)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device-mac', help='Wi-Fi MAC from USB identity, e.g. 1c2904d089b2')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    if args.device_mac and not re.fullmatch(r'(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}|[0-9a-fA-F]{12}', args.device_mac):
        parser.error('Expected a 12-digit MAC, with optional colons.')
    try:
        import bleak  # noqa: F401
    except ImportError:
        parser.error('Install BLE dependencies: python -m pip install -r tools/requirements-ble.txt')
    pump = BlePump(args.device_mac)
    class Handler(SseHandler):
        def do_POST(self):
            if self.path!='/screen':
                self.send_error(404);return
            origin=self.headers.get('Origin')
            if origin and origin not in ('http://localhost:8767','http://127.0.0.1:8767'):
                self.send_error(403);return
            if self.headers.get_content_type()!='application/json':
                self.send_error(415);return
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=2048:raise ValueError('Invalid screen body')
                self.connection.settimeout(2)
                accepted=pump.queue_screen(json.loads(self.rfile.read(length)))
                payload=json.dumps({'accepted':accepted}).encode()
                self.send_response(200 if accepted else 503)
                self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(payload)))
                self.end_headers();self.wfile.write(payload)
            except (ValueError,TypeError,OSError):
                self.send_error(400)
    Handler.pump = pump
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.daemon_threads = True
    worker = threading.Thread(target=pump.run, name='ble-reader', daemon=True)
    worker.start()
    print(f'BLE bridge: http://127.0.0.1:{args.port}/events', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pump.stop()
        worker.join(timeout=22)
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
