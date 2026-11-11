/** Gallery: Lessons / Instructors filter and a lightbox on a native <dialog> (focus trap and Esc come for free). */
export default function initGallery(root) {
  const dialog = root.querySelector('[data-lightbox]');
  const cells = [...root.querySelectorAll('.gallery__cell')];
  const filters = [...root.querySelectorAll('[data-filter]')];
  const visible = () => cells.filter((c) => !c.hidden).map((c) => c.querySelector('.gallery__item'));

  filters.forEach((btn) =>
    btn.addEventListener('click', () => {
      const cat = btn.dataset.filter;
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      cells.forEach((c) => (c.hidden = cat !== 'all' && c.dataset.cat !== cat));
    }),
  );

  if (!dialog || typeof dialog.showModal !== 'function') return;
  const img = dialog.querySelector('[data-lightbox-img]');
  const caption = dialog.querySelector('[data-lightbox-caption]');
  let list = [];
  let index = 0;
  const show = (i) => {
    index = (i + list.length) % list.length;
    const item = list[index];
    img.src = item.dataset.full;
    img.alt = item.querySelector('img')?.alt ?? '';
    caption.textContent = item.dataset.caption ?? '';
  };
  root.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery__item');
    if (!item) return;
    list = visible();
    show(list.indexOf(item));
    dialog.showModal();
    window.__lenis?.stop();
  });
  dialog.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lightbox-next]').addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog.addEventListener('close', () => {
    window.__lenis?.start();
    list[index]?.focus();
  });
}
