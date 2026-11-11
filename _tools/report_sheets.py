"""Before/after sheets for the redesign report (_qa/report). python -I _tools/report_sheets.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / '_qa'
OUT = QA / 'report'
F = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font, small = ImageFont.truetype(F, 26), ImageFont.truetype(F, 17)
DEEP, TURQ = (0, 74, 92), (48, 203, 198)


def tag(d, x, y, text, before):
    tw = d.textlength(text, font=small)
    d.rectangle((x + 8, y + 8, x + 20 + tw, y + 33), fill=DEEP if before else TURQ)
    d.text((x + 14, y + 11), text, fill='white' if before else DEEP, font=small)


# 1. pages: same view before and after
pairs = [
    ('Inicio — hero con Logo 1, Reservar + WhatsApp, foto principal del documento', 'before/desktop/01.jpg', 'after/desktop/02.jpg'),
    ('Inicio — clases: 3 tarjetas con precio «desde»', 'before/desktop/04.jpg', 'after/desktop/06.jpg'),
    ('Clases — Privadas / Grupo / Avanzado-Técnico con tablas de precios', 'before/desktop/08.jpg', 'after/desktop/14.jpg'),
    ('Nuestra historia', 'before/desktop/05.jpg', 'after/desktop/09.jpg'),
    ('Planes → Reservar: depósito 15 % online, 85 % en la escuela', 'before/desktop/11.jpg', 'after/desktop/17.jpg'),
    ('Ubicación → Surf y tiempo: Windguru + AEMET integrados', 'before/desktop/12.jpg', 'after/desktop/19.jpg'),
    ('Contacto', 'before/desktop/14.jpg', 'after/desktop/22.jpg'),
    ('Inicio — mapa de Google en Erreka 6 + «Cómo llegar»', 'before/desktop/13.jpg', 'after/desktop/04.jpg'),
]
W, pw = 1830, 430
ph = round(pw * 900 / 1440)
rows = (len(pairs) + 1) // 2
sheet = Image.new('RGB', (W, 80 + rows * (ph + 56)), 'white')
d = ImageDraw.Draw(sheet)
d.text((30, 24), 'Web Mundaka Surf Academy — antes / después', fill=DEEP, font=font)
for i, (label, a, b) in enumerate(pairs):
    x = 30 + (i % 2) * (2 * pw + 50)
    y = 80 + (i // 2) * (ph + 56)
    d.text((x, y), label, fill=DEEP, font=small)
    for j, (p, before) in enumerate([(a, True), (b, False)]):
        sheet.paste(Image.open(QA / p).convert('RGB').resize((pw, ph)), (x + j * (pw + 8), y + 26))
        tag(d, x + j * (pw + 8), y + 26, 'ANTES' if before else 'DESPUÉS', before)
sheet.save(OUT / '01-web-antes-despues.jpg', quality=84)

# 2. new pages (did not exist before) + phone views
new = [('Instructores (4 fichas)', 'after/desktop/12.jpg'), ('Galería con filtro', 'after/desktop/20.jpg'), ('FAQ', 'after/desktop/21.jpg'),
       ('Condiciones de reserva', 'after/desktop/23.jpg'), ('Información práctica', 'after/desktop/15.jpg'), ('Inglés (/en/)', 'after/desktop/24.jpg'),
       ('Previsión en Inicio', 'after/desktop/05.jpg'), ('Opiniones (modo revisión)', 'after/desktop/07.jpg'), ('Pie con Logo 2', 'after/desktop/08.jpg')]
cols, nw = 3, 576
nh = round(nw * 900 / 1440)
mob = sorted((QA / 'after/mobile').glob('*.jpg'))[:6]
mw, mh = 280, round(280 * 844 / 390)
H = 80 + 3 * (nh + 40) + 50 + mh + 20
sheet = Image.new('RGB', (W, H), 'white')
d = ImageDraw.Draw(sheet)
d.text((30, 24), 'Páginas nuevas (no existían) y vista móvil', fill=DEEP, font=font)
for i, (label, p) in enumerate(new):
    x, y = 30 + (i % cols) * (nw + 15), 80 + (i // cols) * (nh + 40)
    d.text((x, y), label, fill=DEEP, font=small)
    sheet.paste(Image.open(QA / p).convert('RGB').resize((nw, nh)), (x, y + 24))
y = 80 + 3 * (nh + 40) + 10
d.text((30, y), 'Móvil (390 px)', fill=DEEP, font=small)
for i, p in enumerate(mob):
    sheet.paste(Image.open(p).convert('RGB').resize((mw, mh)), (30 + i * (mw + 10), y + 30))
sheet.save(OUT / '03-paginas-nuevas-y-movil.jpg', quality=84)
print('ok')

# 3. the enhanced main photos: whole image + the same detail at 100 %
photos = [('mundaka-lineup', 'Hero (Inicio)', True, (0.30, 0.40)), ('mundaka-santa-catalina', 'Nuestra historia (hero)', True, (0.08, 0.12)),
          ('stock-hermitage', 'Nuestra historia (foto)', False, (0.45, 0.38)), ('stock-wave-tunnel', 'Clases (hero)', False, (0.45, 0.35)),
          ('stock-catch-bg', 'Surf y tiempo (hero)', True, (0.12, 0.70))]
fw = 520
rows = []
for n, label, person, (cx, cy) in photos:
    old = Image.open(OUT / f'old-{n}.webp').convert('RGB')
    new = Image.open(ROOT / f'public/assets/img/{n}-3200.webp').convert('RGB')
    fh = round(fw * old.height / old.width)
    row = Image.new('RGB', (W, fh + 40), 'white')
    d = ImageDraw.Draw(row)
    d.text((30, 4), f'{label}  ·  {old.width}×{old.height} → 4096×2737' + ('  ·  surfista sin retocar (cara original)' if person else ''), fill=DEEP, font=small)
    row.paste(old.resize((fw, fh)), (30, 34))
    row.paste(new.resize((fw, fh)), (30 + fw + 10, 34))
    bw = int(0.12 * new.width)
    bh = int(bw * fh / 330)
    bx, by = min(int(cx * new.width), new.width - bw), min(int(cy * new.height), new.height - bh)
    r = old.width / new.width
    x0 = 30 + 2 * fw + 40
    row.paste(old.crop((int(bx * r), int(by * r), int((bx + bw) * r), int((by + bh) * r))).resize((330, fh), Image.LANCZOS), (x0, 34))
    row.paste(new.crop((bx, by, bx + bw, by + bh)).resize((330, fh), Image.LANCZOS), (x0 + 340, 34))
    for xx, t in [(30, 'ANTES'), (30 + fw + 10, 'DESPUÉS'), (x0, 'ANTES · detalle 100 %'), (x0 + 340, 'DESPUÉS · detalle 100 %')]:
        tag(d, xx, 34, t, t.startswith('ANTES'))
    rows.append(row)
sheet = Image.new('RGB', (W, 80 + sum(r.height + 20 for r in rows)), 'white')
d = ImageDraw.Draw(sheet)
d.text((30, 24), 'Imágenes principales — antes / después (Higgsfield 4K + ajuste suave de color)', fill=DEEP, font=font)
y = 80
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height + 20
sheet.save(OUT / '02-imagenes-antes-despues.jpg', quality=86)
print('ok images')
