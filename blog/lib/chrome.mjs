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

const NAV = [
  { href: '/#portfolio', en: 'Portfolio', es: 'Portfolio', key: 'portfolio' },
  { href: '/blog/', en: 'Journal', es: 'Diario', key: 'journal' },
  { href: '/#tfp', en: 'Collaborate', es: 'Colaborar', key: 'tfp' },
  { href: '/#process', en: 'Process', es: 'Proceso', key: 'process' },
  { href: '/prices.html', en: 'Pricing', es: 'Precios', key: 'pricing' },
  { href: '/#contact', en: 'Contact', es: 'Contacto', key: 'contact' },
];

/**
 * Shared sticky header.
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
    <nav class="site-head__nav" aria-label="Málaga Fotografía">${links}</nav>
    <div class="site-head__actions">
      <a class="btn btn--primary site-head__apply" href="/apply/">${bi('Apply', 'Aplicar')}</a>
      <div class="langtoggle" role="group" aria-label="Language / Idioma">
        <button type="button" class="langtoggle__btn" data-set-lang="es">ES</button>
        <button type="button" class="langtoggle__btn" data-set-lang="en">EN</button>
      </div>
    </div>
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
