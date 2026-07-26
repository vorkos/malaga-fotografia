/**
 * chrome.mjs — the ONE shared site chrome (header + footer) and the bilingual
 * SSR helpers, used by every generated page: home + prices (build-site.mjs),
 * the Journal (build.mjs), and — by mirroring this markup — /apply/.
 *
 * Why one module: the site used to wear two different chromes (home said
 * "Kostiantyn V." with an ES/EN toggle; blog/apply said "Málaga Fotografía"
 * with none). Every page now renders the same wordmark, nav, Apply CTA and
 * language toggle so a visitor never feels they left the site mid-funnel.
 *
 * Bilingual strategy (crawler- + no-JS-safe): every translatable string is
 * rendered TWICE, wrapped by `bi(en, es)` into <span data-lang>. CSS
 * (site.css / blog.css) hides the non-active language based on <html lang>.
 * A tiny boot script sets <html lang> from persisted `mf_lang` (or the browser
 * locale, Spanish-default) before paint. So: crawlers index both languages,
 * no-JS users get the default, JS users get a persisted toggle — no rerender.
 */

export const BRAND = 'Málaga Fotografía';
export const SITE = 'https://malaga-fotografia.com';

/** Render both languages inline; CSS shows the active one. */
export function bi(en, es) {
  return `<span data-lang="en">${en}</span><span data-lang="es">${es}</span>`;
}

/** Runs in <head> before paint: pick the language with no flash of the wrong one. */
export const LANG_BOOT = `<script>(function(){try{var l=localStorage.getItem('mf_lang');if(!l){l=(navigator.language||'es').toLowerCase().indexOf('en')===0?'en':'es';}document.documentElement.lang=l;}catch(e){document.documentElement.lang='es';}})();</script>`;

/** Pricing is `/prices`, NOT `/prices.html`: Cloudflare Assets strips the
 *  extension and 307s `/prices.html` -> `/prices`, so linking the .html made
 *  every Pricing click pay a redirect and pointed the canonical at a URL that
 *  redirects away from itself. */
const NAV = [
  { href: '/#portfolio', en: 'Portfolio', es: 'Portfolio', key: 'portfolio' },
  { href: '/blog/', en: 'Journal', es: 'Diario', key: 'journal' },
  { href: '/#tfp', en: 'Collaborate', es: 'Colaborar', key: 'tfp' },
  { href: '/#process', en: 'Process', es: 'Proceso', key: 'process' },
  { href: '/prices', en: 'Pricing', es: 'Precios', key: 'pricing' },
  { href: '/#contact', en: 'Contact', es: 'Contacto', key: 'contact' },
];

/**
 * Shared sticky header.
 *
 * Layout note: `.site-head__panel` is `display:contents` on desktop, so the nav
 * and the language toggle lay out as if it weren't there — brand | nav | Apply |
 * ES·EN on one row, ordered by `order` in blog.css. Below 720px the panel
 * becomes a real box that collapses behind the menu button. Wrapping them gives
 * the button a single `aria-controls` target while leaving the desktop row
 * untouched.
 *
 * The toggle buttons ship `aria-pressed="false"`; chrome.js corrects the active
 * one on load. The *visual* active state is CSS off `html[lang]`, which is set
 * pre-paint by LANG_BOOT, so there is no flash — only the announced state waits
 * for JS.
 *
 * @param {string} active  nav key to mark aria-current (or '')
 */
export function siteHeader(active = '') {
  const links = NAV.map((n) => {
    const cur = n.key === active ? ' aria-current="page"' : '';
    return `<a href="${n.href}"${cur}>${bi(n.en, n.es)}</a>`;
  }).join('');
  return `  <a class="skip-link" href="#main">${bi('Skip to content', 'Saltar al contenido')}</a>
  <header class="site-head">
    <a class="site-head__brand" href="/">${BRAND}</a>
    <div class="site-head__panel" id="site-menu">
      <nav class="site-head__nav" aria-label="${BRAND}">${links}</nav>
      <div class="langtoggle" role="group" aria-label="Language / Idioma">
        <button type="button" class="langtoggle__btn" data-set-lang="es" aria-pressed="false">ES</button>
        <button type="button" class="langtoggle__btn" data-set-lang="en" aria-pressed="false">EN</button>
      </div>
    </div>
    <a class="btn btn--primary site-head__apply" href="/apply/">${bi('Apply', 'Aplicar')}</a>
    <button type="button" class="site-head__menu" aria-controls="site-menu" aria-expanded="false">
      <span class="site-head__bars" aria-hidden="true"></span>
      <span class="vh">${bi('Menu', 'Menú')}</span>
    </button>
  </header>`;
}

/** Shared footer. */
export function siteFooter() {
  const year = new Date().getFullYear();
  return `  <footer class="site-foot">
    <span class="site-foot__brand">${BRAND}</span>
    <span>${bi('Confidential &amp; professional', 'Confidencial y profesional')} · Málaga · ${year}</span>
    <a href="https://instagram.com/ph.kostiantyn.v" target="_blank" rel="noopener">@ph.kostiantyn.v</a>
  </footer>`;
}
