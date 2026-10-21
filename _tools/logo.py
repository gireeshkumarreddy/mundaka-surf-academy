"""Lift the supplied logo (logo.jpg, artwork on black) onto a transparent background.

Run from the project root:  python -I _tools/logo.py
Outputs to public/assets/img (logo-*.webp, logo-mark-*.webp, logo.png) and public/assets (favicons).
The artwork is untouched: black becomes transparent and anti-aliased edges are un-premultiplied
against black, so the yellow and blues keep their exact colours on any background.
"""
import numpy as np
from PIL import Image

SRC = 'logo.jpg'
OUT = 'public/assets/img'
INK = (6, 24, 38)  # header/plate colour used behind the favicon mark

rgb = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
peak = rgb.max(axis=2)
alpha = np.clip((peak - 14) / (64 - 14), 0, 1)
safe = np.maximum(alpha, 1e-3)[..., None]
colour = np.clip(rgb / 255 / safe, 0, 1)
colour = np.where(alpha[..., None] >= 1, rgb / 255, colour)
rgba = np.dstack([colour, alpha])
img = Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA')

ys, xs = np.where(alpha > 0.02)
pad = 6
box = (xs.min() - pad, ys.min() - pad, xs.max() + pad + 1, ys.max() + pad + 1)
lockup = img.crop(box)
lockup.save(f'{OUT}/logo.png', optimize=True)

# the wave + surfer sit above the first fully empty row under them
rows = (alpha > 0.02).sum(axis=1)
split = next(y for y in range(ys.min() + 50, ys.max()) if rows[y] == 0)
mark = img.crop((box[0], box[1], box[2], split))
mbox = mark.getbbox()
mark = mark.crop((max(mbox[0] - pad, 0), mbox[1], mbox[2] + pad, mbox[3] + pad))


def variants(im, name, widths):
    for w in widths:
        v = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width > w else im
        v.save(f'{OUT}/{name}-{w}.webp', 'WEBP', quality=92, method=6, exact=True)


variants(lockup, 'logo', [200, 320, 640, 1076])
variants(mark, 'logo-mark', [256, 512])

# favicons: the mark centred on a rounded ink square
for size, name in ((512, 'favicon-512.png'), (192, 'favicon-192.png'), (180, 'apple-touch-icon.png'), (48, 'favicon-48.png')):
    tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    radius = round(size * 0.22)
    mask = Image.new('L', (size * 4, size * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius * 4, fill=255)
    tile.paste(Image.new('RGBA', (size, size), INK + (255,)), (0, 0), mask.resize((size, size), Image.LANCZOS))
    m = mark.copy()
    m.thumbnail((round(size * 0.86), round(size * 0.86)), Image.LANCZOS)
    tile.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    tile.save(f'public/assets/{name}', optimize=True)

print('logo', lockup.size, 'mark', mark.size, 'split at row', split)
