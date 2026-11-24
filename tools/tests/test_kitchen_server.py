"""Emotion routing, provider failures and the public HTTP boundary."""
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib import error, request

sys.path.insert(0, str(Path(__file__).parents[1]))
import kitchen_server as kitchen


def provider_result(**changes):
    value = {"emotion": "joy", "scene": "coffee", "reply": "听起来今天有一份小小的成就。", "reason": "去豆仓里庆祝一下。"}
    value.update(changes)
    return value


class RecommendationTests(unittest.TestCase):
    def test_all_six_emotions_use_fixed_foods(self):
        for emotion, (_, dish, _) in kitchen.EMOTIONS.items():
            result = kitchen.validate_recommendation(provider_result(emotion=emotion, dish=99))
            self.assertEqual(result["dish"], dish)
            self.assertEqual(result["source"], "deepseek")

    def test_rejects_unknown_and_malformed_recommendations(self):
        for changes in ({"emotion": "neutral"}, {"scene": "space"}, {"reply": ""}, {"reason": "x" * 101}, {"emotion": []}, {"scene": {}}):
            with self.subTest(changes=changes), self.assertRaises(kitchen.ApiError):
                kitchen.validate_recommendation(provider_result(**changes))

    def test_validates_input_before_provider_call(self):
        for body in ([], {}, {"text": None}, {"text": " "}, {"text": "x" * 601}):
            with self.assertRaises(kitchen.ApiError):
                kitchen.validate_text(body)
        self.assertEqual(kitchen.validate_text({"text": " 开心 "}), "开心")

    def test_provider_uses_private_auth_and_json_mode(self):
        response = io.BytesIO(json.dumps({"choices": [{"message": {"content": json.dumps(provider_result())}}]}).encode())
        with patch.object(kitchen.request, "urlopen", return_value=response) as mocked:
            result = kitchen.recommend("老板表扬我，我很开心。", {"api_key": "test-private-key", "model": "deepseek-flash"})
        call = mocked.call_args.args[0]
        self.assertEqual(call.full_url, "https://api.deepseek.com/chat/completions")
        self.assertEqual(call.get_header("Authorization"), "Bearer test-private-key")
        payload = json.loads(call.data)
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertEqual(payload["messages"][1]["content"], "老板表扬我，我很开心。")
        self.assertNotIn("test-private-key", json.dumps(result))

    def test_provider_errors_are_redacted(self):
        for code in (401, 402, 429, 500):
            exc = error.HTTPError("https://api.deepseek.com", code, "private upstream details", {}, None)
            with patch.object(kitchen.request, "urlopen", side_effect=exc), self.assertRaises(kitchen.ApiError) as caught:
                kitchen.recommend("今天心情复杂", {"api_key": "private", "model": "test"})
            self.assertNotIn("private", caught.exception.message)
        with patch.object(kitchen.request, "urlopen", side_effect=TimeoutError), self.assertRaises(kitchen.ApiError) as caught:
            kitchen.recommend("今天心情复杂", {"api_key": "private", "model": "test"})
        self.assertEqual(caught.exception.status, 504)

    def test_blank_provider_content_is_not_a_fake_success(self):
        response = io.BytesIO(b'{"choices":[{"message":{"content":"   "}}]}')
        with patch.object(kitchen.request, "urlopen", return_value=response), self.assertRaises(kitchen.ApiError) as caught:
            kitchen.recommend("今天心情复杂", {"api_key": "private", "model": "test"})
        self.assertEqual(caught.exception.status, 502)


