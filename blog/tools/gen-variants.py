"""blog/tools/gen-variants.py — AVIF/WebP siblings for every displayed image.

Scans the built pages (index.html, prices.html, apply/index.html) for
`<img src="/gallery/…jpg">`, downloads each JPEG from the live site, encodes a
`.webp` (q82) and `.avif` (q50) at the same resolution, and uploads them next to
the JPEG in the `photos` R2 bucket via authenticated wrangler. The pages already
reference the variants through `<picture>` (build-site.mjs `pic()`), so run this
whenever you add/rotate a displayed photo, then redeploy.

Idempotent: always overwrites. `_worker.js` serves R2 objects with their stored
Content-Type, so no worker change is needed.

Requires: Python 3 + Pillow (`pip install pillow`), and wrangler logged in.
Usage:   python blog/tools/gen-variants.py            (all displayed images)
         python blog/tools/gen-variants.py --dry-run  (list, don't upload)
"""
import os, re, sys, subprocess, tempfile, urllib.request
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[2]  # malaga-fotografia/
SITE = "https://malaga-fotografia.com"
BUCKET = "photos"
DRY = "--dry-run" in sys.argv


def displayed_keys() -> list[str]:
    keys: set[str] = set()
    for f in ["index.html", "prices.html", "apply/index.html"]:
        html = (REPO / f).read_text(encoding="utf-8")
        for m in re.finditer(r'src="(/gallery/[A-Za-z0-9._/-]+\.jpg)"', html):
            keys.add(m.group(1).lstrip("/"))
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
    print(f"{len(keys)} displayed images{' (dry-run)' if DRY else ''}", flush=True)
    work = Path(tempfile.mkdtemp(prefix="mf-variants-"))
    ok = fail = 0
    for i, key in enumerate(keys, 1):
        base = key[:-4]
        if DRY:
            print(f"  {key} -> {base}.webp, {base}.avif")
            continue
        try:
            req = urllib.request.Request(f"{SITE}/{key}", headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=30).read()
            src = work / "src.jpg"; src.write_bytes(data)
            im = Image.open(src).convert("RGB")
            webp = work / "o.webp"; avif = work / "o.avif"
            im.save(webp, format="WEBP", quality=82, method=6)
            im.save(avif, format="AVIF", quality=50)
            rw, ow = wrangler_put(base + ".webp", webp, "image/webp")
            ra, oa = wrangler_put(base + ".avif", avif, "image/avif")
            if rw and ra:
                ok += 1
                print(f"[{i}/{len(keys)}] OK {key}  jpg={len(data)//1024}K "
                      f"webp={webp.stat().st_size//1024}K avif={avif.stat().st_size//1024}K", flush=True)
            else:
                fail += 1
                print(f"[{i}/{len(keys)}] FAIL {key}\n  {(ow if not rw else oa)[-200:]}", flush=True)
        except Exception as e:
            fail += 1
            print(f"[{i}/{len(keys)}] ERROR {key}: {type(e).__name__} {str(e)[:120]}", flush=True)
    print(f"DONE ok={ok} fail={fail}", flush=True)
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
