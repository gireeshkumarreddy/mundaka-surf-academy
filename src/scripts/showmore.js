/**
 * "Ver más fotos": a list shows its first photos and opens the rest on request (Our story photos, gallery instructors;
 * client feedback 5). Without JavaScript every photo shows. The items to fold away carry data-more-item.
 */
import { t } from './integrations/config.js';

export default function initShowMore() {
  document.querySelectorAll('[data-more-wrap]').forEach((wrap) => {
    const list = wrap.querySelector('[data-more]');
    const btn = wrap.querySelector('[data-more-btn]');
    const extra = list?.querySelectorAll('[data-more-item]').length ?? 0;
    if (!list || !btn || !extra) return;
    const label = (open) => (open ? t('showLess') : t('showMore', { n: extra }));
    list.classList.add('is-collapsed');
    btn.textContent = label(false);
    btn.hidden = false;
    btn.addEventListener('click', () => {
      const open = list.classList.toggle('is-collapsed') === false;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = label(open);
      if (open) list.querySelector('[data-more-item]')?.querySelector('button, a, img')?.scrollIntoView?.({ block: 'nearest' });
    });
  });
}
