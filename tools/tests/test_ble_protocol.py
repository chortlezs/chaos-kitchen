"""BLE wire compatibility, reconnect boundaries and stale-action rejection."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).parents[1]))
from ble_protocol import Decoder, FRAME


def packet(action=4, flags=0, boot=7, seq=1, t=1000, roll=-500, axis=0):
    return FRAME.pack(1, action, flags, boot, seq, t, roll, axis, 0)


class ProtocolTests(unittest.TestCase):
    def test_four_actions_match_existing_browser_contract(self):
        events = [Decoder().decode(packet(action=n, flags=1), 2000) for n in range(1, 5)]
        self.assertEqual(FRAME.size, 20)
        self.assertEqual(events[0]['cycle'], 'down_up')
        self.assertEqual((events[1]['motion'], events[1]['active']), ('circle', True))
        self.assertEqual(events[2]['motion'], 'vertical')
        self.assertEqual((events[3]['roll'], events[3]['axis']), (-.5, 'x'))
        self.assertEqual(Decoder().decode(packet(roll=750, axis=1), 2000)['roll'], .75)

    def test_duplicate_and_out_of_order_frames_do_not_replay(self):
        decoder = Decoder()
        first = decoder.decode(packet(seq=5), 2000)
        self.assertIsNone(decoder.decode(packet(seq=5), 2001))
        self.assertIsNone(decoder.decode(packet(seq=4), 2002))
        next_event = decoder.decode(packet(seq=6, t=1050), 2050)
        self.assertNotEqual(first['event_id'], next_event['event_id'])

    def test_backlog_is_dropped_then_fresh_packets_resume(self):
        decoder = Decoder()
        decoder.decode(packet(), 2000)
        self.assertIsNone(decoder.decode(packet(seq=2, t=1050), 2400))
        self.assertIsNotNone(decoder.decode(packet(seq=3, t=1450), 2450))

    def test_wrap_and_reconnection(self):
        decoder = Decoder()
        decoder.decode(packet(seq=0xffffffff, t=0xfffffff0), 2000)
        self.assertIsNotNone(decoder.decode(packet(seq=0, t=34), 2050))
        with self.assertRaises(ValueError):
            decoder.decode(packet(boot=8), 2100)
        self.assertIsNotNone(Decoder().decode(packet(boot=8), 2100))

    def test_malformed_notifications_are_rejected(self):
        for data in [b'', packet()[:-1], packet()+b'0', packet(action=9), packet(roll=1001),
                     packet(flags=4), packet(axis=3)]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                Decoder().decode(data, 2000)

    def test_sse_client_receives_actual_ble_link_state(self):
        spec = importlib.util.spec_from_file_location('test_ble_bridge', Path(__file__).parents[1] / 'ble-bridge.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        pump = module.BlePump('1c:29:04:d0:89:b2')
        client = pump.add_client()
        self.assertEqual(json.loads(client.get_nowait())['state'], 'scanning')
        pump.set_link('connected', identity='kitchen_link:v1:1c2904d089b2')
        self.assertTrue(json.loads(client.get_nowait())['connected'])
        pump.set_link('disconnected')
        self.assertFalse(json.loads(client.get_nowait())['connected'])
        self.assertEqual(pump.health()['source'], 'ble')


class ReceiverTests(unittest.IsolatedAsyncioTestCase):
    async def test_subscription_validates_identity_and_forwards_notifications(self):
        spec = importlib.util.spec_from_file_location('test_ble_receiver', Path(__file__).parents[1] / 'ble-bridge.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        pump = module.BlePump('1c2904d089b2')
        queue = pump.add_client()
        queue.get_nowait()
        device = SimpleNamespace(address='BLE_ADDRESS', name='Kitchen-Mosaico-89B2')
        advertisement = SimpleNamespace(service_uuids=[module.SERVICE_UUID], local_name=device.name)
        scanner = SimpleNamespace(discover=AsyncMock(return_value={'board': (device, advertisement)}))
        operations = []

        class Client:
            is_connected = True

            def __init__(self, target, **kwargs):
                self.target = target

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                operations.append('disconnect')

            async def read_gatt_char(self, uuid):
                operations.append('identity')
                return b'kitchen_link:v1:1c2904d089b2'

            async def start_notify(self, uuid, callback):
                operations.append('subscribe')
                callback(None, packet(action=1))
                callback(None, packet(action=4, seq=2, t=1050, roll=250))
                pump.stopped.set()

            async def stop_notify(self, uuid):
                operations.append('unsubscribe')

        with patch.dict(sys.modules, {'bleak': SimpleNamespace(BleakClient=Client, BleakScanner=scanner)}):
            await pump.receive_loop()
        items = []
        while not queue.empty():
            items.append(json.loads(queue.get_nowait()))
        motions = [item for item in items if item['type'] == 'motion']
        self.assertEqual([item['action'] for item in motions], ['chop', 'plate'])
        self.assertEqual(motions[-1]['roll'], .25)
        self.assertEqual(operations, ['identity', 'subscribe', 'unsubscribe', 'disconnect'])
        self.assertFalse(pump.health()['connected'])


if __name__ == '__main__':
    unittest.main()
