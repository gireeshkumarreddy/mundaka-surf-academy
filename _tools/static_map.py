"""Static map preview of the shop (no cookies, no third-party request when a visitor opens the page).

Builds public/assets/img/map-mundaka-<w>.webp from OpenStreetMap tiles around site.config.json -> brand.geo, centred on
the point, so the page can show a real map before the visitor agrees to load Google Maps. Run once, by hand, when the
address changes:  ~/.local/venvs/media/bin/python3 -I _tools/static_map.py

OpenStreetMap: data (c) OpenStreetMap contributors, ODbL; the page shows that credit on the image. Fetching ~25 tiles once
is within the tile usage policy (no bulk download); tiles are cached in _source/map-tiles so re-runs fetch nothing.
"""
import io
import json
import math
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ZOOM = 17          # streets and the port readable; shown at half size, so sharp on phones
SIZE = 1200        # square crop (the box is 4:3 on computers, 1:1 on phones; the point stays in the centre)
WIDTHS = (600, 900, 1200)
UA = "MundakaSurfAcademySite-static-map/1.0 (one-off build of a preview image)"

geo = json.loads((ROOT / "site.config.json").read_text())["brand"]["geo"]
lat, lng = geo["lat"], geo["lng"]
n = 2 ** ZOOM
px = (lng + 180) / 360 * n * 256
py = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n * 256
x0, y0 = px - SIZE / 2, py - SIZE / 2
tx0, ty0 = int(x0 // 256), int(y0 // 256)
tx1, ty1 = int((x0 + SIZE) // 256), int((y0 + SIZE) // 256)

cache = ROOT / "_source" / "map-tiles"
cache.mkdir(parents=True, exist_ok=True)
canvas = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256), "white")
fetched = 0
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        f = cache / f"{ZOOM}-{tx}-{ty}.png"
        if not f.exists():
            req = urllib.request.Request(f"https://tile.openstreetmap.org/{ZOOM}/{tx}/{ty}.png", headers={"User-Agent": UA})
            f.write_bytes(urllib.request.urlopen(req, timeout=30).read())
            fetched += 1
            time.sleep(0.3)
        canvas.paste(Image.open(io.BytesIO(f.read_bytes())).convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))

ox, oy = round(x0 - tx0 * 256), round(y0 - ty0 * 256)
crop = canvas.crop((ox, oy, ox + SIZE, oy + SIZE))
out = ROOT / "public" / "assets" / "img"
for w in WIDTHS:
    img = crop if w == SIZE else crop.resize((w, w), Image.LANCZOS)
    img.save(out / f"map-mundaka-{w}.webp", "WEBP", quality=84, method=6)
print(f"tiles {tx1 - tx0 + 1}x{ty1 - ty0 + 1} (fetched {fetched}), centre {lat},{lng} -> map-mundaka-{{{','.join(map(str, WIDTHS))}}}.webp")
