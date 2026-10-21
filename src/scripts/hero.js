/**
 * Scroll-driven hero, after the reference video. The section stays pinned until every step has played:
 *   1. the letters of MUNDAKA rise one by one from behind the wave as you scroll,
 *   2. a short hold on the full word,
 *   3. a wave rises from below and covers the screen while the statement appears,
 *   4. the wave keeps rising until white foam fills the page and the statement turns black,
 *   then the page moves on to the next section.
 * Uses transforms + opacity only. Skipped for reduced motion (the word is then simply shown).
 */
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const segment = (p, a, b) => clamp((p - a) / (b - a));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

export default function initHero(root) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sticky = root.querySelector('.hero__sticky');
  // the foreground (sky cut away) and rising-wave layers are invisible until the hero moves, so they are only
  // requested once the page has loaded (or on the first scroll): decoding them made the first paint wait on phones
  const lazyLayers = [...root.querySelectorAll('[data-srcset]')];
  let layersLoaded = false;
  const loadLayers = () => {
    if (layersLoaded) return;
    layersLoaded = true;
    for (const el of lazyLayers) {
      el.srcset = el.dataset.srcset;
      if (el.dataset.src) el.src = el.dataset.src;
    }
  };
  if (document.readyState === 'complete') setTimeout(loadLayers, 0);
  else window.addEventListener('load', () => setTimeout(loadLayers, 0), { once: true });
  const word = root.querySelector('.hero__word');
  let letters = [];
  let ticking = false;

  const split = () => {
    if (letters.length) return;
    const text = word.textContent.trim();
    word.textContent = '';
    letters = [...text].map((ch) => {
      const span = document.createElement('span');
      span.className = 'hero__letter';
      span.textContent = ch;
      word.append(span);
      return span;
    });
  };
  const unsplit = () => {
    if (!letters.length) return;
    word.textContent = letters.map((l) => l.textContent).join('');
    letters = [];
  };

  const frame = () => {
    ticking = false;
    if (!root.classList.contains('hero--animated')) return;
    const h = sticky.clientHeight;
    const total = root.offsetHeight - h;
    const p = clamp(-root.getBoundingClientRect().top / total);
    root.classList.toggle('hero--moving', p > 0 && p < 1);
    if (p > 0) loadLayers();
    const s = root.style;

    // 1. letters rise from behind the wave, one after another
    const n = letters.length;
    letters.forEach((el, i) => {
      const start = 0.02 + i * (0.2 / Math.max(n - 1, 1));
      const t = easeOut(segment(p, start, start + 0.13));
      el.style.transform = `translate3d(0, ${((1 - t) * 108).toFixed(2)}%, 0)`;
      el.style.opacity = Math.min(1, t * 1.6).toFixed(3);
    });

    // scene drifts and zooms slightly the whole time the word is on screen
    const drift = segment(p, 0, 0.62);
    s.setProperty('--stage-scale', (1 + 0.08 * drift).toFixed(4));
    s.setProperty('--stage-y', `${(-0.03 * h * drift).toFixed(1)}px`);
    s.setProperty('--fg-y', `${(-0.06 * h * drift).toFixed(1)}px`);
    s.setProperty('--explore-o', (1 - segment(p, 0, 0.04)).toFixed(3));

    // 2–3. after a hold, the word drifts up and the wave rises over it
    s.setProperty('--title-y', `${(-0.14 * h * easeInOut(segment(p, 0.42, 0.62))).toFixed(1)}px`);
    s.setProperty('--title-o', (1 - segment(p, 0.5, 0.62)).toFixed(3));
    const rise = h * (1 - easeOut(segment(p, 0.44, 0.66))) - 1.3 * h * easeInOut(segment(p, 0.74, 0.97));
    s.setProperty('--rise', `${rise.toFixed(1)}px`);
    s.setProperty('--statement-o', segment(p, 0.56, 0.66).toFixed(3));
    s.setProperty('--statement-y', `${(-0.04 * h * segment(p, 0.92, 1)).toFixed(1)}px`);

    // 4. the solid foam starts ~1.1 screen heights below the top of the rising layer
    const foamTop = rise + 1.1 * h;
    const mix = clamp((h * 0.8 - foamTop) / (h * 0.14));
    s.setProperty('--ink-mix', `${(mix * 100).toFixed(1)}%`);
    s.setProperty('--ink-mix-n', mix.toFixed(3));
    document.body.classList.toggle('on-dark', p > 0.5 && mix < 0.5);
  };

  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };

  const apply = () => {
    const animate = !reduce.matches;
    root.classList.toggle('hero--animated', animate);
    if (animate) split();
    else {
      unsplit();
      document.body.classList.remove('on-dark');
      root.removeAttribute('style');
    }
    request();
  };

  reduce.addEventListener('change', apply);
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  apply();
}
