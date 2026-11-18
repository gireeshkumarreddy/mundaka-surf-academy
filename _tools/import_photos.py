"""Client photos -> web images (public/assets/img/<name>-<width>.webp). Resize only: no retouching, no colour change, never
enlarged beyond the original. Orientation from the camera (EXIF) is applied.

    ~/.local/venvs/media/bin/python3 -I _tools/import_photos.py <source.jpg> <name> [width ...]

Default widths 480 800 1200 (only those below the original width, plus the original width if it is smaller than the last).
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "img"


def export(src, name, widths=(480, 800, 1200)):
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    done = []
    for w in widths:
        if w > im.width:
            continue
        r = im if w == im.width else im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
        r.save(OUT / f"{name}-{w}.webp", "WEBP", quality=80, method=6)
        done.append(w)
    if not done or (done[-1] < widths[-1] and im.width not in done and im.width < widths[-1]):
        im.save(OUT / f"{name}-{im.width}.webp", "WEBP", quality=80, method=6)
        done.append(im.width)
    return done


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    ws = tuple(int(w) for w in sys.argv[3:]) or (480, 800, 1200)
    print(sys.argv[2], export(sys.argv[1], sys.argv[2], ws))
