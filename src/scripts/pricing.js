/**
 * Prices from data/plans.json. Pure functions, shared by the browser, the build and the reference server code
 * (server/), so all three always agree.
 *
 * plan.price = { unit: 'personHour', amount, hours: [1, 2, 3] }          → amount × hours × people
 *            | { unit: 'package', packages: [{ days, hours, amount }] }  → package amount × people
 * `option` is the number of hours (personHour) or days (package) chosen in the booking form.
 */
export function planOptions(plan) {
  const p = plan?.price;
  if (!p) return [];
  if (p.unit === 'personHour') return (p.hours ?? [1]).map((h) => ({ value: h, hours: h, amount: p.amount * h }));
  if (p.unit === 'package') return (p.packages ?? []).map((k) => ({ value: k.days, days: k.days, hours: k.hours, amount: k.amount }));
  return [];
}

/** The lowest price shown as "from …" (per person). */
export function fromPrice(plan) {
  const p = plan?.price;
  if (!p) return null;
  if (p.unit === 'personHour') return p.amount ?? null;
  const amounts = (p.packages ?? []).map((k) => k.amount).filter((a) => a != null);
  return amounts.length ? Math.min(...amounts) : null;
}

export function estimate(plan, { participants = 1, option } = {}) {
  const currency = plan?.price?.currency ?? 'EUR';
  const options = planOptions(plan);
  const chosen = options.find((o) => o.value === Number(option)) ?? options[0];
  if (!chosen || chosen.amount == null) return { total: null, currency };
  const n = Math.max(1, Number(participants) || 1);
  return { total: Math.round(chosen.amount * n * 100) / 100, currency, perPerson: chosen.amount, option: chosen.value, hours: chosen.hours, days: chosen.days ?? null };
}

/** Deposit now and balance at the school (percent of the total, rounded to cents). */
export function split(total, percent) {
  if (total == null) return { now: null, later: null };
  const now = Math.round(total * percent) / 100;
  return { now, later: Math.round((total - now) * 100) / 100 };
}

export function formatMoney(amount, currency = 'EUR', locale = 'es') {
  if (amount == null) return null;
  return new Intl.NumberFormat(locale === 'en' ? 'en-IE' : 'es-ES', { style: 'currency', currency, minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(amount);
}
