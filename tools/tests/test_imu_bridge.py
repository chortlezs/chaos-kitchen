"""Regression checks for retained-log filtering and the SSE event envelope."""
import importlib.util
import io
import json
from pathlib import Path
import unittest
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))

spec = importlib.util.spec_from_file_location("imu_bridge", Path(__file__).parents[1] / "imu-bridge.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def test_only_live_complete_logs_are_forwarded(self):
        pump = bridge.EventPump("python", Path("workspace"), Path("project"))
        pump.started_ns = 100
        client = pump.add_client()
        records = ["not json\n", "null\n", "[]\n"]
        payload = {"action": "chop", "cycle": "down_up", "t_ms": 1200}
        for stamp in (50, 200):
            records.append(json.dumps({"host_receive_wall_ns": stamp, "capture_id": "boot-a", "event_id": 42,
                                       "text": "MOTION_EVENT " + json.dumps(payload)}) + "\n")
        with patch.object(bridge.subprocess, "Popen") as process:
            process.return_value.stdout = io.StringIO("".join(records))
            pump.read_once()
        event = json.loads(client.get_nowait())
        self.assertEqual(event["cycle"], "down_up")
        self.assertEqual(event["type"], "motion")
        self.assertEqual(event["event_id"], "boot-a:42")
        self.assertTrue(client.empty(), "old retained logs must not become gameplay events")

    def test_slow_browser_keeps_a_bounded_queue(self):
        pump = bridge.EventPump("python", Path("workspace"), Path("project"))
        client = pump.add_client()
        for i in range(100):
            pump.broadcast({"t_ms": i})
        self.assertEqual(client.qsize(), 32)
        self.assertEqual(json.loads(client.get_nowait())["t_ms"], 68)
        pump.remove_client(client)
        self.assertNotIn(client, pump.clients)

    def test_reader_reconnects_after_an_unexpected_end(self):
        pump = bridge.EventPump("python", Path("workspace"), Path("project"))
        with patch.object(pump, "read_once") as reader, patch.object(pump.stopped, "wait", side_effect=[False, True]):
            pump.run()
            self.assertEqual(reader.call_count, 2)


if __name__ == "__main__":
    unittest.main()
