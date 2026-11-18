# Mundaka Surf Academy — website

Bilingual website (**Spanish first**, English under `/en/`) for **Mundaka Surf Academy**, Erreka 6, 48360 Mundaka (Bizkaia),
built to the client's design brief (`docs/BRIEF.md` maps every point of the brief to the site).
Static HTML, CSS and a little vanilla JavaScript. No framework, no runtime dependencies; runs on any static host.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds to `dist/`, serves it at http://localhost:4321 and rebuilds on every change (restart it after editing `scripts/build.mjs`) |
| `npm run build` | Builds the site into `dist/` (upload this folder) |
| `npm run check` | Builds and verifies every internal link, image, script and `#anchor` |
| `npm test` | Tests the server handlers (bookings, deposit checkout, emails; network stubbed) and runs the link check |

Node 18 or newer. Nothing to install.

## Where things live

```
site.config.json          ← contact details, WhatsApp number, socials, hero video, forms, payments, forecast widgets
public/data/plans.json    ← lessons and prices (Group and Advanced 1–5 and 7 days 35–160 €, Private 1 h 60/55/50 € per person for 1/2/3 people, Inclusive 50 €/person/hour)
public/data/schedule.json ← booking calendar: season and tide-based lesson times per day (_tools/import_calendar.py loads the academy's PDF)
public/data/team.json     ← instructor cards (add an entry to add an instructor)
public/data/gallery.json  ← gallery: instructors (first 3 show, "Ver más" opens the rest) and class photos (after the drone clips)
public/data/mundaka-photos.json ← 'Mundaka en fotos' on Our story (photographer in site.config.json → photographer)
src/locales/es.json, en.json ← all text, Spanish and English
src/pages/                ← one template per page      src/partials/ ← header, footer, map, section buttons, icons
src/styles/               ← CSS, concatenated in file-name order (01-tokens.css = colours and type)
src/scripts/              ← booking, contact, gallery, cookie consent, embeds, motion
brand/                    ← the two logos and the main photo, as delivered in the brief
server/                   ← server functions: booking/contact email, Stripe deposit checkout, webhook (not deployed)
_tools/                   ← brand.py (logos → web), build_enhanced.py (enhanced photos → web), import_photos.py (client photos → web, resize only), QA scripts
```

## Brand

* **Colours** (sampled from the logos): deep teal `#004A5C`, badge teal `#006C88`, turquoise `#30CBC6`, aqua `#A0F5EE`,
  on white. Turquoise and aqua are fills only (too light for text on white). Tokens in `src/styles/01-tokens.css`.
* **Logos**: Logo 1 (horizontal) in the header and the home hero; Logo 2 (round badge) in the footer, favicons, page
  headers and the booking summary. `python -I _tools/brand.py` re-cuts them from `brand/` when the original files arrive.
* **Type**: Montserrat (headings, close to the MUNDAKA lettering) and Inter (text), self-hosted (SIL OFL).
* **Photos**: the five main scenic photos (home hero, Our story ×2, Lessons and Surf & weather heroes) were upscaled to
  4K with Higgsfield (`bytedance_image_upscale`, script in `_source/enhance/run.sh`, not in git) and given a light colour
  lift by `_tools/build_enhanced.py`. Surfers are kept exactly as photographed: the area around each person is restored
  from the original (`PROTECT` in that script), because the upscaler redraws faces.

## Everyday edits

* **Text** – `src/locales/es.json` and `en.json`, then `npm run build`.
* **Prices** – `public/data/plans.json` (booking form and server read it live; rebuild to refresh the printed tables).
* **Instructors** – `public/data/team.json`: name, role, bio, certificates and a photo name (4:5, one different photo per person).
* **Reviews** – `site.config.json → reviews.items` (name, date, rating, text) and `reviews.googleUrl`.
* **WhatsApp** – `site.config.json → whatsapp.number` (temporary number from the brief); every button uses it.
* **Hero video** – `site.config.json → hero.video` is a name: `public/assets/video/<name>.mp4` (landscape, 1280 px) and `<name>-phone.mp4` (portrait cut for phones); the still of its first frame is the image `hero-urdaibai` / `hero-urdaibai-m`. The video starts after the first paint and never for "reduce motion" / "save data" (`src/scripts/hero-video.js`). Encoded with the ffmpeg bundled in the media venv: H.264, CRF 26, no audio, `-movflags +faststart`; the phone cut is `crop=404:720:219:0`. Empty = the main photo again.
* **Lesson clips** – the drone clips on the Lessons page (`lesson-group.mp4`, `lesson-private.mp4`, 960 px, CRF 28) download only when near the screen and play while visible (`src/scripts/inview-video.js`).
* **Review markers** – while `reviewMode` is `true`, everything still to be supplied by the academy shows in amber. Set it
  to `false` before launch.

## Admin (CMS)

