/**
 * booking-status.html?status=success|cancelled|failed
 * Return page for the future payment provider. The server webhook is the source of truth for
 * whether a booking is paid; this page only tells the visitor what happened.
 */
export default function initStatus(root) {
  const status = new URLSearchParams(window.location.search).get('status');
  const tpl = status && root.querySelector(`template[data-status="${CSS.escape(status)}"]`);
  if (!tpl) return;
  const content = tpl.content;
  root.querySelector('[data-status-title]').textContent = content.querySelector('h1').textContent;
  root.querySelector('[data-status-text]').textContent = content.querySelector('p').textContent;
  document.title = `${content.querySelector('h1').textContent} — ${document.title.split(' — ').pop()}`;
}
