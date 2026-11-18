/**
 * Home hero video (the academy's drone flight over Urdaibai). The still of its first frame paints first; the video
 * starts after that, fading in over the still once it plays. Phones get the portrait cut (a third of the size). Visitors
 * who ask for less motion or less data keep the still. Pauses while the hero is off screen.
 */
export default function initHeroVideo(video) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || navigator.connection?.saveData === true) return;
  const phone = window.matchMedia('(max-width: 640px)').matches; // same breakpoint as the still's phone crop
  video.src = phone ? video.dataset.srcPhone : video.dataset.src;
  video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
  const play = () => video.play()?.catch(() => {});
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : video.pause())).observe(video);
}
