/**
 * Booking records — the seam for a real database.
 *
 * Replace the in-memory Map with the academy's chosen store (Postgres/Supabase, Airtable,
 * a Google Sheet, the booking system's API…). Keep the same four functions and the rest of
 * server/ keeps working. The in-memory version loses data on every restart: demo only.
 *
 * Status flow: pending → paid | failed | cancelled   (request-only bookings stay "requested")
 */
const bookings = new Map();

const newReference = () => `MSA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export async function createBooking(data, status = 'requested') {
  const reference = newReference();
  bookings.set(reference, { reference, status, createdAt: new Date().toISOString(), ...data });
  return reference;
}

export async function updateBooking(reference, patch) {
  const current = bookings.get(reference);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  bookings.set(reference, next);
  return next;
}

export async function getBooking(reference) {
  return bookings.get(reference) ?? null;
}

export async function listBookings() {
  return [...bookings.values()];
}
