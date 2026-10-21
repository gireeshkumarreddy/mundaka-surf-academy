/**
 * POST /api/create-checkout-session — NOT ACTIVE until site.config.json → payments.enabled = true.
 *
 * Creates a Stripe Checkout session for the amount due now (full price or deposit), recalculated
 * here from data/plans.json. Card details are entered on Stripe's page, never on this website.
 *
 * Environment:
 *   STRIPE_SECRET_KEY   sk_test_… while testing, sk_live_… in production
 *   SITE_URL            https://your-domain (used for the return pages)
 *   DEPOSIT_PERCENT     optional, e.g. 20 (otherwise the full amount is charged)
 */
import { json, validateBooking } from './shared.mjs';
import { createBooking, updateBooking } from './booking-store.mjs';
import { estimate } from '../src/scripts/pricing.js';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }
  const { booking, plan, error } = await validateBooking(body.booking);
  if (error) return json({ error }, 422);

  const est = estimate(plan, { participants: booking.participants, date: booking.date });
  if (est.total == null) return json({ error: 'price-not-published' }, 409);
  const percent = Number(process.env.DEPOSIT_PERCENT) || 100;
  const dueNow = Math.round(est.total * percent) / 100;

  const reference = await createBooking({ ...booking, estimate: est, dueNow }, 'pending');
  const site = process.env.SITE_URL.replace(/\/$/, '');
  const prefix = booking.locale === 'es' ? '/es' : '';
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': (est.currency || 'EUR').toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(Math.round(dueNow * 100)),
    'line_items[0][price_data][product_data][name]': `${booking.planName} — ${booking.date}${percent < 100 ? ` (deposit ${percent}%)` : ''}`,
    customer_email: booking.contact.email,
    client_reference_id: reference,
    'metadata[reference]': reference,
    locale: booking.locale,
    success_url: `${site}${prefix}/booking-status.html?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}${prefix}/booking-status.html?status=cancelled`,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    await updateBooking(reference, { status: 'failed', error: session.error?.message });
    return json({ error: 'checkout-failed' }, 502);
  }
  await updateBooking(reference, { checkoutSessionId: session.id });
  return json({ url: session.url, reference });
}
