/**
 * Public site settings, written into every page by the build from site.config.json
 * (<script type="application/json" id="site-config">). No secrets are ever in here.
 */
let cache;

export function getConfig() {
  if (!cache) {
    const el = document.getElementById('site-config');
    cache = el ? JSON.parse(el.textContent) : { strings: {}, paths: {} };
  }
  return cache;
}

/** Translated UI string for scripts, with {placeholders}. */
export function t(key, vars = {}) {
  const value = getConfig().strings?.[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** Pick the current locale from a { es, en } object, falling back to Spanish (the main language). */
export function local(value) {
  if (value == null || typeof value !== 'object') return value;
  return value[getConfig().locale] ?? value.es ?? value.en ?? '';
}
