import { t, local } from './integrations/config.js';
import { formatMoney } from './pricing.js';

let request;

/** data/plans.json, fetched once per page. Edit that file to change plans without rebuilding. */
export function loadPlans(config) {
  request ??= fetch(config.paths.plans, { cache: 'no-cache' }).then((res) => {
    if (!res.ok) throw new Error(`plans ${res.status}`);
    return res.json();
  });
  return request.catch((err) => {
    request = undefined; // allow a retry
    throw err;
  });
}

export const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const tbc = () => `<span class="tbc">${escapeHTML(t('tbc'))}</span>`;

export function imageUrl(config, name, width = 800) {
  return `${config.paths.images}${name}-${width}.webp`;
}

export function levelsLabel(plan) {
  if (!plan.levels?.length) return null;
  if (plan.levels.length >= 3) return t('levelAll');
  return plan.levels.map((l) => t(`level_${l}`)).join(' · ');
}

export function priceLabel(plan, config) {
  const p = plan.price;
  if (!p || p.amount == null) return t('priceOnRequest');
  return `${formatMoney(p.amount, p.currency, config.locale)} <small>${escapeHTML(t(`per_${p.unit}`))}</small>`;
}

export function seasonLabel(config) {
  const fmt = new Intl.DateTimeFormat(config.locale === 'es' ? 'es-ES' : 'en-GB', { month: 'long' });
  const month = (m) => fmt.format(new Date(2026, m - 1, 1));
  return t('seasonValue', { from: month(config.season.fromMonth), to: month(config.season.toMonth) });
}

/** Rows shared by the plan panel and the comparison table: [label, html]. */
export function planRows(plan, config) {
  const v = (value, render) => (value == null ? tbc() : render(value));
  return [
    [t('rowLevel'), v(levelsLabel(plan), escapeHTML)],
    [t('rowFormat'), escapeHTML(t(`format_${plan.format}`))],
    [t('rowSessions'), v(plan.sessions, (n) => escapeHTML(t('sessionsN', { n })))],
    [t('rowDuration'), v(plan.durationMinutes, (n) => escapeHTML(t('minutesN', { n })))],
    [t('rowGroup'), v(plan.groupSize, (n) => escapeHTML(t('groupUpTo', { n })))],
    [t('rowAge'), v(plan.minAge, (n) => escapeHTML(t('ageFrom', { n })))],
    [t('rowIncludes'), v(plan.includes && local(plan.includes), escapeHTML)],
    [t('rowAvailability'), escapeHTML(seasonLabel(config))],
    [t('rowConditions'), v(plan.conditions && local(plan.conditions), escapeHTML)],
    [t('rowPrice'), priceLabel(plan, config)],
  ];
}
