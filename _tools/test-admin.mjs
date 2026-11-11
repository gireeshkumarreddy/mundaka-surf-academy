#!/usr/bin/env node
/**
 * Unit tests for the pure helpers of the admin panel (public/admin/admin.js): base64 UTF-8 round trip, in-place JSON
 * patching, locale flatten/unflatten (order kept), slugify, unique names, WebP width selection, crop, image manifest.
 *   node _tools/test-admin.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../public/admin/admin.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(path.join(ROOT, p), 'utf8');
let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
};

await test('base64 UTF-8 round trip', () => {
  for (const s of ['', 'abc', '¡Hola! Mañana, 60 €. Ñandú — «comillas» …', '日本語 😀  ', 'x'.repeat(100000) + 'é']) {
    const b64 = A.utf8ToBase64(s);
    assert.equal(A.base64ToUtf8(b64), s);
    assert.equal(Buffer.from(b64, 'base64').toString('utf8'), s, 'same bytes as Node');
  }
  // GitHub wraps base64 at 60 columns with newlines
  const wrapped = Buffer.from('Clases en grupo: 35 €').toString('base64').replace(/(.{8})/g, '$1\n');
  assert.equal(A.base64ToUtf8(wrapped), 'Clases en grupo: 35 €');
  const bytes = new Uint8Array(70000).map((_, i) => (i * 7) % 256);
  assert.deepEqual(A.base64ToBytes(A.bytesToBase64(bytes)), bytes);
  assert.throws(() => A.base64ToUtf8(Buffer.from([0xff, 0xfe, 0x41]).toString('base64')), 'invalid UTF-8 is refused');
});

await test('slugify', () => {
  assert.equal(A.slugify('Foto Ñandú 2.JPG'), 'foto-nandu-2-jpg');
  assert.equal(A.slugify('  IMG_2034  '), 'img-2034');
  assert.equal(A.slugify('Xabier Gondra León'), 'xabier-gondra-leon');
  assert.equal(A.slugify('¡¿€€?!'), 'foto');
  assert.equal(A.slugify('', 'instructor'), 'instructor');
  assert.ok(A.slugify('a'.repeat(80)).length <= 48);
  assert.ok(!A.slugify(`${'a'.repeat(47)}-b`).endsWith('-'));
});

await test('uniqueName', () => {
  assert.equal(A.uniqueName('foto', new Set()), 'foto');
  assert.equal(A.uniqueName('foto', new Set(['foto'])), 'foto-2');
  assert.equal(A.uniqueName('foto', ['foto', 'foto-2', 'foto-3']), 'foto-4');
  assert.equal(A.uniqueName('foto', new Map([['foto', 1]])), 'foto-2');
});

await test('pickWidths (never upscale, at least one)', () => {
  assert.deepEqual(A.pickWidths(4000), [480, 800, 1200, 1600]);
  assert.deepEqual(A.pickWidths(1600), [480, 800, 1200, 1600]);
  assert.deepEqual(A.pickWidths(1599), [480, 800, 1200]);
  assert.deepEqual(A.pickWidths(800), [480, 800]);
  assert.deepEqual(A.pickWidths(500.7), [480]);
  assert.deepEqual(A.pickWidths(300), [300]);
  assert.deepEqual(A.pickWidths(0), []);
});

await test('cropRect', () => {
  assert.deepEqual(A.cropRect(4000, 3000, null), { x: 0, y: 0, w: 4000, h: 3000 });
  assert.deepEqual(A.cropRect(4000, 3000, 4 / 5), { x: 800, y: 0, w: 2400, h: 3000 });
  const tall = A.cropRect(1000, 2000, 4 / 5);
  assert.deepEqual([tall.w, tall.h], [1000, 1250]);
  assert.ok(tall.y > 0 && tall.y < 2000 - 1250 && tall.y < (2000 - 1250) / 2, 'portrait crop keeps the upper part');
  assert.deepEqual(A.cropRect(800, 1000, 4 / 5), { x: 0, y: 0, w: 800, h: 1000 });
});

await test('imageManifest uses the build rule', () => {
  const m = A.imageManifest(['green-curl-800.webp', 'green-curl-1600.webp', 'img-2034-2-480.webp', 'brush-edge.webp', 'logo.png', 'mundaka-lineup-m-768.webp']);
  assert.deepEqual(m.get('green-curl'), [800, 1600]);
  assert.deepEqual(m.get('img-2034-2'), [480]);
  assert.deepEqual(m.get('mundaka-lineup-m'), [768]);
  assert.equal(m.has('brush-edge'), false);
  assert.equal(A.thumbWidth([320, 480, 800]), 480);
  assert.equal(A.thumbWidth([160, 320]), 320);
});

await test('parseJSON agrees with JSON.parse on every data file', async () => {
  for (const f of ['public/data/plans.json', 'public/data/team.json', 'public/data/gallery.json', 'site.config.json', 'src/locales/es.json', 'src/locales/en.json']) {
    const text = await read(f);
    assert.deepEqual(A.nodeValue(A.parseJSON(text)), JSON.parse(text), f);
    assert.equal(A.patchJSON(text, JSON.parse(text)), text, `${f}: no change → identical text`);
  }
  assert.throws(() => A.parseJSON('{"a": 1,}'));
  assert.throws(() => A.parseJSON('{"a": 1} x'));
  assert.deepEqual(A.nodeValue(A.parseJSON('﻿{"a":"\\u00e9\\"","b":[1,-2.5e3,true,null]}')), { a: 'é"', b: [1, -2500, true, null] });
});

await test('patchJSON changes only what changed', async () => {
  const plans = await read('public/data/plans.json');
  const d = JSON.parse(plans);
  d.plans[0].price.amount = 65;
  d.plans[1].name.es = 'Clases en grupo «nuevas»';
  const out = A.patchJSON(plans, d);
  assert.deepEqual(JSON.parse(out), d);
  const diff = out.split('\n').filter((l, i) => l !== plans.split('\n')[i]);
  assert.equal(diff.length, 2, 'two lines changed');
  assert.match(diff[0], /"amount": 65,/);

  // a key added → only that object is rewritten, at its own indentation; $comment kept
  const cfg = await read('site.config.json');
  const c = JSON.parse(cfg);
  c.reviews.items.push({ name: 'Ane', date: '2026-08-14', rating: 5, text: { es: '¡Genial!', en: 'Great!' } });
  c.whatsapp.number = '34600000000';
  const cOut = A.patchJSON(cfg, c);
  assert.deepEqual(JSON.parse(cOut), c);
  assert.ok(cOut.includes('"$comment": "Temporary number'), '$comment kept');
  assert.ok(cOut.includes('\n\n  "contact"'), 'blank lines between sections kept');
  assert.ok(cOut.includes('\n    "items": [\n      {\n        "name": "Ane",'), 'new array indented in place');
  assert.ok(cOut.endsWith('}\n'));

  // gallery uses one-space indentation: re-serialised parts follow it
  const gal = await read('public/data/gallery.json');
  const g = JSON.parse(gal);
  g.items.reverse();
  g.items.push({ image: 'new-photo', category: 'lessons', alt: { es: 'Nueva' } });
  const gOut = A.patchJSON(gal, g);
  assert.deepEqual(JSON.parse(gOut), g);
  assert.equal(gOut, `${JSON.stringify(g, null, 1)}\n`);

  // reorder with the same keys → values swapped in place, layout untouched
  const team = await read('public/data/team.json');
  const t = JSON.parse(team);
  [t.instructors[0], t.instructors[1]] = [t.instructors[1], t.instructors[0]];
  const tOut = A.patchJSON(team, t);
  assert.deepEqual(JSON.parse(tOut), t);
  assert.equal(tOut.split('\n').length, team.split('\n').length);

  assert.equal(A.patchJSON('{"a":1}', { a: 2 }), '{"a":2}\n', 'trailing newline added');
  assert.equal(A.patchJSON('{"a": [1, 2]}', { a: [1, 2, 3] }), '{"a": [\n  1,\n  2,\n  3\n]}\n');
  assert.equal(A.stringifyJSON({ a: [], b: {}, c: [{ d: 'é<br>' }] }, '  '), JSON.stringify({ a: [], b: {}, c: [{ d: 'é<br>' }] }, null, 2));
});

await test('locale flatten/unflatten keeps order and text', async () => {
  for (const f of ['src/locales/es.json', 'src/locales/en.json']) {
    const text = await read(f);
    const entries = A.flattenLocale(text);
    assert.ok(entries.length > 100);
    assert.ok(entries.every(([p, v]) => Array.isArray(p) && p.length && typeof v === 'string'));
    const back = A.unflattenLocale(entries);
    assert.equal(A.stringifyJSON(back, '  ') + '\n', `${JSON.stringify(JSON.parse(text), null, 2)}\n`, `${f}: round trip`);
    assert.equal(A.patchJSON(text, back), text, `${f}: unchanged → identical`);
  }
  // order is kept even for integer-like keys, which plain JS objects would move to the front
  const src = '{\n  "b": "1",\n  "404": { "z": "x", "10": "y" },\n  "a": "<br>ñ"\n}\n';
  const e = A.flattenLocale(src);
  assert.deepEqual(e.map(([p]) => p.join('.')), ['b', '404.z', '404.10', 'a']);
  e[3][1] = 'nuevo<br>texto';
  e.push([['404', 'nuevo'], 'añadido']);
  e.push([['c', 'd'], 'otro']);
  const out = A.patchJSON(src, A.unflattenLocale(e));
  assert.equal(out, '{\n  "b": "1",\n  "404": {\n    "z": "x",\n    "10": "y",\n    "nuevo": "añadido"\n  },\n  "a": "<br>ñ",\n  "c": {\n    "d": "otro"\n  }\n}\n'.replace('"a": "<br>ñ"', '"a": "nuevo<br>texto"'));
  assert.deepEqual(A.flattenLocale(out).map(([p]) => p.join('.')), ['b', '404.z', '404.10', '404.nuevo', 'a', 'c.d']);
  // a single changed string is replaced in place
  const es = await read('src/locales/es.json');
  const ee = A.flattenLocale(es);
  const i = ee.findIndex(([p]) => p.join('.') === 'common.nav.home');
  ee[i][1] = 'Portada';
  const esOut = A.patchJSON(es, A.unflattenLocale(ee));
  assert.equal(esOut.replace('"home": "Portada"', '"home": "Inicio"'), es);
});

await test('validators', () => {
  assert.ok(A.isPrice(60) && A.isPrice(35.5) && A.isPrice(0.01));
  assert.ok(!A.isPrice(0) && !A.isPrice(-1) && !A.isPrice(1.234) && !A.isPrice('60') && !A.isPrice(NaN));
  assert.ok(A.isHours(1.5) && !A.isHours(1.25) && !A.isHours(0));
  assert.ok(A.isWhatsapp('34688681436') && !A.isWhatsapp('+34 688 68 14 36') && !A.isWhatsapp('1234'));
  assert.ok(A.isDate('2026-02-28') && !A.isDate('2026-02-30') && !A.isDate('2026-2-3'));
  assert.ok(A.isHttps('https://www.instagram.com/x/') && !A.isHttps('http://x.com') && !A.isHttps('https://'));
  assert.ok(A.isEmail('a@b.es') && !A.isEmail('a@b'));
});

await test('detectRepo', () => {
  assert.deepEqual(A.detectRepo({ hostname: 'someone.github.io', pathname: '/my-site/admin/' }), { owner: 'someone', repo: 'my-site', branch: 'main' });
  assert.equal(A.detectRepo({ hostname: 'localhost', pathname: '/admin/' }).repo, 'mundaka-surf-academy');
  assert.equal(A.detectRepo(undefined).owner, 'gireeshkumarreddy');
});

console.log(process.exitCode ? `${passed} passed, some failed` : `admin helpers: all ${passed} tests passed`);
