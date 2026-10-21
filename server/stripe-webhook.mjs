/**
 * POST /api/stripe-webhook — the source of truth for payment status (NOT ACTIVE yet).
 * Stripe calls it after checkout; the signature proves the call really comes from Stripe.
 *
 * Environment:
 *   STRIPE_WEBHOOK_SECRET   whsec_… from the Stripe dashboard (Developers → Webhooks)
 * Events to enable: checkout.session.completed, checkout.session.expired, checkout.session.async_payment_failed
 */
import { json } from './shared.mjs';
import { updateBooking } from './booking-store.mjs';

const TOLERANCE_SECONDS = 300;

export async function verifyStripeSignature(rawBody, header, secret, now = Date.now()) {
  const parts = Object.fromEntries(String(header ?? '').split(',').map((kv) => kv.split('=')));
  const timestamp = Number(parts.t);
  if (!timestamp || !parts.v1 || Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  // constant-time comparison
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: 'bad-signature' }, 400);

  const event = JSON.parse(raw);
  const session = event.data?.object ?? {};
  const reference = session.metadata?.reference ?? session.client_reference_id;
  if (!reference) return json({ received: true });

  switch (event.type) {
    case 'checkout.session.completed':
      await updateBooking(reference, { status: session.payment_status === 'paid' ? 'paid' : 'pending', paidAmount: session.amount_total / 100, paymentIntent: session.payment_intent });
      // TODO when activating: send the confirmation email to the customer and the academy here.
      break;
    case 'checkout.session.expired':
      await updateBooking(reference, { status: 'cancelled' });
      break;
    case 'checkout.session.async_payment_failed':
      await updateBooking(reference, { status: 'failed' });
      break;
    default:
      break;
  }
  return json({ received: true });
}
