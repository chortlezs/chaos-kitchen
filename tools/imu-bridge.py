"""Forward ESP-Iris motion log events to the browser over Server-Sent Events.

The bridge deliberately uses ``mosaico.py iris logs`` instead of opening COM6 or
COM7. ESP-Iris owns those USB interfaces and remains responsible for identity,
reconnects and project ownership.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


EVENT_RE = re.compile(r"(?:MOTION_EVENT|IMU_SAMPLE)\s+(\{.*\})")


class EventPump:
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
        self.clients: set[queue.Queue[str]] = set()
        self.lock = threading.Lock()
        self.process: subprocess.Popen[str] | None = None
        self.started_ns = time.time_ns()

    def add_client(self) -> queue.Queue[str]:
        client: queue.Queue[str] = queue.Queue(maxsize=32)
        with self.lock:
            self.clients.add(client)
        return client

    def remove_client(self, client: queue.Queue[str]) -> None:
        with self.lock:
            self.clients.discard(client)

    def broadcast(self, payload: dict) -> None:
        message = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with self.lock:
            clients = list(self.clients)
        for client in clients:
            try:
                client.put_nowait(message)
            except queue.Full:
                # A slow browser must not stop the log reader or the device.
                try:
                    client.get_nowait()
                    client.put_nowait(message)
                except queue.Empty:
                    pass

    def run(self) -> None:
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
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
        if self.process and self.process.poll() is None:
            self.process.terminate()


class Handler(BaseHTTPRequestHandler):
    pump: EventPump

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"ok":true,"source":"esp-iris"}\n')
            return
        if self.path != "/events":
            self.send_error(404)
            return
        client = self.pump.add_client()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    message = client.get(timeout=10)
                except queue.Empty:
                    self.wfile.write(b": heartbeat\n\n")
                    self.wfile.flush()
                    continue
                self.wfile.write(f"data: {message}\n\n".encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            self.pump.remove_client(client)

    def log_message(self, *_args: object) -> None:
        return


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
