# Content checklist — Mundaka Surf Academy

Sources reviewed: TESERACT discovery questionnaire (answers marked in blue), the Google Drive folder
(MIKEL, ROBERTO, UR, XABI + "things to improve" doc), the reference video, six reference images,
the supplied logo image and the public header of instagram.com/xabigondra ("Euskal Herria · Mundaka").
Nothing below the line "Still missing" has been invented on the site: it shows **To be confirmed**.

## 1. Questionnaire → website

| # | Question | Answer (questionnaire) | Where it is used |
| --- | --- | --- | --- |
| – | Business / contact | Mundaka Surf Academy · Xabier Gondra León | Logo, header, footer, About, legal pages, structured data |
| 1 | Business name | MUNDAKASURFACADEMY | Written as "Mundaka Surf Academy" (as in the logo) |
| 2 | Main goal | All: enquiries, book & pay online, present classes/instructors | Booking request flow, plans, lessons, About; payment prepared |
| 3 | Customers | All types | Copy addresses beginners, improvers, advanced, children & families, visitors |
| 4 | Services | Private, group, kids, camps/multi-day, **adaptive (disability / special needs)**; rental **not yet** | Five lesson types everywhere; "rental not available yet" on Lessons + FAQ |
| 5 | Levels | All levels | Levels "anatomy" + finder + plans |
| 6 | How to book | Combination: online class/date/time, request, WhatsApp/phone | 4-step booking request; WhatsApp ready (number pending); phone/email slots ready |
| 7 | Availability | Fixed weekly timetable — *monthly hour timetable March–September*; calendar with slots | Season shown site-wide; date picker warns outside March–September |
| 8 | Pricing display | Multiple options | `plans.json` supports per person, per lesson (+ group tiers), packages, seasonal prices |
| 9 | Payment | Card online, pay on arrival, deposit online + balance later | Shown on Plans + FAQ; Stripe deposit flow prepared (`server/`), off |
| 10 | Account | No account (also ticked "not sure") | Guest booking only |
| 11 | Pages | All sections | Home, About & instructor, Lessons, Plans & prices, Booking, Gallery, FAQ, Location, Contact |
| 12 | Languages | EN + ES; German and French if possible | EN + ES built. DE/FR: add `src/locales/de.json`, `fr.json` and enable in config |
| 13 | Style | Clean/minimal + natural/coastal; "visual but easy to book" | Photo-led, white + sea blues, booking CTA in header on every page |
| 14 | Brand materials | Logo, colours, photos & videos; "ideas but not final" | Logo redrawn from the supplied image (see 4. below); Drive photos/videos used |
| 15 | Manage after launch | All of these; needs guidance | Plans editable in one JSON file; text in locale files; README explains |
| – | Competitors | mundakabarrasurf.com, mundakasurfshopschool.com, gudaricaribe.com | Not copied. Used only as a check on what visitors expect to find |
| – | "Things to improve" doc | Windguru Mundaka (waves) + eltiempo.es Mundaka (weather); explain lesson levels like the example, ignore its prices | Conditions cards (Home, Lessons, Location); level descriptions on Lessons |

## 2. Reference → section

| Reference | Used for |
| --- | --- |
| Video (Red Bull "Surfing" scroll) | Home hero: giant MUNDAKA between sky and wave, wave rising to white foam with statement; vertical "Lessons" title with staggered cards; centred header, left social rail, "Explore ↓" |
| 1 · John John Florence | Home "Meet Xabier": brushed double exposure, big serif name, vertical name, B&W photos, statement |
| 2 · Haifins | Lessons hero (wave fading to white, gradient title, floating "Featured" card), levels "anatomy" diagram, framed statements |
| 3 · Epic Portugal | Location page: brushed photo edge, sand page, stylised Spain map with highlighted region, pins and distances |
| 4 · Porten agency | Footer on every page: graded photo, grain, arches, wide uppercase type, BOOK NOW |
| 5 · BluShark | Plans page + home plans band: teal wave, bold title, white-framed photo, pill email box |
| 6 · Between Land & Sea | Poster sections: home CTA, About hero, 404 |

## 3. Drive assets

* **XABI** folder used for Xabier (hero statement layer, Meet section, About, Lessons, Plans, gallery).
* **UR** folder: home hero (`ur_40`/`ur_42`, Mundaka left with the Santa Catalina hermitage), gallery.
* **MIKEL**: gallery, framed sections, both videos. **ROBERTO**: gallery.
* The 30-second academy film (home, instructor section) is built from XABI/UR/MIKEL photos plus the stock lesson photos.
* Lesson-type photos (private, group, kids, courses, adaptive) and some backgrounds are **illustrative Unsplash stock**
  — listed in `docs/IMAGE-CREDITS.md`; replace them with real academy photos when available.
* Duplicates skipped (xabi_52/53, 55/56, 66/67, 71/72). Watermarked photos are credited (Koldo Erauzkin, Martin Ugalde).
* Not used: xabi_47 (group of young people — consent unknown), xabi_64 (jet ski, two people, context unknown).

## 4. Still missing — please confirm

**Business & contact**
- [ ] Email address and phone number (only Instagram is published now)
- [ ] WhatsApp number (feature built, hidden until added)
- [ ] Exact meeting point / beach and parking
- [ ] Domain name (for canonical URLs and sitemap)
- [ ] Legal owner for the legal notice + privacy policy: name or company, NIF/CIF, registered address, data-retention period
- [ ] Is @xabigondra the academy's Instagram or Xabier's personal one? Any other social accounts?

**Lessons & plans** (all shown as "To be confirmed")
- [ ] Prices for each plan (per person / per lesson / package), seasonal prices, discounts
- [ ] Lesson duration, number of sessions in courses/camps, maximum group size
- [ ] What is included (board, wetsuit, insurance?) and what to bring
- [ ] Minimum age for kids' lessons; any requirements (e.g. swimming ability)
- [ ] Safety rules; cancellation / bad-conditions / refund policy; deposit percentage
- [ ] Lesson languages
- [ ] Do lessons run outside March–September?
- [ ] Review the draft copy: level descriptions (Lessons), "How we teach" (About), adaptive-surfing wording

**Instructor**
- [ ] Xabier's qualifications/certifications and years of experience (none are claimed now)
- [ ] A portrait photo of Xabier (the Drive has action shots only)
- [ ] Confirm the XABI folder photos show Xabier; who are Mikel, Roberto and Ur (instructors? students?) and may they appear?
- [ ] Photos of actual lessons, kids and adaptive sessions (none supplied — those cards use illustrative stock photos)
- [ ] Photographer permissions for credited photos; credits for uncredited ones

**Brand**
- [x] Logo supplied (`logo.jpg`) and used as-is on a transparent background; site colours follow it.
- [x] Logo colours confirmed (20/10/2026): keep the supplied logo exactly as is, with the yellow surfer
      (this replaces the earlier "white surfing element" note in the brief).
- [ ] A vector (SVG/AI) version of the logo for print and very large sizes.
- [ ] Real reviews to publish (the section stays hidden until supplied)
- [ ] Check the Spanish academy film (30 s, no sound): every claim in it comes from the questionnaire or the site
      (season March–September, booking without an account, availability confirmed before payment, all levels).
      Add a voice-over or music only with a licensed track.

**Not supplied**
- The "mobile reference video" mentioned in the brief — only one (desktop) video was received. Mobile layouts were
  adapted from the desktop reference.
