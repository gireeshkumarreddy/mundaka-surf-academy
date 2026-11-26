/**
 * Consent-aware embeds: Google Maps and AEMET iframes (data-src) and the Windguru forecast widget (data-kind).
 * Nothing is requested from those services until the visitor accepts cookies or presses the embed's button.
 */
import { getConsent, onConsent } from './consent.js';

let wgCount = 0;
// Windguru models for Mundaka (spot 48688): 84 = GFS-Wave 16 km (wave height, period, direction), 100 = WG (wind, gusts,
// temperature, clouds, rain)
const WINDGURU = [
  { m: 84, p: 'HTSGW,PERPW,DIRPW' },
  { m: 100, p: 'WINDSPD,GUST,SMER,TMPE,CDC,APCP1s' },
];

function load(box) {
  if (box.classList.contains('is-loaded')) return;
  box.classList.add('is-loaded');
  if (box.dataset.kind === 'windguru') {
    // the official Windguru widget: a marker script with a unique id, then the loader that puts the iframe after it.
    // One widget shows one model, so two tables: waves from GFS-Wave (the wind model has no wave rows), then wind.
    box.replaceChildren();
    for (const { m, p } of WINDGURU) {
      const uid = `wg_fwdg_${box.dataset.spot}_${m}_${Date.now()}${wgCount++}`;
      const marker = document.createElement('script');
      marker.id = uid;
      marker.type = 'text/plain';
      const args = [`s=${box.dataset.spot}`, `m=${m}`, `uid=${uid}`, 'wj=knots', 'tj=c', 'waj=m', 'tij=cm', 'odh=0', 'doh=24', `fhours=${box.dataset.hours || 72}`, 'hrsm=2', 'vt=forecasts', `lng=${box.dataset.lang === 'en' ? 'en' : 'es'}`, 'idbs=1', `p=${p}`];
      const s = document.createElement('script');
      s.src = `https://www.windguru.cz/js/widget.php?${args.join('&')}`;
      s.async = true;
      const slot = document.createElement('div');
      slot.className = 'embed__wg';
      slot.append(marker, s);
      box.append(slot);
    }
    return;
  }
  const frame = document.createElement('iframe');
  frame.src = box.dataset.src;
  frame.title = box.dataset.title ?? '';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  box.replaceChildren(frame);
}

// groups (map, forecast) the visitor asked to see during this visit: one tap shows them on every page until the tab closes
const KEY = 'msa:embeds';
const asked = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};
const remember = (group) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...new Set([...asked(), group])]));
  } catch {
    /* private mode: it just isn't remembered */
  }
};

export default function initEmbeds() {
  const boxes = [...document.querySelectorAll('[data-embed]')];
  const show = (group) => boxes.filter((b) => b.dataset.group === group).forEach(load);
  boxes.forEach((box) =>
    box.querySelector('[data-embed-load]')?.addEventListener('click', () => {
      if (!box.dataset.group) return load(box);
      remember(box.dataset.group);
      show(box.dataset.group); // e.g. both forecasts (Windguru and AEMET) with one tap
    }),
  );
  if (getConsent() === 'all') boxes.forEach(load);
  else asked().forEach(show);
  onConsent((value) => {
    if (value === 'all') boxes.forEach(load);
    else
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* nothing stored */
      }
  });
}
