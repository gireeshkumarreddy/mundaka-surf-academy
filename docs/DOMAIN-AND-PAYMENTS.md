# Domain, hosting and online payments — what is needed

## Why the hosting has to change before payments go live
The site is on GitHub Pages today. Pages only serves files: it cannot run the small server functions in
`server/` that create the Stripe payment, receive Stripe's confirmation and send the emails. Recommended: move the
site to **Vercel** (free plan is enough; the studio already has a Vercel account). Vercel serves the same static
site *and* runs `server/*.mjs` as `/api/*` functions. Do this before connecting the domain, so the DNS is set once.

## 1. Domain (the client bought it)
Needed from the client: the domain name and access to the registrar's DNS panel (or a short screen-share).
1. Add the domain to the Vercel project (Settings → Domains): `example.com` and `www.example.com`.
2. Vercel shows the exact records to create at the registrar — normally:
   - `A` record for `@` → `76.76.21.21`
   - `CNAME` record for `www` → `cname.vercel-dns.com`
3. Wait for the green check in Vercel (minutes to a few hours). HTTPS is automatic.
4. In `site.config.json` set `"siteUrl": "https://example.com"` (enables canonical links, hreflang and the sitemap)
   and build without `SITE_BASE` (the site lives at the domain root).

## 2. Online payments (Stripe) — a 20-minute call with the client
The client, on stripe.com, creates the account in the business's name:
- Business type: individual / sole trader (autónomo) — Xabier Gondra León, NIF 20975102E,
  address Barrio Erreka nº 3, Mundaka; the website URL; a phone number.
- The bank account (IBAN) where Stripe pays out. **Never send passwords, card or bank details by chat or email.**
- Activate the account (Stripe asks for an ID check).
During the call we create, inside Stripe and Vercel (not by message):
- `STRIPE_SECRET_KEY` (a restricted live key) and the webhook to `https://example.com/api/stripe-webhook`
  → `STRIPE_WEBHOOK_SECRET`. Both go straight into Vercel's environment variables.
- `DEPOSIT_PERCENT=15` and `SITE_URL=https://example.com`.
Then `site.config.json → payments.enabled: true`. Test once in Stripe's test mode, then live.

## 3. Confirmation emails
A sending service (Resend, free tier) verified on the new domain (three DNS records it shows), then
`RESEND_API_KEY`, `ENQUIRY_FROM=reservas@example.com`, `ENQUIRY_TO=mundakasurfacademy@gmail.com` in Vercel.

## 4. Booking storage
`server/booking-store.mjs` keeps bookings in memory (demo only). For live payments connect a small database
(Vercel KV / Upstash Redis is the simplest) so paid bookings survive restarts and the academy can list them.

## 5. Tide calendar
The calendar reads `public/data/schedule.json` (season March–October 2027). When the client's spreadsheet arrives
(date, low/high tide, lesson times), it is converted into that file; the format is described at its top.
Note: slots are not limited by capacity yet — the academy confirms each booking.
