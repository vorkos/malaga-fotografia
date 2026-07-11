/* Tiny dependency-free carousel for Journal posts.
   The track is a native horizontal scroll-snap container, so swipe works with
   zero JS on touch devices. This only wires up the prev/next arrows, the dots,
   and keeps the active dot in sync with scroll position. */
(function () {
  document.querySelectorAll('[data-carousel]').forEach((root) => {
    const track = root.querySelector('[data-track]');
    const slides = Array.from(track.children);
    const dots = Array.from(root.querySelectorAll('.carousel__dot'));
    if (!track || slides.length < 2) return;

    const scrollTo = (i) => {
      const idx = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: slides[idx].offsetLeft, behavior: 'smooth' });
    };
    const current = () => Math.round(track.scrollLeft / track.clientWidth);

    root.querySelector('[data-prev]')?.addEventListener('click', () => scrollTo(current() - 1));
    root.querySelector('[data-next]')?.addEventListener('click', () => scrollTo(current() + 1));
    dots.forEach((d) => d.addEventListener('click', () => scrollTo(Number(d.dataset.i))));

    const sync = () => {
      const i = current();
      dots.forEach((d, di) => d.setAttribute('aria-current', di === i ? 'true' : 'false'));
    };
    track.addEventListener('scroll', () => window.requestAnimationFrame(sync), { passive: true });
    sync();
  });
})();
