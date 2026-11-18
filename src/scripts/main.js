import { getConfig } from './integrations/config.js';
import initConsent from './consent.js';
import { initMotion } from './motion.js';
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

// The first screen needs no script (its entrance is pure CSS), so let the browser paint it before the scripts start:
// on phones the start-up work below otherwise delayed the first paint.
await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

initMotion();
initHeader();
initMenu();
initInteractions();
initConsent();

// page modules, loaded only where their markup exists
const modules = [
  ['[data-booking]', './booking.js'],
  ['[data-contact-form]', './contact.js'],
  ['[data-gallery]', './gallery.js'],
  ['[data-embed]', './embed.js'],
  ['[data-booking-status]', './status.js'],
  ['[data-map]', './map.js'],
  ['[data-readmore]', './readmore.js'],
  ['[data-hero-video]', './hero-video.js'],
  ['[data-inview-video]', './inview-video.js'],
];
const startModules = (root) => {
  for (const [selector, path] of modules) {
    const el = root.querySelector(selector);
    if (el) import(path).then((m) => m.default(el, config)).catch((err) => console.error(`Failed to start ${path}`, err));
  }
};
startModules(document);

let lastScroll = 0;
window.addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });

/* Heavy blocks (the Spain map) arrive as <template data-defer data-src>: fetched and started shortly before they
   scroll into view, so they cost nothing while the page first loads. */
const deferred = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    deferred.unobserve(target);
    const template = target.querySelector(':scope > template[data-defer]');
    fetch(template.dataset.src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`${res.status} ${template.dataset.src}`))))
      .then((html) => {
        // insert once scrolling has paused, so a scroll in progress never waits for it
        const place = () => {
          if (performance.now() - lastScroll < 180) {
            setTimeout(place, 120);
            return;
          }
          template.insertAdjacentHTML('afterend', html);
          template.remove();
          startModules(target);
        };
        if ('requestIdleCallback' in window) requestIdleCallback(place, { timeout: 600 });
        else setTimeout(place, 50);
      })
      .catch((err) => console.error('Deferred block failed to load', err));
  }
}, { rootMargin: '1200px 0px' });
document.querySelectorAll('template[data-defer]').forEach((t) => deferred.observe(t.parentElement));
