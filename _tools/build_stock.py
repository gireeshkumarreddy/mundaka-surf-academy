"""Export the HD stock photos (Unsplash licence — free for commercial use) as responsive WebP.

Run from the project root:  python -I _tools/build_stock.py
Sources: _source/stock/hd/<role>.jpg (downloaded from the pages listed in docs/IMAGE-CREDITS.md).
"""
import numpy as np
from PIL import Image

SRC = '_source/stock/hd'
OUT = 'public/assets/img'

# (source role, output name, widths)
STOCK = [
    ('private', 'stock-private', [560, 800, 1400, 2000]),
    ('group', 'stock-group', [560, 800, 1400, 2000]),
    ('kids', 'stock-kids', [560, 800, 1400, 2000]),
    ('courses', 'stock-courses', [560, 800, 1600, 2400]),
    ('adaptive', 'stock-adaptive', [560, 800, 1400, 2000]),
    ('adaptive-framed', 'stock-adaptive-wide', [768, 1024, 1800, 2600]),
    ('lessons-hero', 'stock-lessons-hero', [768, 1024, 1800, 2600]),
    ('plans-bg', 'stock-plans-bg', [768, 1024, 1800, 2600]),
    ('catch-bg', 'stock-catch-bg', [768, 1024, 1800, 2600]),
    ('hermitage', 'stock-hermitage', [800, 1600, 2600]),
    ('wave-tunnel', 'stock-wave-tunnel', [800, 1600, 2400]),
    ('group-women', 'stock-group-women', [768, 1024, 1800, 2600]),
    ('gaztelugatxe', 'stock-gaztelugatxe', [800, 1400, 2000]),
]


def brighten(im, curve=1.08, colour=1.08):
    """Gentle version of build_images.brighten(): these photos are already well exposed."""
    rgb = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    rgb = 1 - (1 - rgb) ** curve
    lum = (rgb * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(axis=2, keepdims=True)
    rgb = np.clip(lum + (rgb - lum) * colour, 0, 1)
    return Image.fromarray((rgb * 255).round().astype(np.uint8), 'RGB')


for role, name, widths in STOCK:
    im = brighten(Image.open(f'{SRC}/{role}.jpg'))
    for w in widths:
        v = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        v.save(f'{OUT}/{name}-{w}.webp', 'WEBP', quality=82, method=6)
    print(name, im.size, widths)
