/**
 * POST /api/enquiry — receives the booking request and emails it to the academy.
 * Use with site.config.json → enquiry: { "provider": "webhook", "endpoint": "/api/enquiry" }.
 *
 * Environment (set on the host, never in the repository):
 *   RESEND_API_KEY   key for https://resend.com (or swap sendMail() for any email/CRM API)
 *   ENQUIRY_TO       academy inbox that receives requests
 *   ENQUIRY_FROM     verified sender, e.g. "Mundaka Surf Academy <reservas@your-domain>"
 */
import { json, validateBooking } from './shared.mjs';
import { createBooking } from './booking-store.mjs';
import { estimate } from '../src/scripts/pricing.js';

async function sendMail({ to, from, replyTo, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from, reply_to: replyTo, subject, text }),
  });
  if (!res.ok) throw new Error(`mail ${res.status}`);
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid-json' }, 400);
  }
  const { booking, plan, error } = await validateBooking(input);
  if (error) return json({ error }, 422);

  const est = estimate(plan, { participants: booking.participants, date: booking.date });
  const reference = await createBooking({ ...booking, estimate: est }, 'requested');
  const lines = [
    `Reference: ${reference}`,
    `Lesson: ${booking.planName}`,
    `Level: ${booking.level}`,
    `Date: ${booking.date} (${booking.time})`,
    `People: ${booking.participants}${booking.ages ? ` — ages ${booking.ages}` : ''}`,
    booking.availability && `Other availability: ${booking.availability}`,
    `Name: ${booking.contact.name}`,
    `Email: ${booking.contact.email}`,
    booking.contact.phone && `Phone: ${booking.contact.phone}`,
    booking.adaptive && 'Adaptive needs: yes',
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
  return json({ ok: true, reference });
}
