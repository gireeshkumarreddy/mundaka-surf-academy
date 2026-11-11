/**
 * Cookie consent. The site sets no cookies of its own; external embeds (Google Maps, Windguru, AEMET) may, so they
 * load only after "Accept all" or when the visitor presses a single embed's own button. The choice is kept in
 * localStorage ('msa:consent' = 'all' | 'necessary') and can be changed from any [data-consent-open] button.
 */
const KEY = 'msa:consent';
const listeners = new Set();

export function getConsent() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function onConsent(fn) {
  listeners.add(fn);
}

function setConsent(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  listeners.forEach((fn) => fn(value));
}

export default function initConsent() {
  const banner = document.querySelector('[data-cookie-banner]');
  if (!banner) return;
  const show = (on) => {
    banner.hidden = !on;
    document.body.classList.toggle('has-cookie-banner', on);
  };
  if (!getConsent()) show(true);
  banner.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-consent-choice]')?.dataset.consentChoice;
    if (!choice) return;
    setConsent(choice);
    show(false);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-consent-open]')) return;
    show(true);
    banner.querySelector('[data-consent-choice="all"]')?.focus();
  });
}
