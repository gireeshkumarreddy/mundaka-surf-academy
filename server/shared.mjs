/** Helpers shared by the server handlers. Standard Request/Response only. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planOptions } from '../src/scripts/pricing.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** Same data/plans.json the website uses — prices are always recalculated from it, never taken from the browser. */
export async function loadPlans() {
  const file = process.env.PLANS_FILE ?? path.join(HERE, '..', 'public', 'data', 'plans.json');
  return JSON.parse(await readFile(file, 'utf8'));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validates a booking request from the website form. Returns { booking } or { error }. */
export async function validateBooking(input) {
  if (!input || typeof input !== 'object') return { error: 'invalid-body' };
  const { plans } = await loadPlans();
  const plan = plans.find((p) => p.id === input.plan?.id && p.bookable !== false);
  if (!plan) return { error: 'unknown-plan' };
  const participants = Number(input.participants);
  if (!Number.isInteger(participants) || participants < 1 || participants > (plan.maxPeople ?? 40)) return { error: 'participants' };
  const time = String(input.time ?? '');
  // a class time from the calendar: "HH:MM-HH:MM" (start-end), or just "HH:MM"
  if (time && !/^([01]\d|2[0-3]):[0-5]\d(-([01]\d|2[0-3]):[0-5]\d)?$/.test(time)) return { error: 'time' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) return { error: 'date' };
  // hours (private) or days (group packages): must be one of the options published in plans.json
  const option = Number(input.option);
  if (!planOptions(plan).some((o) => o.value === option)) return { error: 'option' };
  const name = String(input.contact?.name ?? '').trim();
  const email = String(input.contact?.email ?? '').trim();
  if (name.length < 2 || !EMAIL.test(email)) return { error: 'contact' };
  const clip = (s, n) => String(s ?? '').slice(0, n);
  return {
    plan,
    booking: {
      planId: plan.id,
      planName: plan.name?.en ?? plan.id,
      option,
      level: clip(input.level, 20),
      date: input.date,
      time,
      payMode: input.payMode === 'full' ? 'full' : 'deposit',
      participants,
      contact: { name: clip(name, 120), email: clip(email, 200), phone: clip(input.contact?.phone, 40) },
      policyAccepted: input.policyAccepted === true,
      message: clip(input.message, 3000),
      locale: input.locale === 'en' ? 'en' : 'es',
    },
  };
}

/** Sends one plain-text email through Resend (https://resend.com); swap the fetch for any other email API. */
export async function sendMail({ to, from, replyTo, subject, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from, reply_to: replyTo, subject, text }),
  });
  if (!res.ok) throw new Error(`mail ${res.status}`);
}

/** Confirmation for the customer, in the language they booked in. status: 'requested' | 'paid'. */
export function customerEmail(booking, est, reference, status, paid = null) {
  const es = booking.locale !== 'en';
  const eur = (n) => (n == null ? (es ? 'precio a confirmar' : 'price to be confirmed') : `${n.toFixed(2)} EUR`);
  const unit = es ? (booking.option === 1 ? 'día' : 'días') : booking.option === 1 ? 'day' : 'days';
  const option = est.hours && !est.days ? `${booking.option} h` : `${booking.option} ${unit}`;
  const lines = es
    ? [
        status === 'paid' ? 'Gracias: tu reserva en Mundaka Surf Academy está confirmada.' : 'Gracias: hemos recibido tu solicitud de reserva en Mundaka Surf Academy.',
        '',
        `Referencia: ${reference}`,
        `Clase: ${booking.planName} (${option})`,
        `Fecha: ${booking.date}${booking.time ? ` · ${booking.time}` : ' (hora según marea, te la confirmamos)'}`,
        `Personas: ${booking.participants}`,
        `Total: ${eur(est.total)}`,
        paid != null ? `Pagado online: ${eur(paid)}` : null,
        paid != null && est.total != null && est.total - paid > 0 ? `A pagar en la escuela (efectivo o tarjeta): ${eur(Math.round((est.total - paid) * 100) / 100)}` : null,
        '',
        'Las clases dependen de la marea y del estado del mar: te escribiremos para confirmar la hora.',
        'Mundaka Surf Academy · Erreka 6, 48360 Mundaka · mundakasurfacademy@gmail.com',
      ]
    : [
        status === 'paid' ? 'Thank you: your booking with Mundaka Surf Academy is confirmed.' : 'Thank you: we have received your booking request at Mundaka Surf Academy.',
        '',
        `Reference: ${reference}`,
        `Lesson: ${booking.planName} (${option})`,
        `Date: ${booking.date}${booking.time ? ` · ${booking.time}` : ' (time set by the tide, we will confirm it)'}`,
        `People: ${booking.participants}`,
        `Total: ${eur(est.total)}`,
        paid != null ? `Paid online: ${eur(paid)}` : null,
        paid != null && est.total != null && est.total - paid > 0 ? `To pay at the school (cash or card): ${eur(Math.round((est.total - paid) * 100) / 100)}` : null,
        '',
        'Lessons depend on the tide and the sea: we will write to confirm the time.',
        'Mundaka Surf Academy · Erreka 6, 48360 Mundaka · mundakasurfacademy@gmail.com',
      ];
  return {
    subject: es ? `Mundaka Surf Academy — ${status === 'paid' ? 'reserva confirmada' : 'solicitud recibida'} (${reference})` : `Mundaka Surf Academy — ${status === 'paid' ? 'booking confirmed' : 'request received'} (${reference})`,
    text: lines.filter((l) => l != null).join('\n'),
  };
}
