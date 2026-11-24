"""DeepSeek sees bounded summaries, never raw IMU data or movement authority."""
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).parents[1]))
import kitchen_server as kitchen


def context(**changes):
    value={'scene':'coffee','emotion':'joy','stage':'map','event':'slow','activity':'walk',
           'confidence':.82,'cadence':55,'baseline':90,'seconds':60}
    value.update(changes);return value


class AssessmentTests(unittest.TestCase):
    def setUp(self):kitchen.ANKLE_CACHE.clear()

    def test_quality_and_evidence_gates_do_not_call_the_provider(self):
        for change in ({'activity':'unknown'},{'activity':'other'},{'confidence':.5},
                       {'cadence':90},{'event':'recover','cadence':55}):
            with patch.object(kitchen.request,'urlopen') as provider:
                result=kitchen.assess_ankle(context(**change))
            provider.assert_not_called();self.assertEqual(result['decision'],'quiet')
            self.assertEqual(result['source'],'quality_gate')

    def test_only_allowed_summary_fields_are_sent_and_cache_avoids_repeat_calls(self):
        response=io.BytesIO(json.dumps({'choices':[{'message':{'content':json.dumps({
            'decision':'speak','text':'咖啡还等着你，找回刚才的节奏！'})}}]}).encode())
        with patch.object(kitchen.request,'urlopen',return_value=response) as provider:
            result=kitchen.assess_ankle(context(raw_samples=[1,2,3]),{'api_key':'private','model':'test'})
            self.assertEqual(result,kitchen.assess_ankle(context(),{'api_key':'private','model':'test'}))
        provider.assert_called_once()
        payload=json.loads(provider.call_args.args[0].data)
        self.assertNotIn('raw_samples',payload['messages'][1]['content'])
        self.assertNotIn('private',json.dumps(result))
        self.assertEqual(result['source'],'deepseek');self.assertEqual(result['kind'],'slow')

    def test_invalid_enums_nonfinite_values_and_hand_stages_are_rejected(self):
        for change in ({'confidence':float('nan')},{'confidence':True},{'stage':'wok'},
                       {'event':'balance'},{'activity':'fall'},{'baseline':0},{'seconds':181}):
            with self.subTest(change=change),self.assertRaises(kitchen.ApiError):
                kitchen.validate_ankle_context(context(**change))

    def test_invalid_provider_output_and_timeouts_are_not_fake_success(self):
        for value in ({'decision':'accelerate'},{'decision':'speak','text':'x'*41},[]):
            response=io.BytesIO(json.dumps({'choices':[{'message':{'content':json.dumps(value)}}]}).encode())
            with patch.object(kitchen.request,'urlopen',return_value=response),self.assertRaises(kitchen.ApiError):
                kitchen.assess_ankle(context(),{'api_key':'private','model':'test'})
        with patch.object(kitchen.request,'urlopen',side_effect=TimeoutError),self.assertRaises(kitchen.ApiError) as caught:
            kitchen.assess_ankle(context(),{'api_key':'private','model':'test'})
        self.assertEqual(caught.exception.status,504)


if __name__=='__main__':unittest.main()
