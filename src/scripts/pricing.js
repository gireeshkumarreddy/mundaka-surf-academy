/**
 * Price estimates from data/plans.json. Pure functions, shared by the browser and the
 * reference server code (server/), so both always agree.
 *
 * plan.price = {
 *   amount: number | null,                    // null → "price on request"
 *   unit: "person" | "lesson" | "package",    // per participant, per private lesson, per package (per person)
 *   perPersonTiers?: [{ people: 2, amount }], // optional private-lesson price per person by group size
 *   seasons?: [{ from: "07-01", to: "08-31", amount }]  // optional seasonal prices (MM-DD, inclusive)
 * }
 */
export function seasonalAmount(price, isoDate) {
  if (!price || price.amount == null) return null;
  if (!isoDate || !price.seasons?.length) return price.amount;
  const md = isoDate.slice(5, 10);
  const match = price.seasons.find((s) => (s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to));
  return match ? match.amount : price.amount;
}

export function estimate(plan, { participants = 1, date = '' } = {}) {
  const price = plan?.price;
  const base = seasonalAmount(price, date);
  const currency = price?.currency ?? 'EUR';
  if (base == null) return { total: null, currency };
  const n = Math.max(1, Number(participants) || 1);

  if (price.unit === 'lesson') {
    const tier = [...(price.perPersonTiers ?? [])].sort((a, b) => b.people - a.people).find((t) => n >= t.people);
    return tier ? { total: tier.amount * n, currency, perPerson: tier.amount } : { total: base, currency };
  }
  return { total: base * n, currency, perPerson: base };
}

export function formatMoney(amount, currency = 'EUR', locale = 'en') {
  if (amount == null) return null;
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-IE', { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}
