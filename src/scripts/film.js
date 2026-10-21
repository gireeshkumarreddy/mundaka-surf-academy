import { reduceMotion } from './motion.js';

/* The academy film in the instructor section: grows from small to full width as it scrolls up,
   plays (muted) while on screen, and its chapter bar shows progress and jumps to each part. */
export default function initFilm(root, config) {
  const screen = root.querySelector('[data-film-screen]');
  const video = screen.querySelector('video');
  const toggle = root.querySelector('[data-film-toggle]');
  const label = toggle.querySelector('[data-film-label]');
  const full = root.querySelector('[data-film-full]');
  const chapters = [...root.querySelectorAll('[data-film-seek]')];
  const starts = chapters.map((b) => Number(b.dataset.filmSeek));

  // 0 while the film's bottom edge is entering the viewport, 1 once it is two thirds of the way up
  // measured only while the film is near the screen: measuring it while its section is still skipped off-screen
  // (content-visibility) would force the browser to render that whole section during page load
  let ticking = false;
  let near = false;
  const grow = () => {
    ticking = false;
    if (reduceMotion.matches) {
      root.style.setProperty('--grow', '1');
      return;
    }
    if (!near) return;
    const r = root.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.8)));
    root.style.setProperty('--grow', p.toFixed(4));
  };
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(grow);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  reduceMotion.addEventListener?.('change', request);
  new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    if (near) request();
  }, { rootMargin: '60% 0px' }).observe(root);

  const play = () => {
    video.preload = 'auto';
    return video.play().catch(() => {});
  };
  const sync = () => {
    const playing = !video.paused;
    root.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-pressed', String(playing));
    label.textContent = playing ? config.strings.videoPause : config.strings.videoPlay;
  };
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);

  const flip = () => {
    if (video.paused) {
      root.dataset.userPaused = 'false';
      play();
    } else {
      root.dataset.userPaused = 'true';
      video.pause();
    }
  };
  toggle.addEventListener('click', flip);
  screen.addEventListener('click', flip);

  // plays by itself while on screen, unless the visitor paused it or prefers reduced motion
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !reduceMotion.matches && root.dataset.userPaused !== 'true') play();
    else if (!entry.isIntersecting && !video.paused) video.pause();
  }, { threshold: 0.45 }).observe(screen);

  // chapter bar: each segment fills while its part of the film plays
  const progress = () => {
    const now = video.currentTime;
    const end = video.duration || starts[starts.length - 1] + 4;
    chapters.forEach((b, i) => {
      const from = starts[i];
      const to = starts[i + 1] ?? end;
      const current = now >= from && now < to;
      b.style.setProperty('--fill', Math.min(1, Math.max(0, (now - from) / (to - from))).toFixed(3));
      b.classList.toggle('is-current', current);
      if (current) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  };
  const loop = () => {
    progress();
    if (!video.paused) requestAnimationFrame(loop);
  };
  video.addEventListener('play', () => requestAnimationFrame(loop));
  video.addEventListener('seeked', progress);
  chapters.forEach((b, i) => {
    b.addEventListener('click', () => {
      video.preload = 'auto';
      video.currentTime = starts[i] + 0.05;
      root.dataset.userPaused = 'false';
      play();
      progress();
    });
  });
  progress();

  full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (screen.requestFullscreen) screen.requestFullscreen().then(play).catch(() => {});
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone Safari
  });
}
