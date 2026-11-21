"""Start the local V1 game and reuse/start the ESP-Iris motion bridge."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import urllib.error
import urllib.request
import webbrowser


def bridge_ready(port, transport='usb'):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as response:
            result = json.load(response)
            expected = 'ble' if transport == 'ble' else 'esp-iris'
            if result.get('ok') is True and result.get('source') != expected:
                raise RuntimeError('Port 8766 is using another transport. Stop the previous hardware launcher first.')
            return result.get("ok") is True and result.get("source") == expected
    except (OSError, ValueError, urllib.error.URLError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-port", type=int, default=8767)
    parser.add_argument("--bridge-port", type=int, default=8766)
    parser.add_argument("--workspace", type=Path, default=Path(r"C:\esp-mosaico-vibe"))
    parser.add_argument("--project", type=Path)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument('--transport', choices=('usb', 'ble'), default='usb')
    parser.add_argument('--device-mac', help='Select the BLE board by its Wi-Fi MAC')
    args = parser.parse_args()
    if args.bridge_port != 8766:
        parser.error("The game currently uses local bridge port 8766.")
    if args.transport == 'ble':
        try:
            import bleak  # noqa: F401
        except ImportError:
            parser.error('Install BLE dependencies: python -m pip install -r tools/requirements-ble.txt')
    try:
        reuse_bridge = bridge_ready(args.bridge_port, args.transport)
    except RuntimeError as error:
        parser.error(str(error))
    root = Path(__file__).resolve().parent.parent
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.web_port),
                                     functools.partial(SimpleHTTPRequestHandler, directory=str(root)))
    except OSError as error:
        print(f"Cannot start V1 web server: {error}. Close the previous V1 launcher or choose --web-port.")
        return 1
    child = None
    server.daemon_threads = True
    try:
        if not reuse_bridge:
            command = [sys.executable, str(root / "tools" / "imu-bridge.py"),
                       "--workspace", str(args.workspace), "--project",
                       str(args.project or args.workspace / "projects" / "kitchen_link")]
            if args.transport == 'ble':
                command = [sys.executable, str(root / 'tools' / 'ble-bridge.py')]
                if args.device_mac:
                    command += ['--device-mac', args.device_mac]
            child = subprocess.Popen(command, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0)
        url = f"http://127.0.0.1:{args.web_port}/neon-chaos-kitchen.html?scene=toilet&esp=1"
        print(f"V1 hardware game: {url}", flush=True)
        print(f"Transport: {args.transport}. Keep this window open. Ctrl+C stops this V1 server.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if child is not None and child.poll() is None:
            try:
                if os.name == 'nt':
                    child.send_signal(signal.CTRL_BREAK_EVENT)
                else:
                    child.send_signal(signal.SIGINT)
                child.wait(timeout=24)
            except (OSError, subprocess.TimeoutExpired):
                child.terminate()
                child.wait(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
