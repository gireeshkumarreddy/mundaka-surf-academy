/**
 * Booking request: lesson → date & group → details → review → send.
 * Until payments are enabled this is a request the academy confirms; nothing is charged.
 */
import { t, local } from './integrations/config.js';
import { sendEnquiry, enquiryConfigured } from './integrations/enquiry.js';
import { whatsappUrl, bookingMessage } from './integrations/whatsapp.js';
import { paymentsEnabled, amountDueNow, startCheckout } from './integrations/payments.js';
import { estimate, formatMoney } from './pricing.js';
import { loadPlans, escapeHTML, priceLabel } from './data.js';
import { scrollToTarget } from './motion.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{6,20}$/;

const isoToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default async function initBooking(root, config) {
  const form = root.querySelector('[data-booking-form]');
  const steps = [...form.querySelectorAll('[data-step]')];
  const dots = [...root.querySelectorAll('[data-step-dot]')];
  const btnBack = form.querySelector('[data-back]');
  const btnNext = form.querySelector('[data-next]');
  const btnSubmit = form.querySelector('[data-submit]');
  const alertBox = form.querySelector('[data-booking-alert]');
  const done = form.querySelector('[data-booking-done]');
  const nav = form.querySelector('[data-booking-nav]');
  const options = form.querySelector('[data-plan-options]');
  const waAlt = form.querySelector('[data-wa-alt]');
  const dateLocale = config.locale === 'es' ? 'es-ES' : 'en-GB';
  let plans = [];
  let step = 1;

  if (!enquiryConfigured(config) && config.reviewMode) root.querySelector('[data-demo-note]').hidden = false;

  // date limits: today → 18 months ahead
  const date = form.elements.date;
  date.min = isoToday();
  const max = new Date();
  max.setMonth(max.getMonth() + 18);
  date.max = max.toISOString().slice(0, 10);
  date.addEventListener('change', () => {
    const month = Number(date.value.slice(5, 7));
    const { fromMonth, toMonth } = config.season;
    root.querySelector('[data-season-note]').hidden = !date.value || (month >= fromMonth && month <= toMonth);
  });

  // prefill from the URL (?plan=…&level=…) and from the plans page email box
  const params = new URLSearchParams(window.location.search);
  let prefill = {};
  try {
    prefill = JSON.parse(sessionStorage.getItem('msa:prefill') || '{}');
    sessionStorage.removeItem('msa:prefill');
  } catch {
    /* ignore */
  }
  if (prefill.email) form.elements.email.value = prefill.email;
  const level = params.get('level');
  if (level && form.elements.level.querySelector(`option[value="${CSS.escape(level)}"]`)) form.elements.level.value = level;
  const wantedPlan = params.get('plan') || prefill.plan;

  const renderPlans = () => {
    options.innerHTML = `<fieldset class="plan-options__set"><legend class="visually-hidden">${escapeHTML(t('choosePlan'))}</legend>${plans
      .map(
        (p) => `<label class="plan-option">
          <input type="radio" name="plan" value="${escapeHTML(p.id)}" required>
          <span class="plan-option__body">
            <span class="plan-option__name">${escapeHTML(local(p.name))}</span>
            <span class="plan-option__summary">${escapeHTML(local(p.summary))}</span>
            <span class="plan-option__price">${priceLabel(p, config)}</span>
          </span>
        </label>`,
      )
      .join('')}</fieldset>`;
    const match = plans.find((p) => p.id === wantedPlan);
    if (match) form.querySelector(`input[name="plan"][value="${CSS.escape(match.id)}"]`).checked = true;
    options.addEventListener('change', () => showError('plan', false));
  };

  const showError = (name, on) => {
    const err = form.querySelector(`[data-error="${name}"]`);
    if (err) err.hidden = !on;
  };

  const setInvalid = (name, invalid) => {
    const field = form.querySelector(`[data-field="${name}"]`);
    const input = form.elements[name];
    field?.classList.toggle('is-invalid', invalid);
    if (input && input.setAttribute) input.setAttribute('aria-invalid', String(invalid));
    return !invalid;
  };

  const validators = {
    1: () => {
      const okPlan = Boolean(form.elements.plan?.value);
      showError('plan', !okPlan);
      const okLevel = setInvalid('level', !form.elements.level.value);
      return okPlan && okLevel;
    },
    2: () => {
      const v = date.value;
      const okDate = setInvalid('date', !v || v < date.min || v > date.max);
      const n = Number(form.elements.participants.value);
      const okPeople = setInvalid('participants', !Number.isInteger(n) || n < 1 || n > 40);
      return okDate && okPeople;
    },
    3: () => {
      const okName = setInvalid('name', form.elements.name.value.trim().length < 2);
      const okEmail = setInvalid('email', !EMAIL.test(form.elements.email.value.trim()));
      const phone = form.elements.phone.value.trim();
      const okPhone = setInvalid('phone', phone !== '' && !PHONE.test(phone));
      const okConsent = setInvalid('consent', !form.elements.consent.checked);
      return okName && okEmail && okPhone && okConsent;
    },
    4: () => true,
  };

  const details = () => {
    const plan = plans.find((p) => p.id === form.elements.plan?.value);
    const f = form.elements;
    return {
      plan,
      level: f.level.value,
      date: date.value,
      time: f.time.value,
      participants: Number(f.participants.value) || 1,
      ages: f.ages.value.trim(),
      availability: f.availability.value.trim(),
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
      adaptive: f.adaptive.checked,
      message: f.message.value.trim(),
    };
  };

  const formatDate = (iso) => (iso ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'full' }).format(new Date(`${iso}T12:00:00`)) : '');

  const renderSummary = () => {
    const d = details();
    const rows = [
      [t('sumLesson'), local(d.plan?.name)],
      [t('sumLevel'), t(`level_${d.level}`)],
      [t('sumDate'), formatDate(d.date)],
      [t('sumTime'), t(`time_${d.time}`)],
      [t('sumPeople'), String(d.participants)],
      [t('sumAges'), d.ages],
      [t('sumAvailability'), d.availability],
      [t('sumName'), d.name],
      [t('sumEmail'), d.email],
      [t('sumPhone'), d.phone],
      [t('sumAdaptive'), d.adaptive ? t('yes') : ''],
      [t('sumMessage'), d.message],
    ].filter(([, v]) => v);
    form.querySelector('[data-summary]').innerHTML = rows.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join('');

    const est = estimate(d.plan, { participants: d.participants, date: d.date });
    const total = form.querySelector('[data-summary-total]');
    total.innerHTML = est.total == null
      ? `<span>${escapeHTML(t('sumEstimate'))}</span><strong>${escapeHTML(t('priceOnRequest'))}</strong>`
      : `<span>${escapeHTML(t('sumEstimate'))}</span><strong>${formatMoney(est.total, est.currency, config.locale)}</strong>`;

    const pay = form.querySelector('[data-summary-pay]');
    if (paymentsEnabled(config)) {
      const due = amountDueNow(est.total, config);
      pay.textContent = due == null ? t('payLater') : t('payNow', { amount: formatMoney(due, est.currency, config.locale) });
      btnSubmit.textContent = t('submitPay');
    } else {
      pay.textContent = t('payNotYet');
    }

    const wa = whatsappUrl(config, bookingMessage({ plan: local(d.plan?.name), date: formatDate(d.date), participants: d.participants, level: t(`level_${d.level}`), name: d.name }));
    waAlt.hidden = !wa;
    if (wa) waAlt.querySelector('[data-wa-booking]').href = wa;
  };

  const go = (to, { focus = true } = {}) => {
    step = to;
    steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== step));
    dots.forEach((d) => {
      const n = Number(d.dataset.stepDot);
      d.toggleAttribute('aria-current', n === step);
      if (n === step) d.setAttribute('aria-current', 'step');
      d.classList.toggle('is-done', n < step);
    });
    btnBack.hidden = step === 1;
    btnNext.hidden = step === 4;
    btnSubmit.hidden = step !== 4;
    if (step === 4) renderSummary();
    else waAlt.hidden = true;
    if (focus) {
      const target = steps[step - 1].querySelector('legend, .step__title');
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
      scrollToTarget(form);
    }
  };

  const showAlert = (html) => {
    alertBox.innerHTML = html;
    alertBox.hidden = !html;
  };

  btnNext.addEventListener('click', () => {
    showAlert('');
    if (!validators[step]()) {
      form.querySelector('.is-invalid input, .is-invalid select, .is-invalid textarea, [data-error]:not([hidden]) ~ * input')?.focus();
      if (step === 1 && !form.elements.plan?.value) form.querySelector('input[name="plan"]')?.focus();
      return;
    }
    go(step + 1);
  });
  btnBack.addEventListener('click', () => go(step - 1));
  form.addEventListener('input', (e) => {
    const field = e.target.closest('[data-field]');
    if (field?.classList.contains('is-invalid')) setInvalid(field.dataset.field, false);
  });

  const finish = (title, text) => {
    steps.forEach((s) => (s.hidden = true));
    nav.hidden = true;
    waAlt.hidden = true;
    done.hidden = false;
    done.querySelector('[data-done-title]').textContent = title;
    done.querySelector('[data-done-text]').innerHTML = text;
    done.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (step !== 4) return;
    for (const s of [1, 2, 3]) {
      if (!validators[s]()) {
        go(s);
        return;
      }
    }
    const d = details();
    const payload = {
      type: 'booking-request',
      submittedAt: new Date().toISOString(),
      locale: config.locale,
      plan: { id: d.plan.id, name: local(d.plan.name) },
      level: d.level,
      date: d.date,
      time: d.time,
      participants: d.participants,
      ages: d.ages,
      availability: d.availability,
      contact: { name: d.name, email: d.email, phone: d.phone },
      adaptive: d.adaptive,
      message: d.message,
      estimate: estimate(d.plan, { participants: d.participants, date: d.date }),
    };

    // spam trap: real visitors never see or fill this field
    if (form.elements.company.value) {
      finish(t('doneTitle'), escapeHTML(t('doneText', { email: d.email })));
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = t('sending');
    try {
      if (paymentsEnabled(config)) {
        await startCheckout(config, payload);
        return;
      }
      const result = await sendEnquiry(config, payload);
      if (result.ok) {
        finish(t('doneTitle'), escapeHTML(t('doneText', { email: d.email })));
        form.reset();
      } else if (result.reason === 'not-configured') {
        const summary = `${bookingMessage({ plan: local(d.plan.name), date: formatDate(d.date), participants: d.participants, level: t(`level_${d.level}`), name: d.name })}\n${d.email}${d.phone ? ` · ${d.phone}` : ''}${d.message ? `\n${d.message}` : ''}`;
        finish(t('demoTitle'), `${escapeHTML(t('demoText'))}<br><button type="button" class="btn btn--sm btn--outline" data-copy>${escapeHTML(t('copy'))}</button>`);
        done.querySelector('[data-copy]').addEventListener('click', async (ev) => {
          try {
            await navigator.clipboard.writeText(summary);
            ev.target.textContent = t('copied');
          } catch {
            ev.target.textContent = t('copyFailed');
          }
        });
      } else {
        showAlert(`<p>${escapeHTML(t('sendError'))}</p>`);
        alertBox.focus?.();
      }
    } catch (err) {
      console.error(err);
      showAlert(`<p>${escapeHTML(t('sendError'))}</p>`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = paymentsEnabled(config) ? t('submitPay') : t('submit');
    }
  });

  form.querySelector('[data-restart]').addEventListener('click', () => {
    done.hidden = true;
    nav.hidden = false;
    go(1);
  });

  // plans
  try {
    const data = await loadPlans(config);
    plans = (data.plans ?? []).filter((p) => p.bookable !== false);
    renderPlans();
  } catch (err) {
    console.error(err);
    options.innerHTML = `<p class="plans-error plans-error--dark">${escapeHTML(t('plansError'))}</p>`;
    btnNext.disabled = true;
  }
  go(1, { focus: false });
  if (window.location.hash === '#booking' && wantedPlan) form.elements.level.focus({ preventScroll: true });
}
