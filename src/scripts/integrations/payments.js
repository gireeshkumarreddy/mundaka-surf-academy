/**
 * Online payment — prepared, NOT active (site.config.json → payments.enabled = false).
 *
 * How it will work once a provider is chosen (Stripe Checkout assumed, see server/README.md):
 *   1. the browser sends the booking request (plan id, date, participants, contact) to
 *      payments.checkoutEndpoint — a server function that holds the secret key;
 *   2. the server recalculates the price from data/plans.json (never trusting the browser),
 *      stores a "pending" booking and returns the provider's hosted checkout URL;
 *   3. the visitor pays on the provider's page (card details never touch this site);
 *   4. the provider redirects to booking-status.html?status=success|cancelled and calls the
 *      server webhook, which marks the booking paid / failed.
 */
export function paymentsEnabled(config) {
  return Boolean(config.payments?.enabled && config.payments?.checkoutEndpoint);
}

/** Amount due now under the configured mode (full, or deposit with balance on the day). */
export function amountDueNow(total, config) {
  if (total == null) return null;
  const { mode, depositPercent } = config.payments ?? {};
  if (mode === 'deposit') return depositPercent ? Math.round(total * depositPercent) / 100 : null;
  return total;
}

export async function startCheckout(config, booking) {
  if (!paymentsEnabled(config)) throw new Error('payments-disabled');
  const res = await fetch(config.payments.checkoutEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking, locale: config.locale }),
  });
  if (!res.ok) throw new Error(`checkout-failed-${res.status}`);
  const { url } = await res.json();
  if (!url || !/^https:\/\//.test(url)) throw new Error('checkout-invalid-url');
  window.location.assign(url);
}
