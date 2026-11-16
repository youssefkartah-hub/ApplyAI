#!/usr/bin/env python3
"""Make fast-loading copies of every photo in docs/assets/media.

Run this after adding or replacing a .jpg or .png there:

    python3 tools/optimize_images.py

For each image it writes WebP copies at a few widths next to the original
(photo.jpg -> photo-640.webp, photo-1000.webp, ...) and records the sizes in
content/media.json. build.mjs reads that file to write responsive <picture>
tags. Needs Pillow:  pip install pillow
"""
import json
import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is missing. Install it with:  pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent
MEDIA = ROOT / "docs" / "assets" / "media"
MANIFEST = ROOT / "content" / "media.json"
WIDTHS = [640, 1000, 1600]
SKIP_PREFIXES = ("og-",)  # social preview images are used as-is


def main():
    manifest = {}
    for src in sorted(MEDIA.iterdir()):
        if src.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        if src.name.startswith(SKIP_PREFIXES):
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            w, h = im.size
            widths = [x for x in WIDTHS if x < w] + [w]
            for tw in widths:
                out = MEDIA / f"{src.stem}-{tw}.webp"
                if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
                    continue
                th = round(h * tw / w)
                im.resize((tw, th), Image.LANCZOS).save(out, "WEBP", quality=80, method=6)
                print(f"wrote {out.name}")
        manifest[src.name] = {"w": w, "h": h, "webp": widths}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"updated {MANIFEST.relative_to(ROOT)} ({len(manifest)} images)")


if __name__ == "__main__":
    main()
