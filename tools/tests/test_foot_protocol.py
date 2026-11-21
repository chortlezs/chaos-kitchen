"""Foot telemetry units, packet validation and sequence wrap checks."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1]))
from foot_protocol import FRAME, SampleDecoder


def packet(seq=1, version=1, kind=1):
    return FRAME.pack(version, kind, seq, 12345, 100, -500, 1000, 123, -456, 0)


class FootProtocolTests(unittest.TestCase):
    def test_firmware_units_and_packet_size(self):
        self.assertEqual(FRAME.size, 20)
        sample = SampleDecoder().decode(packet())
        self.assertEqual((sample['ax'], sample['ay'], sample['az']), (.1, -.5, 1))
        self.assertEqual((sample['gx'], sample['gy'], sample['gz']), (12.3, -45.6, 0))
        self.assertEqual(sample['source'], 'xiao-foot')

    def test_duplicate_loss_and_wrap(self):
        decoder = SampleDecoder()
        decoder.decode(packet(seq=65534))
        self.assertIsNone(decoder.decode(packet(seq=65534)))
        self.assertIsNotNone(decoder.decode(packet(seq=1)))
        self.assertEqual(decoder.dropped, 2)
        self.assertIsNone(decoder.decode(packet(seq=0)))

    def test_bad_packet(self):
        for data in (b'', packet()[:-1], packet(version=2), packet(kind=4)):
            with self.subTest(data=data), self.assertRaises(ValueError):
                SampleDecoder().decode(data)


if __name__ == '__main__':
    unittest.main()
