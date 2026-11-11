"""Web variants of the Higgsfield-enhanced main photos (4K upscales in _source/enhance, made by run.sh there).

  python -I _tools/build_enhanced.py

Each name keeps its old file name, so pages need no change; a light tone lift (a touch of colour and contrast)
is applied after the upscale. Widths 768-3200 cover phones to 4K screens.

People are never AI-altered: the upscaler redraws faces, so the area around each surfer (PROTECT, relative
boxes) is put back from the original photo (plain resampling) with a soft edge. Add a box when a new photo
with a recognisable person goes through the upscaler.
"""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter

PROTECT = {
    'mundaka-lineup': [(0.43, 0.47, 0.54, 0.68)],
    'mundaka-santa-catalina': [(0.56, 0.54, 0.67, 0.73)],
    'stock-catch-bg': [(0.36, 0.37, 0.48, 0.61)],
}

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / '_source/enhance'
IMG = ROOT / 'public/assets/img'
WIDTHS = [768, 1200, 1600, 2400, 3200]
# phone crops (<name>-m): portrait frames centred on the subject, so phones get a sharp, well-framed photo
# instead of a thin slice of the wide one. (centre x, width / height)
MOBILE = {
    'mundaka-lineup': (0.47, 0.6),
    'mundaka-santa-catalina': (0.6, 0.82),
    'stock-wave-tunnel': (0.5, 0.82),
    'stock-catch-bg': (0.44, 0.82),
}
MOBILE_WIDTHS = [600, 900, 1200]

for f in sorted(SRC.glob('*-4k.*')):
    name = f.name.split('-4k.')[0]
    im = Image.open(f).convert('RGB')
    if name in PROTECT:
        orig = Image.open(SRC / f'{name}-in.jpg').convert('RGB').resize(im.size, Image.LANCZOS)
        mask = Image.new('L', im.size, 0)
        draw = ImageDraw.Draw(mask)
        for x0, y0, x1, y1 in PROTECT[name]:
            draw.rounded_rectangle((x0 * im.width, y0 * im.height, x1 * im.width, y1 * im.height), radius=60, fill=255)
        im = Image.composite(orig, im, mask.filter(ImageFilter.GaussianBlur(28)))
    im = ImageEnhance.Color(im).enhance(1.05)
    im = ImageEnhance.Contrast(im).enhance(1.025)
    for old in IMG.glob(f'{name}-*.webp'):
        if old.stem.rsplit('-', 1)[1].isdigit():
            old.unlink()
    for w in WIDTHS:
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(IMG / f'{name}-{w}.webp', 'WEBP', quality=80 if w >= 2400 else 82, method=6)
    if name in MOBILE:
        cx, ar = MOBILE[name]
        w = round(im.height * ar)
        x0 = min(max(0, round(cx * im.width - w / 2)), im.width - w)
        crop = im.crop((x0, 0, x0 + w, im.height))
        for old in IMG.glob(f'{name}-m-*.webp'):
            old.unlink()
        for mw in MOBILE_WIDTHS:
            crop.resize((mw, round(crop.height * mw / crop.width)), Image.LANCZOS).save(IMG / f'{name}-m-{mw}.webp', 'WEBP', quality=82, method=6)
    print(name, im.size)
