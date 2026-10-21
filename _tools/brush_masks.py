"""Generate dry-brush edge masks (white = visible) used as CSS mask-image.

brush-edge.webp  : wide strip, opaque at the top, ragged brushed edge toward the bottom
brush-frame.webp : square, opaque centre with brushed edges on all sides
"""
import numpy as np
import cv2
from PIL import Image

OUT = 'public/assets/img'
rng = np.random.default_rng(11)


def as_mask(a):
    """White pixels whose alpha carries the mask, so CSS mask-image works in alpha mode."""
    al = Image.fromarray((a * 255).astype(np.uint8), 'L')
    return Image.merge('LA', (Image.new('L', al.size, 255), al))


def streak_noise(h, w, sx, sy):
    small = rng.random((max(h // sy, 2), max(w // sx, 2))).astype(np.float32)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)


def smooth_line(n, scale, amp):
    pts = rng.random(n // scale + 3).astype(np.float32)
    line = cv2.resize(pts.reshape(1, -1), (n, 1), interpolation=cv2.INTER_CUBIC)[0]
    return (line - 0.5) * 2 * amp


# horizontal strip: edge wanders around 55% height, horizontal dry-brush streaks below it
H, W = 360, 2000
y = np.arange(H, dtype=np.float32)[:, None]
edge = H * 0.42 + smooth_line(W, 160, H * 0.18) + smooth_line(W, 18, H * 0.05)
dist = (y - edge[None, :]) / (H * 0.32)  # <0 inside, >0 outside
streaks = 0.6 * streak_noise(H, W, 90, 3) + 0.4 * streak_noise(H, W, 25, 2)
alpha = np.clip(1.0 - dist * 1.6 - (streaks - 0.5) * 1.5, 0, 1)
alpha = np.where(alpha > 0.5, np.clip(alpha * 1.4, 0, 1), alpha * 0.35)
specks = (rng.random((H, W)) > 0.9975) & (dist < 1.4) & (dist > 0.2)
alpha = np.maximum(alpha, cv2.dilate(specks.astype(np.float32), np.ones((3, 3), np.uint8)) * 0.9)
alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
alpha[:8] = 1
as_mask(alpha).save(f'{OUT}/brush-edge.webp', quality=90, alpha_quality=85, method=6)

# square frame with brushed edges on every side
S = 1000
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
m = np.ones((S, S), np.float32)
for side in range(4):
    line = S * 0.09 + smooth_line(S, 120, S * 0.05) + smooth_line(S, 14, S * 0.012)
    coord = [yy, S - 1 - yy, xx, S - 1 - xx][side]
    along = [xx, xx, yy, yy][side].astype(int)
    d = (line[along] - coord) / (S * 0.06)  # >0 outside the frame
    st = streak_noise(S, S, 70, 3) if side < 2 else streak_noise(S, S, 3, 70)
    m = np.minimum(m, np.clip(1.0 - d * 1.5 - (st - 0.5) * 1.6, 0, 1))
m = np.where(m > 0.5, np.clip(m * 1.4, 0, 1), m * 0.3)
m = cv2.GaussianBlur(m, (0, 0), 0.7)
as_mask(m).save(f'{OUT}/brush-frame.webp', quality=90, alpha_quality=85, method=6)
print('brush masks written')
