/** Contact form: validates, then sends through the same enquiry delivery as bookings (demo mode until configured). */
import { t } from './integrations/config.js';
import { sendEnquiry, enquiryConfigured } from './integrations/enquiry.js';
import { escapeHTML } from './data.js';
import { whatsappUrl } from './integrations/whatsapp.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{6,20}$/;

export default function initContact(form, config) {
  const alertBox = form.querySelector('[data-contact-alert]');
  const done = form.querySelector('[data-contact-done]');
  if (!enquiryConfigured(config) && config.reviewMode) form.querySelector('[data-demo-note]').hidden = false;
  const check = (name, ok) => {
    form.querySelector(`[data-field="${name}"]`)?.classList.toggle('is-invalid', !ok);
    return ok;
  };
  form.addEventListener('input', (e) => e.target.closest('[data-field]')?.classList.remove('is-invalid'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const phone = f.phone.value.trim();
    const ok = [
      check('name', f.name.value.trim().length >= 2),
      check('email', EMAIL.test(f.email.value.trim())),
      check('phone', !phone || PHONE.test(phone)),
      check('message', f.message.value.trim().length >= 2),
      check('consent', f.consent.checked),
    ].every(Boolean);
    if (!ok) {
      form.querySelector('.is-invalid input, .is-invalid textarea')?.focus();
      return;
    }
    const name = f.name.value.trim();
    const finish = (html) => {
      done.innerHTML = html;
      done.hidden = false;
      done.focus();
    };
    if (f.company.value) return finish(escapeHTML(t('contactDone', { name })));
    const wa = whatsappUrl(config, `${t('waContact', { name })}\n${f.message.value.trim()}`);
    const waButton = wa ? ` <a class="btn btn--wa btn--sm" href="${escapeHTML(wa)}" target="_blank" rel="noopener">${escapeHTML(t('waAlso'))}</a>` : '';
    const result = await sendEnquiry(config, { type: 'contact', locale: config.locale, submittedAt: new Date().toISOString(), contact: { name, email: f.email.value.trim(), phone }, message: f.message.value.trim() });
    if (result.ok) {
      form.reset();
      finish(escapeHTML(t('contactDone', { name })) + waButton);
    } else if (result.reason === 'not-configured') finish(escapeHTML(t('contactDemo')));
    else {
      alertBox.innerHTML = `<p>${escapeHTML(t('sendError'))}${waButton}</p>`;
      alertBox.hidden = false;
    }
  });
}
