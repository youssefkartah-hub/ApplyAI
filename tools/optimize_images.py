#!/usr/bin/env python3
"""Make fast-loading WebP copies of every photo in media-src/.

Keep your original photos in media-src/ (they are not published). Run:

    python3 tools/optimize_images.py

For each photo.jpg it writes docs/assets/media/photo-720.webp, photo-1440.webp
(smaller sizes only if the original is smaller) and records the sizes in
content/media.json. build.mjs reads that file to write responsive <img> tags.

The 30 room frames for the Roomly viewer come from media-src/orbit/ and go to
docs/assets/media/orbit/00.webp ... 29.webp.

Needs Pillow:  pip install pillow
"""
import json
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is missing. Install it with:  pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "media-src"
OUT = ROOT / "docs" / "assets" / "media"
MANIFEST = ROOT / "content" / "media.json"
WIDTHS = [720, 1440]


def newer(out, src):
    return out.exists() and out.stat().st_mtime >= src.stat().st_mtime


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for src in sorted(SRC.iterdir()):
        if src.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            w, h = im.size
            widths = [x for x in WIDTHS if x < w] + [w if w <= WIDTHS[-1] else WIDTHS[-1]]
            widths = sorted(set(widths))
            for tw in widths:
                out = OUT / f"{src.stem}-{tw}.webp"
                if newer(out, src):
                    continue
                th = round(h * tw / w)
                im.resize((tw, th), Image.LANCZOS).save(out, "WEBP", quality=80, method=6)
                print(f"wrote {out.name}")
        top = widths[-1]
        manifest[src.stem] = {"w": top, "h": round(h * top / w), "widths": widths}

    orbit = SRC / "orbit"
    if orbit.is_dir():
        (OUT / "orbit").mkdir(exist_ok=True)
        for i, src in enumerate(sorted(orbit.glob("*.jpg"))):
            out = OUT / "orbit" / f"{i:02d}.webp"
            if newer(out, src):
                continue
            with Image.open(src) as im:
                im.convert("RGB").save(out, "WEBP", quality=74, method=6)
            print(f"wrote orbit/{out.name}")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"updated {MANIFEST.relative_to(ROOT)} ({len(manifest)} images)")


if __name__ == "__main__":
    main()
