"""Split a photo into sky (background) and scene (foreground) so hero text can sit between them.
usage: python skymask.py <src.jpg> <out-foreground.png>

1. rough sky = smooth pixels close to the colour at the top of the frame, connected to the top edge
2. the sky gets lighter toward the horizon, so a per-row sky colour is measured from that rough mask
3. in a band around the skyline, alpha follows each pixel's distance from its row's sky colour:
   land and the wave lip stay solid, hazy spray becomes semi-transparent
"""
import sys
import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
bgr = cv2.imread(src)
h, w = bgr.shape[:2]
lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
weights = np.array([1.0, 1.7, 1.7], np.float32)

ref = np.median(lab[: int(h * 0.05)].reshape(-1, 3), axis=0)
dist0 = np.sqrt((((lab - ref) * weights) ** 2).sum(axis=2))
gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32)
cand = ((dist0 < 26) & (grad < 20)).astype(np.uint8)
n, lbl = cv2.connectedComponents(cand)
top = set(np.unique(lbl[0:2, :])) - {0}
sky = np.isin(lbl, list(top)).astype(np.uint8)
# fill holes (birds, dust) inside the sky
n2, l2, stats, _ = cv2.connectedComponentsWithStats(1 - sky)
for i in range(1, n2):
    if stats[i, cv2.CC_STAT_AREA] < w * h * 0.001 and stats[i, cv2.CC_STAT_TOP] < h * 0.6:
        sky[l2 == i] = 1

# per-row sky colour, carried down below the last row that still has sky
row_ref = np.zeros((h, 3), np.float32)
last = ref
for y in range(h):
    m = sky[y] > 0
    if m.sum() > 40:
        last = np.median(lab[y][m], axis=0)
    row_ref[y] = last
row_ref = cv2.GaussianBlur(row_ref.reshape(h, 1, 3), (1, 0), sigmaX=0, sigmaY=6).reshape(h, 3)
dist = np.sqrt((((lab - row_ref[:, None, :]) * weights) ** 2).sum(axis=2))

boundary = cv2.morphologyEx(sky, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
band = cv2.dilate(boundary, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))) > 0
alpha = 1.0 - sky.astype(np.float32)
alpha = np.where(band, np.clip((dist - 4) / 15.0, 0, 1), alpha)
alpha = cv2.GaussianBlur(alpha, (0, 0), 0.8)

cv2.imwrite(out, np.dstack([bgr, (alpha * 255).astype(np.uint8)]))
print(out, w, h, 'sky %.1f%%' % (100 * (1 - alpha).mean()))
