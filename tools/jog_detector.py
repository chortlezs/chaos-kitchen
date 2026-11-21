"""Causal, calibrated single-ankle cycle detector; no keyboard emulation."""
import math
from collections import deque


class JogDetector:
    def __init__(self, profile):
        self.bias = [profile['gyro_bias_dps'][k] for k in ('gx', 'gy', 'gz')]
        axis = [profile['gyro_swing_axis'][k] for k in ('gx', 'gy', 'gz')]
        length = math.sqrt(sum(v*v for v in axis))
        if not math.isfinite(length) or length < .1:
            raise ValueError('Invalid calibrated swing axis')
        self.axis = [v/length for v in axis]
        config = profile['proposed_detector']
        self.minimum = config['cycle_interval_min_seconds']
        self.maximum = config['cycle_interval_max_seconds']
        self.threshold = config.get('positive_swing_min_dps', 25)
        self.reset()

    def reset(self):
        self.last_t = None
        self.filtered = 0.
        self.low_seen = False
        self.peak = None
        self.last_peak_t = None
        self.streak = 0
        self.running = False
        self.last_cycle_t = None
        self.accel_history = deque()

    def accept(self, sample):
        """Return complete cycles (0, 1 or 2), never up/down half-cycle peaks."""
        t = sample['t_ms']
        if self.last_t is not None:
            elapsed = ((t-self.last_t) & 0xffffffff)/1000
            if elapsed <= 0 or elapsed > .25:
                self.reset()
        self.last_t = t
        norm=math.sqrt(sum(sample[k]**2 for k in ('ax','ay','az')))
        self.accel_history.append((t,norm))
        while self.accel_history and ((t-self.accel_history[0][0])&0xffffffff)/1000 > self.maximum:
            self.accel_history.popleft()
        if self.last_cycle_t is not None and ((t-self.last_cycle_t)&0xffffffff)/1000 > self.maximum:
            self.running = False
            self.streak = 0
        velocity = sum((sample[k]-b)*a for k,b,a in zip(('gx','gy','gz'),self.bias,self.axis))
        self.filtered += .35*(velocity-self.filtered)
        v = self.filtered
        if v < -self.threshold*.65:
            self.low_seen = True
        if self.peak is None:
            if self.low_seen and v >= self.threshold:
                self.peak = (v,t)
            return 0
        if v > self.peak[0]:
            self.peak = (v,t)
        if v > self.peak[0]-10:
            return 0
        _,peak_t = self.peak
        self.peak = None
        self.low_seen = False
        previous = self.last_peak_t
        self.last_peak_t = peak_t
        if previous is None:
            return 0
        interval = ((peak_t-previous)&0xffffffff)/1000
        norms=[a for _,a in self.accel_history]
        if not self.minimum <= interval <= self.maximum or max(norms)-min(norms)<.18:
            self.streak = 0
            self.running = False
            return 0
        self.streak += 1
        self.last_cycle_t = peak_t
        if self.streak < 2:
            return 0
        self.running = True
        # Confirm two consecutive intervals before crediting either full cycle.
        return 2 if self.streak == 2 else 1
