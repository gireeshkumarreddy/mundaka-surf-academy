# Mundaka Surf Academy — website

Bilingual (English / Spanish) website for **Mundaka Surf Academy**, instructor **Xabier Gondra León**, Mundaka (Bizkaia).
Static HTML, CSS and a little vanilla JavaScript. No framework, no runtime dependencies. It runs on any static host
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, cPanel…).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds to `dist/`, serves it at http://localhost:4321 and rebuilds on every change |
| `npm run build` | Builds the site into `dist/` (upload this folder) |
| `npm run check` | Builds and verifies every internal link, image, script and `#anchor` |
| `npm test` | Tests the server handlers (network stubbed) and runs the link check |

Node 18 or newer. Nothing to install.

## Where things live

```
site.config.json      ← contact details, WhatsApp, form delivery, payments, review mode (edit this first)
public/data/plans.json← surf plans, prices and conditions — editable WITHOUT rebuilding
src/locales/en.json   ← all English text   src/locales/es.json ← all Spanish text
src/pages/            ← one template per page (home, about, lessons, plans, location, contact, legal…)
src/partials/         ← header, footer, logo, Spain map, shared blocks
src/styles/           ← CSS, concatenated in file-name order
src/scripts/          ← JavaScript modules (hero, plans, booking, integrations/)
public/assets/        ← optimised images (WebP), videos, fonts, favicon
server/               ← reference server functions for email delivery and Stripe (not active)
scripts/              ← build + dev server        _tools/ ← image, map and QA scripts (not deployed)
docs/CONTENT-CHECKLIST.md ← questionnaire answers, what is confirmed, what is still missing
```

## Look & motion

* **Colours**: the logo's radium yellow `#FBDE04`, ink `#141414` and white — no blue anywhere in the interface
  (only the logo artwork and the photos keep their own colours). Buttons are yellow or white. See
  `src/styles/01-tokens.css`. `python -I _tools/logo.py` re-cuts the logo
  from `logo.jpg` (transparent PNG/WebP, wave-and-surfer mark, favicons) if the artwork changes.
* **Header**: small white floating bar with the logo centred inside it (a hairline dark edge keeps the yellow
  lettering readable on white). Full size at the top, smaller while scrolling down (the "Book a lesson" pill folds into a round button),
  full size again when scrolling up. A soft pill glides behind hovered links.
* **Hero**: as you scroll, the letters of MUNDAKA rise one by one from behind the wave; the section stays pinned
  until the word, the statement and the white foam have all played (`src/scripts/hero.js`).
* **Interactions** (`src/scripts/interactions.js`, `src/styles/04-interactions.css`): fill-sweep buttons, magnetic
  call-to-action buttons, a cursor follower with View / Drag / Play labels, drag-to-scroll photo strip, tilt on
  framed photos, hover lifts on cards. Mouse/trackpad only; touch keeps native behaviour.
* **Map** (`src/scripts/map.js`): Spain ⇄ Basque coast zoom, region names on hover, city distances with a line to
  Mundaka, and a Mundaka card with directions. Regenerate the SVG with `python -I _tools/spain_map.py`.
* **Motion** (`src/scripts/motion.js`, `src/styles/03-motion.css`): Lenis smooth scrolling, fade-up on scroll,
  images uncover from the bottom edge upwards, headings rise word by word, and a curtain transition between
  pages. All of it switches off for visitors who ask their device for reduced motion.
* **Photos** are brightened in `_tools/build_images.py` (`brighten()`); re-run it after adding Drive photos.
  The lesson-type photos are HD Unsplash stock (`_tools/build_stock.py`, credits in `docs/IMAGE-CREDITS.md`) until the
  academy has its own.
* **Academy film** (home, instructor section): a 30-second Spanish motion-graphics video made in `video/` (Remotion,
  see `video/README.md`). It grows from small to full width as you scroll (`src/scripts/film.js`), plays muted while
  on screen, and has play/pause, chapter jumps and full screen. Mobile gets the lighter 720p file.
* **Footer**: white, with the logo, arch links and "Book now" — no background photo.

## Everyday edits

* **Text** – change the string in `src/locales/en.json` and `es.json`, then `npm run build`.
* **Plans and prices** – edit `public/data/plans.json` (also on the live server, no rebuild). A `null` value shows
  as "To be confirmed" / "Price on request". Price units: `person`, `lesson` (optionally `perPersonTiers`) or `package`;
  seasonal prices via `seasons: [{ "from": "07-01", "to": "08-31", "amount": 50 }]`.
* **Review markers** – while `reviewMode` is `true`, missing information is highlighted in amber and a few
  notes for the academy are visible. Set it to `false` before launch.

## Switching on the integrations

**WhatsApp** – put the number in `site.config.json → whatsapp.number` (digits with country code, e.g. `34600000000`)
and rebuild. Buttons then appear in the menu, social rail, footer and contact page, and the booking review offers
"send these details on WhatsApp" with the request prefilled. While empty, no WhatsApp link exists anywhere.

**Booking requests** – `site.config.json → enquiry`:
* `"provider": "formspree", "endpoint": "https://formspree.io/f/…"` – quickest, emails each request;
* `"provider": "webhook", "endpoint": "/api/enquiry"` – the included `server/enquiry.mjs`, or any CRM/Make/Zapier URL;
* `"provider": "netlify"` – Netlify Forms.
Until one is set the form runs in demo mode: it validates, shows the review and tells the visitor nothing was sent.

**Online payment** – prepared, off. See `server/README.md`. When ready: deploy the two Stripe functions, set the
secret keys on the host, publish prices in `plans.json`, then set `payments.enabled: true`. The browser never sees
card data or secret keys; the server recalculates every amount from `plans.json`.

## Before launch

1. Fill in the items listed in `docs/CONTENT-CHECKLIST.md` (prices, durations, contact details, legal owner data).
2. Set `siteUrl` (enables canonical URLs, hreflang and `sitemap.xml`) and `reviewMode: false`.
3. `npm run check`, then upload `dist/`.

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages (`.github/workflows/pages.yml`):
https://gireeshkumarreddy.github.io/mundaka-surf-academy/. The project site lives in a sub-folder, so the
workflow sets `SITE_BASE=/mundaka-surf-academy/` (only the 404 page uses root paths). On a host that serves the
site from the domain root, leave `SITE_BASE` unset.

## Mobile performance

* The first screen of every page paints without waiting for scripts: its text and photo animate with CSS
  (`03-motion.css`), and `motion.js` tags each later section's content only as it nears the screen.
* Phones (touch screens) keep native scrolling; Lenis runs only with a mouse or trackpad.
* The Spain map arrives as `<template data-defer>` and is put in place shortly before it scrolls into view.
* Photos have phone-sized variants (768 px full-width, 560 px cards, 200 px logo); the CSS is minified at build time.
* `npm run dev` gzips text files like most hosts, so local Lighthouse runs are realistic.

## Credits

Photos and videos: the academy's Google Drive archive (credited photographers: Koldo Erauzkin, Martin Ugalde).
Lesson-type photos: Unsplash (Unsplash licence) — see `docs/IMAGE-CREDITS.md`.
Map: © Instituto Geográfico Nacional (CC BY 4.0) via es-atlas. Fonts (self-hosted, SIL OFL): Archivo, Playfair
Display. Smooth scrolling: Lenis 1.1.13 (MIT, self-hosted in `public/assets/vendor`).
