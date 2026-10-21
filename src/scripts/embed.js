/** Click-to-load map: no request goes to the map provider until the visitor asks for it. */
export default function initEmbeds() {
  document.querySelectorAll('[data-embed]').forEach((box) => {
    box.querySelector('[data-embed-load]')?.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = box.dataset.src;
      frame.title = box.dataset.title ?? '';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      box.replaceChildren(frame);
      box.classList.add('is-loaded');
    });
  });
}
