/**
 * Mobile audit with headless Chrome (no dependencies): full-page screenshots of every page at phone sizes plus
 * automatic checks — horizontal overflow, small tap targets, small text, images too blurry for a 3× phone screen.
 *   node _tools/mobile_audit.mjs <out-dir> [base-url] [width]x[height]
 * Motion is turned off (prefers-reduced-motion) so everything that normally fades in is visible in the captures.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [outDir = '_qa/mobile', base = 'http://localhost:4321', size = '390x844'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const ALL = ['', 'about.html', 'team.html', 'lessons.html', 'book.html', 'conditions.html', 'surf-weather.html', 'gallery.html', 'faq.html', 'contact.html', 'legal-notice.html', 'privacy.html', 'cookies.html', 'en/', 'en/book.html'];
const PAGES = process.env.PAGES ? process.env.PAGES.split(',').map((p) => (p === 'index' ? '' : p)) : ALL;
const SCALE = Number(process.env.SCALE) || 1 / 3;
const CHROME = process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(outDir, { recursive: true });
const profile = path.join(os.tmpdir(), `audit-chrome-${process.pid}`);
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch('http://127.0.0.1:9334/json/list')).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const n = ++id;
  pending.set(n, resolve);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.navigate', { url: base });
await sleep(1500);
await evaluate(`localStorage.setItem('msa:consent', '${process.env.CONSENT || 'necessary'}')`);

const CHECKS = `(() => {
  const W = innerWidth, out = { overflow: [], taps: [], text: [], images: [] };
  const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[hidden], .visually-hidden, .mobile-menu, dialog:not([open]), .hp, .skip-link'); };
  const name = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase()) + (el.textContent ? ' "' + el.textContent.trim().slice(0, 28) + '"' : '');
  out.docWidth = document.documentElement.scrollWidth;
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || getComputedStyle(el).position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !el.closest('.embed, .table-wrap, .hero__media, .page-hero, .frame')) out.overflow.push(name(el) + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
  }
  for (const el of document.querySelectorAll('a, button, input, select, textarea, summary, label')) {
    if (!vis(el)) continue;
    if (el.matches('label') && !el.querySelector('input[type=checkbox], input[type=radio]')) continue;
    if (el.matches('input[type=radio], input[type=checkbox]') && el.closest('label')) continue;
    const r = el.getBoundingClientRect();
    const inline = el.matches('a') && el.closest('p, li, dd, td') && !el.matches('.btn, .link-arrow');
    if ((r.height < 44 || r.width < 44) && !inline) out.taps.push(name(el) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  }
  for (const el of document.querySelectorAll('p, li, a, span, dt, dd, td, th, label, button, figcaption, small, h1, h2, h3, h4, summary')) {
    if (!vis(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 13) out.text.push(name(el) + ' ' + fs + 'px');
  }
  for (const img of document.images) {
    if (!vis(img) || !img.currentSrc) continue;
    const r = img.getBoundingClientRect();
    const need = Math.round(r.width * Math.min(devicePixelRatio, 2));
    const m = img.currentSrc.match(/-(\\d+)\\.webp/);
    const have = m ? Number(m[1]) : img.naturalWidth;
    const fit = getComputedStyle(img).objectFit;
    // with object-fit: cover the image is scaled to the box's height too
    const coverNeed = fit === 'cover' && img.naturalWidth ? Math.round(Math.max(r.width, r.height * img.naturalWidth / img.naturalHeight) * Math.min(devicePixelRatio, 2)) : need;
    if (have < coverNeed * 0.9) out.images.push(img.currentSrc.split('/').pop() + ' shown ' + Math.round(r.width) + '×' + Math.round(r.height) + ' needs ~' + coverNeed + 'w');
  }
  // MARKS="sel1,sel2": where those elements sit in the full-page shot (for before/after crops)
  out.marks = Object.fromEntries((${JSON.stringify(process.env.MARKS || '')}).split(',').filter(Boolean).map((sel) => { const el = document.querySelector(sel); const r = el && el.getBoundingClientRect(); return [sel, r ? [Math.round(r.top + scrollY), Math.round(r.height)] : null]; }));
  out.height = document.documentElement.scrollHeight;
  return out;
})()`;

const report = {};
for (const p of PAGES) {
  await send('Page.navigate', { url: `${base}/${p}` });
  await sleep(process.env.CONSENT === 'all' ? 5000 : 2200);
  // every image loaded before the full-page shot (lazy ones far down the page otherwise come out blank); at most 10 s
  await evaluate(`document.documentElement.classList.add('cv-off'); document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')); new Promise((r) => { const t0 = Date.now(); const tick = () => ([...document.images].every((i) => i.complete) || Date.now() - t0 > 10000 ? setTimeout(r, 400) : setTimeout(tick, 200)); setTimeout(tick, 300); }).then(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null))))`);
  const res = await evaluate(CHECKS);
  report[p || 'index'] = res;
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60, captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(res.height, 16000), scale: SCALE } });
  const file = path.join(outDir, `${(p || 'index').replace(/\//g, '_').replace(/\.html$/, '') || 'en'}.jpg`);
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  const dedupe = (a) => [...new Set(a)];
  console.log(`\n== ${p || 'index'}  (${res.height}px tall, doc width ${res.docWidth}/${width})`);
  if (Object.keys(res.marks ?? {}).length) console.log('  marks: ' + JSON.stringify(res.marks));
  for (const k of ['overflow', 'taps', 'text', 'images']) if (res[k].length) console.log(`  ${k}: ${dedupe(res[k]).slice(0, 12).join(' | ')}${dedupe(res[k]).length > 12 ? ` (+${dedupe(res[k]).length - 12})` : ''}`);
}
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
ws.close();
chrome.kill();
await sleep(300);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
