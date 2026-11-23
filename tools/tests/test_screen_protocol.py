import asyncio
import importlib.util
import json
from pathlib import Path
import struct
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parents[1]))
from screen_protocol import encode_screen, FRAME


def state(**extra):
    return {'stage':'chop','theme':'fridge','dish':2,'progress':50,'cuts':5,'session':123,**extra}


class ScreenTests(unittest.TestCase):
    def test_compact_frame_and_tilt(self):
        frame=encode_screen(state(tilt=-675,event=1,event_counter=450,seconds=13))
        self.assertEqual(len(frame),20)
        values=FRAME.unpack(frame)
        self.assertEqual(values[:8],(1,2,1,2,50,100,5,0))
        self.assertEqual(values[-4:],(450,-675,13,123))

    def test_invalid_fields_are_not_sent_to_device(self):
        for extra in ({'stage':'erase'},{'theme':'other'},{'cuts':11},{'dish':6},{'tilt':1001},
                      {'session':0},{'flags':4},{'progress':float('nan')},{'dish':True}):
            with self.subTest(extra=extra),self.assertRaises(ValueError):
                encode_screen(state(**extra))

    def test_mailbox_is_latest_only_and_drops_disconnect(self):
        spec=importlib.util.spec_from_file_location('screen_bridge',Path(__file__).parents[1]/'ble-bridge.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        pump=module.BlePump()
        self.assertFalse(pump.queue_screen(state()))
        pump.set_link('connected');pump.screen_supported=True
        self.assertTrue(pump.queue_screen(state(progress=10)))
        self.assertTrue(pump.queue_screen(state(progress=90)))
        self.assertEqual(pump.screen_pending[1][4],90)
        pump.set_link('disconnected')
        self.assertIsNone(pump.screen_pending)
        self.assertFalse(pump.queue_screen(state()))


if __name__=='__main__': unittest.main()
