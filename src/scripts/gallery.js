/** Gallery lightbox on a native <dialog> (focus trap, Esc to close come for free). */
export default function initGallery(root) {
  const dialog = root.querySelector('[data-lightbox]');
  const items = [...root.querySelectorAll('.gallery__item')];
  if (!dialog || !items.length || typeof dialog.showModal !== 'function') return;
  const img = dialog.querySelector('[data-lightbox-img]');
  const caption = dialog.querySelector('[data-lightbox-caption]');
  let index = 0;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    img.src = item.dataset.full;
    img.alt = item.querySelector('img')?.alt ?? '';
    caption.textContent = item.dataset.caption ?? '';
  };

  items.forEach((item, i) =>
    item.addEventListener('click', () => {
      show(i);
      dialog.showModal();
      window.__lenis?.stop();
    }),
  );
  dialog.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-lightbox-next]').addEventListener('click', () => show(index + 1));
  dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  // click on the backdrop closes
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    window.__lenis?.start();
    items[index]?.focus();
  });
}
