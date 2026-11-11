"""Cut the two brand logos (brand/*.jpg, taken from the website brief) into web assets.

  python -I _tools/brand.py   (Pillow + numpy; writes into public/assets/img and public/assets)

Logo 1 (horizontal): the white background becomes transparent (letters and church windows too, so it sits on any
light colour). Logo 2 (circular badge): only the white outside the circle goes, so it reads as a white disc
sticker on any background. Favicons and the touch icon come from the badge.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / 'public/assets/img'
ASSETS = ROOT / 'public/assets'


def key_white(im):
    """White → transparent: alpha from how far the darkest channel is from white; colours unmultiplied."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    d = 255 - a.min(axis=2)
    alpha = np.clip((d - 10) / 38, 0, 1)
    safe = np.where(alpha > 0, alpha, 1)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None]) * 255) / safe, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8))


def key_outside(im):
    """Transparent only outside the badge circle (flood-fill from the corners), with a soft edge."""
    rgb = im.convert('RGB')
    w, h = rgb.size
    a = np.asarray(rgb).astype(np.int16)
    white = (a.min(axis=2) > 238)
    out = np.zeros((h, w), bool)
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or out[y, x] or not white[y, x]:
            continue
        out[y, x] = True
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    mask = Image.fromarray(((~out) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    res = rgb.convert('RGBA')
    res.putalpha(mask)
    return res


def trim(im, pad=0):
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    return im.crop(box)


def save_widths(im, name, widths):
    for w in widths:
        if w > im.width:
            continue
        im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(IMG / f'{name}-{w}.webp', 'WEBP', quality=92, method=6)


logo = trim(key_white(Image.open(ROOT / 'brand/logo-horizontal.jpg')), 2)
save_widths(logo, 'logo-h', [240, 360, 480, 720, 960])
# the church-and-wave mark alone (left of the thin divider line)
cols = np.asarray(logo.getchannel('A')).astype(np.float32).mean(axis=0) / 255
gap = next(x for x in range(int(logo.width * 0.25), logo.width) if cols[x] < 0.01)
icon = trim(logo.crop((0, 0, gap, logo.height)), 2)
save_widths(icon, 'logo-icon', [128, 256, 384])

badge = trim(key_outside(Image.open(ROOT / 'brand/logo-badge.jpg')), 1)
side = max(badge.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
sq.paste(badge, ((side - badge.width) // 2, (side - badge.height) // 2))
save_widths(sq, 'badge', [160, 320, 640, 960])
for size, name in [(48, 'favicon-48.png'), (192, 'favicon-192.png'), (512, 'favicon-512.png')]:
    sq.resize((size, size), Image.LANCZOS).save(ASSETS / name)
# clear badge: the exact logo with its white keyed out, for light backgrounds (footer, page headers)
clear = key_white(sq)
clear.putalpha(Image.fromarray(np.minimum(np.asarray(clear.getchannel('A')), np.asarray(sq.getchannel('A')))))
save_widths(clear, 'badge-clear', [160, 320, 640])


touch = Image.new('RGB', (180, 180), 'white')
touch.paste(sq.resize((164, 164), Image.LANCZOS), (8, 8), sq.resize((164, 164), Image.LANCZOS))
touch.save(ASSETS / 'apple-touch-icon.png')
print('logo', logo.size, 'icon', icon.size, 'badge', sq.size)
