"""blog/tools/gen-thumbs.py — narrow re-encodes so phones stop downloading 1080px.

`<picture>` already picks the right *format* (AVIF/WebP/JPEG, gen-variants.py).
It says nothing about *width*, so every visitor fetched the 1080px original —
which the grid then paints into a 138px box on a phone. Roughly sixty times the
pixels the screen can show, fourteen times over.

This makes 400px and 800px cuts of every gallery photo, uploads them to R2 next
to the original as `<base>-w400.avif` etc., and records what now exists in
`blog/gallery-thumbs.json`:

    { "mariia/Z52_0012-small.jpg": [400, 800], ... }

build-site.mjs reads that manifest and only then emits `srcset`. The manifest is
written AFTER a successful upload, so the built HTML can never advertise a width
R2 hasn't got — a photo missing from it simply keeps today's single-source
markup.

Run after adding or rotating a displayed photo, then rebuild and deploy:

    python blog/tools/gen-thumbs.py            # encode, upload, write manifest
    python blog/tools/gen-thumbs.py --dry-run  # show what it would do
    npm run build

Requires: Python 3 + Pillow, and wrangler logged in.
"""
import io
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SITE = "https://malaga-fotografia.com"
BUCKET = "photos"
MANIFEST = REPO / "blog" / "gallery-thumbs.json"
PAGES = ["index.html", "prices.html", "apply/index.html"]
# 400 covers a phone's two-column grid at 2x; 800 covers the 4-column desktop
# grid at 2x and the feature images. Above that the original is the right answer.
WIDTHS = [400, 800]
DRY = "--dry-run" in sys.argv


def displayed_keys() -> list[str]:
    """Every /gallery/*.jpg the built pages actually show."""
    keys: set[str] = set()
    for name in PAGES:
        page = REPO / name
        if not page.exists():
            continue
        html = page.read_text(encoding="utf-8")
        for m in re.finditer(r'src="/gallery/([A-Za-z0-9._/-]+\.jpg)"', html):
            keys.add(m.group(1))
    return sorted(keys)


def wrangler_put(key: str, local: Path, ct: str) -> tuple[bool, str]:
    r = subprocess.run(
        ["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{key}",
         "--file", str(local), "--content-type", ct, "--remote"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", shell=True)
    out = (r.stdout or "") + (r.stderr or "")
    return (r.returncode == 0 and "complete" in out.lower()), out


def main() -> int:
    keys = displayed_keys()
    if not keys:
        print("no displayed photos found -- has the site been built?", file=sys.stderr)
        return 2
    print(f"{len(keys)} photos x {len(WIDTHS)} widths"
          f"{' (dry-run)' if DRY else ''}", flush=True)

    manifest: dict[str, list[int]] = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    work = Path(tempfile.mkdtemp(prefix="mf-thumbs-"))
    ok = fail = 0
    for i, key in enumerate(keys, 1):
        base = key[:-4]
        try:
            req = urllib.request.Request(f"{SITE}/gallery/{key}",
                                         headers={"User-Agent": "Mozilla/5.0"})
            src = Image.open(io.BytesIO(
                urllib.request.urlopen(req, timeout=30).read())).convert("RGB")
        except Exception as e:
            print(f"[{i}/{len(keys)}] ERROR {key}: {type(e).__name__} {e}", file=sys.stderr)
            fail += 1
            continue

        made: list[int] = []
        for w in WIDTHS:
            if src.width <= w:
                continue  # already narrower than the cut; the original is smaller
            im = src.copy()
            im.thumbnail((w, w * 10), Image.LANCZOS)
            if DRY:
                made.append(w)
                continue
            good = True
            for ext, fmt, ct, kw in (
                ("avif", "AVIF", "image/avif", {"quality": 50}),
                ("webp", "WEBP", "image/webp", {"quality": 82, "method": 6}),
            ):
                f = work / f"o.{ext}"
                im.save(f, format=fmt, **kw)
                sent, out = wrangler_put(f"{base}-w{w}.{ext}", f, ct)
                if not sent:
                    print(f"[{i}/{len(keys)}] FAIL {base}-w{w}.{ext}\n  {out[-200:]}",
                          file=sys.stderr)
                    good = False
            if good:
                made.append(w)

        if made and len(made) == len([w for w in WIDTHS if src.width > w]):
            # Only claim a photo in the manifest when every width it needs is up.
            manifest[key] = made
            ok += 1
            print(f"[{i}/{len(keys)}] OK   {key}  {src.width}px -> {made}", flush=True)
        else:
            fail += 1
            manifest.pop(key, None)
            print(f"[{i}/{len(keys)}] PART {key} -- left out of the manifest", flush=True)

    if DRY:
        print("\ndry run -- nothing uploaded, manifest untouched")
        return 0

    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                        encoding="utf-8")
    print(f"\nwrote {MANIFEST.relative_to(REPO)} -- ok={ok} fail={fail}. "
          f"Now: npm run build")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
