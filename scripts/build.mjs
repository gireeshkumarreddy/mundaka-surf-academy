#!/usr/bin/env node
/**
 * Static site builder (no dependencies).
 *
 * Renders every page in src/pages once per enabled locale:
 *   es (default) -> dist/<slug>.html     en -> dist/en/<slug>.html
 *
 * Template syntax (pages, partials, layout and locale strings):
 *   {{> partial}}                 include src/partials/partial.html
 *   {{some.key}}                  locale string (falls back to English)
 *   {{meta.title}}                the current page's <key>.meta.title
 *   {{config.brand.name}}         value from site.config.json (HTML-escaped)
 *   {{link:plans}}  {{link:lessons#kids}}   relative link to a page in the same locale
 *   {{asset:img/x.webp}}          relative path into /assets
 *   {{img name=x sizes="100vw" alt=key.path class=y loading=eager mobile=x-m}}   responsive <img> (mobile: phone crop)
 *   {{srcset:name}}  {{src:name}}  {{src:name@800}}
 *   {{#if config.whatsapp.number}} ... {{else}} ... {{/if}}   ({{#unless}} too, not nested)
 *   {{tbc}}                       "to be confirmed" marker
 *   {{wa-url}}                    WhatsApp click-to-chat link with the default message (site.config.json → whatsapp)
 *   {{price-table:group}}  {{from-price:private}}   prices from public/data/plans.json
 *   {{team-cards}}  {{gallery-items}}  {{reviews}}   cards from public/data/team.json, gallery.json, site.config reviews
 *
 * `node scripts/build.mjs --check` also verifies every internal link, asset and #anchor.
 */
import { readFile, writeFile, mkdir, readdir, cp, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planOptions, fromPrice, formatMoney, split } from '../src/scripts/pricing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
// where the site lives on its host: '/' normally, '/<repo>/' for a GitHub Pages project site (SITE_BASE env var)
const BASE = (process.env.SITE_BASE || '/').replace(/\/?$/, '/');

const readJSON = async (p) => JSON.parse(await readFile(p, 'utf8'));
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
// conservative CSS minifier: drops comments and the whitespace around braces and semicolons, nothing else
const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

