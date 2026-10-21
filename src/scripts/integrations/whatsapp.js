/**
 * WhatsApp click-to-chat.
 * Off until site.config.json → whatsapp.number is filled in (digits, international format).
 * While it is empty the build does not render WhatsApp buttons, and this module removes any
 * leftover [data-whatsapp] element, so no broken or fake link can reach visitors.
 */
import { t } from './config.js';

export function whatsappNumber(config) {
  return String(config.whatsapp?.number ?? '').replace(/\D/g, '');
}

export function whatsappUrl(config, message = '') {
  const number = whatsappNumber(config);
  if (!number) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** Prefilled message for a booking request (used by the booking form). */
export function bookingMessage(details) {
  const lines = [t('waIntro')];
  if (details.plan) lines.push(`${t('waPlan')}: ${details.plan}`);
  if (details.date) lines.push(`${t('waDate')}: ${details.date}`);
  if (details.participants) lines.push(`${t('waPeople')}: ${details.participants}`);
  if (details.level) lines.push(`${t('waLevel')}: ${details.level}`);
  if (details.name) lines.push(`${t('waName')}: ${details.name}`);
  return lines.join('\n');
}

export function initWhatsApp(config) {
  const url = whatsappUrl(config, t('waDefault'));
  document.querySelectorAll('[data-whatsapp]').forEach((el) => {
    if (!url) {
      el.remove();
      return;
    }
    el.href = url;
    el.target = '_blank';
    el.rel = 'noopener';
    el.hidden = false;
  });
}
