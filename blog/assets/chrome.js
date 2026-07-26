/**
 * chrome.js — shared site-chrome behaviour: the ES/EN language toggle and the
 * mobile menu.
 *
 * Language lives on <html lang> (set pre-paint by the inline LANG_BOOT script)
 * and is mirrored to localStorage `mf_lang` so the choice persists across every
 * page — home, prices, journal, apply. CSS (blog.css) does the show/hide of
 * [data-lang] spans, so switching is instant and needs no rerender. This file
 * only has to keep `aria-pressed` truthful: the active button was previously
 * distinguished by colour alone, which announced nothing.
 *
 * The menu is a plain disclosure. Under 720px the nav and toggle collapse into
 * a panel (see blog.css) because the wrapped six-item nav made the sticky
 * header 211px tall — a quarter of a phone screen, permanently.
 */
(function () {
  var doc = document;

  // --- language ------------------------------------------------------------
  function syncPressed() {
    var lang = doc.documentElement.lang;
    doc.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
    });
  }

  function setLang(lang) {
    doc.documentElement.lang = lang;
    try {
      localStorage.setItem('mf_lang', lang);
    } catch (e) {
      /* private mode — choice just won't persist */
    }
    syncPressed();
  }

  // --- menu ----------------------------------------------------------------
  var btn = doc.querySelector('.site-head__menu');
  var panel = btn && doc.getElementById(btn.getAttribute('aria-controls'));

  function setOpen(open) {
    if (!btn || !panel) return;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.setAttribute('data-open', '');
    else panel.removeAttribute('data-open');
  }

  if (btn && panel) {
    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });

    // Following a link should leave the menu behind, or it covers the very
    // section you just jumped to. The language buttons are exempt — you stay
    // put when you switch language.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        btn.focus();
      }
    });

    // Rotating to landscape past the breakpoint hides the button but would
    // leave `data-open` set, so the panel reappears on the next rotation back.
    var wide = window.matchMedia('(min-width: 720px)');
    (wide.addEventListener ? wide.addEventListener.bind(wide, 'change') : wide.addListener.bind(wide))(
      function (e) { if (e.matches) setOpen(false); }
    );
  }

  doc.addEventListener('click', function (e) {
    var lb = e.target.closest('[data-set-lang]');
    if (lb) setLang(lb.getAttribute('data-set-lang'));
  });

  syncPressed();
})();
