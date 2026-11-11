/**
 * WhatsApp click-to-chat (site.config.json → whatsapp.number). The buttons on every page are written by the
 * build ({{wa-url}}); this module only builds the prefilled booking message for the booking form.
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
  if (details.option) lines.push(`${t('waOption')}: ${details.option}`);
  if (details.date) lines.push(`${t('waDate')}: ${details.date}`);
  if (details.participants) lines.push(`${t('waPeople')}: ${details.participants}`);
  if (details.level) lines.push(`${t('waLevel')}: ${details.level}`);
  if (details.name) lines.push(`${t('waName')}: ${details.name}`);
  return lines.join('\n');
}
