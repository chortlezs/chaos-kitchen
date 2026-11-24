"""Start the local V1 game and reuse/start the ESP-Iris motion bridge."""
import argparse
from kitchen_server import create_server
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
    parser.add_argument('--foot', action='store_true', help='Enable calibrated ankle jogging and fixed routes')
    parser.add_argument('--foot-calibration', type=Path)
    args = parser.parse_args()
    if args.bridge_port != 8766:
        parser.error("The game currently uses local bridge port 8766.")
    if args.transport == 'ble' or args.foot:
        try:
            import bleak  # noqa: F401
        except ImportError:
            parser.error('Install BLE dependencies: python -m pip install -r tools/requirements-ble.txt')
    try:
        reuse_bridge = bridge_ready(args.bridge_port, args.transport)
    except RuntimeError as error:
        parser.error(str(error))
    root = Path(__file__).resolve().parent.parent
    foot_profile = args.foot_calibration or root / '.hardware-runtime' / 'foot-calibration.json'
    reuse_foot = False
    if args.foot:
        try:
            from ankle_classifier import ActivityModel
            ActivityModel()
        except (ImportError, OSError, ValueError) as error:
            parser.error('Ankle AI model unavailable. Install tools/requirements-ankle.txt and run tools/train_ankle_model.py. '+str(error))
        if not foot_profile.is_file():
            parser.error('Ankle calibration missing: supply --foot-calibration <profile.json>.')
        profile = json.loads(foot_profile.read_text(encoding='utf-8'))
        try:
            with urllib.request.urlopen('http://127.0.0.1:8768/health', timeout=2) as response:
                health = json.load(response)
            if health.get('source') != 'xiao-ble' or health.get('calibration_identity') != profile.get('identity'):
                parser.error('Port 8768 is occupied by a different sensor bridge.')
            if health.get('pace_protocol') != 1:
                parser.error('Foot bridge is outdated. Close the previous foot/game launcher and restart to enable motion feedback.')
            if health.get('activity_protocol') != 1 or not health.get('classifier_ready'):
                parser.error('Foot AI receiver is outdated or has no model. Close the previous foot/game launcher and restart.')
            reuse_foot = True
        except (OSError, ValueError, urllib.error.URLError):
            pass
    try:
        server = create_server(args.web_port, root)
    except OSError as error:
        print(f"Cannot start V1 web server: {error}. Close the previous V1 launcher or choose --web-port.")
        return 1
    children = []
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
            children.append(subprocess.Popen(command, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0))
        if args.foot and not reuse_foot:
            children.append(subprocess.Popen([sys.executable,str(root/'tools'/'foot-bridge.py'),
                '--calibration',str(foot_profile)],creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0))
        url = f"http://127.0.0.1:{args.web_port}/?esp=1"
        if args.foot:
            url += '&foot=1'
        print(f"V1 hardware game: {url}", flush=True)
        print(f"Transport: {args.transport}. Keep this window open. Ctrl+C stops this V1 server.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        for child in children:
            if child.poll() is None:
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
