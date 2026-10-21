import { getConfig } from './integrations/config.js';
import { initWhatsApp } from './integrations/whatsapp.js';
import { initMotion, reduceMotion } from './motion.js';
import initInteractions from './interactions.js';

const config = getConfig();

/* Header: full size at the top, minimised while scrolling down, full size again when scrolling up. */
function initHeader() {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  let lastY = 0; // read on the first frame: reading scrollY during start-up forces a full layout
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (y < 90) header.classList.remove('is-min');
    else if (y > lastY + 6) header.classList.add('is-min');
    else if (y < lastY - 6) header.classList.remove('is-min');
    if (Math.abs(y - lastY) > 6 || y < 90) lastY = y;
    document.body.classList.toggle('past-hero', y > window.innerHeight * 0.9);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  requestAnimationFrame(update); // first read on the next frame, not in the middle of start-up (no forced layout)
}

function initMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (open) window.__lenis?.stop();
    else window.__lenis?.start();
    if (open) menu.querySelector('a')?.focus();
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

/* Ambient video clips: play in view (unless reduced motion), always pausable. */
function initClips() {
  const clips = document.querySelectorAll('[data-clip]');
  if (!clips.length) return;
  const label = (clip, playing) => {
    const btn = clip.querySelector('[data-clip-toggle]');
    btn.setAttribute('aria-pressed', String(playing));
    btn.querySelector('[data-clip-label]').textContent = playing ? config.strings.videoPause : config.strings.videoPlay;
  };
  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const video = target.querySelector('video');
      if (isIntersecting && !reduceMotion.matches && target.dataset.userPaused !== 'true') {
        video.preload = 'auto';
        video.play().then(() => label(target, true)).catch(() => label(target, false));
      } else if (!video.paused) {
        video.pause();
        label(target, false);
      }
    }
  }, { threshold: 0.35 });
  clips.forEach((clip) => {
    const video = clip.querySelector('video');
    clip.querySelector('[data-clip-toggle]').addEventListener('click', () => {
      if (video.paused) {
        clip.dataset.userPaused = 'false';
        video.play().then(() => label(clip, true));
      } else {
        clip.dataset.userPaused = 'true';
        video.pause();
        label(clip, false);
      }
    });
    io.observe(clip);
  });
}

/* Gentle vertical drift on the staggered lesson cards (desktop only). */
function initParallax() {
  const items = [...document.querySelectorAll('[data-parallax]')];
  const wide = window.matchMedia('(min-width: 1024px)');
  if (!items.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const on = wide.matches && !reduceMotion.matches;
    const mid = window.innerHeight / 2;
    for (const el of items) {
      if (!on) {
        el.style.removeProperty('--py');
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
      el.style.setProperty('--py', `${((r.top + r.height / 2 - mid) * Number(el.dataset.parallax)).toFixed(1)}px`);
    }
  };
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  request();
}

initMotion();
initHeader();
initMenu();
initInteractions();
initClips();
initParallax();
initWhatsApp(config);

// page modules, loaded only where their markup exists
const modules = [
  ['[data-hero]', './hero.js'],
  ['[data-plans]', './plans.js'],
  ['[data-booking]', './booking.js'],
  ['[data-finder]', './finder.js'],
  ['[data-gallery]', './gallery.js'],
  ['[data-embed]', './embed.js'],
  ['[data-booking-status]', './status.js'],
  ['[data-map]', './map.js'],
  ['[data-film]', './film.js'],
];
const startModules = (root) => {
  for (const [selector, path] of modules) {
    const el = root.querySelector(selector);
    if (el) import(path).then((m) => m.default(el, config)).catch((err) => console.error(`Failed to start ${path}`, err));
  }
};
startModules(document);

/* Heavy blocks (the Spain map) arrive as <template data-defer>, either inline or as a separate file (data-src): they
   are put in place, and their scripts started, shortly before they scroll into view, so they cost nothing (not even
   download time) while the page first loads. */
const deferred = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    deferred.unobserve(target);
    const template = target.querySelector(':scope > template[data-defer]');
    const place = (html) => {
      if (html != null) template.insertAdjacentHTML('afterend', html);
      else template.after(template.content);
      template.remove();
      startModules(target);
    };
    if (template.dataset.src) {
      fetch(template.dataset.src)
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`${res.status} ${template.dataset.src}`))))
        .then(place)
        .catch((err) => console.error('Deferred block failed to load', err));
    } else place(null);
  }
}, { rootMargin: '1200px 0px' });
document.querySelectorAll('template[data-defer]').forEach((t) => deferred.observe(t.parentElement));
