/**
 * Consent-aware embeds: Google Maps and AEMET iframes (data-src) and the Windguru forecast widget (data-kind).
 * Nothing is requested from those services until the visitor accepts cookies or presses the embed's button.
 */
import { getConsent, onConsent } from './consent.js';

let wgCount = 0;

function load(box) {
  if (box.classList.contains('is-loaded')) return;
  box.classList.add('is-loaded');
  if (box.dataset.kind === 'windguru') {
    // the official Windguru widget: a marker script with a unique id, then the loader that puts the iframe after it
    const uid = `wg_fwdg_${box.dataset.spot}_100_${Date.now()}${wgCount++}`;
    const marker = document.createElement('script');
    marker.id = uid;
    marker.type = 'text/plain';
    box.replaceChildren(marker);
    const args = [`s=${box.dataset.spot}`, 'm=100', `uid=${uid}`, 'wj=knots', 'tj=c', 'waj=m', 'tij=cm', 'odh=0', 'doh=24', `fhours=${box.dataset.hours || 72}`, 'hrsm=2', 'vt=forecasts', `lng=${box.dataset.lang === 'en' ? 'en' : 'es'}`, 'idbs=1', 'p=WINDSPD,GUST,SMER,HTSGW,PERPW,DIRPW,TMPE,CDC,APCP1s'];
    const s = document.createElement('script');
    s.src = `https://www.windguru.cz/js/widget.php?${args.join('&')}`;
    s.async = true;
    box.append(s);
    return;
  }
  const frame = document.createElement('iframe');
  frame.src = box.dataset.src;
  frame.title = box.dataset.title ?? '';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  box.replaceChildren(frame);
}

export default function initEmbeds() {
  const boxes = [...document.querySelectorAll('[data-embed]')];
  boxes.forEach((box) => box.querySelector('[data-embed-load]')?.addEventListener('click', () => load(box)));
  if (getConsent() === 'all') boxes.forEach(load);
  onConsent((value) => value === 'all' && boxes.forEach(load));
}
