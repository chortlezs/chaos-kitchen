"""Independent physical behaviours: quiet, slow gait, running, gaps and rotation."""
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).parents[1]))
from jog_detector import JogDetector

PROFILE={'gyro_bias_dps':dict.fromkeys(('gx','gy','gz'),0),
         'gyro_swing_axis':{'gx':1,'gy':0,'gz':0},
         'proposed_detector':{'cycle_interval_min_seconds':.4,'cycle_interval_max_seconds':.98}}


def samples(hz,seconds=12,offset=0,accel=True):
    for i in range(int(seconds*50)):
        t=i/50
        yield {'t_ms':offset+i*20,'gx':100*math.sin(2*math.pi*hz*t),'gy':0,'gz':0,
               'ax':0,'ay':0,'az':1+(.3*math.sin(4*math.pi*hz*t) if accel else 0)}


class JogTests(unittest.TestCase):
    def test_slow_gait_and_stationary_never_credit(self):
        for cadence in (0,.8):
            detector=JogDetector(PROFILE)
            self.assertEqual(sum(detector.accept(s) for s in samples(cadence)),0)

    def test_one_cycle_per_ankle_not_two_impact_peaks(self):
        detector=JogDetector(PROFILE)
        count=sum(detector.accept(s) for s in samples(1.5))
        self.assertGreaterEqual(count,15)
        self.assertLessEqual(count,18,'12 seconds at 1.5 ankle cycles/s cannot be 36 cycles')

    def test_rotation_without_acceleration_is_not_jogging(self):
        detector=JogDetector(PROFILE)
        self.assertEqual(sum(detector.accept(s) for s in samples(1.5,accel=False)),0)

    def test_stop_and_data_gap_clear_running_and_confirmation(self):
        detector=JogDetector(PROFILE)
        self.assertGreater(sum(detector.accept(s) for s in samples(1.5,3)),0)
        self.assertEqual(sum(detector.accept(s) for s in samples(0,2,offset=3000)),0)
        self.assertFalse(detector.running)
        fresh=list(samples(1.5,.6,offset=10000))
        self.assertEqual(sum(detector.accept(s) for s in fresh),0)


if __name__=='__main__':
    unittest.main()
