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
Object.assign(process.env, { RESEND_API_KEY: 'test', ENQUIRY_TO: 'academy@example.com', ENQUIRY_FROM: 'web@example.com', STRIPE_SECRET_KEY: 'sk_test_x', SITE_URL: 'https://example.com', STRIPE_WEBHOOK_SECRET: 'whsec_test', DEPOSIT_PERCENT: '15' });
const post = (body) => new Request('http://x/api', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const good = { plan: { id: 'group' }, option: 1, time: '16:00', level: 'beginner', date: '2027-06-15', participants: 3, contact: { name: 'Test Person', email: 'test@example.com' }, policyAccepted: true, locale: 'es' };

let r = await enquiry(post(good)); let b = await r.json();
assert.equal(r.status, 200); assert.ok(b.reference); assert.equal((await getBooking(b.reference)).status, 'requested');
assert.ok(calls.at(-2).body.includes('Booking request') && calls.at(-2).body.includes('105 EUR')); // academy: 3 × 35 €
assert.ok(calls.at(-1).body.includes('test@example.com') && calls.at(-1).body.includes('solicitud de reserva')); // customer copy, in Spanish
assert.equal((await enquiry(post({ ...good, option: 9 }))).status, 422); // not a published package
assert.equal((await enquiry(post({ ...good, time: '25:00' }))).status, 422); // not a time
assert.equal((await enquiry(post({ ...good, plan: { id: 'private' }, participants: 3 }))).status, 422); // private: 1 or 2 people
assert.equal((await enquiry(post({ ...good, plan: { id: 'inclusive' }, participants: 1 }))).status, 200); // the new inclusive lessons
assert.equal((await enquiry(post({ ...good, plan: { id: 'nope' } }))).status, 422);
assert.equal((await enquiry(post({ ...good, contact: { name: 'A', email: 'bad' } }))).status, 422);
assert.equal((await enquiry(post('not json'))).status, 400);
assert.equal((await enquiry(new Request('http://x', { method: 'GET' }))).status, 405);
assert.equal((await enquiry(post({ type: 'contact', contact: { name: 'Ana', email: 'ana@example.com' }, message: 'Hola' }))).status, 200);
assert.ok(calls.at(-1).body.includes('Website message'));
console.log('enquiry: ok (booking + contact message)');

assert.equal((await checkout(post({ booking: { ...good, policyAccepted: false } }))).status, 422); // conditions must be accepted
r = await checkout(post({ booking: good })); b = await r.json();
assert.equal(r.status, 200); assert.equal(b.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
const stripeBody = new URLSearchParams(calls.at(-1).body);
assert.equal(stripeBody.get('line_items[0][price_data][unit_amount]'), '1575'); // 3 × 35 € = 105 €, 15 % deposit = 15.75 €
assert.ok(stripeBody.get('success_url').startsWith('https://example.com/booking-status.html?status=success')); // Spanish at the root
assert.equal((await getBooking(b.reference)).status, 'pending');
r = await checkout(post({ booking: { ...good, payMode: 'full' } }));
assert.equal(r.status, 200);
assert.equal(new URLSearchParams(calls.at(-1).body).get('line_items[0][price_data][unit_amount]'), '10500'); // the customer chose 100 %
r = await checkout(post({ booking: good })); b = await r.json(); // the deposit booking used by the webhook test below
console.log('checkout: ok (15 % deposit 15.75 EUR of 105 EUR, or 100 % online)');

const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { metadata: { reference: b.reference }, payment_status: 'paid', amount_total: 1575 } } });
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
assert.ok(calls.some((c) => c.body.includes('reserva confirmada') && c.body.includes('89.25 EUR'))); // customer: balance at the school
console.log('webhook: ok (signature checked, booking marked paid)');
console.log('bookings recorded:', (await listBookings()).map((x) => `${x.reference}:${x.status}`).join(', '));
