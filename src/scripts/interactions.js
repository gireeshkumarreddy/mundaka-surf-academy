/**
 * Pointer interactions: header hover pill, magnetic buttons, a soft cursor follower with labels,
 * drag-to-scroll on the photo strip and tilt on framed photos.
 * Mouse/trackpad only (fine pointers) and never with reduced motion — touch devices keep native behaviour.
 */
import { t } from './integrations/config.js';

const fine = window.matchMedia('(pointer: fine)');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

/* a soft pill glides behind the hovered header link (works with keyboard focus too) */
function initNavPill() {
  document.querySelectorAll('[data-nav-group]').forEach((nav) => {
    const pill = nav.querySelector('.hdr__pill');
    if (!pill) return;
    const move = (link) => {
      nav.style.setProperty('--pill-x', `${link.offsetLeft}px`);
      nav.style.setProperty('--pill-w', `${link.offsetWidth}px`);
      nav.classList.add('is-hovering');
    };
    nav.querySelectorAll('a').forEach((a) => {
      a.addEventListener('pointerenter', () => move(a));
      a.addEventListener('focus', () => move(a));
      a.addEventListener('blur', () => nav.classList.remove('is-hovering'));
    });
    nav.addEventListener('pointerleave', () => nav.classList.remove('is-hovering'));
  });
}

/* buttons lean gently towards the pointer */
function initMagnetic() {
  document.querySelectorAll('[data-magnetic], .btn--accent, .btn--lg').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate3d(${(dx * 10).toFixed(1)}px, ${(dy * 8).toFixed(1)}px, 0)`;
    });
    el.addEventListener('pointerleave', () => el.style.removeProperty('transform'));
  });
}

/* cursor follower: a ring that trails the pointer, grows on links and shows a label on media */
function initCursor() {
  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="cursor__ring"></span><span class="cursor__label"></span>';
  document.body.append(el);
  const label = el.querySelector('.cursor__label');
  let x = -100;
  let y = -100;
  let cx = x;
  let cy = y;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    el.classList.add('is-active');
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-active'));
  const tick = () => {
    cx += (x - cx) * 0.2;
    cy += (y - cy) * 0.2;
    el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const LABELS = { view: 'cursorView', drag: 'cursorDrag', play: 'cursorPlay' };
  document.addEventListener('pointerover', (e) => {
    const media = e.target.closest('[data-cursor]');
    const kind = media?.dataset.cursor;
    const interactive = e.target.closest('a, button, [role="tab"], label, summary, select, input, textarea, .map-region, .map-city, .map-pin');
    el.classList.toggle('is-media', Boolean(kind));
    el.classList.toggle('is-link', !kind && Boolean(interactive));
    label.textContent = kind ? t(LABELS[kind] ?? 'cursorView') : '';
  });
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));
}

/* label media areas for the cursor */
function tagCursorAreas() {
  document.querySelectorAll('.gallery__item, .story__media, .type__media, .strip__item:not(.strip__item--video), .conditions__card').forEach((el) => (el.dataset.cursor = 'view'));
  document.querySelectorAll('.clip').forEach((el) => (el.dataset.cursor = 'play'));
  document.querySelectorAll('.strip__track').forEach((el) => (el.dataset.cursor = 'drag'));
}

/* drag the photo strip sideways with the mouse */
function initStripDrag() {
  document.querySelectorAll('.strip__track').forEach((track) => {
    let startX = 0;
    let startLeft = 0;
    let moved = false;
    let down = false;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      track.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    });
    track.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);
    track.addEventListener('dragstart', (e) => e.preventDefault());
  });
}

/* framed photos tilt towards the pointer */
function initTilt() {
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg)`;
    });
    el.addEventListener('pointerleave', () => el.style.removeProperty('transform'));
  });
}

export default function initInteractions() {
  initNavPill();
  tagCursorAreas();
  initStripDrag();
  if (!fine.matches || reduce.matches) return;
  initMagnetic();
  initCursor();
  initTilt();
}
