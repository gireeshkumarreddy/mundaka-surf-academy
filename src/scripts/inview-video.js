/**
 * Short muted clips (lessons filmed from the drone): nothing is downloaded until a clip comes near the screen; it plays
 * while visible and pauses when scrolled away. With "reduce motion" or "save data" the still shows, with controls to
 * play it on purpose. Clips inside a link (the home lesson cards) keep just the still: controls inside a link would also
 * open it.
 */
export default function initInViewVideos() {
  const videos = [...document.querySelectorAll('video[data-inview-video]')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || navigator.connection?.saveData === true) {
    videos.forEach((v) => {
      if (v.closest('a')) return;
      v.controls = true;
      v.src = v.dataset.src;
    });
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const { target: v, isIntersecting } of entries) {
        if (isIntersecting) {
          if (!v.getAttribute('src')) v.src = v.dataset.src;
          v.play()?.catch(() => {});
        } else if (!v.paused) v.pause();
      }
    },
    { rootMargin: '150px 0px', threshold: 0.15 },
  );
  videos.forEach((v) => io.observe(v));
}
