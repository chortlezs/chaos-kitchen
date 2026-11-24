"""Feature invariance, causal live windows, dropout and numeric artifact checks."""
from pathlib import Path
import sys
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1]))
from ankle_classifier import AnkleClassifier, ActivityModel, DEFAULT_MODEL, features


class FakeModel:
    def __init__(self):self.windows=[]
    def predict(self, window):
        self.windows.append(window.copy())
        return {'label':'jog','confidence':.9,'scores':{'jog':.9},'model':'fake','reason':'classified'}


class AnkleTests(unittest.TestCase):
    def test_features_ignore_sensor_orientation_and_reject_invalid_data(self):
        rng=np.random.default_rng(12)
        accel=rng.normal(size=(100,3))+[0,0,1]
        rotation=np.linalg.qr(rng.normal(size=(3,3)))[0]
        np.testing.assert_allclose(features(accel),features(accel@rotation),rtol=2e-5,atol=1e-6)
        for value in (np.zeros((99,3)),np.full((100,3),np.nan)):
            with self.assertRaises(ValueError):features(value)

    def test_live_window_uses_real_timestamps_and_restarts_after_a_gap(self):
        model=FakeModel();classifier=AnkleClassifier(model)
        outputs=[]
        for i in range(130):
            result=classifier.accept({'t_ms':1000+i*21,'ax':i*.001,'ay':0,'az':1})
            if result:outputs.append(result)
        self.assertEqual(outputs[0]['reason'],'warming_up')
        self.assertTrue(any(value['label']=='jog' for value in outputs))
        self.assertTrue(all(window.shape==(100,3) for window in model.windows))
        self.assertLessEqual(model.windows[-1][-1,0],.129,'no future input can enter a window')
        result=classifier.accept({'t_ms':8000,'ax':0,'ay':0,'az':1})
        self.assertEqual(result['label'],'unknown')
        self.assertEqual(result['reason'],'sample_gap_or_invalid')
        before=len(model.windows)
        for i in range(80):classifier.accept({'t_ms':8020+i*20,'ax':0,'ay':0,'az':1})
        self.assertEqual(len(model.windows),before,'a gap requires a fresh complete window')

    def test_clock_wrap_and_invalid_samples_do_not_replay_old_activity(self):
        classifier=AnkleClassifier(FakeModel());outputs=[]
        for i in range(150):
            result=classifier.accept({'t_ms':(0xfffffff0+i*20)&0xffffffff,'ax':0,'ay':0,'az':1})
            if result:outputs.append(result)
        self.assertTrue(any(value['label']=='jog' for value in outputs))
        self.assertEqual(classifier.accept({'t_ms':4000,'ax':float('nan'),'ay':0,'az':1})['label'],'unknown')

    @unittest.skipUnless(DEFAULT_MODEL.exists(),'Train the public-data model first')
    def test_packaged_model_has_disjoint_participants_and_valid_numeric_scores(self):
        model=ActivityModel()
        split=model.metadata['split']
        self.assertFalse(set(split['train'])&set(split['test']))
        self.assertFalse(set(split['validation'])&set(split['test']))
        self.assertEqual(split['test'],[9,10])
        result=model.predict(np.tile([0,0,1.0],(100,1)))
        self.assertAlmostEqual(sum(result['scores'].values()),1,places=3)
        self.assertIn(result['label'],('still','walk','jog','run','other','unknown'))


if __name__=='__main__':unittest.main()