export async function build({ check = false, quiet = false } = {}) {
  const started = Date.now();
  const config = await readJSON(path.join(ROOT, 'site.config.json'));
  const images = await imageManifest(path.join(PUBLIC, 'assets/img'));
  const locales = {};
  for (const code of config.locales.enabled) locales[code] = await readJSON(path.join(SRC, 'locales', `${code}.json`));
  const plansData = await readJSON(path.join(PUBLIC, 'data/plans.json'));
  const teamData = await readJSON(path.join(PUBLIC, 'data/team.json'));
  const galleryData = await readJSON(path.join(PUBLIC, 'data/gallery.json'));
  const mundakaPhotos = await readJSON(path.join(PUBLIC, 'data/mundaka-photos.json'));
  const defaultLocale = config.locales.default;

  const layout = await readFile(path.join(SRC, 'layouts/base.html'), 'utf8');
  const partials = {};
  for (const f of await readdir(path.join(SRC, 'partials'))) {
    partials[f.replace(/\.html$/, '')] = await readFile(path.join(SRC, 'partials', f), 'utf8');
  }

  const pages = [];
  for (const f of (await readdir(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'))) {
    const raw = await readFile(path.join(SRC, 'pages', f), 'utf8');
    const m = raw.match(/^<!--page\s*([\s\S]*?)-->\s*/);
    if (!m) throw new Error(`${f}: missing <!--page {...} --> header`);
    pages.push({ ...JSON.parse(m[1]), body: raw.slice(m[0].length), file: f });
  }
  const pageByKey = Object.fromEntries(pages.map((p) => [p.key, p]));

  const errors = [];
  await rm(DIST, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  await mkdir(DIST, { recursive: true });

  for (const locale of config.locales.enabled) {
    const strings = locales[locale];
    const prefix = locale === defaultLocale ? '' : `${locale}/`;

    for (const page of pages) {
      // the 404 page is served at any URL depth, so it uses root-relative paths
      const up = page.absolutePaths ? BASE : prefix ? '../' : '';
      const outRel = `${prefix}${page.slug}.html`;
      const t = (key) => {
        const v = get(strings, key) ?? get(locales[defaultLocale], key);
        if (v === undefined) errors.push(`[${locale}] ${page.file}: missing string "${key}"`);
        return v ?? '';
      };
      const pageUrl = (key, loc = locale) => {
        const [k, hash] = key.split('#');
        const target = pageByKey[k];
        if (!target) {
          errors.push(`${page.file}: link to unknown page "${k}"`);
          return '#';
        }
        const locPrefix = loc === defaultLocale ? '' : `${loc}/`;
        return `${up}${locPrefix}${target.slug}.html${hash ? `#${hash}` : ''}`;
      };
      const asset = (p) => `${up}assets/${p}`;
      const imgEntry = (name) => {
        const e = images[name];
        if (!e) errors.push(`${page.file}: unknown image "${name}"`);
        return e ?? { widths: [800], ratio: 1.5 };
      };
      const srcset = (name) => imgEntry(name).widths.map((w) => `${asset(`img/${name}-${w}.webp`)} ${w}w`).join(', ');
      const src = (spec) => {
        const [name, w] = spec.split('@');
        const e = imgEntry(name);
        const width = w ? Number(w) : e.widths[Math.min(1, e.widths.length - 1)];
        if (w && !e.widths.includes(width)) errors.push(`${page.file}: image "${name}" has no ${w}w variant`);
        return asset(`img/${name}-${width}.webp`);
      };
      const ctx = { config, page, locale };

      const helpers = (token) => {
        if (token.startsWith('> ')) {
          const name = token.slice(2).trim();
          if (!(name in partials)) errors.push(`${page.file}: unknown partial "${name}"`);
          return partials[name] ?? '';
        }
        if (token.startsWith('link:')) return pageUrl(token.slice(5));
        if (token.startsWith('asset:')) return asset(token.slice(6));
        if (token.startsWith('srcset:')) return srcset(token.slice(7));
        if (token.startsWith('src:')) return src(token.slice(4));
        if (token.startsWith('img ')) {
          const attrs = {};
          for (const m of token.slice(4).matchAll(/([\w-]+)=(?:"([^"]*)"|(\S+))/g)) attrs[m[1]] = m[2] ?? m[3];
          const e = imgEntry(attrs.name);
          const max = e.widths[e.widths.length - 1];
          const alt = !attrs.alt || attrs.alt === '-' ? '' : escapeHTML(t(attrs.alt).replace(/<[^>]+>/g, ''));
          const extra = ['class', 'style', 'fetchpriority', 'data-speed']
            .filter((k) => attrs[k])
            .map((k) => ` ${k}="${attrs[k]}"`)
            .join('');
          const tag = `<img src="${src(attrs.name)}" srcset="${srcset(attrs.name)}" sizes="${attrs.sizes ?? '100vw'}" width="${max}" height="${Math.round(max / e.ratio)}" alt="${alt}" loading="${attrs.loading ?? 'lazy'}" decoding="async"${extra}>`;
          // mobile=<name>: phones (≤ 640 px) get their own crop of the photo
          return attrs.mobile ? `<picture><source media="(max-width: 640px)" srcset="${srcset(attrs.mobile)}" sizes="100vw">${tag}</picture>` : tag;
        }
        if (token === 'tbc') return `<span class="tbc">${t('common.tbc')}</span>`;
        if (token === 'year') return String(new Date().getFullYear());
        if (token === 'locale') return locale;
        if (token === 'lang-switch') {
          return `<nav class="lang-switch" aria-label="${t('common.language')}">${config.locales.enabled
            .map((l) => `<a href="${pageUrl(page.key, l)}" hreflang="${l}" lang="${l}"${l === locale ? ' aria-current="true"' : ''}>${l.toUpperCase()}</a>`)
            .join('')}</nav>`;
        }
        if (token === 'head-extra') return headExtra();
        if (token === 'wa-url') return waUrl(t('common.waMessage'));
        if (token.startsWith('price-table:')) return priceTable(token.slice(12));
        if (token.startsWith('from-price:')) {
          const plan = planById(token.slice(11));
          return plan ? escapeHTML(formatMoney(fromPrice(plan), plan.price.currency, locale) ?? '') : '';
        }
        if (token === 'deposit-table') return depositTable();
        if (token === 'team-cards') return teamCards();
        if (token === 'gallery-items') return galleryItems();
        if (token.startsWith('gallery-items:')) return galleryItems(token.slice(14));
        if (token === 'photo-grid:mundaka') return photoGrid(mundakaPhotos);
        if (token === 'reviews') return reviews();
        if (token === 'partners') return partners();
        if (token === 'site-config') return siteConfigScript();
        if (token.startsWith('meta.')) return t(`${page.key}.${token}`);
        if (token.startsWith('config.')) return escapeHTML(get(config, token.slice(7)) ?? '');
        if (token.startsWith('page.')) return escapeHTML(get(page, token.slice(5)) ?? '');
        return t(token);
      };

      const L = (v) => (v && typeof v === 'object' ? v[locale] ?? v[defaultLocale] ?? '' : v ?? '');
      const waUrl = (message) => {
        const n = String(config.whatsapp?.number ?? '').replace(/\D/g, '');
        return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : '';
      };
      const planById = (id) => {
        const plan = plansData.plans.find((p) => p.id === id);
        if (!plan) errors.push(`${page.file}: unknown plan "${id}"`);
        return plan;
      };
      const money = (n, cur = 'EUR') => escapeHTML(formatMoney(n, cur, locale));

      // price table of one lesson type, written into the page at build time (restyled from the client's price list)
      const priceTable = (id) => {
        const plan = planById(id);
        if (!plan) return '';
        const cur = plan.price.currency;
        if (plan.price.unit === 'personHour' && plan.price.groupRates?.length) {
          // private lessons: the price per person drops with the group size (client feedback 3)
          const h = plan.price.hours?.[0] ?? 1;
          const rows = plan.price.groupRates
            .map((r) => `<tr><td>${r.people === 1 ? t('lessons.table.person1') : t('lessons.table.personsN').replace('{n}', r.people)}</td><td><strong>${money(r.amount * h, cur)}</strong></td><td>${money(r.amount * h * r.people, cur)}</td></tr>`)
            .join('');
          return `<table class="price-table"><caption class="visually-hidden">${escapeHTML(L(plan.name))}</caption>
<thead><tr><th scope="col">${t('lessons.table.people')}</th><th scope="col">${t('lessons.table.perPersonOne')}</th><th scope="col">${t('lessons.table.total')}</th></tr></thead>
<tbody>${rows}</tbody></table>`;
        }
        if (plan.price.unit === 'personHour') {
          return `<table class="price-table"><caption class="visually-hidden">${escapeHTML(L(plan.name))}</caption>
<thead><tr><th scope="col">${t('lessons.table.type')}</th><th scope="col">${t('lessons.table.price')}</th></tr></thead>
<tbody><tr><td>${plan.id === 'private' ? t('lessons.table.privateRow') : escapeHTML(L(plan.name))}</td><td><strong>${money(plan.price.amount, cur)}</strong> ${t('lessons.table.perPersonHour')}</td></tr></tbody></table>`;
        }
        const rows = planOptions(plan)
          .map((o) => `<tr><td>${o.days}</td><td>${o.hours} h</td><td><strong>${money(o.amount, cur)}</strong></td></tr>`)
          .join('');
        return `<table class="price-table"><caption class="visually-hidden">${escapeHTML(L(plan.name))}</caption>
<thead><tr><th scope="col">${t('lessons.table.days')}</th><th scope="col">${t('lessons.table.hours')}</th><th scope="col">${t('lessons.table.pricePerson')}</th></tr></thead>
<tbody>${rows}</tbody></table>`;
      };

      // deposit examples (brief, section 7): every group package and one private hour for one person
      const depositTable = () => {
        const pct = config.payments.depositPercent;
        const rows = [];
        const group = planById('group');
        for (const o of planOptions(group)) rows.push([t('book.examples.group').replace('{d}', o.days).replace('{h}', o.hours), o.amount, group.price.currency]);
        const priv = planById('private');
        rows.push([t('book.examples.private'), planOptions(priv)[0].amount, priv.price.currency]);
        const body = rows
          .map(([label, total, cur]) => {
            const { now, later } = split(total, pct);
            return `<tr><td>${escapeHTML(label)}</td><td>${money(total, cur)}</td><td><strong>${money(now, cur)}</strong></td><td>${money(later, cur)}</td></tr>`;
          })
          .join('');
        return `<div class="table-wrap"><table class="price-table price-table--deposit"><thead><tr><th scope="col">${t('book.examples.lesson')}</th><th scope="col">${t('book.examples.total')}</th><th scope="col">${t('book.examples.now').replace('{p}', pct)}</th><th scope="col">${t('book.examples.later').replace('{p}', 100 - pct)}</th></tr></thead><tbody>${body}</tbody></table></div>`;
      };

      const pending = (key) => (config.reviewMode ? `<span class="tbc">${t(key)}</span>` : '');
      const teamCards = () =>
        teamData.instructors
          .map((p, i) => {
            const photo = p.photo
              ? helpers(`img name=${p.photo} sizes="(min-width: 1100px) 22vw, (min-width: 640px) 45vw, 50vw" alt=-`).replace('alt=""', `alt="${escapeHTML(L(p.name))}"`)
              : `<span class="team-card__ph" aria-hidden="true"><img src="${src('badge-clear@320')}" alt="" width="320" height="320" loading="lazy"></span>${pending('team.photoPending')}`;
            const certs = p.certificates?.length
              ? `<ul class="team-card__certs">${p.certificates.map((c) => `<li>${escapeHTML(L(c))}</li>`).join('')}</ul>`
              : `<p class="team-card__certs-empty">${pending('team.certsPending')}</p>`;
            // short bio with "Leer más" (client feedback 3); the button only for bios long enough to be cut at four lines
            const more = L(p.bio).length > 180 ? `<button type="button" class="team-card__more" data-readmore-toggle aria-expanded="false" hidden>${t('js.readMore')}</button>` : '';
            const bio = L(p.bio) ? `<div class="team-card__bio" data-readmore><p>${escapeHTML(L(p.bio))}</p>${more}</div>` : `<p class="team-card__bio">${pending('team.bioPending')}</p>`;
            return `<article class="team-card" id="${escapeHTML(p.id)}">
  <figure class="team-card__photo">${photo}</figure>
  <div class="team-card__body">
    <p class="team-card__num">${String(i + 1).padStart(2, '0')}</p>
    <h3 class="team-card__name">${escapeHTML(L(p.name))}</h3>
    <p class="team-card__role">${escapeHTML(L(p.role))}</p>
    ${bio}
    ${p.languages?.length ? `<p class="team-card__langs"><strong>${t('team.langsTitle')}:</strong> ${p.languages.map((x) => escapeHTML(L(x))).join(' · ')}</p>` : ''}
    <h4 class="team-card__certs-title">${t('team.certsTitle')}</h4>
    ${certs}
  </div>
</article>`;
          })
          .join('\n');

      // one section of the gallery (instructors | lessons) or all of it; cells past the first `visible` wait behind "Ver más"
      const galleryItems = (cat) =>
        galleryData.items
          .filter((g) => !cat || g.category === cat)
          .map((g, i, all) => {
            const more = cat === 'instructors' && i >= (galleryData.instructorsVisible ?? all.length) ? ' data-more-item' : '';
            const alt = escapeHTML(L(g.alt));
            return `<li class="gallery__cell" data-cat="${g.category}"${more}><button type="button" class="gallery__item" data-full="${src(`${g.image}@${imgEntry(g.image).widths.filter((w) => w <= 1600).at(-1) ?? imgEntry(g.image).widths[0]}`)}" data-caption="${alt}" aria-label="${t('gallery.open')}: ${alt}">${helpers(`img name=${g.image} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 96vw" alt=-`).replace('alt=""', `alt="${alt}"`)}</button></li>`;
          })
          .join('\n');

      // 'Mundaka en fotos' (Our story): photos by the academy's photographer, landscape ones across two tiles
      const photoGrid = (data) =>
        data.items
          .map((p, i) => {
            const wide = p.wide ? ' class="photo-grid__wide"' : '';
            const more = i >= (data.visible ?? data.items.length) ? ' data-more-item' : '';
            const img = helpers(`img name=${p.image} sizes="${p.wide ? '(min-width: 900px) 62vw, 100vw' : '(min-width: 900px) 31vw, 50vw'}" alt=-`).replace('alt=""', `alt="${escapeHTML(L(p.alt))}"`);
            return `<figure${wide}${more}>${img}</figure>`;
          })
          .join('\n');

      const stars = (n) => `<span class="stars" aria-label="${t('home.reviews.rating').replace('{n}', n)}">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
      const reviews = () => {
        const items = config.reviews?.items ?? [];
        if (!items.length) {
          return config.reviewMode
            ? `<div class="reviews__empty">${[1, 2, 3].map(() => `<figure class="review-card review-card--ph">${stars(5)}<blockquote><p>${t('home.reviews.placeholder')}</p></blockquote><figcaption>${t('home.reviews.placeholderName')}</figcaption></figure>`).join('')}</div><p class="review-note">${t('home.reviews.pending')}</p>`
            : '';
        }
        const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric' });
        return items
          .map((r) => `<figure class="review-card">${stars(Number(r.rating) || 5)}<blockquote><p>${escapeHTML(L(r.text))}</p></blockquote><figcaption><strong>${escapeHTML(r.name)}</strong>${r.date ? ` · <time datetime="${escapeHTML(r.date)}">${fmt.format(new Date(`${r.date}T12:00:00`))}</time>` : ''}</figcaption></figure>`)
          .join('');
      };

      // brand partners in the footer (site.config.json → partners.items); a dashed placeholder in review mode until then
      const partners = () => {
        const items = config.partners?.items ?? [];
        if (!items.length) return config.reviewMode ? `<div class="partners partners--ph"><p class="partners__title">${t('footer.partners')}</p><p class="review-note">${t('footer.partnersPending')}</p></div>` : '';
        return `<div class="partners"><p class="partners__title">${t('footer.partners')}</p><ul class="partners__list">${items
          .map((it) => {
            const e = imgEntry(it.logo);
            const w = e.widths.at(-1);
            const img = `<img src="${src(`${it.logo}@${w}`)}" alt="${escapeHTML(it.name)}" width="${w}" height="${Math.round(w / e.ratio)}" loading="lazy" decoding="async">`;
            // no website yet → the logo is shown without a link
            return `<li>${it.url ? `<a href="${escapeHTML(it.url)}" target="_blank" rel="noopener">${img}</a>` : img}</li>`;
          })
          .join('')}</ul></div>`;
      };

      const headExtra = () => {
        const out = [];
        const abs = (loc) => (config.siteUrl ? `${config.siteUrl.replace(/\/$/, '')}/${loc === defaultLocale ? '' : `${loc}/`}${page.slug === 'index' ? '' : `${page.slug}.html`}` : null);
        if (page.noindex) out.push('<meta name="robots" content="noindex">');
        // page scripts that would otherwise only be requested once main.js has run ("preload" in the page header)
        for (const file of page.preload ?? []) out.push(`<link rel="modulepreload" href="${up}assets/${file}">`);
        if (config.siteUrl && !page.noindex) {
          out.push(`<link rel="canonical" href="${abs(locale)}">`);
          for (const l of config.locales.enabled) out.push(`<link rel="alternate" hreflang="${l}" href="${abs(l)}">`);
          out.push(`<link rel="alternate" hreflang="x-default" href="${abs(defaultLocale)}">`);
          out.push(`<meta property="og:url" content="${abs(locale)}">`);
        }
        if (page.key === 'home') {
          const ld = {
            '@context': 'https://schema.org',
            '@type': 'SportsActivityLocation',
            name: config.brand.name,
            sport: 'Surfing',
            description: t('home.meta.description'),
            address: {
              '@type': 'PostalAddress',
              streetAddress: config.brand.street,
              addressLocality: config.brand.locality,
              addressRegion: config.brand.region,
              postalCode: config.brand.postalCode,
              addressCountry: config.brand.country,
            },
            geo: { '@type': 'GeoCoordinates', latitude: config.brand.geo.lat, longitude: config.brand.geo.lng },
            sameAs: [config.social.instagram?.url, config.social.facebook?.url].filter(Boolean),
          };
          if (config.siteUrl) ld.url = abs(locale);
          if (config.contact.email) ld.email = config.contact.email;
          if (config.contact.phone) ld.telephone = config.contact.phone;
          out.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
        }
        return out.join('\n  ');
      };

      const siteConfigScript = () => {
        const pub = {
          locale,
          reviewMode: config.reviewMode,
          brand: config.brand,
          defaultLocale,
          whatsapp: config.whatsapp,
          forecast: config.forecast,
          enquiry: config.enquiry,
          payments: config.payments,
          paths: {
            plans: `${up}data/plans.json`,
            schedule: `${up}data/schedule.json`,
            contact: pageUrl('contact'),
            book: pageUrl('book'),
            conditions: pageUrl('conditions'),
            cookies: pageUrl('cookies'),
            bookingStatus: pageUrl('bookingStatus'),
            images: asset('img/'),
            directions: config.maps.directions,
          },
          strings: strings.js ?? locales[defaultLocale].js,
        };
        return `<script type="application/json" id="site-config">${JSON.stringify(pub).replace(/</g, '\\u003c')}</script>`;
      };

      const conditionals = (html) =>
        html.replace(/\{\{#(if|unless) ([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/\1\}\}/g, (_, kind, key, yes, no = '') => {
          const v = key === 'review' ? config.reviewMode : get(ctx, key);
          const truthy = Array.isArray(v) ? v.length > 0 : Boolean(v);
          return (kind === 'if' ? truthy : !truthy) ? yes : no;
        });

      // a fragment (e.g. the Spain map) is written without the layout and fetched into pages when needed
      let html = page.fragment ? `<!-- fragment: fetched into pages by main.js -->
${page.body}` : layout.replace('{{content}}', () => page.body);
      for (let pass = 0; pass < 6 && html.includes('{{'); pass++) {
        html = conditionals(html);
        html = html.replace(/\{\{([^{}]+?)\}\}/g, (_, token) => helpers(token.trim()));
      }
      if (html.includes('{{')) errors.push(`${outRel}: unresolved template tag near "${html.slice(html.indexOf('{{'), html.indexOf('{{') + 60)}"`);
      html = html.replaceAll(`data-nav="${page.key}"`, `data-nav="${page.key}" aria-current="page"`);

      const out = path.join(DIST, outRel);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, html);
    }
  }

  // static files, styles and scripts
  await cp(PUBLIC, DIST, { recursive: true, filter: (p) => !p.endsWith('manifest.json') });
  const styleFiles = (await readdir(path.join(SRC, 'styles'))).filter((f) => f.endsWith('.css')).sort();
  const css = (await Promise.all(styleFiles.map((f) => readFile(path.join(SRC, 'styles', f), 'utf8')))).join('\n');
  await mkdir(path.join(DIST, 'assets/css'), { recursive: true });
  await writeFile(path.join(DIST, 'assets/css/site.css'), minifyCss(css));
  await cp(path.join(SRC, 'scripts'), path.join(DIST, 'assets/js'), { recursive: true });

  // robots + sitemap (sitemap needs the production domain in site.config.json)
  const robots = ['User-agent: *', 'Allow: /', `Disallow: ${BASE}admin/`];
  for (const l of config.locales.enabled) {
    for (const p of pages.filter((p) => p.fragment)) robots.push(`Disallow: ${BASE}${l === defaultLocale ? '' : `${l}/`}${p.slug}.html`);
  }
  if (config.siteUrl) {
    const base = config.siteUrl.replace(/\/$/, '');
    const urls = [];
    for (const l of config.locales.enabled) {
      for (const p of pages.filter((p) => !p.noindex)) {
        urls.push(`${base}/${l === defaultLocale ? '' : `${l}/`}${p.slug === 'index' ? '' : `${p.slug}.html`}`);
      }
    }
    await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
    robots.push(`Sitemap: ${base}/sitemap.xml`);
  }
  await writeFile(path.join(DIST, 'robots.txt'), robots.join('\n') + '\n');

  if (check) errors.push(...(await checkLinks()));
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n - ${[...new Set(errors)].join('\n - ')}`);
    process.exitCode = 1;
  } else if (!quiet) {
    console.log(`Built ${pages.length} pages × ${config.locales.enabled.length} locales in ${Date.now() - started} ms${check ? ' — all links, assets and anchors OK' : ''}`);
  }
  return errors;
}

/** Width variants and aspect ratio of every name-<width>.webp in public/assets/img (read from the file headers). */
async function imageManifest(dir) {
  const manifest = {};
  for (const f of await readdir(dir)) {
    const m = f.match(/^(.+)-(\d+)\.webp$/);
    if (!m) continue;
    const b = await readFile(path.join(dir, f));
    let w;
    let h;
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') {
      w = b.readUInt16LE(26) & 0x3fff;
      h = b.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L') {
      w = 1 + (((b[22] & 0x3f) << 8) | b[21]);
      h = 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6));
    } else if (chunk === 'VP8X') {
      w = 1 + b.readUIntLE(24, 3);
      h = 1 + b.readUIntLE(27, 3);
    } else continue;
    const e = (manifest[m[1]] ??= { widths: [], ratio: Math.round((w / h) * 10000) / 10000 });
    e.widths.push(Number(m[2]));
  }
  for (const e of Object.values(manifest)) e.widths.sort((a, b) => a - b);
  return manifest;
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function checkLinks() {
  const problems = [];
  const htmlFiles = (await walk(DIST)).filter((f) => f.endsWith('.html'));
  const idsCache = new Map();
  const idsOf = async (file) => {
    if (!idsCache.has(file)) {
      const html = await readFile(file, 'utf8');
      idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    }
    return idsCache.get(file);
  };
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    // a fragment's own #references (icons) resolve against the page it is inserted into
    const self = html.startsWith('<!-- fragment') ? path.join(path.dirname(file), 'index.html') : file;
    const refs = [];
    for (const m of html.matchAll(/\s(?:href|src|poster)="([^"]+)"/g)) refs.push(m[1]);
    for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) refs.push(...m[1].split(',').map((s) => s.trim().split(/\s+/)[0]));
    for (const m of html.matchAll(/url\(([^)'"]+)\)/g)) refs.push(m[1]);
    for (const ref of refs) {
      if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(ref) || ref === '#') continue;
      const [p, hash] = ref.split('#');
      const clean = p.split('?')[0];
      const target = !p ? self : clean.startsWith('/') ? path.join(DIST, clean.startsWith(BASE) ? clean.slice(BASE.length - 1) : clean) : path.resolve(path.dirname(file), clean);
      if (!existsSync(target)) {
        problems.push(`${path.relative(DIST, file)} → missing ${ref}`);
        continue;
      }
      if (hash && target.endsWith('.html') && !(await idsOf(target)).has(hash)) {
        problems.push(`${path.relative(DIST, file)} → no #${hash} in ${path.relative(DIST, target)}`);
      }
    }
  }
  // CSS url() references
  const css = await readFile(path.join(DIST, 'assets/css/site.css'), 'utf8');
  for (const m of css.matchAll(/url\(["']?([^)"']+)["']?\)/g)) {
    if (/^(data:|https?:|#)/.test(m[1])) continue;
    if (!existsSync(path.resolve(DIST, 'assets/css', m[1]))) problems.push(`site.css → missing ${m[1]}`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await build({ check: process.argv.includes('--check') });
}
