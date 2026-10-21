/** Helpers shared by the server handlers. Standard Request/Response only. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  if (!Number.isInteger(participants) || participants < 1 || participants > 40) return { error: 'participants' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) return { error: 'date' };
  const name = String(input.contact?.name ?? '').trim();
  const email = String(input.contact?.email ?? '').trim();
  if (name.length < 2 || !EMAIL.test(email)) return { error: 'contact' };
  const clip = (s, n) => String(s ?? '').slice(0, n);
  return {
    plan,
    booking: {
      planId: plan.id,
      planName: plan.name?.en ?? plan.id,
      level: clip(input.level, 20),
      date: input.date,
      time: clip(input.time, 20),
      participants,
      ages: clip(input.ages, 200),
      availability: clip(input.availability, 1000),
      contact: { name: clip(name, 120), email: clip(email, 200), phone: clip(input.contact?.phone, 40) },
      adaptive: Boolean(input.adaptive),
      message: clip(input.message, 3000),
      locale: input.locale === 'es' ? 'es' : 'en',
    },
  };
}