A browser-only admin panel (Spanish) lives at **`/admin/`**
(https://gireeshkumarreddy.github.io/mundaka-surf-academy/admin/; source in `public/admin/`, no dependencies). It is
`noindex` and disallowed in `robots.txt`. It edits the files below through the GitHub API; every **Guardar** is **one
commit** on `main`, so one save = one Pages deploy (the site is live again 1–2 minutes later).

**Access token (once per person/device).** GitHub → **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token** → *Repository access*: **Only select repositories** → this repository →
*Repository permissions*: **Contents: Read and write** (nothing else) → choose an expiry → generate, then paste it in the
panel. The token stays in that browser's localStorage until **Olvidar token**; it only ever goes to `api.github.com` in
the `Authorization` header. Revoke it on the same GitHub page if a device is lost. Without a token, **Ver sin conectar**
opens a read-only preview built from the published `/data/*.json`.

| Section | Edits |
| --- | --- |
| Precios / clases | `public/data/plans.json` – names, summaries, per-hour price and bookable hours (private), day packages (group, advanced) |
| Instructores | `public/data/team.json` – add, remove, reorder cards; name, role, bio, certificates, photo (one photo per card, enforced) |
| Galería | `public/data/gallery.json` – upload, remove, reorder, category (lessons / instructors), alt text ES/EN |
| Opiniones | `site.config.json → reviews` – Google link and testimonials (name, date, 1–5 stars, text ES/EN) |
| Ajustes / contacto | `site.config.json` – email, address, WhatsApp number and display, Instagram/Facebook, hero video, `siteUrl`, `reviewMode` |
| Textos | `src/locales/es.json` + `en.json` – every text, searchable, ES and EN side by side, saved together |

How it saves: Git Data API (blobs → tree → commit → fast-forward the ref). Before committing it re-reads `main`; if a
file it is about to write changed on GitHub since it was loaded, it stops, reloads that file and says so (nothing is
overwritten). Files are patched in place: only changed values are rewritten, so formatting, key order and the
`$comment` keys are kept. Uploaded photos are resized in the browser to WebP (quality 0.82) at 480/800/1200/1600 px wide
(only widths ≤ the original; instructor photos can be cropped to 4:5) and committed as
`public/assets/img/<name>-<width>.webp` together with the JSON change. Photo upload needs a browser that can encode WebP
(Chrome, Edge, Firefox on a computer or Android; Safari/iOS may not: the panel checks and says so). Removing a photo
from the gallery or a card does not delete its files. Helper tests: `node _tools/test-admin.mjs`.

## Booking and payments

**Until March 2027: booking requests only.** The academy can't take payments before registering as autónomo, so
`site.config.json → payments.enabled` is `false` and the whole site follows it: the booking page shows no 15 % / 100 %
choice, no "pay now" amounts and no deposit examples; the button says "Enviar solicitud"; the booking page, conditions
and FAQ say that nothing is paid online and the academy confirms each booking and how to pay. Setting it to `true`
(with the Stripe functions deployed) brings back the deposit texts, the payment choice and the deposit tables.

Booking (`book.html`): **tide calendar** (season and daily lesson times in `public/data/schedule.json`) → lesson type
(group/beginners, advanced & technical, private for 1–2 people, inclusive) → duration, people, level → details →
booking conditions accepted → pay the **15 % deposit** or **100 %** online; the summary always shows total, what is
paid now and the balance at the school. Hosting, domain and Stripe steps: `docs/DOMAIN-AND-PAYMENTS.md`. Until payments
are switched on the form sends a booking request (or runs in demo mode if no delivery is configured).

* **Delivery** – `site.config.json → enquiry`: `formspree`, `netlify` or `webhook` (`server/enquiry.mjs` emails the
  academy and a copy to the customer).
* **Deposit online** – deploy the server functions with the Stripe and email keys (`server/README.md`), then set
  `payments.enabled: true`. The server recalculates every amount from `plans.json`; the webhook sends the confirmation
  emails to the customer and the academy.

## Cookies and embeds

The site sets no cookies of its own. Google Maps, Windguru and AEMET load only after "Accept all" in the cookie banner
or when the visitor presses the embed's own button (`src/scripts/consent.js`, `embed.js`).

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/pages.yml`):
https://gireeshkumarreddy.github.io/mundaka-surf-academy/ (the workflow sets `SITE_BASE=/mundaka-surf-academy/`).
Before launch: fill in what `docs/BRIEF.md` lists as pending, set `siteUrl` and `reviewMode: false`, run `npm run check`.

## Credits

Photos: the academy's archive (Koldo Erauzkin, Martin Ugalde); some lesson photos from Unsplash. Fonts: Montserrat, Inter
(SIL OFL). Smooth scrolling: Lenis 1.1.13 (MIT). Forecasts: Windguru, AEMET. Map: Google Maps.
