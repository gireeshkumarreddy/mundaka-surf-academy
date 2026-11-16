# Domain, hosting and online payments — what is needed

## Why the hosting has to change before payments go live
The site is on GitHub Pages today. Pages only serves files: it cannot run the small server functions in
`server/` that create the Stripe payment, receive Stripe's confirmation and send the emails. Recommended: move the
site to a host with functions. **Vercel** serves the same static site *and* runs `server/*.mjs` as `/api/*` functions,
but its free Hobby plan is for non-commercial use only, so a business taking payments needs Vercel Pro (about $20 a
month). **Cloudflare Pages** (with Pages Functions) has a free plan that allows commercial use. Decide before
connecting the domain, so the DNS is set once.

The domain comes with hosting from RK Solutions until 30-09-2027 (see below). If that hosting is ordinary shared
hosting it can serve the static site, but not the Node functions for Stripe and the emails; ask RK what it includes.

## 1. Domain (the client bought it)
**mundakasurfacademy.com**, registered with **RK Solutions** (Erreka Informatika S.L., Gernika-Lumo) on 01-10-2026:
domain registration 85 € with hosting included from 01-10-2026 to 30-09-2027 (client feedback 3). The DNS is managed
at RK Solutions: either the client gives access to RK's panel on a short screen-share, or RK creates the records below
on request. Never ask for the password by message.
1. Add the domain to the Vercel project (Settings → Domains): `mundakasurfacademy.com` and `www.mundakasurfacademy.com`.
2. Vercel shows the exact records to create at the registrar — normally:
   - `A` record for `@` → `76.76.21.21`
   - `CNAME` record for `www` → `cname.vercel-dns.com`
3. Wait for the green check in Vercel (minutes to a few hours). HTTPS is automatic.
4. In `site.config.json` set `"siteUrl": "https://mundakasurfacademy.com"` (enables canonical links, hreflang and the sitemap)
   and build without `SITE_BASE` (the site lives at the domain root).

## 2. Online payments (Stripe) — a 20-minute call with the client
Status (client feedback 3): the account is created; the bank details are still to add, then we meet.
The client, on stripe.com, completes the account in the business's name:
- Business type: individual / sole trader (autónomo) — Xabier Gondra León, NIF 20975102E,
  address Barrio Erreka nº 6, 48360 Mundaka (the school, as on the legal notice); the website URL; a phone number.
- The bank account (IBAN) where Stripe pays out. **Never send passwords, card or bank details by chat or email.**
- Activate the account (Stripe asks for an ID check).
During the call we create, inside Stripe and Vercel (not by message):
- `STRIPE_SECRET_KEY` (a restricted live key) and the webhook to `https://mundakasurfacademy.com/api/stripe-webhook`
  → `STRIPE_WEBHOOK_SECRET`. Both go straight into Vercel's environment variables.
- `DEPOSIT_PERCENT=15` and `SITE_URL=https://mundakasurfacademy.com`.
Then `site.config.json → payments.enabled: true`. Test once in Stripe's test mode, then live.

## 3. Confirmation emails
A sending service (Resend, free tier) verified on the new domain (three DNS records it shows), then
`RESEND_API_KEY`, `ENQUIRY_FROM=reservas@mundakasurfacademy.com`, `ENQUIRY_TO=mundakasurfacademy@gmail.com` in Vercel.

## 4. Booking storage
`server/booking-store.mjs` keeps bookings in memory (demo only). For live payments connect a small database
(Vercel KV / Upstash Redis is the simplest) so paid bookings survive restarts and the academy can list them.

## 5. Tide calendar
The calendar reads `public/data/schedule.json` (season March–October 2027). It is loaded from the academy's class
calendar PDF (one page per month: each low tide and the two groups around it, 2 h before and 2 h after, in daylight):
`~/.local/venvs/media/bin/python3 -I _tools/import_calendar.py <calendar.pdf> 2027-03-01 2027-10-31` — it checks every
month is complete and stops on anything it can't read. 245 days, 533 class times for 2027.
Note: slots are not limited by capacity yet — the academy confirms each booking.
