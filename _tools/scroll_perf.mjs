/**
 * Scroll smoothness test: real scroll gestures in headless Chrome (touch on a phone viewport, mouse wheel on desktop),
 * optional CPU slow-down, frame times recorded in the page. Reports average fps, frames slower than 1/30 s ("janky")
 * and long tasks per page.
 *   node _tools/scroll_perf.mjs [base-url] [phone|desktop] [cpu-throttle]
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [base = 'http://localhost:4321', mode = 'phone', throttle = '4'] = process.argv.slice(2);
const phone = mode === 'phone';
const PAGES = (process.env.PAGES || 'index,about.html,team.html,lessons.html,book.html,gallery.html,surf-weather.html').split(',').map((p) => (p === 'index' ? '' : p));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = path.join(os.tmpdir(), `perf-chrome-${process.pid}`);
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch('http://127.0.0.1:9335/json/list')).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
const [w, h] = phone ? [390, 844] : [1440, 900];
await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: phone ? 3 : 1, mobile: phone });
if (phone) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: base });
await sleep(1200);
await evaluate(`localStorage.setItem('msa:consent', 'necessary')`);
const RECORD = `(() => { window.__frames = []; window.__long = 0; let last = performance.now();
  const tick = (t) => { window.__frames.push(t - last); last = t; if (window.__rec) requestAnimationFrame(tick); };
  window.__rec = true; requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask' }); } catch {} })()`;
const STOP = `(() => { window.__rec = false; const f = window.__frames.slice(2); const total = f.reduce((a, b) => a + b, 0);
  return { frames: f.length, fps: Math.round(f.length / (total / 1000)), janky: f.filter((x) => x > 34).length, worst: Math.round(Math.max(...f)), longTasks: window.__long }; })()`;

console.log(`${mode}, CPU ×${throttle}`);
for (const p of PAGES) {
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await send('Page.navigate', { url: `${base}/${p}` });
  await sleep(3000);
  await send('Emulation.setCPUThrottlingRate', { rate: Number(throttle) });
  await evaluate(RECORD);
  // one long gesture down the page: 3500 px at 1500 px/s, like a firm swipe or steady wheel scrolling
  await send('Input.synthesizeScrollGesture', { x: Math.round(w / 2), y: Math.round(h * 0.7), yDistance: -3500, speed: 1500, gestureSourceType: phone ? 'touch' : 'mouse', repeatCount: 1 });
  await sleep(1500);
  const r = await evaluate(STOP);
  console.log(`${(p || 'index').padEnd(18)} fps ${String(r.fps).padStart(3)} · janky frames ${String(r.janky).padStart(3)}/${r.frames} · worst ${r.worst} ms · long tasks ${r.longTasks}`);
}
ws.close();
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
