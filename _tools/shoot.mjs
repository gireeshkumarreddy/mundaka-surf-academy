/**
 * QA screenshots with headless Chrome over the DevTools protocol (no dependencies).
 *   node _tools/shoot.mjs <out-dir> <width>x<height> <url>[|selector-or-scrollY|js:<code>] ...
 * Each shot: navigate (skipped when the URL is "same"), optionally scroll to a selector, a pixel offset
 * or run JS (awaited, result printed), wait, capture the viewport.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [outDir, size, ...shots] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
const mobile = width < 768;
mkdirSync(outDir, { recursive: true });
const profile = path.join(os.tmpdir(), `qa-chrome-${process.pid}`);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const n = ++id;
  pending.set(n, resolve);
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });

let n = 0;
for (const shot of shots) {
  const [url, ...rest] = shot.split('|');
  const where = rest.join('|');
  if (url !== 'same') {
    await send('Page.navigate', { url });
    await sleep(2600);
  }
  if (where.startsWith('js:')) {
    const res = await send('Runtime.evaluate', { expression: `(async()=>{${where.slice(3)}})()`, awaitPromise: true, returnByValue: true });
    if (res.result?.result?.value !== undefined) console.log('  js →', JSON.stringify(res.result.result.value));
    if (res.result?.exceptionDetails) console.log('  js error →', res.result.exceptionDetails.exception?.description);
    await sleep(1600);
  } else if (where) {
    const expr = /^\d+$/.test(where)
      ? `window.scrollTo({top:${where},behavior:'instant'})`
      : `(()=>{const el=document.querySelector(${JSON.stringify(where)}); if(el) window.scrollTo({top: el.getBoundingClientRect().top + scrollY - 0, behavior:'instant'}); return !!el})()`;
    await send('Runtime.evaluate', { expression: expr });
    await sleep(1400);
  }
  const res = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  const file = path.join(outDir, `${String(++n).padStart(2, '0')}.jpg`);
  writeFileSync(file, Buffer.from(res.result.data, 'base64'));
  console.log(file, shot);
}
ws.close();
chrome.kill();
await sleep(300);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
