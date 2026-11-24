"""Exercise the actual receiver callback with slow BLE samples and a live clock."""
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
from foot_protocol import FRAME, SERVICE_UUID
from test_jog_detector import PROFILE, samples
from ankle_classifier import AnkleClassifier
from test_ankle_classifier import FakeModel


class FootBridgeTests(unittest.IsolatedAsyncioTestCase):
    async def test_slow_live_telemetry_reaches_sse_without_movement_credit(self):
        spec=importlib.util.spec_from_file_location('coach_foot_bridge',Path(__file__).parents[1]/'foot-bridge.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        profile={**PROFILE,'identity':'test-ankle'}
        pump=module.FootPump(profile,classifier=AnkleClassifier(FakeModel()));messages=[]
        pump.broadcast=messages.append
        clock=[0.0]

        class Scanner:
            @staticmethod
            async def discover(**_):
                return {'device':(SimpleNamespace(address='test-address'),SimpleNamespace(service_uuids=[SERVICE_UUID]))}

        class Client:
            is_connected=True

            def __init__(self,*_,**__):pass
            async def __aenter__(self):return self
            async def __aexit__(self,*_):pass
            async def read_gatt_char(self,_):return b'test-ankle'
            async def stop_notify(self,_):pass

            async def start_notify(self,_,callback):
                for seq,sample in enumerate(samples(.8)):
                    clock[0]=seq/50
                    packet=FRAME.pack(1,1,seq,sample['t_ms'],
                        *[round(sample[key]*1000) for key in ('ax','ay','az')],
                        *[round(sample[key]*10) for key in ('gx','gy','gz')])
                    callback(None,packet)
                pump.stopped.set()

        with patch.dict(sys.modules,{'bleak':SimpleNamespace(BleakClient=Client,BleakScanner=Scanner)}),\
             patch.object(module.time,'monotonic',side_effect=lambda:clock[0]),\
             patch.object(module.time,'time_ns',side_effect=lambda:1700000000000000000+round(clock[0]*1e9)),\
             patch('builtins.print'):
            await pump.receive_loop()
        pace=[value for value in messages if value.get('type')=='pace']
        self.assertGreater(len(pace),45)
        self.assertTrue(any(45<=value['cadence']<=50 for value in pace))
        self.assertTrue(all(value['source']=='xiao-foot' and value['sent_at_ms']>0 for value in pace))
        self.assertEqual(pump.total_cycles,0)
        self.assertFalse(any(value.get('action')=='run' for value in messages))
        self.assertEqual(pump.health()['pace_protocol'],1)
        activity=[value for value in messages if value.get('type')=='activity']
        self.assertGreater(len(activity),15)
        self.assertTrue(any(value['label']=='jog' and value['window_ms']==2000 for value in activity))
        self.assertEqual(pump.health()['activity_protocol'],1)
        self.assertTrue(pump.health()['classifier_ready'])
        self.assertNotIn('gx',json.dumps(pace))


if __name__=='__main__':unittest.main()
