"""Build the stylised Spain map partial (src/partials/spain-map.html) from IGN TopoJSON.

Data: es-atlas 0.6.0 (Instituto Geográfico Nacional, CC BY 4.0) in _source/geo.
Labels are template placeholders ({{map.*}}) so the build can translate them.
"""
import json
import math
import cv2
import numpy as np

topo = json.load(open('_source/geo/autonomous_regions.json', encoding='utf-8'))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']

arcs = []
for arc in topo['arcs']:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx
        y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)


def ring(idx):
    out = []
    for i in idx:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(pts if not out else pts[1:])
    return out


W, H, PAD = 820, 700, 26
LON0, LON1, LAT0, LAT1 = -9.45, 4.45, 35.15, 44.75


def merc(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


KX = (W - 2 * PAD) / (LON1 - LON0)
KY = KX * 180 / math.pi  # keep Mercator aspect


def proj(lon, lat):
    return (PAD + (lon - LON0) * KX, PAD + (merc(LAT1) - merc(lat)) * KY)


# the Canary Islands are drawn in an inset at the bottom left
INSET = (PAD, H - 128, 230, 96)  # x, y, w, h
CAN = (-18.2, -13.3, 27.6, 29.5)


def proj_canarias(lon, lat):
    x0, y0, w, h = INSET
    kx = (w - 16) / (CAN[1] - CAN[0])
    ky = kx * 180 / math.pi
    return (x0 + 8 + (lon - CAN[0]) * kx, y0 + 8 + (merc(CAN[3]) - merc(lat)) * ky)


def rdp(pts, eps):
    if len(pts) < 4:
        return pts
    a = np.array(pts, np.float32).reshape(-1, 1, 2)
    return [tuple(p[0]) for p in cv2.approxPolyDP(a, eps, True)]


def path_d(polys):
    d = []
    for poly in polys:
        if len(poly) < 3:
            continue
        d.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in poly) + 'Z')
    return ''.join(d)


regions = {}
land_polys = []
for g in topo['objects']['autonomous_regions']['geometries']:
    rid = g['id']
    if rid == '20':  # Gibraltar is not part of Spain
        continue
    p = proj_canarias if rid == '05' else proj
    polys = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
    out = []
    for poly in polys:
        for r_i, r in enumerate(poly):
            pts = [p(lon, lat) for lon, lat in ring(r)]
            pts = rdp(pts, 0.55)
            if len(pts) >= 3:
                out.append(pts)
                if r_i == 0 and rid != '05':
                    land_polys.append(pts)
    regions[rid] = out

# halftone dots along the Atlantic and Cantabrian coasts (Epic Portugal reference)
mask = np.zeros((H, W), np.uint8)
for poly in land_polys:
    cv2.fillPoly(mask, [np.array(poly, np.int32)], 255)
near = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (64, 64)))
band = cv2.bitwise_and(near, cv2.bitwise_not(cv2.dilate(mask, np.ones((7, 7), np.uint8))))
dots = []
step = 8
for yy in range(0, H, step):
    for xx in range(0 + (yy // step % 2) * step // 2, W, step):
        if band[yy, xx] and (yy < 205 or xx < 175):  # north coast + west coast only
            dots.append((xx, yy))
dots_d = ''.join(f'M{x - 1.6:.1f} {y}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0' for x, y in dots)


def hav(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


MUNDAKA = (43.4075, -2.6986)
CITIES = {
    'bilbao': (43.2630, -2.9350),
    'donostia': (43.3183, -1.9812),
    'madrid': (40.4168, -3.7038),
    'barcelona': (41.3874, 2.1686),
}
LAS_PALMAS = (28.1235, -15.4363)
dist = {k: round(hav(MUNDAKA, v)) for k, v in CITIES.items()}
dist['canarias'] = round(hav(MUNDAKA, LAS_PALMAS), -1)
print('straight-line km from Mundaka:', dist)

mx, my = proj(MUNDAKA[1], MUNDAKA[0])
pts = {k: proj(v[1], v[0]) for k, v in CITIES.items()}
lpx, lpy = proj_canarias(LAS_PALMAS[1], LAS_PALMAS[0])


def km(n):
    return f'{n:,.0f}'.replace(',', '{{map.thousands}}')


ORDER = ['12', '03', '06', '07', '17', '15', '02', '09', '13', '08', '10', '11', '14', '01', '04', '18', '19', '05']
REGION_NAMES = {
    '01': 'Andalucía', '02': 'Aragón', '03': 'Asturias', '04': 'Illes Balears', '05': 'Canarias', '06': 'Cantabria',
    '07': 'Castilla y León', '08': 'Castilla-La Mancha', '09': 'Catalunya', '10': 'Comunitat Valenciana', '11': 'Extremadura',
    '12': 'Galicia', '13': 'Comunidad de Madrid', '14': 'Región de Murcia', '15': 'Navarra', '16': 'Euskadi', '17': 'La Rioja',
    '18': 'Ceuta', '19': 'Melilla',
}
svg = []
svg.append('<div class="map" data-map>')
svg.append('  <div class="map__controls" role="group" aria-label="{{location.map.controls}}">')
svg.append('    <button type="button" class="map__btn is-active" data-map-view="spain" aria-pressed="true">{{location.map.spain}}</button>')
svg.append('    <button type="button" class="map__btn" data-map-view="basque" aria-pressed="false">{{location.map.basque}}</button>')
svg.append('    <a class="map__btn" href="{{link:location#local-title}}"><svg class="icon" aria-hidden="true"><use href="#i-pin"/></svg>{{location.map.street}}</a>')
svg.append('  </div>')
svg.append(f'<svg class="spain-map" viewBox="0 0 {W} {H}" role="img" aria-labelledby="spain-map-title spain-map-desc" xmlns="http://www.w3.org/2000/svg">')
svg.append('<title id="spain-map-title">{{map.title}}</title><desc id="spain-map-desc">{{map.desc}}</desc>')
svg.append(f'<path class="map-dots" d="{dots_d}"/>')
for rid in ORDER:
    svg.append(f'<path class="map-region" data-region="{rid}" data-name="{REGION_NAMES[rid]}" d="{path_d(regions[rid])}"/>')
svg.append(f'<path class="map-region map-region--home" data-region="16" data-name="{REGION_NAMES["16"]}" d="{path_d(regions["16"])}"/>')
x0, y0, w, h = INSET
svg.append('<g class="map-far">')
svg.append(f'<rect class="map-inset" x="{x0}" y="{y0}" width="{w}" height="{h}" rx="6"/>')
svg.append(f'<text class="map-label map-label--region" x="{x0 + w - 8}" y="{y0 + h - 10}" text-anchor="end">Canarias</text>')
svg.append(f'<path class="map-route" d="M{mx:.1f} {my:.1f}Q{(mx + lpx) / 2 - 120:.1f} {(my + lpy) / 2 - 40:.1f} {lpx:.1f} {lpy - 6:.1f}"/>')
cx, cy = (mx + lpx) / 2 - 62, (my + lpy) / 2 - 18
svg.append(f'<g class="map-distance" transform="translate({cx:.1f} {cy:.1f})"><rect x="-34" y="-11" width="68" height="22" rx="11"/><text y="4" text-anchor="middle">{km(dist["canarias"])} km</text></g>')
svg.append(f'<text class="map-label map-label--sea" x="{proj(-6.6, 44.35)[0]:.1f}" y="{proj(-6.6, 44.35)[1]:.1f}">{{{{map.biscay}}}}</text>')
svg.append(f'<text class="map-label map-label--sea" x="{proj(-9.35, 38.3)[0]:.1f}" y="{proj(-9.35, 38.3)[1]:.1f}" text-anchor="end" transform="rotate(-90 {proj(-9.35, 38.3)[0]:.1f} {proj(-9.35, 38.3)[1]:.1f})">{{{{map.atlantic}}}}</text>')
svg.append(f'<text class="map-label map-label--sea" x="{proj(1.2, 38.4)[0]:.1f}" y="{proj(1.2, 38.4)[1]:.1f}">{{{{map.mediterranean}}}}</text>')
svg.append('</g>')
# straight lines Mundaka → each city, drawn when the city is hovered or selected
pts = {k: proj(v[1], v[0]) for k, v in CITIES.items()}
for k, (px, py) in pts.items():
    svg.append(f'<path class="map-link" data-link="{k}" d="M{mx:.1f} {my:.1f}L{px:.1f} {py:.1f}"/>')
# Euskadi label (kept the same size while zooming)
ex, ey = proj(-2.55, 42.86)
svg.append(f'<g transform="translate({ex:.1f} {ey:.1f})"><g class="map-mark"><text class="map-label map-label--home" text-anchor="middle">Euskadi</text></g></g>')
anchors = {
    'bilbao': (-118, 34, 'end'),
    'donostia': (70, 34, 'start'),
    'madrid': (-70, 26, 'end'),
    'barcelona': (-8, 34, 'end'),
}
names = {'bilbao': 'Bilbao', 'donostia': 'Donostia / San Sebastián', 'madrid': 'Madrid', 'barcelona': 'Barcelona'}
for k, (px, py) in pts.items():
    ox, oy, anchor = anchors[k]
    svg.append(f'<g class="map-city" data-city="{k}" data-km="{dist[k]}" data-name="{names[k]}" transform="translate({px:.1f} {py:.1f})" tabindex="0" role="button" aria-label="{names[k]} · {km(dist[k])} km">'
               f'<g class="map-mark"><path class="map-leader" d="M0 0L{ox} {oy}"/><circle class="map-city-hit" r="14"/><circle class="map-city-dot" r="3.4"/>'
               f'<text class="map-label" x="{ox + (-5 if anchor == "end" else 5)}" y="{oy + 4}" text-anchor="{anchor}">{names[k]} <tspan class="map-km">· {km(dist[k])} km</tspan></text></g></g>')
svg.append(f'<g class="map-pin" transform="translate({mx:.1f} {my:.1f})" tabindex="0" role="button" aria-label="Mundaka — {{{{js.mapHome}}}}">'
           f'<g class="map-mark"><circle class="map-pin-pulse" r="14"/><circle class="map-pin-ring" r="8"/><circle class="map-pin-dot" r="4"/>'
           f'<path class="map-leader" d="M0 0L42 -38"/><text class="map-label map-label--pin" x="46" y="-42">Mundaka</text></g></g>')
svg.append('</svg>')
svg.append('  <div class="map__tip" data-map-tip hidden></div>')
svg.append('  <div class="map__foot"><p class="map__hint">{{location.map.hint}}</p><p class="map__credit">{{map.credit}}</p></div>')
svg.append('</div>')

open('src/partials/spain-map.html', 'w', encoding='utf-8').write('\n'.join(svg) + '\n')
json.dump({'distancesKm': dist, 'mundaka': {'x': round(mx, 1), 'y': round(my, 1)}}, open('_source/geo/map-facts.json', 'w'), indent=2)
print('map written', len(dots), 'dots')
