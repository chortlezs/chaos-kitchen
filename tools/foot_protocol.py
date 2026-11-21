"""XIAO foot IMU telemetry v1, separate from hand-controller semantic events."""
import struct

SERVICE_UUID = 'b1730011-2a7d-4e51-913c-4f79b150cc01'
SAMPLE_UUID = 'b1730012-2a7d-4e51-913c-4f79b150cc01'
IDENTITY_UUID = 'b1730013-2a7d-4e51-913c-4f79b150cc01'
FRAME = struct.Struct('<BBHIhhhhhh')


class SampleDecoder:
    def __init__(self):
        self.sequence = None
        self.dropped = 0

    def decode(self, data):
        if len(data) != FRAME.size:
            raise ValueError('Expected a 20-byte foot IMU notification')
        version, kind, seq, t_ms, ax, ay, az, gx, gy, gz = FRAME.unpack(data)
        if version != 1 or kind != 1:
            raise ValueError('Unsupported foot telemetry protocol')
        if self.sequence is not None:
            delta = (seq - self.sequence) & 0xffff
            if delta == 0 or delta >= 0x8000:
                return None
            self.dropped += delta - 1
        self.sequence = seq
        return {'type': 'sample', 'source': 'xiao-foot', 'seq': seq, 't_ms': t_ms,
                'ax': ax / 1000, 'ay': ay / 1000, 'az': az / 1000,
                'gx': gx / 10, 'gy': gy / 10, 'gz': gz / 10}
