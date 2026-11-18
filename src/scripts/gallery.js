/** Gallery (client feedback 5): instructors and classes in two sections; a lightbox on a native <dialog> (focus trap and
 *  Esc come for free) walks the photos that are showing in the section of the photo opened. */
export default function initGallery(root) {
  const dialog = root.querySelector('[data-lightbox]');
  const visible = (item) => [...item.closest('.gallery__grid').querySelectorAll('.gallery__item')].filter((b) => b.getClientRects().length);

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
    list = visible(item);
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
