"""Local SSE transport shared by independent USB and BLE motion readers."""
import json
import queue
import threading
from http.server import BaseHTTPRequestHandler


class EventHub:
    def __init__(self):
        self.clients: set[queue.Queue[str]] = set()
        self.lock = threading.Lock()

    def health(self):
        raise NotImplementedError

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


class Handler(BaseHTTPRequestHandler):
    pump: EventHub

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
            self.wfile.write((json.dumps(self.pump.health()) + '\n').encode('utf-8'))
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

