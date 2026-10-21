/**
 * Records a scripted tour of the running site with headless Chrome (DevTools screencast, no dependencies).
 *   node _tools/record.mjs <out-dir> [base-url]
 * Writes <out-dir>/frames/*.jpg, frames.json ([file, t]) and mouse.json ([t, x, y, clicked]) — times in seconds
 * from the start of the recording. `python -I _tools/assemble_tour.py <out-dir>` turns them into an MP4.
 * The tour itself is the TOUR function at the bottom: real scrolling (through the page's Lenis), mouse moves,
 * hovers and clicks, and page changes through the site's own menu.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const [outDir, base = 'http://localhost:4321'] = process.argv.slice(2);
const W = 1920;
const H = 1080;
rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, 'frames'), { recursive: true });

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = path.join(os.tmpdir(), `tour-chrome-${process.pid}`);
const PORT = 9334;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`, '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 50 && !target; i++) {
  await realSleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const listeners = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) {
    (listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const n = ++id;
  pending.set(n, resolve);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);
const once = (method) => new Promise((r) => {
  const fn = (p) => {
    listeners.set(method, listeners.get(method).filter((f) => f !== fn));
    r(p);
  };
  on(method, fn);
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

// Slow motion: this machine captures 1080p at ~10–14 fps, so the page runs SLOW times slower than real time
// (its timers, animation frames, clocks, CSS animations and videos) and the frames are played back at normal
// speed afterwards. All tour times below are in page time; frame and mouse timestamps are written in page time too.
const SLOW = Number(process.env.TOUR_SLOW || 3);
const sleep = (ms) => realSleep(ms * SLOW);
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const K = ${SLOW};
  const perfNow = performance.now.bind(performance);
  const start = perfNow();
  const slow = (t) => start + (t - start) / K;
  performance.now = () => slow(perfNow());
  const dateNow = Date.now;
  const d0 = dateNow();
  Date.now = () => d0 + (dateNow() - d0) / K;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => cb(slow(t)));
  const st = window.setTimeout.bind(window);
  const si = window.setInterval.bind(window);
  window.setTimeout = (fn, ms = 0, ...a) => st(fn, ms * K, ...a);
  window.setInterval = (fn, ms = 0, ...a) => si(fn, ms * K, ...a);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    this.defaultPlaybackRate = 1 / K;
    this.playbackRate = 1 / K;
    return play.call(this);
  };
})();` });
await send('Animation.enable');
const slowAnimations = () => send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
await slowAnimations();
on('Page.frameNavigated', ({ frame }) => !frame.parentId && slowAnimations());

// ── recording ──
let t0 = null;
const frames = [];
const mouse = [];
const now = () => (t0 === null ? 0 : (performance.now() / 1000 - t0) / SLOW);
on('Page.screencastFrame', ({ data, sessionId }) => {
  send('Page.screencastFrameAck', { sessionId });
  if (t0 === null) return;
  const file = `${String(frames.length).padStart(5, '0')}.jpg`;
  writeFileSync(path.join(outDir, 'frames', file), Buffer.from(data, 'base64'));
  frames.push([file, +now().toFixed(4)]);
});
const startRecording = async () => {
  await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  t0 = performance.now() / 1000;
};

// ── actions ──
let mx = W / 2;
let my = H / 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const moveMouse = async (x, y) => {
  mx = x;
  my = y;
  mouse.push([+now().toFixed(4), Math.round(x), Math.round(y), 0]);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' });
};
// time-based, so a slow DevTools round trip never stretches the move
const move = async (x, y, ms = 700) => {
  const [sx, sy] = [mx, my];
  const begin = now();
  for (;;) {
    const p = Math.min(1, (now() - begin) / (ms / 1000));
    const k = ease(p);
    // a gentle arc, like a hand moving a mouse
    const lift = Math.sin(Math.PI * p) * Math.min(60, Math.hypot(x - sx, y - sy) * 0.08);
    await moveMouse(sx + (x - sx) * k, sy + (y - sy) * k - lift);
    if (p >= 1) break;
    await sleep(8);
  }
};
const box = (selector, index = 0) => evaluate(`(() => {
  const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top + scrollY };
})()`);
const moveTo = async (selector, ms = 700, { index = 0, dx = 0, dy = 0 } = {}) => {
  const b = await box(selector, index);
  if (!b) {
    console.warn('missing', selector);
    return;
  }
  await move(b.x + dx, b.y + dy, ms);
};
const click = async () => {
  mouse.push([+now().toFixed(4), Math.round(mx), Math.round(my), 1]);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: mx, y: my, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await sleep(70);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mx, y: my, button: 'left', clickCount: 1, pointerType: 'mouse' });
};
// smooth scroll through the page's own Lenis instance (falls back to native smooth scrolling)
const scroll = async (to, ms, retry = true) => {
  const y = typeof to === 'number' ? to : (await box(to))?.top ?? 0;
  await evaluate(`(() => {
    const target = Math.min(${y}, document.documentElement.scrollHeight - innerHeight);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    // re-measure first: content loaded by scripts (booking options, plans) changes the page height
    if (window.__lenis) {
      window.__lenis.resize();
      window.__lenis.scrollTo(target, { duration: ${ms / 1000}, easing: ease, force: true, lock: true });
    }
    else window.scrollTo({ top: target, behavior: 'smooth' });
  })()`);
  await sleep(ms + 60);
  // aiming for the bottom: the page may have grown meanwhile (e.g. the booking form opening a field)
  if (y >= 99999) {
    const short = await evaluate('document.documentElement.scrollHeight - innerHeight - scrollY');
    if (retry && short > 2) await scroll(y, 450, false);
  }
};
const wait = (ms) => sleep(ms);
// click a link and wait for the next page (the site plays its curtain transition in between)
const navigate = async () => {
  const loaded = once('Page.loadEventFired');
  await click();
  await loaded;
};

// ── the tour ──
async function TOUR() {
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: `${base}/` });
  await loaded;
  await realSleep(7000); // fonts and the first reveal (slowed down too)
  await moveMouse(1180, 700);
  await startRecording();

  // HOME — hero: MUNDAKA rises letter by letter, the wave and the statement, then the foam
  await wait(700);
  await move(960, 620, 600);
  await scroll(4842, 5400);
  // lesson stories
  await scroll(5650, 1200);
  await moveTo('.story__media', 500, { index: 1 });
  await scroll(6950, 1200);
  // instructor film grows and plays; jump to a chapter
  await scroll('.meet__film', 1500);
  await scroll((await box('.meet__film')).top - 110, 400);
  await moveTo('.film__screen', 500);
  await wait(700);
  await moveTo('[data-film-seek]', 600, { index: 2 });
  await click();
  await wait(900);
  // catch your wave: lesson picker
  await scroll(9490, 1100);
  await moveTo('.plan-links a', 500, { index: 1 });
  await wait(450);
  // photo strip and the Spain map
  await scroll(10374, 900);
  await scroll(11273, 900);
  await moveTo('.map-city', 600, { index: 2 });
  await wait(700);
  // poster and footer
  await scroll(12323, 800);
  await scroll(99999, 1100);

  // LESSONS (through the menu)
  await moveTo('.hdr__nav [data-nav="lessons"]', 600);
  await navigate();
  await wait(1000);
  await scroll(856, 900);
  await scroll(3177, 1300);
  await wait(300);

  // PLANS: pick a plan, then the comparison table
  await moveTo('.hdr__nav [data-nav="plans"]', 600);
  await navigate();
  await wait(1000);
  await moveTo('[data-plan-tabs] [role="tab"]', 600, { index: 1 });
  await click();
  await wait(600);
  await scroll(1170, 1100);
  await wait(400);

  // ABOUT
  await moveTo('.hdr__nav [data-nav="about"]', 600);
  await navigate();
  await wait(1000);
  await scroll(1816, 1100);
  await wait(300);
  await scroll(3601, 1000);
  await scroll(4359, 900);
  await wait(500);

  // LOCATION: the interactive map
  await moveTo('.hdr__nav [data-nav="location"]', 600);
  await navigate();
  await wait(1000);
  await scroll(1050, 1000);
  await moveTo('.map__btn', 500, { index: 0 });
  await click();
  await wait(800);
  await moveTo('.map-city', 500, { index: 1 });
  await wait(500);

  // CONTACT: the booking request, then down to the footer
  await moveTo('.hdr__nav [data-nav="contact"]', 600);
  await navigate();
  await wait(1000);
  await scroll(719, 1000);
  await moveTo('[data-plan-options] .plan-option', 500, { index: 1 });
  await click();
  await wait(500);
  await scroll(99999, 1500);
  await moveTo('.footer-actions__book', 700);
  await wait(1400);
}

try {
  await TOUR();
} finally {
  await send('Page.stopScreencast');
  await realSleep(300);
  writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify(frames));
  writeFileSync(path.join(outDir, 'mouse.json'), JSON.stringify(mouse));
  console.log(`${frames.length} frames over ${now().toFixed(1)} s of page time (${(frames.length / now()).toFixed(1)} fps)`);
  ws.close();
  chrome.kill();
  await realSleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
