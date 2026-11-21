"""Forward ESP-Iris motion log events to the browser over Server-Sent Events.

The bridge deliberately uses ``mosaico.py iris logs`` instead of opening COM6 or
COM7. ESP-Iris owns those USB interfaces and remains responsible for identity,
reconnects and project ownership.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path

from motion_sse import EventHub, Handler


EVENT_RE = re.compile(r"(?:MOTION_EVENT|IMU_SAMPLE)\s+(\{.*\})")


class EventPump(EventHub):
    def __init__(self, python: str, workspace: Path, project: Path) -> None:
        self.workspace = workspace
        self.command = [
            python,
            str(workspace / "mosaico.py"),
            "--json",
            "iris",
            "logs",
            "--project",
            str(project),
            "--timeout",
            "0",
            "--grep",
            "EVENT",
        ]
        super().__init__()
        self.process: subprocess.Popen[str] | None = None
        self.started_ns = time.time_ns()
        self.stopped = threading.Event()

    def run(self) -> None:
        while not self.stopped.is_set():
            self.started_ns = time.time_ns()
            try:
                self.read_once()
            except OSError as error:
                print(f"ESP log reader disconnected: {error}", flush=True)
            if self.stopped.wait(1):
                break

    def read_once(self) -> None:
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        # Boot logs can contain replacement characters; Windows GBK must not kill the reader.
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        self.process = subprocess.Popen(
            self.command,
            cwd=self.workspace,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        assert self.process.stdout is not None
        for line in self.process.stdout:
            try:
                record = json.loads(line)
                text = record.get("text", "") if isinstance(record, dict) else ""
            except json.JSONDecodeError:
                continue
            if not isinstance(record, dict):
                continue
            # Iris initially replays retained logs; only forward new live gestures.
            received_ns = record.get("host_receive_wall_ns", record.get("host_receive_ns", 0))
            if not isinstance(received_ns, int) or received_ns < self.started_ns:
                continue
            match = EVENT_RE.search(str(text))
            if not match:
                continue
            try:
                event = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
            event["type"] = "motion" if "action" in event else "sample"
            event["sent_at_ms"] = time.time_ns() // 1000000
            event["boot_id"] = str(record.get("boot_id") or record.get("capture_id") or "unknown")
            event["event_id"] = f"{event['boot_id']}:{record.get('event_id', event.get('t_ms'))}"
            self.broadcast(event)

    def stop(self) -> None:
        self.stopped.set()
        if self.process and self.process.poll() is None:
            self.process.terminate()

    def health(self) -> dict:
        return {"ok": True, "source": "esp-iris"}



def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path(r"C:\esp-mosaico-vibe"))
    parser.add_argument("--project", type=Path, default=Path(r"C:\esp-mosaico-vibe\projects\kitchen_link"))
    parser.add_argument("--python", default=os.environ.get("MOSAICO_PYTHON", sys.executable))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()

    pump = EventPump(args.python, args.workspace.resolve(), args.project.resolve())
    Handler.pump = pump
    threading.Thread(target=pump.run, name="iris-log-reader", daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"IMU bridge listening at http://{args.host}:{args.port}/events", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        pump.stop()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
