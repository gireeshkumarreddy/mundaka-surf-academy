"""Export the Drive photos used on the site as responsive WebP files.

Run from the project root:  python -I _tools/build_images.py
Sources live in _source/drive (originals from the client's Google Drive folder).
Output goes to public/assets/img. Each entry lists the widths to export.
"""
import os
import numpy as np
from PIL import Image, ImageOps, ImageFilter

SRC = '_source/drive'
CUT = '_source/cutouts'
OUT = 'public/assets/img'
os.makedirs(OUT, exist_ok=True)

# (source, output name, widths, crop box in source pixels or None)
PHOTOS = [
    # hero (UR folder, Mundaka left with the Santa Catalina hermitage)
    ('UR/ur_40.jpg', 'hero-mundaka', [768, 1024, 1600, 2048], None),
    ('UR/ur_42.jpg', 'hero-mundaka-sq', [720, 800, 1080, 1440], None),
    # rising wave layer of the hero
    ('XABI/xabi_49.jpg', 'rise-wave', [768, 1024, 1600], None),
    # Xabier (XABI folder)
    ('XABI/xabi_78.jpg', 'mundaka-santa-catalina', [800, 1600, 2400], None),
    ('XABI/xabi_77.jpg', 'mundaka-lineup', [800, 1600, 2400], None),
    ('XABI/xabi_63.jpg', 'xabier-glassy-wall', [800, 1600], None),
    ('XABI/xabi_48.jpg', 'xabier-bottom-turn', [800, 1600], None),
    ('XABI/xabi_46.jpg', 'xabier-blue-wall', [800, 1600], None),
    ('XABI/xabi_52.jpg', 'xabier-barrel', [800, 1600], None),
    ('XABI/xabi_54.jpg', 'xabier-carve', [800, 1600], None),
    ('XABI/xabi_59.jpg', 'xabier-snap', [800, 1600], None),
    ('XABI/xabi_61.jpg', 'xabier-layback', [800, 1600], None),
    ('XABI/xabi_62.jpg', 'xabier-trim', [800, 1600], None),
    ('XABI/xabi_44.jpg', 'xabier-face', [1080], None),
    ('XABI/xabi_57.jpg', 'xabier-dark-barrel', [800, 1600], None),
    ('XABI/xabi_76.jpg', 'xabier-big-wall', [1080], None),
    ('XABI/xabi_45.jpg', 'xabier-foam-line', [800, 1600], None),
    # other surfers in the Drive folder (MIKEL, ROBERTO, UR)
    ('UR/ur_37.jpg', 'spray-backlit', [800, 1439], None),
    ('UR/ur_33.jpg', 'barrel-grey', [800, 1600], None),
    ('UR/ur_38.jpg', 'barrel-blue', [800, 1600], None),
    ('MIKEL/mikel_02.jpg', 'green-wall', [800, 1600, 2000], None),
    ('MIKEL/mikel_04.jpg', 'green-curl', [800, 1600], None),
    ('MIKEL/mikel_10.jpg', 'whitewater', [800, 1599], None),
    ('ROBERTO/roberto_31.jpg', 'walking-out', [800, 1600], None),
    ('ROBERTO/roberto_32.jpg', 'spray-turn', [800, 1600, 2000], None),
    # square detail crops for the lesson-level callouts
    ('MIKEL/mikel_10.jpg', 'level-beginner', [320, 480], (560, 330, 1160, 930)),
    ('MIKEL/mikel_04.jpg', 'level-intermediate', [320, 480], (300, 300, 900, 900)),
    ('UR/ur_33.jpg', 'level-advanced', [320, 480], (480, 330, 1080, 930)),
    # card crops (no people) for lesson types whose audience is not pictured in the Drive photos
    ('XABI/xabi_44.jpg', 'texture-wave-face', [480, 800], (0, 0, 1080, 720)),
    ('XABI/xabi_45.jpg', 'texture-foam', [800], (0, 0, 900, 1066)),
]

# transparent layers: (cutout png, source photo, output name, widths, crop to subject?)
LAYERS = [
    ('ur40_fg.png', None, 'hero-mundaka-fg', [768, 1024, 1600, 2048], False),
    ('ur42_fg.png', None, 'hero-mundaka-sq-fg', [720, 800, 1080, 1440], False),
    ('m54_isnet.png', 'XABI/xabi_54.jpg', 'xabier-cutout', [420, 640], True),
    ('m54_isnet.png', 'XABI/xabi_54.jpg', 'xabier-carve-cut', [800, 1600], False),
]


def brighten(im):
    """Bright, clean grade for every photo: lift mid-tones and shadows on a curve that keeps
    pure white and black where they are (no clipped foam), then a little more colour."""
    has_alpha = im.mode == 'RGBA'
    rgb = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    rgb = 1 - (1 - rgb) ** 1.2
    lum = (rgb * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(axis=2, keepdims=True)
    rgb = np.clip(lum + (rgb - lum) * 1.14, 0, 1)
    out = Image.fromarray((rgb * 255).round().astype(np.uint8), 'RGB')
    if has_alpha:
        out.putalpha(im.split()[-1])
    return out


def save_variants(im, name, widths):
    for w in widths:
        v = im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        if v.mode == 'RGBA':
            v.save(f'{OUT}/{name}-{w}.webp', 'WEBP', quality=82, method=6, exact=False)
        else:
            v.save(f'{OUT}/{name}-{w}.webp', 'WEBP', quality=78, method=6)
    print(name, im.size, widths)


for src, name, widths, crop in PHOTOS:
    im = ImageOps.exif_transpose(Image.open(f'{SRC}/{src}')).convert('RGB')
    if crop:
        im = im.crop(crop)
    save_variants(brighten(im), name, widths)

for cut, photo, name, widths, tight in LAYERS:
    rgba = Image.open(f'{CUT}/{cut}')
    if photo:  # rembg masks are greyscale; combine with the photo
        base = Image.open(f'{SRC}/{photo}').convert('RGB')
        mask = rgba.convert('L')
        rgba = base.copy()
        rgba.putalpha(mask)
    rgba = rgba.convert('RGBA')
    if tight:
        a = np.array(rgba.split()[-1])
        ys, xs = np.where(a > 30)
        pad = 24
        rgba = rgba.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), xs.max() + pad, ys.max() + pad))
    save_variants(brighten(rgba), name, widths)

# footer photo, warm graded with film grain (Porten reference)
im = brighten(Image.open(f'{SRC}/ROBERTO/roberto_31.jpg').convert('RGB'))
arr = np.asarray(im).astype(np.float32) / 255
warm = np.clip(arr * np.array([1.06, 1.0, 0.9]) + np.array([0.03, 0.015, 0.0]), 0, 1)
rng = np.random.default_rng(7)
grain = rng.normal(0, 0.035, arr.shape[:2])[..., None]
warm = np.clip(warm + grain, 0, 1)
save_variants(Image.fromarray((warm * 255).astype(np.uint8)), 'footer-walking-out', [800, 1600])

# flipped brush edge (ragged top) for layers that rise from below
from PIL import Image as _I
_I.open(f'{OUT}/brush-edge.webp').transpose(_I.FLIP_TOP_BOTTOM).save(f'{OUT}/brush-edge-top.webp', quality=90, alpha_quality=85, method=6)
_I.open(f'{OUT}/brush-edge-sm.webp').transpose(_I.FLIP_TOP_BOTTOM).save(f'{OUT}/brush-edge-top-sm.webp', quality=90, alpha_quality=70, method=6)
