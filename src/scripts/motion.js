/**
 * Site-wide motion, in the spirit of elokeglobal.com:
 *  - Lenis smooth scrolling (inertia on wheel/trackpad, native on touch),
 *  - everything fades up as it scrolls into view, images uncover from the bottom edge upwards,
 *  - headings rise word by word,
 *  - a short curtain transition between pages.
 * Nothing here runs when the visitor prefers reduced motion.
 */
const html = document.documentElement;
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export let lenis = null;

const HEADER_OFFSET = () => (window.innerWidth < 1024 ? 84 : 104);

export function scrollToTarget(target, { immediate = false } = {}) {
  if (lenis) lenis.scrollTo(target, { offset: -HEADER_OFFSET(), immediate });
  else target.scrollIntoView({ behavior: immediate || reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
}

function initSmoothScroll() {
  // touch screens keep their native scrolling: Lenis would add nothing there but per-frame work
  if (!window.Lenis || window.matchMedia('(pointer: coarse)').matches) return;
  lenis = new window.Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.5,
  });
  window.__lenis = lenis;
  const raf = (time) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  // same-page anchors glide instead of jumping
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || url.hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    scrollToTarget(target);
    target.setAttribute('tabindex', target.getAttribute('tabindex') ?? '-1');
    target.focus({ preventScroll: true });
  });

  // arriving with #hash from another page
  if (window.location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target) window.addEventListener('load', () => scrollToTarget(target, { immediate: true }), { once: true });
  }
}

/* ---------- reveals ---------- */
const SKIP = '.hero, .site-header, .page-curtain, .lightbox, .mobile-menu, [data-booking-form], [data-plan-panel], [data-plan-tabs], [data-plans-compare], [data-plan-photo], .finder__result, [data-no-motion]';
const FADE = [
  'h1', 'h2', 'h3', 'h4', 'p', 'dl', 'blockquote', 'address', '.btn', '.link-arrow', '.eyebrow', '.dash', '.spain-map', '.steps', '.booking__note',
  '.catch__chips', '.conditions-mini', '.channels > li', '.facts > li', '.practical__grid > li', '.pay__list > li', '.approach__list > li',
  '.faq__list > details', '.choice-group', '.gallery__grid > li', '.clips__item', '.strip__item', '.conditions__card', '.story', '.callout', '.feature-card',
  '.footer-claim', '.footer-arch-nav a', '.footer-tagline', '.footer-actions', '.footer-badge',
].join(',');
const SPLIT = '.title, .catch__title, .poster__title, .cta-band__title, .plans-hero__title, .loc-hero__title, .meet__name, .stories__vertical, .profile__name, .type__name, .anatomy__title, .footer-claim__big, .framed__title';

function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) continue;
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            continue;
          }
          const outer = document.createElement('span');
          outer.className = 'split-w';
          const inner = document.createElement('span');
          inner.textContent = part;
          inner.style.setProperty('--i', String(i++));
          outer.append(inner);
          frag.append(outer);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && !child.classList.contains('visually-hidden') && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
}

function initReveals() {
  const main = document.querySelector('main');
  const footer = document.querySelector('.site-footer');
  const targets = new Set();
  // the first screen animates in with CSS alone (03-motion.css), so it paints without waiting for this script
  const first = main.firstElementChild;
  const skip = (el) => el.closest(SKIP) || (first && first.contains(el));
  const within = (root, selector) => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];

  html.classList.add('motion');
  // a clipped image has no visible area of its own, so images are watched through their container
  const watched = new Map();
  const io = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
    const base = html.classList.contains('is-entered') ? 0 : 0.35;
    entering.forEach((entry, n) => {
      for (const el of watched.get(entry.target) ?? []) {
        el.style.setProperty('--delay', `${(base + Math.min(n, 8) * 0.08).toFixed(2)}s`);
        el.classList.add('is-in');
      }
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
  const watch = (els) => els.forEach((el) => {
    targets.add(el);
    const probe = el.matches('[data-img]') && el.parentElement ? el.parentElement : el;
    if (probe.classList.contains('is-in') && probe !== el) {
      el.classList.add('is-in'); // its container has already arrived
      return;
    }
    if (!watched.has(probe)) {
      watched.set(probe, []);
      io.observe(probe);
    }
    watched.get(probe).push(el);
  });

  // every section after the first glides up as a whole
  const sections = [...main.querySelectorAll(':scope > section, :scope > div.section')].filter((s) => s !== first && !s.matches('.hero'));
  sections.forEach((section) => section.setAttribute('data-section', section.matches('.catch, .poster, .framed') ? 'slow' : ''));
  watch(sections);

  // the content of each block is tagged only as it nears the screen (its section is still hidden then): tagging the
  // whole page at load made phones recalculate every style while the page was still loading
  const tag = (root) => {
    const found = [];
    within(root, '[data-reveal]').forEach((el) => !skip(el) && found.push(el));
    within(root, FADE).forEach((el) => {
      if (skip(el) || el.closest('[data-reveal]') || el.closest('[data-fade]') || el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-fade', '');
      found.push(el);
    });
    within(root, 'img, video').forEach((el) => {
      if (skip(el) || el.closest('.callout__lens, .feature-card__img')) return;
      el.setAttribute('data-img', '');
      found.push(el);
    });
    within(root, SPLIT).forEach((el) => {
      if (skip(el) || el.querySelector('.split-w')) return;
      splitWords(el);
      if (!el.matches('[data-fade], [data-reveal]') && !el.closest('[data-reveal], [data-fade]')) {
        el.setAttribute('data-fade', '');
        found.push(el);
      }
    });
    watch(found);
  };
  const prep = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      prep.unobserve(target);
      tag(target);
    }
  }, { rootMargin: '100% 0px' });
  [...main.children].filter((el) => el !== first).concat(footer ?? []).forEach((el) => prep.observe(el));

  // anything already scrolled past (e.g. arriving on #anchor) shows at once
  window.addEventListener('load', () => requestAnimationFrame(() => {
    targets.forEach((el) => {
      if (!el.classList.contains('is-in') && el.getBoundingClientRect().bottom < 0) el.classList.add('is-in');
    });
  }), { once: true });
}

/* ---------- page transitions ---------- */
function initTransitions() {
  const curtain = document.querySelector('.page-curtain');
  const enter = () => {
    const covered = html.classList.contains('is-entering') || html.classList.contains('is-leaving');
    html.classList.remove('is-entering', 'is-leaving');
    html.classList.toggle('is-lifting', covered);
    html.classList.add('is-entered');
  };
  // flush the covered state so the lift animates, then lift straight away (only needed when arriving covered)
  if (curtain && html.classList.contains('is-entering')) getComputedStyle(curtain).transform;
  enter();
  window.addEventListener('pageshow', (e) => e.persisted && enter());

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    if (!/(\.html|\/)$/.test(url.pathname)) return;
    e.preventDefault();
    try {
      sessionStorage.setItem('msa:nav', '1'); // the next page opens behind the curtain and lifts it
    } catch {
      /* storage blocked: the next page simply appears */
    }
    html.classList.remove('is-entered', 'is-lifting');
    if (curtain) getComputedStyle(curtain).transform; // start from below the screen
    html.classList.add('is-leaving');
    setTimeout(() => window.location.assign(url.href), 560);
  });
}

export function initMotion() {
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    html.classList.remove('is-entering', 'motion-pending');
    html.classList.add('is-entered');
    return;
  }
  initSmoothScroll();
  initReveals();
  html.classList.remove('motion-pending');
  initTransitions();
}
