"""Generate and persist all fixed scene lines for offline-fast playback."""
from pathlib import Path
import json

from kitchen_server import synthesize_tts


ROOT = Path(__file__).resolve().parent.parent


def main():
    lines = json.loads((ROOT / "coach-lines.json").read_text(encoding="utf-8"))
    total = completed = 0
    for scene in ("neon", "fridge", "toilet", "coffee"):
        for kind in ("slow", "urgent", "recover", "balance", "praise"):
            for text in lines[scene][kind]:
                total += 1
                audio = synthesize_tts(text, kind)
                completed += 1
                print(f"[{completed}/{total}] {scene}/{kind} {len(audio)} bytes", flush=True)
    print(f"CosyVoice fixed-line cache ready: {completed} files", flush=True)


if __name__ == "__main__":
    main()
