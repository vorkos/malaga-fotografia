/**
 * chrome.js — shared site-chrome behaviour: the ES/EN language toggle.
 *
 * The language is stored on <html lang> (set pre-paint by the inline LANG_BOOT
 * script) and mirrored to localStorage `mf_lang` so the choice persists across
 * every page — home, prices, journal, apply. CSS (blog.css) does the actual
 * show/hide of [data-lang] spans, so switching is instant and needs no rerender.
 */
(function () {
  function setLang(lang) {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('mf_lang', lang);
    } catch (e) {
      /* private mode — choice just won't persist */
    }
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-set-lang]');
    if (!btn) return;
    setLang(btn.getAttribute('data-set-lang'));
  });
})();
