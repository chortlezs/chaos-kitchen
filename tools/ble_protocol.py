"""Kitchen BLE v1: one complete semantic event per default-MTU notification."""
import struct

SERVICE_UUID = 'b1730001-2a7d-4e51-913c-4f79b150cc01'
EVENT_UUID = 'b1730002-2a7d-4e51-913c-4f79b150cc01'
IDENTITY_UUID = 'b1730003-2a7d-4e51-913c-4f79b150cc01'
FRAME = struct.Struct('<BBHIIIhBB')


class Decoder:
    """One decoder per connection; reject malformed, duplicated or stale frames."""
    def __init__(self):
        self.boot = None
        self.sequence = None
        self.device_time = None
        self.host_time = None

    def decode(self, data, received_ms):
        if len(data) != FRAME.size:
            raise ValueError('BLE packet must contain exactly 20 bytes')
        version, action, flags, boot, sequence, device_time, roll, axis, reserved = FRAME.unpack(data)
        if version != 1 or action not in (1, 2, 3, 4) or reserved or flags & ~1:
            raise ValueError('Unsupported BLE packet')
        if not -1000 <= roll <= 1000 or axis not in (0, 1):
            raise ValueError('Invalid BLE tilt')
        if self.boot is not None and self.boot != boot:
            raise ValueError('Boot changed within connection; reconnect required')
        if self.sequence is not None:
            delta = (sequence - self.sequence) & 0xffffffff
            if delta == 0 or delta >= 0x80000000:
                return None
            elapsed = (device_time - self.device_time) & 0xffffffff
            if elapsed >= 0x80000000:
                return None
            # Minimum observed host-device offset tracks transport backlog without
            # requiring synchronized clocks. Handle uptime wrap after 49 days.
            predicted = self.host_time + elapsed
            if received_ms - predicted > 200:
                return None
            self.host_time = min(received_ms, predicted)
        else:
            self.host_time = received_ms
        self.boot, self.sequence, self.device_time = boot, sequence, device_time
        event = {'type': 'motion', 't_ms': device_time, 'boot_id': f'ble:{boot:08x}',
                 'event_id': f'ble:{boot:08x}:{sequence}', 'sent_at_ms': received_ms,
                 'transport': 'ble'}
        if action == 1:
            event.update(action='chop', cycle='down_up')
        elif action == 2:
            event.update(action='wok', motion='circle', active=bool(flags & 1))
        elif action == 3:
            event.update(action='flip', motion='vertical')
        else:
            event.update(action='plate', motion='tilt', roll=roll / 1000,
                         axis='xy'[axis])
        return event
