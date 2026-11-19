"""Start the local V1 game and reuse/start the ESP-Iris motion bridge."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import webbrowser


def bridge_ready(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as response:
            result = json.load(response)
            return result.get("ok") is True and result.get("source") == "esp-iris"
    except (OSError, ValueError, urllib.error.URLError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-port", type=int, default=8767)
    parser.add_argument("--bridge-port", type=int, default=8766)
    parser.add_argument("--workspace", type=Path, default=Path(r"C:\esp-mosaico-vibe"))
    parser.add_argument("--project", type=Path)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if args.bridge_port != 8766:
        parser.error("The game currently uses local bridge port 8766.")
    root = Path(__file__).resolve().parent.parent
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.web_port),
                                     functools.partial(SimpleHTTPRequestHandler, directory=str(root)))
    except OSError as error:
        print(f"Cannot start V1 web server: {error}. Close the previous V1 launcher or choose --web-port.")
        return 1
    child = None
    try:
        if not bridge_ready(args.bridge_port):
            command = [sys.executable, str(root / "tools" / "imu-bridge.py"),
                       "--workspace", str(args.workspace), "--project",
                       str(args.project or args.workspace / "projects" / "kitchen_link")]
            child = subprocess.Popen(command)
        url = f"http://127.0.0.1:{args.web_port}/?esp=1"
        print(f"V1 hardware game: {url}", flush=True)
        print("Keep this window open. Ctrl+C stops this V1 server.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if child is not None and child.poll() is None:
            child.terminate()
            child.wait(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
