/**
 * Prices from data/plans.json. Pure functions, shared by the browser, the build and the reference server code
 * (server/), so all three always agree.
 *
 * plan.price = { unit: 'personHour', amount, hours: [1, 2, 3], groupRates? } → rate × hours × people
 *            | { unit: 'package', packages: [{ days, hours, amount }] }      → package amount × people
 * groupRates: [{ people, amount }] — a lower rate per person for bigger private groups (client feedback 3: 1 person 60 €,
 * 2 people 55 € each, 3 people 50 € each); without it, `amount` is the rate for everyone.
 * `option` is the number of hours (personHour) or days (package) chosen in the booking form.
 */
const round2 = (n) => Math.round(n * 100) / 100;

/** Hourly rate per person for a group of `people` (personHour plans). */
export function rateFor(plan, people = 1) {
  const p = plan?.price;
  if (!p) return null;
  const rates = (p.groupRates ?? []).filter((r) => r.people <= people).sort((a, b) => b.people - a.people);
  return rates[0]?.amount ?? p.amount ?? null;
}

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
  if (p.unit === 'personHour') {
    const rates = [p.amount, ...(p.groupRates ?? []).map((r) => r.amount)].filter((a) => a != null);
    return rates.length ? Math.min(...rates) : null;
  }
  const amounts = (p.packages ?? []).map((k) => k.amount).filter((a) => a != null);
  return amounts.length ? Math.min(...amounts) : null;
}

export function estimate(plan, { participants = 1, option } = {}) {
  const currency = plan?.price?.currency ?? 'EUR';
  const options = planOptions(plan);
  const chosen = options.find((o) => o.value === Number(option)) ?? options[0];
  if (!chosen || chosen.amount == null) return { total: null, currency };
  const n = Math.max(1, Number(participants) || 1);
  const perPerson = plan.price.unit === 'personHour' ? round2(rateFor(plan, n) * chosen.hours) : chosen.amount;
  return { total: round2(perPerson * n), currency, perPerson, option: chosen.value, hours: chosen.hours, days: chosen.days ?? null };
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
