# Server functions (prepared, not active)

Small handlers using the standard `Request` → `Response` API, so they run on Vercel, Netlify (Functions 2.0),
Cloudflare Workers/Pages or a tiny Node server with minimal wiring. Secrets live only in the host's environment.

| File | Route | Purpose |
| --- | --- | --- |
| `enquiry.mjs` | `POST /api/enquiry` | Validates a booking request, records it, emails it to the academy (Resend API) |
| `create-checkout-session.mjs` | `POST /api/create-checkout-session` | Creates a Stripe Checkout session for the full price or a deposit |
| `stripe-webhook.mjs` | `POST /api/stripe-webhook` | Verifies Stripe's signature and marks bookings paid / failed / cancelled |
| `booking-store.mjs` | – | Where bookings are stored. **In-memory placeholder** — replace with a real database |
| `shared.mjs` | – | Validation and `plans.json` loading shared by the handlers |

## Environment variables

| Variable | Used by | Example |
| --- | --- | --- |
| `RESEND_API_KEY` | enquiry | `re_…` |
| `ENQUIRY_TO` / `ENQUIRY_FROM` | enquiry | academy inbox / verified sender |
| `STRIPE_SECRET_KEY` | checkout | `sk_test_…` while testing |
| `STRIPE_WEBHOOK_SECRET` | webhook | `whsec_…` |
| `SITE_URL` | checkout | `https://your-domain` |
| `DEPOSIT_PERCENT` | checkout | `20` (omit to charge the full price) |
| `PLANS_FILE` | all | optional path to `plans.json` if not deployed next to `server/` |

## Payment flow once enabled

1. Visitor completes the booking form → browser posts the booking to `/api/create-checkout-session`.
2. Server validates it, recalculates the price from `plans.json` (refuses if the price is not published),
   stores a `pending` booking and returns Stripe's hosted checkout URL.
3. Visitor pays on Stripe → returns to `booking-status.html?status=success` or `?status=cancelled`.
4. Stripe calls `/api/stripe-webhook` → booking becomes `paid` (or `failed` / `cancelled`). Send confirmation emails here.

Then set in `site.config.json`: `"payments": { "enabled": true, "depositPercent": 20, … }` (the browser uses
`depositPercent` only to show the amount; the server's `DEPOSIT_PERCENT` decides what is charged — keep them equal).

`npm test` runs `_tools/test-server.mjs`, which exercises all three handlers with the network stubbed.
