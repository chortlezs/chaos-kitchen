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


class BlePump(EventHub):
    def __init__(self, device_mac=None):
        super().__init__()
        self.stopped = threading.Event()
        self.device_mac = device_mac.replace(':', '').lower() if device_mac else None
        self.link = {'type': 'link', 'transport': 'ble', 'state': 'scanning', 'connected': False}
        self.last_event_ms = None

    def set_link(self, state, **details):
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
                    while client.is_connected and not self.stopped.is_set():
                        await asyncio.sleep(.2)
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
        pass
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
