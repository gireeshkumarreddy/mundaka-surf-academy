"""Turn a recorded tour (_tools/record.mjs) into a constant-frame-rate MP4 with a drawn mouse pointer and click pulses.

Run from the project root:
    python -I _tools/assemble_tour.py <tour-dir> <out.mp4> [--duration 50] [--fps 30]

The recording is stretched or squeezed uniformly to --duration seconds. Each output frame shows the captured frame
nearest in time; the pointer is drawn where the mouse was at that moment (headless capture has no pointer of its own).
"""
import argparse
import bisect
import io
import json
import os
import subprocess

from PIL import Image, ImageDraw, ImageFilter

FFMPEG = os.path.abspath('video/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe')
W, H = 1920, 1080
YELLOW = (251, 222, 4)

ap = argparse.ArgumentParser()
ap.add_argument('tour')
ap.add_argument('out')
ap.add_argument('--duration', type=float, default=50)
ap.add_argument('--fps', type=int, default=30)
args = ap.parse_args()

frames = json.load(open(os.path.join(args.tour, 'frames.json')))
mouse = json.load(open(os.path.join(args.tour, 'mouse.json')))
frame_t = [t for _, t in frames]
mouse_t = [m[0] for m in mouse]
clicks = [m[0] for m in mouse if m[3]]
total = frame_t[-1]
scale = total / args.duration


def pointer(size=1.6):
    """Classic arrow pointer, white with a dark outline and soft shadow, drawn 4x and scaled down for smooth edges."""
    s = 4 * size
    pts = [(0, 0), (0, 17), (4.2, 13.2), (7, 19.6), (9.6, 18.5), (6.9, 12.3), (12.4, 12.3)]
    pts = [(2 + x * s, 2 + y * s) for x, y in pts]
    big = Image.new('RGBA', (int(16 * s), int(24 * s)), (0, 0, 0, 0))
    shadow = Image.new('RGBA', big.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).polygon([(x + 1.5 * s, y + 2 * s) for x, y in pts], fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(2 * s))
    big.alpha_composite(shadow)
    d = ImageDraw.Draw(big)
    d.polygon(pts, fill=(255, 255, 255, 255), outline=(20, 20, 20, 255), width=int(1.4 * s))
    return big.resize((big.width // 4, big.height // 4), Image.LANCZOS)


POINTER = pointer()


def mouse_at(t):
    i = bisect.bisect_right(mouse_t, t)
    if i == 0:
        return mouse[0][1], mouse[0][2]
    if i >= len(mouse):
        return mouse[-1][1], mouse[-1][2]
    a, b = mouse[i - 1], mouse[i]
    k = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
    return a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k


def pulse(age):
    """Yellow ring that grows and fades after a click (age in seconds of tour time)."""
    p = age / 0.5
    r = 10 + 30 * (1 - (1 - p) ** 3)
    size = 96
    big = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    c = size * 2
    d = ImageDraw.Draw(big)
    d.ellipse([c - r * 4, c - r * 4, c + r * 4, c + r * 4], outline=YELLOW + (int(235 * (1 - p)),), width=18)
    return big.resize((size, size), Image.LANCZOS)


def nearest(t):
    i = bisect.bisect_left(frame_t, t)
    if i == 0:
        return 0
    if i >= len(frame_t):
        return len(frame_t) - 1
    return i if frame_t[i] - t < t - frame_t[i - 1] else i - 1


n_out = round(args.duration * args.fps)
# the bundled ffmpeg has no raw-video input, so frames go through the pipe as BMP images
cmd = [FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'bmp', '-framerate', str(args.fps),
       '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
       '-profile:v', 'high', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
       '-movflags', '+faststart', args.out]
enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
cache = (None, None)
for n in range(n_out):
    t = n / args.fps * scale
    idx = nearest(t)
    if cache[0] != idx:
        base = Image.open(os.path.join(args.tour, 'frames', frames[idx][0])).convert('RGBA')
        if base.size != (W, H):
            base = base.resize((W, H), Image.LANCZOS)
        cache = (idx, base)
    img = cache[1].copy()
    for tc in clicks:
        if 0 <= t - tc < 0.5:
            ring = pulse(t - tc)
            mx, my = mouse_at(tc)
            img.alpha_composite(ring, (int(mx - ring.width / 2), int(my - ring.height / 2)))
    x, y = mouse_at(t)
    if -40 < x < W and -40 < y < H:
        px, py = int(round(x)) - 2, int(round(y)) - 2
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        layer.paste(POINTER, (px, py))
        img.alpha_composite(layer)
    buf = io.BytesIO()
    img.convert('RGB').save(buf, 'BMP')
    enc.stdin.write(buf.getvalue())
    if n % 300 == 0:
        print(f'{n}/{n_out}', flush=True)
enc.stdin.close()
enc.wait()
print('done', args.out, f'{n_out} frames, {args.duration:.1f} s, recording squeezed {scale:.3f}x')
