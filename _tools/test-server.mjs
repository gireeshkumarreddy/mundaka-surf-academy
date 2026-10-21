// Local checks for server/ handlers. Network calls are stubbed: nothing is sent anywhere.
import assert from 'node:assert/strict';
import enquiry from '../server/enquiry.mjs';
import checkout from '../server/create-checkout-session.mjs';
import webhook, { verifyStripeSignature } from '../server/stripe-webhook.mjs';
import { getBooking, listBookings } from '../server/booking-store.mjs';

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: String(init.body) });
  if (url.includes('stripe.com')) return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
  return new Response('{}', { status: 200 });
};
Object.assign(process.env, { RESEND_API_KEY: 'test', ENQUIRY_TO: 'academy@example.com', ENQUIRY_FROM: 'web@example.com', STRIPE_SECRET_KEY: 'sk_test_x', SITE_URL: 'https://example.com', STRIPE_WEBHOOK_SECRET: 'whsec_test', DEPOSIT_PERCENT: '20' });
const post = (body) => new Request('http://x/api', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { plan: { id: 'group' }, level: 'beginner', date: '2027-06-15', time: 'morning', participants: 3, contact: { name: 'Test Person', email: 'test@example.com' }, locale: 'es' };

let r = await enquiry(post(good)); let b = await r.json();
assert.equal(r.status, 200); assert.ok(b.reference); assert.equal((await getBooking(b.reference)).status, 'requested');
assert.ok(calls.at(-1).body.includes('Booking request') && calls.at(-1).body.includes('price on request'));
assert.equal((await enquiry(post({ ...good, plan: { id: 'nope' } }))).status, 422);
assert.equal((await enquiry(post({ ...good, contact: { name: 'A', email: 'bad' } }))).status, 422);
assert.equal((await enquiry(post('not json'))).status, 400);
assert.equal((await enquiry(new Request('http://x', { method: 'GET' }))).status, 405);
console.log('enquiry: ok');

// prices are null in plans.json → checkout must refuse rather than invent an amount
r = await checkout(post({ booking: good })); assert.equal(r.status, 409);
process.env.PLANS_FILE = '_tools/test-plans.json';
const fs = await import('node:fs');
const plans = JSON.parse(fs.readFileSync('public/data/plans.json', 'utf8'));
plans.plans.find((p) => p.id === 'group').price.amount = 40;
fs.writeFileSync('_tools/test-plans.json', JSON.stringify(plans));
r = await checkout(post({ booking: good })); b = await r.json();
assert.equal(r.status, 200); assert.equal(b.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
const stripeBody = new URLSearchParams(calls.at(-1).body);
assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '2400'); // 3 × 40 € = 120 €, 20 % deposit = 24.00 €
assert.ok(stripeBody.get('success_url').startsWith('https://example.com/es/booking-status.html?status=success'));
assert.equal((await getBooking(b.reference)).status, 'pending');
console.log('checkout: ok (deposit 24.00 EUR)');

const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { metadata: { reference: b.reference }, payment_status: 'paid', amount_total: 2400 } } });
const t = Math.floor(Date.now() / 1000);
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec_test'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${event}`)))].map((x) => x.toString(16).padStart(2, '0')).join('');
assert.equal(await verifyStripeSignature(event, `t=${t},v1=${sig}`, 'whsec_test'), true);
assert.equal(await verifyStripeSignature(event, `t=${t},v1=${sig.replace(/^./, '0')}`, 'whsec_test'), false);
assert.equal(await verifyStripeSignature(event, `t=${t - 1000},v1=${sig}`, 'whsec_test'), false);
const bad = await webhook(new Request('http://x', { method: 'POST', body: event, headers: { 'stripe-signature': `t=${t},v1=deadbeef` } }));
assert.equal(bad.status, 400);
const okRes = await webhook(new Request('http://x', { method: 'POST', body: event, headers: { 'stripe-signature': `t=${t},v1=${sig}` } }));
assert.equal(okRes.status, 200);
assert.equal((await getBooking(b.reference)).status, 'paid');
console.log('webhook: ok (signature checked, booking marked paid)');
fs.rmSync('_tools/test-plans.json');
console.log('bookings recorded:', (await listBookings()).map((x) => `${x.reference}:${x.status}`).join(', '));
