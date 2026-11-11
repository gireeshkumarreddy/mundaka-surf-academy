/**
 * POST /api/enquiry — receives the booking request and emails it to the academy.
 * Use with site.config.json → enquiry: { "provider": "webhook", "endpoint": "/api/enquiry" }.
 *
 * Environment (set on the host, never in the repository):
 *   RESEND_API_KEY   key for https://resend.com (or swap sendMail() for any email/CRM API)
 *   ENQUIRY_TO       academy inbox that receives requests
 *   ENQUIRY_FROM     verified sender, e.g. "Mundaka Surf Academy <reservas@your-domain>"
 */
import { json, validateBooking, sendMail, customerEmail } from './shared.mjs';
import { createBooking } from './booking-store.mjs';
import { estimate } from '../src/scripts/pricing.js';


export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }
  // plain message from the contact page
  if (input?.type === 'contact') {
    const name = String(input.contact?.name ?? '').trim().slice(0, 120);
    const email = String(input.contact?.email ?? '').trim().slice(0, 200);
    const message = String(input.message ?? '').trim().slice(0, 5000);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || message.length < 2) return json({ error: 'contact' }, 422);
    try {
      await sendMail({ to: process.env.ENQUIRY_TO, from: process.env.ENQUIRY_FROM, replyTo: email, subject: `Website message — ${name}`, text: [`Name: ${name}`, `Email: ${email}`, input.contact?.phone && `Phone: ${String(input.contact.phone).slice(0, 40)}`, '', message].filter((l) => l != null && l !== undefined).join('\n') });
    } catch (err) {
      console.error(err);
      return json({ error: 'delivery-failed' }, 502);
    }
    return json({ ok: true });
  }

  const { booking, plan, error } = await validateBooking(input);
  if (error) return json({ error }, 422);

  const est = estimate(plan, { participants: booking.participants, option: booking.option });
  const reference = await createBooking({ ...booking, estimate: est }, 'requested');
  const lines = [
    `Reference: ${reference}`,
    `Lesson: ${booking.planName}`,
    `Level: ${booking.level}`,
    `Option: ${plan.price?.unit === 'personHour' ? `${booking.option} h` : `${booking.option} day(s)`}`,
    `Date: ${booking.date}`,
    `People: ${booking.participants}`,
    `Name: ${booking.contact.name}`,
    `Email: ${booking.contact.email}`,
    booking.contact.phone && `Phone: ${booking.contact.phone}`,
    `Booking conditions accepted: ${booking.policyAccepted ? 'yes' : 'no'}`,
    booking.message && `Message: ${booking.message}`,
    `Estimate: ${est.total == null ? 'price on request' : `${est.total} ${est.currency}`}`,
    `Site language: ${booking.locale}`,
  ].filter(Boolean);

  try {
    await sendMail({
      to: process.env.ENQUIRY_TO,
      from: process.env.ENQUIRY_FROM,
      replyTo: booking.contact.email,
      subject: `Booking request — ${booking.planName} — ${booking.date}`,
      text: lines.join('\n'),
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'delivery-failed' }, 502);
  }
  // copy for the customer (a failure here does not lose the request: the academy already has it)
  try {
    await sendMail({ to: booking.contact.email, from: process.env.ENQUIRY_FROM, replyTo: process.env.ENQUIRY_TO, ...customerEmail(booking, est, reference, 'requested') });
  } catch (err) {
    console.error('customer copy failed', err);
  }
  return json({ ok: true, reference });
}
