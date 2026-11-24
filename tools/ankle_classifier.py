"""Public-data ankle activity classifier. No wearable recordings are stored.

Only orientation-invariant acceleration features are used: XIAO gyro mounting
and the MHEALTH gyroscope scale need not match. Values enter this module in g.
"""
from collections import deque
import json
import hashlib
from pathlib import Path

import numpy as np

LABELS = ('still', 'walk', 'jog', 'run', 'other')
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = ROOT / 'models' / 'ankle-mhealth' / 'model.npz'
RATE = 50
WINDOW = 100
FEATURE_VERSION = 'ankle-accel-invariant/v1'


def features(accel):
    """Shared training/inference transform for a 2-second, 50 Hz window in g."""
    x = np.asarray(accel, dtype=np.float64)
    if x.shape != (WINDOW, 3) or not np.isfinite(x).all():
        raise ValueError('Expected 100 finite XYZ acceleration samples in g')
    mag = np.linalg.norm(x, axis=1)
    centered = mag-mag.mean()
    std = max(float(mag.std()), 1e-7)
    delta = np.diff(mag)
    dynamic = np.linalg.norm(x-x.mean(axis=0), axis=1)
    eigen = np.linalg.eigvalsh(np.cov(x, rowvar=False))
    spectrum = np.abs(np.fft.rfft(centered*np.hanning(WINDOW)))**2
    frequency = np.fft.rfftfreq(WINDOW, 1/RATE)
    spectrum[0] = 0
    total = max(float(spectrum.sum()), 1e-12)
    normalized = spectrum/total
    bands = [float(spectrum[(frequency >= lo) & (frequency < hi)].sum()/total)
             for lo, hi in ((.5, 1.5), (1.5, 3), (3, 5), (5, 10), (10, 26))]
    correlations = [float(np.dot(centered[:-lag], centered[lag:]) /
                          max(np.dot(centered, centered), 1e-12)) for lag in (10, 15, 20, 25, 30, 40, 50, 60)]
    return np.array([
        mag.mean(), mag.std(), mag.min(), mag.max(), *np.quantile(mag, [.05, .25, .5, .75, .95]),
        np.sqrt(np.mean(mag**2)), np.mean(np.abs(centered)),
        np.mean((centered/std)**3), np.mean((centered/std)**4),
        delta.std(), np.mean(np.abs(delta)), np.quantile(np.abs(delta), .95),
        dynamic.mean(), dynamic.std(), np.quantile(dynamic, .9), *eigen,
        frequency[np.argmax(spectrum)], np.log1p(total),
        -np.sum(normalized*np.log(normalized+1e-12)), *bands, *correlations,
    ], dtype=np.float32)


class ActivityModel:
    """Read a numeric-only forest export; runtime does not import scikit-learn."""
    def __init__(self, path=DEFAULT_MODEL):
        path = Path(path)
        self.metadata = json.loads(path.with_name('metadata.json').read_text(encoding='utf-8'))
        if self.metadata.get('feature_version') != FEATURE_VERSION or self.metadata.get('labels') != list(LABELS):
            raise ValueError('Unsupported ankle model metadata')
        if hashlib.sha256(path.read_bytes()).hexdigest() != self.metadata.get('model_sha256'):
            raise ValueError('Ankle model checksum mismatch')
        with np.load(path, allow_pickle=False) as data:
            for name in ('left', 'right', 'feature', 'threshold', 'value', 'offsets'):
                setattr(self, name, data[name].copy())
        self.threshold_score = float(self.metadata['rejection']['minimum_score'])
        self.margin = float(self.metadata['rejection']['minimum_margin'])

    def predict(self, accel):
        return self.predict_features(features(accel))

    def predict_features(self, vector):
        vector = np.asarray(vector, dtype=np.float32)
        scores = np.zeros(len(LABELS))
        for offset in self.offsets:
            node = int(offset)
            while self.left[node] != -1:
                node = int(self.left[node] if vector[self.feature[node]] <= self.threshold[node] else self.right[node])
            scores += self.value[node]
        scores /= len(self.offsets)
        order = np.argsort(scores)
        confidence = float(scores[order[-1]])
        accepted = confidence >= self.threshold_score and confidence-float(scores[order[-2]]) >= self.margin
        return {'label': LABELS[order[-1]] if accepted else 'unknown',
                'confidence': round(confidence, 4),
                'scores': {label: round(float(score), 4) for label, score in zip(LABELS, scores)},
                'model': self.metadata['model_id'], 'reason': 'classified' if accepted else 'low_confidence'}


class AnkleClassifier:
    """Causal resampling and quality gates for live BLE and offline replay."""
    def __init__(self, model=None):
        self.model = model if model is not None else ActivityModel()
        self.reset()

    def reset(self):
        self.samples = deque()
        self.last_t = None
        self.elapsed = 0
        self.last_prediction = -1000

    def accept(self, sample):
        t = sample['t_ms']
        xyz = [sample[key] for key in ('ax', 'ay', 'az')]
        delta = None if self.last_t is None else (t-self.last_t) & 0xffffffff
        if not np.isfinite(xyz).all() or max(abs(v) for v in xyz) > 16 or delta is not None and not 0 < delta <= 120:
            self.reset()
            return self.unknown('sample_gap_or_invalid')
        self.elapsed += delta or 0
        self.last_t = t
        self.samples.append((self.elapsed, *xyz))
        while self.samples and self.elapsed-self.samples[0][0] > 2200:
            self.samples.popleft()
        if self.elapsed-self.last_prediction < 500:
            return None
        self.last_prediction = self.elapsed
        if not self.samples or self.elapsed-self.samples[0][0] < 1980 or len(self.samples) < 70:
            return self.unknown('warming_up')
        array = np.asarray(self.samples)
        # End the inference window at the newest sample; never use future data.
        grid = np.arange(self.elapsed-1980, self.elapsed+1, 20)
        window = np.column_stack([np.interp(grid, array[:, 0], array[:, axis]) for axis in (1, 2, 3)])
        result = self.model.predict(window)
        result['window_ms'] = 2000
        return result

    @staticmethod
    def unknown(reason):
        return {'label': 'unknown', 'confidence': 0, 'scores': {}, 'reason': reason, 'window_ms': 2000}
