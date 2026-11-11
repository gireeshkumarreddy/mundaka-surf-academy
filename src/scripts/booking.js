/**
 * Booking (website brief, section 7): lesson type → duration, date, people, level → details → conditions accepted
 * → pay the 15 % deposit online (payments enabled) or send the request (until then). The summary beside the form
 * always shows the total, the deposit paid now and the balance paid at the school.
 */
import { t, local } from './integrations/config.js';
import { sendEnquiry, enquiryConfigured } from './integrations/enquiry.js';
import { whatsappUrl, bookingMessage } from './integrations/whatsapp.js';
import { paymentsEnabled, startCheckout } from './integrations/payments.js';
import { estimate, planOptions, split, formatMoney } from './pricing.js';
import { loadPlans, escapeHTML } from './data.js';
import { scrollToTarget } from './motion.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{6,20}$/;

const isoToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default async function initBooking(root, config) {
  const form = root.querySelector('[data-booking-form]');
  const f = form.elements;
  const optionSelect = f.option;
  const optionLabel = form.querySelector('[data-option-label]');
  const submit = form.querySelector('[data-submit]');
  const alertBox = form.querySelector('[data-booking-alert]');
  const done = root.querySelector('[data-booking-done]');
  const summary = root.querySelector('[data-summary-box]');
  const waLink = root.querySelector('[data-wa-booking]');
  // phones: a bar pinned to the bottom with the total and the deposit, while the form is on screen
  const bar = root.querySelector('[data-pay-bar]');
  // sections skip rendering off screen (content-visibility), which would pin the bar to the section instead of the screen
  if (bar) document.body.append(bar);
  let formInView = false;
  const showBar = () => bar?.classList.toggle('is-on', formInView && Boolean(plan()) && !form.hidden);
  if (bar) new IntersectionObserver(([e]) => { formInView = e.isIntersecting; showBar(); }).observe(form);
  const pct = config.payments?.depositPercent ?? 15;
  const money = (n, cur = 'EUR') => (n == null ? '—' : formatMoney(n, cur, config.locale));
  const dateFmt = new Intl.DateTimeFormat(config.locale === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'long' });
  let plans = [];

  if (!paymentsEnabled(config) && !enquiryConfigured(config) && config.reviewMode) form.querySelector('[data-demo-note]').hidden = false;
  submit.textContent = t('submit');

  f.date.min = isoToday();
  const max = new Date();
  max.setMonth(max.getMonth() + 18);
  f.date.max = max.toISOString().slice(0, 10);

  const plan = () => plans.find((p) => p.id === f.type.value);

  const fillOptions = () => {
    const p = plan();
    if (!p) return;
    const hours = p.price.unit === 'personHour';
    optionLabel.textContent = hours ? t('optionLabelHours') : t('optionLabelDays');
    const keep = optionSelect.value;
    optionSelect.innerHTML = planOptions(p)
      .map((o) => {
        const label = hours ? t('optionHours', { n: o.hours }) : t('optionDays', { n: o.days, h: o.hours });
        return `<option value="${o.value}">${escapeHTML(label)} — ${escapeHTML(t('optionPrice', { price: money(o.amount, p.price.currency) }))}</option>`;
      })
      .join('');
    if ([...optionSelect.options].some((o) => o.value === keep)) optionSelect.value = keep;
    optionSelect.disabled = false;
    // advanced / technical groups are for intermediate and advanced surfers
    const beginner = f.level.querySelector('option[value="beginner"]');
    beginner.disabled = !p.levels.includes('beginner');
    if (beginner.disabled && f.level.value === 'beginner') f.level.value = '';
  };

  const details = () => ({
    plan: plan(),
    option: Number(optionSelect.value) || null,
    date: f.date.value,
    participants: Number(f.participants.value) || 1,
    level: f.level.value,
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    message: f.message.value.trim(),
  });

  const optionText = (d) => {
    if (!d.plan || !d.option) return '';
    const o = planOptions(d.plan).find((x) => x.value === d.option);
    return d.plan.price.unit === 'personHour' ? t('optionHours', { n: o.hours }) : t('optionDays', { n: o.days, h: o.hours });
  };

  const render = () => {
    const d = details();
    const rows = [
      [t('sumLesson'), d.plan ? local(d.plan.name) : ''],
      [t('sumOption'), optionText(d)],
      [t('sumDate'), d.date ? dateFmt.format(new Date(`${d.date}T12:00:00`)) : ''],
      [t('sumPeople'), String(d.participants)],
      [t('sumLevel'), d.level ? t(`level_${d.level}`) : ''],
    ];
    summary.querySelector('[data-summary]').innerHTML = rows.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${v ? escapeHTML(v) : '—'}</dd></div>`).join('');
    const est = d.plan ? estimate(d.plan, { participants: d.participants, option: d.option }) : { total: null };
    const { now, later } = split(est.total, pct);
    summary.querySelector('[data-sum-total]').textContent = money(est.total, est.currency);
    summary.querySelector('[data-sum-now]').textContent = money(now, est.currency);
    summary.querySelector('[data-sum-later]').textContent = money(later, est.currency);
    if (bar) {
      bar.querySelector('[data-bar-total]').textContent = money(est.total, est.currency);
      bar.querySelector('[data-bar-now]').textContent = money(now, est.currency);
      showBar();
    }
    if (paymentsEnabled(config)) submit.textContent = now == null ? t('submit') : t('submitPay', { amount: money(now, est.currency) });
    if (waLink) {
      const url = whatsappUrl(config, bookingMessage({ plan: d.plan ? local(d.plan.name) : '', option: optionText(d), date: rows[2][1], participants: d.participants, level: rows[4][1], name: d.name }));
      if (url) waLink.href = url;
    }
    return { d, est, now };
  };

  const mark = (name, ok) => {
    const field = form.querySelector(`[data-field="${name}"]`);
    field?.classList.toggle('is-invalid', !ok);
    f[name]?.setAttribute?.('aria-invalid', String(!ok));
    return ok;
  };

  const validate = () => {
    const d = details();
    const typeOk = Boolean(d.plan);
    form.querySelector('[data-error="type"]').hidden = typeOk;
    const n = d.participants;
    const results = [
      typeOk,
      mark('option', Boolean(d.option)),
      mark('date', Boolean(d.date) && d.date >= f.date.min && d.date <= f.date.max),
      mark('participants', Number.isInteger(n) && n >= 1 && n <= 20),
      mark('level', Boolean(d.level)),
      mark('name', d.name.length >= 2),
      mark('email', EMAIL.test(d.email)),
      mark('phone', !d.phone || PHONE.test(d.phone)),
      mark('policy', f.policy.checked),
      mark('consent', f.consent.checked),
    ];
    return results.every(Boolean);
  };

  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') {
      form.querySelector('[data-error="type"]').hidden = true;
      fillOptions();
    }
    render();
  });
  form.addEventListener('input', (e) => {
    e.target.closest('[data-field]')?.classList.remove('is-invalid');
    render();
  });

  const finish = (title, html) => {
    form.hidden = true;
    summary.hidden = true;
    showBar();
    done.hidden = false;
    done.querySelector('[data-done-title]').textContent = title;
    done.querySelector('[data-done-text]').innerHTML = html;
    done.focus();
    scrollToTarget(done);
  };
  done.querySelector('[data-restart]').addEventListener('click', () => {
    done.hidden = true;
    form.hidden = false;
    summary.hidden = false;
    scrollToTarget(form);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    if (!validate()) {
      const first = form.querySelector('[data-error="type"]:not([hidden])') ? form.querySelector('input[name="type"]') : form.querySelector('.is-invalid input, .is-invalid select, .is-invalid textarea');
      first?.focus();
      return;
    }
    const { d, est } = render();
    if (f.company.value) return finish(t('doneTitle'), escapeHTML(t('doneText', { email: d.email })));
    const payload = {
      type: 'booking',
      submittedAt: new Date().toISOString(),
      locale: config.locale,
      plan: { id: d.plan.id, name: local(d.plan.name) },
      option: d.option,
      level: d.level,
      date: d.date,
      participants: d.participants,
      contact: { name: d.name, email: d.email, phone: d.phone },
      message: d.message,
      policyAccepted: true,
      estimate: est,
    };
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = t('sending');
    try {
      if (paymentsEnabled(config)) {
        await startCheckout(config, payload);
        return;
      }
      const result = await sendEnquiry(config, payload);
      if (result.ok) {
        finish(t('doneTitle'), escapeHTML(t('doneText', { email: d.email })));
        form.reset();
        render();
      } else if (result.reason === 'not-configured') {
        const text = `${bookingMessage({ plan: local(d.plan.name), option: optionText(d), date: d.date, participants: d.participants, level: t(`level_${d.level}`), name: d.name })}\n${d.email}${d.phone ? ` · ${d.phone}` : ''}`;
        finish(t('demoTitle'), `${escapeHTML(t('demoText'))}<br><button type="button" class="btn btn--ghost btn--sm" data-copy>${escapeHTML(t('copy'))}</button>`);
        done.querySelector('[data-copy]').addEventListener('click', async (ev) => {
          try {
            await navigator.clipboard.writeText(text);
            ev.target.textContent = t('copied');
          } catch {
            ev.target.textContent = t('copyFailed');
          }
        });
      } else {
        alertBox.innerHTML = `<p>${escapeHTML(t('sendError'))}</p>`;
        alertBox.hidden = false;
        alertBox.focus();
      }
    } catch (err) {
      console.error(err);
      alertBox.innerHTML = `<p>${escapeHTML(t('sendError'))}</p>`;
      alertBox.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });

  try {
    plans = ((await loadPlans(config)).plans ?? []).filter((p) => p.bookable !== false);
  } catch (err) {
    console.error(err);
    alertBox.innerHTML = `<p>${escapeHTML(t('sendError'))}</p>`;
    alertBox.hidden = false;
    submit.disabled = true;
    return;
  }
  // ?type=private|group|advanced from the "Book this lesson" buttons
  const wanted = new URLSearchParams(window.location.search).get('type');
  const radio = wanted && form.querySelector(`input[name="type"][value="${CSS.escape(wanted)}"]`);
  if (radio) radio.checked = true;
  if (plan()) fillOptions();
  render();
}
