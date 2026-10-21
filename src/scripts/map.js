/**
 * Interactive Spain map: smooth zoom between Spain and the Basque coast, region names on hover,
 * city distances (with a line drawn to Mundaka) on hover/focus/tap, and a Mundaka card with directions.
 * Labels and pins keep their on-screen size while zooming.
 */
import { t } from './integrations/config.js';

const ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

export default function initMaps(_el, config) {
  document.querySelectorAll('[data-map]').forEach((root) => initMap(root, config));
}

function initMap(root, config) {
  const svg = root.querySelector('.spain-map');
  const tip = root.querySelector('[data-map-tip]');
  const buttons = [...root.querySelectorAll('[data-map-view]')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = svg.viewBox.baseVal;
  const full = { x: base.x, y: base.y, w: base.width, h: base.height };
  let current = { ...full };
  let anim = 0;
  let pinned = null;
  const marks = [...svg.querySelectorAll('.map-mark')];

  const home = svg.querySelector('.map-region--home').getBBox();
  const pad = 70;
  const ratio = full.w / full.h;
  let bw = home.width + pad * 2;
  let bh = bw / ratio;
  if (bh < home.height + pad * 2) {
    bh = home.height + pad * 2;
    bw = bh * ratio;
  }
  const views = {
    spain: full,
    basque: { x: home.x + home.width / 2 - bw / 2, y: home.y + home.height / 2 - bh / 2 + 10, w: bw, h: bh },
  };

  const apply = (v) => {
    svg.setAttribute('viewBox', `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`);
    const zoom = full.w / v.w;
    // labels and pins keep their on-screen size: scale each one around its own anchor point
    const zi = (1 / zoom).toFixed(4);
    marks.forEach((m) => m.setAttribute('transform', `scale(${zi})`));
    root.classList.toggle('is-zoomed', zoom > 1.4);
  };

  const go = (name) => {
    const target = views[name];
    buttons.forEach((b) => {
      const on = b.dataset.mapView === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    cancelAnimationFrame(anim);
    const from = { ...current };
    if (reduce) {
      current = { ...target };
      apply(current);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const k = ease(Math.min(1, (now - start) / 1100));
      current = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, w: from.w + (target.w - from.w) * k, h: from.h + (target.h - from.h) * k };
      apply(current);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  buttons.forEach((b) => b.addEventListener('click', () => go(b.dataset.mapView)));

  /* tooltip */
  const place = (clientX, clientY) => {
    const r = root.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 80), r.width - 80);
    tip.style.setProperty('--tx', `${x.toFixed(0)}px`);
    tip.style.setProperty('--ty', `${(clientY - r.top).toFixed(0)}px`);
  };
  const placeAt = (el) => {
    const b = el.getBoundingClientRect();
    place(b.left + b.width / 2, b.top);
  };
  const show = (html, interactive = false) => {
    tip.innerHTML = html;
    tip.hidden = false;
    tip.classList.toggle('is-card', interactive);
    requestAnimationFrame(() => tip.classList.add('is-on'));
  };
  const hide = () => {
    tip.classList.remove('is-on');
    tip.hidden = true;
  };

  /* regions */
  svg.querySelectorAll('.map-region').forEach((region) => {
    region.addEventListener('pointerenter', (e) => {
      if (pinned) return;
      show(`<strong>${region.dataset.name}</strong>`);
      place(e.clientX, e.clientY);
    });
    region.addEventListener('pointermove', (e) => !pinned && place(e.clientX, e.clientY));
    region.addEventListener('pointerleave', () => !pinned && hide());
  });
  svg.querySelector('.map-region--home').addEventListener('click', () => go('basque'));

  /* cities */
  const cities = [...svg.querySelectorAll('.map-city')];
  const lit = (city, on) => {
    city.classList.toggle('is-on', on);
    svg.querySelector(`[data-link="${city.dataset.city}"]`)?.classList.toggle('is-on', on);
  };
  const cityText = (city) => `<strong>${city.dataset.name}</strong><span>${t('mapFrom', { km: city.dataset.km })}</span>`;
  cities.forEach((city) => {
    const enter = () => {
      if (pinned && pinned !== city) return;
      lit(city, true);
      show(cityText(city));
      placeAt(city.querySelector('.map-city-dot'));
    };
    const leave = () => {
      if (pinned === city) return;
      lit(city, false);
      if (!pinned) hide();
    };
    city.addEventListener('pointerenter', enter);
    city.addEventListener('pointerleave', leave);
    city.addEventListener('focus', enter);
    city.addEventListener('blur', leave);
    const toggle = () => {
      const was = pinned === city;
      if (pinned) lit(pinned, false);
      pinned = was ? null : city;
      if (pinned) {
        lit(city, true);
        show(cityText(city));
        placeAt(city.querySelector('.map-city-dot'));
      } else hide();
    };
    city.addEventListener('click', toggle);
    city.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
  });

  /* Mundaka pin: a small card with directions */
  const pin = svg.querySelector('.map-pin');
  const openPin = () => {
    if (pinned) lit(pinned, false);
    pinned = pin;
    show(`<strong>Mundaka</strong><span>${t('mapHome')}</span><a class="map__tip-link" href="${config.paths.directions ?? '#'}" target="_blank" rel="noopener">${t('mapDirections')}</a>`, true);
    placeAt(pin.querySelector('.map-pin-dot'));
  };
  pin.addEventListener('pointerenter', () => !pinned && (show(`<strong>Mundaka</strong><span>${t('mapHome')}</span>`), placeAt(pin.querySelector('.map-pin-dot'))));
  pin.addEventListener('pointerleave', () => pinned !== pin && hide());
  pin.addEventListener('click', openPin);
  pin.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openPin()));

  // click on empty map space or Escape clears a pinned tooltip
  root.addEventListener('click', (e) => {
    if (pinned && !e.target.closest('.map-city, .map-pin, .map__tip')) {
      if (pinned !== pin) lit(pinned, false);
      pinned = null;
      hide();
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pinned) {
      if (pinned !== pin) lit(pinned, false);
      pinned = null;
      hide();
    }
  });
  window.addEventListener('resize', () => pinned && placeAt(pinned.querySelector('.map-city-dot, .map-pin-dot')));
  apply(current);
}
