/**
 * site.js — home-page enhancement: the portfolio lightbox.
 *
 * Uses PhotoSwipe v5 (MIT), vendored under /blog/assets/vendor/photoswipe/ so
 * nothing loads from a CDN (free-tier + no external deps). The gallery items
 * are <a> tags with href + data-pswp-width/height, so with JS off they simply
 * open the image — progressive enhancement. Honours prefers-reduced-motion.
 */
import PhotoSwipeLightbox from '/blog/assets/vendor/photoswipe/photoswipe-lightbox.esm.min.js';

const grid = document.querySelector('.gallery__grid');
if (grid) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lightbox = new PhotoSwipeLightbox({
    gallery: '.gallery__grid',
    children: 'a.gallery__item',
    pswpModule: () => import('/blog/assets/vendor/photoswipe/photoswipe.esm.min.js'),
    bgOpacity: 0.92,
    showHideAnimationType: reduce ? 'none' : 'zoom',
    zoom: false,
  });
  lightbox.init();
}
