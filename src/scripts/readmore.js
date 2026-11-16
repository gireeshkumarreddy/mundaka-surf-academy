/**
 * Instructor bios (client feedback 3): shown short, with "Leer más" to open the full text. Without JavaScript the full
 * bio shows and the button stays hidden; the build only adds the button to bios long enough to be cut.
 */
import { t } from './integrations/config.js';

export default function initReadMore() {
  document.querySelectorAll('[data-readmore]').forEach((box) => {
    const btn = box.querySelector('[data-readmore-toggle]');
    if (!btn) return;
    box.classList.add('is-clamped');
    btn.hidden = false;
    btn.addEventListener('click', () => {
      const open = box.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? t('readLess') : t('readMore');
    });
  });
}
