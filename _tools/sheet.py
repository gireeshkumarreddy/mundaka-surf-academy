import sys, glob, os
from PIL import Image, ImageDraw, ImageOps, ImageFont
src, out = sys.argv[1], sys.argv[2]
files = sorted(f for f in glob.glob(os.path.join(src, '*', '*')) if f.lower().endswith(('.jpg', '.jpeg', '.png')))
T, cols, per = 300, 5, 20
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 16)
info = []
for i in range(0, len(files), per):
    chunk = files[i:i+per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols*T, rows*(T+24)), 'white')
    for j, f in enumerate(chunk):
        im = ImageOps.exif_transpose(Image.open(f)); w, h = im.size
        info.append(f"{os.path.basename(f)}\t{w}x{h}")
        im.thumbnail((T, T))
        x, y = (j % cols)*T, (j // cols)*(T+24)
        sheet.paste(im, (x + (T-im.width)//2, y + (T-im.height)//2))
        d = ImageDraw.Draw(sheet); d.text((x+4, y+T+2), f"{os.path.basename(f)} {w}x{h}", fill='black', font=font)
    sheet.save(f"{out}_{i//per+1}.jpg", quality=80)
print('\n'.join(info))
