# Website brief → site

How each point of *Mundaka Surf Academy – Website design brief* is implemented, and what the academy still has to send.
Everything marked **pending** shows as an amber marker on the site while `reviewMode` is `true`.

| Brief | Done on the site | Pending from the academy |
| --- | --- | --- |
| 1. Bilingual, ES main / EN second, ES/EN toggle on every page | Spanish at the root, English under `/en/`; toggle in header, mobile menu and footer; all text, buttons, booking and policies in both | — |
| 1. Naming rule | "Mundaka Surf Academy" everywhere (socials, footer, meta); "Xabi" only in the home presentation | — |
| 1. Contact details | Erreka 6, email, WhatsApp 688 68 14 36 (one place: `site.config.json`), Instagram and Facebook @mundakasurfacademy | Business WhatsApp number |
| 2. Logos and palette | Logo 1 in header + hero; Logo 2 in footer, favicons, page headers, booking; palette #004A5C / #006C88 / #30CBC6 / #A0F5EE on white | Original logo files (cut from the PDF for now) |
| 3. Sitemap | Home, Our story, Instructors, Lessons, Book now, Conditions, Surf & weather, Gallery, FAQ, Contact; footer with contact, socials, legal notice, privacy, cookie policy | — |
| 4. Home | Hero (Logo 1, tagline, Book now + WhatsApp, main photo, video-ready) → Xabi → Google map at Erreka 6 + Get directions → Windguru + AEMET → 3 class cards with "from" price → reviews → footer with Logo 2 | Drone video; Xabi's final text (provisional text shown, no lorem ipsum published); reviews or Google reviews link |
| 4.1 About | Our story page: title + 3 paragraphs + photo, linked from the Xabi block | Final story text (provisional text shown) |
| 5. Instructors | 4 cards from `public/data/team.json` (grid grows when entries are added), same 4:5 crop, certificates block, WhatsApp at the end | 4 different photos, names, roles, bios, certificates |
| 6. Lessons and pricing | Three blocks (Private 60 €/person/hour; Group and Advanced/Technical 1–5 days, 35–135 €), each with description, price table, level/where/when and Book button; practical info: where, when, how a lesson works, what to bring, groups, getting here | Final spots; whether groups need 6+ people |
| 7. Booking | Type, duration, date, people, level → summary with total, 15 % now, 85 % at the school; conditions shown with a required checkbox before paying; deposit examples table; confirmation email to customer and academy (server) | Stripe account + email service keys to switch the online deposit on |
| 8. Policy | Own page, footer link, summary + checkbox in the booking flow | Cancellation deadline / refunds, weather cancellations, no-show and lateness (marked "to be confirmed") |
| 9. Surf & weather | Windguru spot 48688 (Mundaka) and AEMET Mundaka embedded on the Surf & weather page, compact version on Home | — |
| 10. FAQ | The six reference topics, plus cancellation | — |
| 11. Gallery | Grid, lightbox, Lessons / Instructors filter | Client photos from Google Drive (archive photos used for now) |
| 12. WhatsApp | Floating button on every page + WhatsApp next to "Book now" at the end of every section; prefilled "¡Hola! Me gustaría reservar una clase." | — |
| 13. Cookie banner | Banner with equal Accept / Necessary-only choices; Maps, Windguru and AEMET load only with consent | — |
| 14. Legal | Legal notice, privacy and cookie policy with the address and email | Owner's legal name and NIF/CIF |