class TtsSettingsTests(unittest.TestCase):
    def test_loads_private_dashscope_config_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "dashscope.json"
            path.write_text(json.dumps({
                "api_key": "file-private-key",
                "workspace_id": "file-workspace",
                "region": "cn-beijing",
                "voice": "longanhuan",
            }), encoding="utf-8")
            with patch.dict(os.environ, {
                "KITCHEN_TTS_CONFIG": str(path),
                "DASHSCOPE_API_KEY": "",
                "DASHSCOPE_WORKSPACE_ID": "",
                "COSYVOICE_REGION": "",
                "COSYVOICE_MODEL": "",
                "COSYVOICE_VOICE": "",
            }):
                settings = kitchen.load_tts_settings()
            self.assertEqual(settings["api_key"], "file-private-key")
            self.assertEqual(settings["workspace"], "file-workspace")
            self.assertEqual(settings["voice"], "longanhuan")

            with patch.dict(os.environ, {
                "KITCHEN_TTS_CONFIG": str(path),
                "DASHSCOPE_API_KEY": "env-private-key",
                "DASHSCOPE_WORKSPACE_ID": "env-workspace",
                "COSYVOICE_VOICE": "env-voice",
            }):
                settings = kitchen.load_tts_settings()
            self.assertEqual(settings["api_key"], "env-private-key")
            self.assertEqual(settings["workspace"], "env-workspace")
            self.assertEqual(settings["voice"], "env-voice")

    def test_tts_disk_cache_round_trip_and_separation(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(kitchen, "TTS_CACHE_DIR", Path(directory)):
                audio = b"ID3\x03\x00\x00audio"
                kitchen.store_cached_tts("cosyvoice-v3-flash", "longanhuan", "slow", "测试台词", audio)
                self.assertEqual(
                    kitchen.load_cached_tts("cosyvoice-v3-flash", "longanhuan", "slow", "测试台词"),
                    audio,
                )
                self.assertIsNone(
                    kitchen.load_cached_tts("cosyvoice-v3-flash", "longanhuan", "praise", "测试台词")
                )
                self.assertEqual(len(list(Path(directory).glob("*.mp3"))), 1)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = kitchen.create_server(0)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)
        cls.opener = request.build_opener(request.ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join()

    def fetch(self, path, body=None, headers=None):
        req = request.Request(self.base + path, data=body, headers=headers or {})
        return self.opener.open(req, timeout=2)

    def test_public_assets_work_but_private_files_are_denied(self):
        with self.fetch("/") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Cache-Control"], "no-store")
        for path in ("/.git/config", "/.hardware-runtime/foot-calibration.json", "/tools/kitchen_server.py", "/hardware/", "/.env"):
            with self.subTest(path=path), self.assertRaises(error.HTTPError) as caught:
                self.fetch(path)
            self.assertEqual(caught.exception.code, 404)

    def test_health_never_exposes_key(self):
        with patch.object(kitchen, "load_settings", return_value={"api_key": "private-key", "model": "test"}):
            with self.fetch("/api/health") as response:
                data = response.read().decode()
        self.assertTrue(json.loads(data)["configured"])
        self.assertNotIn("private-key", data)

    def test_correct_same_origin_request(self):
        expected = kitchen.validate_recommendation(provider_result())
        with patch.object(kitchen, "recommend", return_value=expected) as mocked:
            with self.fetch("/api/recommend", json.dumps({"text": "老板表扬我了"}).encode(),
                            {"Content-Type": "application/json", "Origin": self.base}) as response:
                self.assertEqual(json.load(response)["dish"], 0)
            mocked.assert_called_once_with("老板表扬我了")

    def test_coach_context_validation_and_same_origin_boundary(self):
        expected={'lines':{kind:['测试台词'] for kind in kitchen.COACH_KINDS},'source':'deepseek'}
        with patch.object(kitchen,'coach_pack',return_value=expected) as mocked:
            with self.fetch('/api/coach',b'{"scene":"coffee","emotion":"joy"}',
                            {'Content-Type':'application/json','Origin':self.base}) as response:
                self.assertEqual(json.load(response),expected)
            mocked.assert_called_once_with({'scene':'coffee','emotion':'joy'})
        for body,headers,status in [
            (b'{"scene":"coffee","emotion":"joy"}',{'Content-Type':'application/json','Origin':'https://other.example'},403),
            (b'{}',{'Content-Type':'text/plain'},415),(b'[]',{'Content-Type':'application/json'},400),
            (b'{"scene":[],"emotion":"joy"}',{'Content-Type':'application/json'},400),
            (b'{"scene":"coffee","emotion":"unknown"}',{'Content-Type':'application/json'},400),
            (b'x'*1025,{'Content-Type':'application/json'},400)]:
            with patch.object(kitchen,'coach_pack') as mocked,self.assertRaises(error.HTTPError) as caught:
                self.fetch('/api/coach',body,headers)
            self.assertEqual(caught.exception.code,status);mocked.assert_not_called()


    def test_rejects_cross_origin_and_invalid_bodies_without_calling_model(self):
        cases = [(b'{}', {"Content-Type": "application/json", "Origin": "https://other.example"}, 403),
                 (b'{}', {"Content-Type": "text/plain"}, 415),
                 (b'[]', {"Content-Type": "application/json"}, 400),
                 (b'{broken', {"Content-Type": "application/json"}, 400)]
        with patch.object(kitchen, "recommend") as mocked:
            for body, headers, status in cases:
                with self.assertRaises(error.HTTPError) as caught:
                    self.fetch("/api/recommend", body, headers)
                self.assertEqual(caught.exception.code, status)
            mocked.assert_not_called()


class CoachTests(unittest.TestCase):
    def setUp(self):
        kitchen.COACH_CACHE.clear()

    def test_ai_lines_are_cached_and_only_scene_emotion_are_sent(self):
        lines={kind:['跟着自己的节奏往前跑！','小厨师陪着你！'] for kind in kitchen.COACH_KINDS}
        response=io.BytesIO(json.dumps({'choices':[{'message':{'content':json.dumps(lines)}}]}).encode())
        settings={'api_key':'private-key','model':'test'}
        context={'scene':'coffee','emotion':'joy','raw_samples':'never send this'}
        with patch.object(kitchen.request,'urlopen',return_value=response) as mocked:
            result=kitchen.coach_pack(context,settings)
            self.assertEqual(kitchen.coach_pack(context,settings),result)
            mocked.assert_called_once()
        payload=json.loads(mocked.call_args.args[0].data)
        self.assertEqual(json.loads(payload['messages'][1]['content']),{'scene':'coffee','emotion':'joy'})
        self.assertEqual(result['source'],'deepseek')
        self.assertNotIn('private-key',json.dumps(result))

    def test_invalid_lines_missing_configuration_and_provider_timeout(self):
        valid={kind:['稳稳端好盘子！'] for kind in kitchen.COACH_KINDS}
        for value in ([],{},dict(valid,balance=['x'*41]),dict(valid,slow=['']),dict(valid,recover='文本')):
            with self.assertRaises(kitchen.ApiError):kitchen.validate_coach_lines(value)
        with self.assertRaises(kitchen.ApiError) as caught:
            kitchen.coach_pack({'scene':'coffee','emotion':'joy'},{'api_key':''})
        self.assertEqual(caught.exception.status,503)
        with patch.object(kitchen.request,'urlopen',side_effect=TimeoutError),self.assertRaises(kitchen.ApiError) as caught:
            kitchen.coach_pack({'scene':'coffee','emotion':'joy'},{'api_key':'private','model':'test'})
        self.assertEqual(caught.exception.status,504)

if __name__ == "__main__":
    unittest.main()
