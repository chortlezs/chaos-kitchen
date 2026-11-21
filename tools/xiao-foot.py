"""Bounded USB/BLE IMU check and CSV recorder for the XIAO foot sensor."""
import argparse
import asyncio
import csv
import json
import math
from pathlib import Path
import re
import time

from foot_protocol import SERVICE_UUID, SAMPLE_UUID, IDENTITY_UUID, SampleDecoder


class Recorder:
    def __init__(self, label, output=None):
        self.label = label
        self.output = Path(output) if output else None
        self.count = 0
        self.first = None
        self.last = None
        self.norms = []
        self.gyro_peak = 0
        self.file = None
        self.writer = None
        if self.output:
            self.output.parent.mkdir(parents=True, exist_ok=True)
            self.file = self.output.open('w', newline='', encoding='utf-8')
            self.writer = csv.DictWriter(self.file, fieldnames=[
                'host_ms', 'label', 'seq', 't_ms', 'ax', 'ay', 'az', 'gx', 'gy', 'gz'])
            self.writer.writeheader()

    def accept(self, sample):
        values = [sample.get(key) for key in ('ax', 'ay', 'az', 'gx', 'gy', 'gz')]
        if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in values):
            raise ValueError('Invalid sensor sample')
        self.count += 1
        self.first = sample if self.first is None else self.first
        self.last = sample
        self.norms.append(math.sqrt(sum(value * value for value in values[:3])))
        self.gyro_peak = max(self.gyro_peak, *(abs(value) for value in values[3:]))
        if self.writer:
            self.writer.writerow({'host_ms': time.time_ns() // 1000000, 'label': self.label,
                                  **{key: sample.get(key) for key in ('seq', 't_ms', 'ax', 'ay', 'az', 'gx', 'gy', 'gz')}})
        if self.count in (1, 50) or self.count % 250 == 0:
            print(json.dumps(sample, ensure_ascii=False), flush=True)

    def summary(self, **extra):
        if self.file:
            self.file.close()
        elapsed = 0 if self.count < 2 else ((self.last['t_ms'] - self.first['t_ms']) & 0xffffffff) / 1000
        summary = {'samples': self.count, 'sensor_seconds': round(elapsed, 3),
                   'sample_hz': round((self.count - 1) / elapsed, 2) if elapsed else 0,
                   'accel_norm_min_g': round(min(self.norms), 3) if self.norms else None,
                   'accel_norm_max_g': round(max(self.norms), 3) if self.norms else None,
                   'gyro_peak_dps': round(self.gyro_peak, 1),
                   'output': str(self.output.resolve()) if self.output else None, **extra}
        print(json.dumps(summary, ensure_ascii=False), flush=True)
        return summary


async def record_ble(args, recorder):
    from bleak import BleakClient, BleakScanner
    found = await BleakScanner.discover(timeout=5, return_adv=True, service_uuids=[SERVICE_UUID])
    candidates = [device for device, adv in found.values()
                  if SERVICE_UUID in [uuid.lower() for uuid in adv.service_uuids]
                  and (not args.address or device.address.lower() == args.address.lower())]
    if len(candidates) != 1:
        raise RuntimeError(f'Found {len(candidates)} foot sensors; connect one, or specify --address.')
    device = candidates[0]
    decoder = SampleDecoder()
    async with BleakClient(device, timeout=15) as client:
        identity = (await client.read_gatt_char(IDENTITY_UUID)).decode('ascii')
        if not re.fullmatch(r'xiao-foot:v1:[0-9a-f]{16}', identity):
            raise RuntimeError(f'Unexpected sensor identity: {identity}')
        print(json.dumps({'connected': True, 'address': device.address, 'identity': identity}), flush=True)

        def receive(_characteristic, data):
            sample = decoder.decode(data)
            if sample:
                recorder.accept(sample)

        await client.start_notify(SAMPLE_UUID, receive)
        deadline = time.monotonic() + args.seconds
        try:
            while time.monotonic() < deadline:
                if not client.is_connected:
                    raise RuntimeError('Foot sensor disconnected during recording')
                await asyncio.sleep(.1)
        finally:
            if client.is_connected:
                await client.stop_notify(SAMPLE_UUID)
    return {'transport': 'ble', 'identity': identity, 'address': device.address,
            'missing_notifications': decoder.dropped}


def record_usb(args, recorder):
    import serial
    from serial.tools import list_ports
    candidates = [p for p in list_ports.comports() if p.vid == 0x2886 and p.pid == 0x8045
                  and (not args.port or p.device.lower() == args.port.lower())]
    if len(candidates) != 1:
        raise RuntimeError('Expected one XIAO Sense application serial port; check --port.')
    port = candidates[0]
    with serial.Serial(port.device, 115200, timeout=.5) as stream:
        deadline = time.monotonic() + args.seconds
        while time.monotonic() < deadline:
            line = stream.readline().decode('utf-8', errors='replace').strip()
            if line.startswith('FOOT_SAMPLE '):
                recorder.accept(json.loads(line[len('FOOT_SAMPLE '):]))
            elif line.startswith('FOOT_ERROR'):
                raise RuntimeError(line)
    return {'transport': 'usb', 'port': port.device, 'usb_serial': port.serial_number}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--transport', choices=('usb', 'ble'), default='usb')
    parser.add_argument('--port')
    parser.add_argument('--address')
    parser.add_argument('--seconds', type=float, default=10)
    parser.add_argument('--label', default='check')
    parser.add_argument('--output')
    args = parser.parse_args()
    if not 1 <= args.seconds <= 600:
        parser.error('--seconds must be 1..600')
    recorder = Recorder(args.label, args.output)
    error = None
    extra = {}
    try:
        extra = asyncio.run(record_ble(args, recorder)) if args.transport == 'ble' else record_usb(args, recorder)
    except (Exception, KeyboardInterrupt) as caught:
        error = str(caught) or 'Recording interrupted'
    summary = recorder.summary(**extra, error=error)
    if error or summary['samples'] < 10:
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
