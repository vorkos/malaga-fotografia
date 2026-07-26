"""blog/tools/gen-dims.py — real pixel dimensions for every lightbox photo.

The grid crops its thumbnails to a tidy ratio in CSS (`.mat--portrait img
{ aspect-ratio: 4/5; object-fit: cover }`), but the lightbox opens the **file**,
which is whatever shape it actually is — 2:3, 3:4, 4:5, 1:1. PhotoSwipe lays
its viewer out from `data-pswp-width/height` *before* the image loads, so those
must be the file's real size. Guessing one number per orientation stretched
every portrait and overflowed the viewport.

Downloads each gallery JPEG referenced by the built pages, reads its size with
Pillow, and writes `blog/gallery-dims.json`:

    { "mariia/Z52_0012-small.jpg": [1080, 1620], ... }

`build-site.mjs` reads that file and fails the build if a photo is missing, so
a new photo can't silently inherit a wrong guess.

Run it whenever you add or rotate a displayed photo, then rebuild:

    python blog/tools/gen-dims.py        # measure and write the manifest
    python blog/tools/gen-dims.py --check   # verify, change nothing, exit 1 on drift
    npm run build

Requires: Python 3 + Pillow. Reads over HTTP from the live site (same as
gen-variants.py); the build itself stays offline.
"""
import io
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SITE = "https://malaga-fotografia.com"
MANIFEST = REPO / "blog" / "gallery-dims.json"
PAGES = ["index.html", "prices.html", "apply/index.html"]
CHECK = "--check" in sys.argv


def lightbox_keys() -> list[str]:
    """Gallery paths that open in the lightbox, from the built pages.

    The `href` of a `.gallery__item`, not the `src` of its thumbnail: the
    thumbnail may one day be a smaller variant, but the file the lightbox
    shows is the one whose dimensions PhotoSwipe needs.
    """
    keys: set[str] = set()
    for name in PAGES:
        page = REPO / name
        if not page.exists():
            continue
        html = page.read_text(encoding="utf-8")
        for m in re.finditer(
                r'class="gallery__item[^"]*"\s+href="/gallery/([^"]+\.jpg)"', html):
            keys.add(m.group(1))
    return sorted(keys)


def measure(key: str) -> tuple[int, int]:
    # Cloudflare 403s urllib's default User-Agent. gen-variants.py does the
    # same thing for the same reason.
    req = urllib.request.Request(f"{SITE}/gallery/{key}",
                                 headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    with Image.open(io.BytesIO(data)) as im:
        return im.size


def main() -> int:
    keys = lightbox_keys()
    if not keys:
        print("no lightbox photos found -- has the site been built?",
              file=sys.stderr)
        return 2

    old = {}
    if MANIFEST.exists():
        old = json.loads(MANIFEST.read_text(encoding="utf-8"))

    dims: dict[str, list[int]] = {}
    failed: list[str] = []
    for key in keys:
        try:
            w, h = measure(key)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            print(f"  !! {key}: {exc}", file=sys.stderr)
            failed.append(key)
            continue
        dims[key] = [w, h]
        was = old.get(key)
        mark = " " if was == [w, h] else "*"
        shape = "landscape" if w > h else ("square" if w == h else "portrait")
        print(f" {mark} {key:44s} {w}x{h}  {shape}")

    if failed:
        print(f"\n{len(failed)} could not be measured; manifest not written.",
              file=sys.stderr)
        return 1

    if CHECK:
        if dims == old:
            print(f"\n{len(dims)} photos, manifest up to date.")
            return 0
        print("\nmanifest is stale -- run without --check", file=sys.stderr)
        return 1

    MANIFEST.write_text(json.dumps(dims, indent=2, sort_keys=True) + "\n",
                        encoding="utf-8")
    changed = sum(1 for k, v in dims.items() if old.get(k) != v)
    print(f"\nwrote {MANIFEST.relative_to(REPO)} -- {len(dims)} photos, "
          f"{changed} changed. Now: npm run build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
