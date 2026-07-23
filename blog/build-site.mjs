/**
 * build-site.mjs — static generator for the home (index.html) and pricing
 * (prices.html) pages. Replaces the old ~530KB client-rendered dc-runtime
 * bundle: these are now real, pre-rendered, bilingual HTML on the shared token
 * system, so crawlers and link-preview bots see actual content (the bundle
 * showed them only a "KV" splash), and the byte-level Python editing workflow
 * is retired.
 *
 * Both languages are emitted inline (see chrome.mjs `bi()`); the ES/EN toggle
 * flips <html lang> with no rerender. Copy is lifted verbatim from the readable
 * design source (src/Portfolio.dc.html, src/Prices.dc.html). Gallery image
 * paths use the current per-model R2 layout (gallery/<model>/<file>) from
 * .agent/photos-by-model.json — the src file's flat paths are stale.
 *
 * Run: `npm run build:site`  (Node 18+, no deps beyond chrome.mjs)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bi, siteHeader, siteFooter, LANG_BOOT, BRAND, SITE } from './lib/chrome.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..'); // repo root — where index.html/prices.html live

const G = (p) => `/gallery/${p}`; // R2 path helper

function head({ title, desc, canonical, ogImage, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog/assets/blog.css">
<link rel="stylesheet" href="/blog/assets/site.css">
${extraHead}${LANG_BOOT}
<script src="/blog/assets/chrome.js" defer></script>
</head>
<body>`;
}

// --- gallery pool (per-model R2 paths, real orientation buckets) ------------
const PORTRAITS = [
  ['mariia/Z52_0012-small.jpg'],
  ['lilly/Z52_0147-small.jpg'],
  ['iryna/Z52_0598-small.jpg'],
  ['nataliia/Z52_9094-small.jpg'],
  ['mariia/Z52_0887-small.jpg'],
  ['vika/Z52_1917-small.jpg'],
  ['iryna/Z52_0537-small.jpg'],
  ['barbara/Z52_0470-small.jpg'],
  ['nataliia/Z52_9385-small.jpg'],
  ['lilly/Z52_8323-small.jpg'],
  ['vika/Z52_2867-small.jpg'],
  ['mariia/Z52_9264-small.jpg'],
].map(([p]) => p);
const WIDES = ['barbara/Z52_0383.jpg', 'barbara/Z52_0461.jpg'];

function galleryItem(path, kind, i) {
  // alt is a plain attribute (no bilingual spans) — one descriptive line.
  const alt = 'Fotografía de retrato de autor · Fine-art portrait · Málaga';
  const wide = kind === 'wide';
  const eager = i < 2 ? '' : ' loading="lazy"';
  // <a> + data-pswp-* drives the PhotoSwipe lightbox (site.js); with JS off the
  // link just opens the image. Dims are orientation approximations (real files
  // are cover-cropped to these ratios) — enough for PhotoSwipe's fit/zoom.
  const w = wide ? 1500 : 1200;
  const h = wide ? 1000 : 1500;
  return `        <a class="gallery__item${wide ? ' gallery__item--wide' : ''}" href="${G(path)}" data-pswp-width="${w}" data-pswp-height="${h}" target="_blank" rel="noopener">
          <div class="mat mat--${wide ? 'wide' : 'portrait'}"><img src="${G(path)}"${eager} decoding="async" alt="${alt}"></div>
        </a>`;
}

/** Curated, stable gallery: strongest frames lead; a wide frame breaks rhythm. */
function galleryGrid() {
  const items = [];
  let pi = 0;
  let wi = 0;
  // 4-col rhythm: 4 portraits, 1 wide (span 2) + 2 portraits, 4 portraits, ...
  const plan = ['p', 'p', 'p', 'p', 'w', 'p', 'p', 'p', 'p', 'p', 'p', 'w', 'p', 'p'];
  plan.forEach((k, i) => {
    if (k === 'w' && wi < WIDES.length) items.push(galleryItem(WIDES[wi++], 'wide', i));
    else if (pi < PORTRAITS.length) items.push(galleryItem(PORTRAITS[pi++], 'portrait', i));
  });
  return items.join('\n');
}

// --- HOME copy (lifted from src/Portfolio.dc.html) --------------------------
const HOME = {
  en: {
    heroEyebrow: 'Portrait photography · Málaga',
    heroTitle: 'Empowerment through the image',
    heroSub:
      "Portrait, boudoir and fine-art nude. I'm looking for muses to collaborate with — a safe, professional space to learn to see yourself differently.",
    heroCta1: 'Apply to collaborate',
    heroCta2: 'View portfolio',
    introLabel: "Hi, I'm Kostya",
    introBody:
      "You don't need to be a model — you just need to be you. I create intimate portraits that capture your unique beauty in a relaxed setting, guiding you every step so the photos come out natural and beautiful.",
    promise: 'A 100% confidential and professional space. You set the limits; I take care of the rest.',
    portfolioLabel: 'Portfolio',
    portfolioTitle: 'Recent work',
    portfolioSub: 'A selection of portrait, boudoir and fine-art nude sessions.',
    tfpLabel: 'TFP collaborations',
    tfpTitle: 'Looking for muses',
    tfpBody:
      'TFP (Time for Prints) means we collaborate with no money involved: I bring time, gear and direction; you bring your presence. We both receive the images for our portfolios.',
    lookTitle: 'What I look for',
    look: [
      'A wish to try something new in front of the camera',
      'Interest in portrait, boudoir or fine-art nude',
      'Commitment and punctuality',
      '18 years or older',
    ],
    getTitle: 'What you get',
    get: [
      'A private gallery with your edited photos',
      'A safe, judgement-free experience',
      'Posing guidance the whole time',
      'Freedom to bring your own ideas',
    ],
    tfpCtaNote: 'Applying takes about a minute — I read every message personally and reply within 48 hours.',
    tfpCtaBtn: 'Apply to collaborate',
    processLabel: 'How I work',
    processTitle: 'The process, step by step',
    steps: [
      { n: '01', title: 'We talk', body: "A no-pressure chat to get to know each other and what you're after." },
      { n: '02', title: 'We pick the place', body: 'Your home, a nice hotel, studio or outdoors. Wherever you feel comfortable.' },
      { n: '03', title: 'The session', body: 'I bring all the gear and guide you through every pose. Just relax and enjoy.' },
      { n: '04', title: 'Your gallery', body: 'You receive your edited photos in a private gallery within 7–10 days.' },
    ],
    contactLabel: 'Contact',
    contactTitle: 'Shall we talk?',
    contactSub: 'No commitment — ask me anything, or apply to collaborate.',
    apply: 'Apply to collaborate',
    priceNote: 'Prefer a private paid session? Sessions from €250 —',
    priceLink: 'see pricing',
  },
  es: {
    heroEyebrow: 'Fotografía de retrato · Málaga',
    heroTitle: 'Empoderamiento a través de la imagen',
    heroSub:
      'Retrato, boudoir y desnudo artístico. Busco musas para colaborar — un espacio seguro y profesional donde aprender a verte con otros ojos.',
    heroCta1: 'Aplica para colaborar',
    heroCta2: 'Ver portfolio',
    introLabel: 'Hola, soy Kostya',
    introBody:
      'No necesitas ser modelo — solo necesitas ser tú. Creo retratos íntimos que capturan tu belleza única en un ambiente relajado, guiándote en cada paso para que las fotos salgan naturales y hermosas.',
    promise: 'Un espacio 100% confidencial y profesional. Tú decides los límites; yo me encargo del resto.',
    portfolioLabel: 'Portfolio',
    portfolioTitle: 'Trabajo reciente',
    portfolioSub: 'Una selección de sesiones de retrato, boudoir y desnudo artístico.',
    tfpLabel: 'Colaboraciones TFP',
    tfpTitle: 'Busco musas',
    tfpBody:
      'TFP (Time for Prints) significa colaborar sin dinero de por medio: yo aporto tiempo, equipo y dirección; tú, tu presencia. Ambos recibimos las imágenes para nuestros portfolios.',
    lookTitle: 'Lo que busco',
    look: [
      'Ganas de probar algo nuevo frente a la cámara',
      'Interés en retrato, boudoir o desnudo artístico',
      'Compromiso y puntualidad',
      'Mayores de 18 años',
    ],
    getTitle: 'Lo que recibes',
    get: [
      'Galería privada con tus fotos editadas',
      'Una experiencia segura, sin juicios',
      'Dirección de poses en todo momento',
      'Libertad para proponer tus propias ideas',
    ],
    tfpCtaNote: 'Aplicar lleva un minuto — leo cada mensaje personalmente y respondo en 48 horas.',
    tfpCtaBtn: 'Aplica para colaborar',
    processLabel: 'Cómo trabajo',
    processTitle: 'El proceso, paso a paso',
    steps: [
      { n: '01', title: 'Hablamos', body: 'Charlamos sin compromiso para conocernos y entender qué buscas.' },
      { n: '02', title: 'Elegimos el lugar', body: 'Tu casa, un hotel bonito, estudio o exterior. Donde te sientas cómoda.' },
      { n: '03', title: 'La sesión', body: 'Traigo todo el equipo y te guío en cada pose. Solo relájate y disfruta.' },
      { n: '04', title: 'Tu galería', body: 'Recibes tus fotos editadas en una galería privada en 7–10 días.' },
    ],
    contactLabel: 'Contacto',
    contactTitle: '¿Hablamos?',
    contactSub: 'Sin compromiso — pregunta lo que quieras, o aplica para colaborar.',
    apply: 'Aplica para colaborar',
    priceNote: '¿Prefieres una sesión privada de pago? Sesiones desde 250€ —',
    priceLink: 'consulta tarifas',
  },
};

const T = (field) => bi(HOME.en[field], HOME.es[field]);
const eyebrow = (field, center = false) =>
  `<div class="eyebrow${center ? ' eyebrow--center' : ''}"><span class="eyebrow__label">${T(field)}</span></div>`;
const pointList = (field) =>
  `<div class="pointlist">${HOME.en[field]
    .map((_, i) => `<div class="point"><span>${bi(HOME.en[field][i], HOME.es[field][i])}</span></div>`)
    .join('')}</div>`;

function renderHome() {
  const steps = HOME.en.steps
    .map(
      (s, i) => `          <div class="step">
            <div class="step__n">${s.n}</div>
            <div class="step__rule"></div>
            <h3>${bi(HOME.en.steps[i].title, HOME.es.steps[i].title)}</h3>
            <p>${bi(HOME.en.steps[i].body, HOME.es.steps[i].body)}</p>
          </div>`,
    )
    .join('\n');

  return `${head({
    title: 'Málaga Fotografía — Retrato, boudoir y desnudo artístico',
    desc: 'Fotografía de retrato, boudoir y desnudo artístico en Málaga. Busco musas para colaboraciones TFP en un espacio seguro y profesional. Portrait, boudoir & fine-art nude in Málaga.',
    canonical: SITE + '/',
    ogImage: SITE + G('barbara/Z52_0461-small.jpg'),
    extraHead:
      '<link rel="stylesheet" href="/blog/assets/vendor/photoswipe/photoswipe.css">\n<script type="module" src="/blog/assets/site.js"></script>\n',
  })}
${siteHeader('portfolio')}

  <main id="main">
    <!-- HERO -->
    <section class="hero" id="top">
      <div class="hero__inner">
        ${eyebrow('heroEyebrow')}
        <h1 class="display">${T('heroTitle')}</h1>
        <p class="hero__sub">${T('heroSub')}</p>
        <div class="hero__cta">
          <a class="pill pill--primary" href="/apply/">${T('heroCta1')}</a>
          <a class="pill pill--ghost" href="#portfolio">${T('heroCta2')}</a>
        </div>
      </div>
    </section>

    <!-- ABOUT -->
    <section class="section" id="about">
      <div class="section__inner about__row">
        <div class="about__text">
          ${eyebrow('introLabel')}
          <p class="about__lead">${T('introBody')}</p>
          <div class="about__promise"><p>${T('promise')}</p></div>
        </div>
        <div class="about__img mat mat--portrait"><img src="${G('barbara/Z52_0569.jpg')}" decoding="async" alt="Retrato · Portrait · Málaga Fotografía"></div>
      </div>
    </section>

    <!-- PORTFOLIO -->
    <section class="section section--surface" id="portfolio">
      <div class="section__inner">
        <div class="gallery__head">
          ${eyebrow('portfolioLabel')}
          <h2 class="display">${T('portfolioTitle')}</h2>
          <p>${T('portfolioSub')}</p>
        </div>
        <div class="gallery__grid">
${galleryGrid()}
        </div>
      </div>
    </section>

    <!-- TFP -->
    <section class="section tfp" id="tfp">
      <div class="section__inner">
        ${eyebrow('tfpLabel')}
        <h2 class="display">${T('tfpTitle')}</h2>
        <p class="tfp__intro">${T('tfpBody')}</p>
        <div class="tfp__cards">
          <div class="tfp__card">
            <h3>${T('lookTitle')}</h3>
            ${pointList('look')}
          </div>
          <div class="tfp__card">
            <h3>${T('getTitle')}</h3>
            ${pointList('get')}
          </div>
        </div>
        <div class="tfp__cta">
          <a class="pill pill--primary" href="/apply/">${T('tfpCtaBtn')}</a>
          <p>${T('tfpCtaNote')}</p>
        </div>
      </div>
    </section>

    <!-- PROCESS -->
    <section class="section section--surface process" id="process">
      <div class="section__inner">
        ${eyebrow('processLabel')}
        <h2 class="display">${T('processTitle')}</h2>
        <div class="steps">
${steps}
        </div>
      </div>
    </section>

    <!-- CONTACT -->
    <section class="section contact" id="contact">
      <div class="contact__inner">
        ${eyebrow('contactLabel', true)}
        <h2 class="display">${T('contactTitle')}</h2>
        <p class="contact__sub">${T('contactSub')}</p>
        <div class="contact__actions">
          <a class="pill pill--primary" href="/apply/">${T('apply')}</a>
          <a class="pill pill--ghost" href="https://wa.me/34674474418" target="_blank" rel="noopener">WhatsApp</a>
          <a class="pill pill--ghost" href="https://instagram.com/ph.kostiantyn.v" target="_blank" rel="noopener">Instagram</a>
        </div>
        <p class="contact__note">${T('priceNote')} <a href="/prices.html">${T('priceLink')}</a></p>
      </div>
    </section>
  </main>

${siteFooter()}
</body>
</html>`;
}

// --- PRICES copy (lifted from src/Prices.dc.html) ---------------------------
const PRICES = {
  en: {
    eyebrow: 'Pricing · Málaga',
    title: 'Sessions & pricing',
    sub: 'Clear pricing, no surprises. Every session includes posing guidance, a safe space and your private edited gallery.',
    popular: 'Most chosen',
    book: 'Book now',
    tiers: [
      { name: 'Mini session', desc: 'Perfect for a relaxed, no-rush first time.', price: '€250', unit: '/ session', features: ['Up to 45 min', '1 look / style', '8 edited photos', 'Private online gallery'] },
      { name: 'Signature session', popular: true, desc: 'The full portrait or boudoir experience.', price: '€420', unit: '/ session', features: ['Up to 2 hours', '2–3 looks / styles', '20 edited photos', 'Posing & styling help', 'Private online gallery'] },
      { name: 'Editorial Deluxe', desc: 'A half-day production with every detail handled.', price: '€650', unit: '/ session', features: ['Half day (up to 4h)', 'Unlimited looks', '35 edited photos', 'Location or studio included', 'Makeup & hair styling'] },
    ],
    includedLabel: 'Always included',
    includedTitle: 'In every session',
    included: [
      'Posing guidance the whole time',
      'A 100% confidential, judgement-free space',
      'Private gallery with your edited photos in 7–10 days',
      'You set the limits; I take care of the rest',
    ],
    addonsLabel: 'Extras',
    addonsTitle: 'Add-ons',
    addons: [
      { name: 'Extra edited photo', price: '€15' },
      { name: 'Makeup & hair (MUA)', price: '€90' },
      { name: 'Studio or location rental', price: '€120' },
      { name: 'Express delivery (48h)', price: '€70' },
      { name: 'Premium printed album', price: 'from €110' },
    ],
    tfpHead: 'Prefer to collaborate at no cost?',
    tfpBody: "If we're after the same thing, we can work TFP — no money involved, we both receive the images.",
    tfpLink: 'See TFP collaborations',
    ctaLabel: 'Booking',
    ctaTitle: 'Ready for your session?',
    ctaSub: "Message me and we'll design the perfect session for you together.",
    back: 'View portfolio',
  },
  es: {
    eyebrow: 'Tarifas · Málaga',
    title: 'Sesiones y tarifas',
    sub: 'Precios claros, sin sorpresas. Cada sesión incluye dirección de poses, un espacio seguro y tu galería privada editada.',
    popular: 'Más elegida',
    book: 'Reservar',
    tiers: [
      { name: 'Mini sesión', desc: 'Ideal para una primera vez, relajada y sin prisa.', price: '250€', unit: '/ sesión', features: ['Hasta 45 min', '1 look / estilo', '8 fotos editadas', 'Galería privada online'] },
      { name: 'Sesión Signature', popular: true, desc: 'La experiencia completa de retrato o boudoir.', price: '420€', unit: '/ sesión', features: ['Hasta 2 horas', '2–3 looks / estilos', '20 fotos editadas', 'Ayuda con poses y estilismo', 'Galería privada online'] },
      { name: 'Editorial Deluxe', desc: 'Producción de medio día con todo cuidado al detalle.', price: '650€', unit: '/ sesión', features: ['Medio día (hasta 4 h)', 'Looks ilimitados', '35 fotos editadas', 'Localización o estudio incluido', 'Maquillaje y peluquería'] },
    ],
    includedLabel: 'Siempre incluido',
    includedTitle: 'En cada sesión',
    included: [
      'Dirección de poses en todo momento',
      'Un espacio 100% confidencial y sin juicios',
      'Galería privada con tus fotos editadas en 7–10 días',
      'Tú decides los límites; yo me encargo del resto',
    ],
    addonsLabel: 'Extras',
    addonsTitle: 'Complementos',
    addons: [
      { name: 'Foto editada adicional', price: '15€' },
      { name: 'Maquillaje y peluquería (MUA)', price: '90€' },
      { name: 'Alquiler de estudio o localización', price: '120€' },
      { name: 'Entrega exprés (48 h)', price: '70€' },
      { name: 'Álbum impreso premium', price: 'desde 110€' },
    ],
    tfpHead: '¿Prefieres colaborar sin coste?',
    tfpBody: 'Si buscamos lo mismo, podemos trabajar en modalidad TFP — sin dinero de por medio, ambos recibimos las imágenes.',
    tfpLink: 'Ver colaboraciones TFP',
    ctaLabel: 'Reserva',
    ctaTitle: '¿Lista para tu sesión?',
    ctaSub: 'Escríbeme y diseñamos juntos la sesión perfecta para ti.',
    back: 'Ver portfolio',
  },
};

function renderPrices() {
  const P = (f) => bi(PRICES.en[f], PRICES.es[f]);
  const tiers = PRICES.en.tiers
    .map((tier, i) => {
      const es = PRICES.es.tiers[i];
      const features = tier.features
        .map((_, fi) => `            <div class="point"><span>${bi(tier.features[fi], es.features[fi])}</span></div>`)
        .join('\n');
      return `        <div class="tier${tier.popular ? ' tier--popular' : ''}">
          ${tier.popular ? `<span class="tier__badge">${P('popular')}</span>` : ''}
          <h3>${bi(tier.name, es.name)}</h3>
          <p class="tier__desc">${bi(tier.desc, es.desc)}</p>
          <div class="tier__price"><b>${bi(tier.price, es.price)}</b><span>${bi(tier.unit, es.unit)}</span></div>
          <div class="tier__rule"></div>
          <div class="tier__features pointlist">
${features}
          </div>
          <a class="pill pill--${tier.popular ? 'primary' : 'ghost'}" href="https://wa.me/34674474418" target="_blank" rel="noopener">${P('book')}</a>
        </div>`;
    })
    .join('\n');

  const included = PRICES.en.included
    .map((_, i) => `          <div class="point"><span>${bi(PRICES.en.included[i], PRICES.es.included[i])}</span></div>`)
    .join('\n');
  const addons = PRICES.en.addons
    .map((a, i) => `          <div class="addon"><span>${bi(a.name, PRICES.es.addons[i].name)}</span><b>${bi(a.price, PRICES.es.addons[i].price)}</b></div>`)
    .join('\n');

  return `${head({
    title: 'Sesiones y tarifas — Málaga Fotografía',
    desc: 'Tarifas de sesiones de retrato y boudoir en Málaga desde 250€. Precios claros con galería privada editada. Portrait & boudoir session pricing in Málaga.',
    canonical: SITE + '/prices.html',
    ogImage: SITE + G('barbara/Z52_0501.jpg'),
  })}
${siteHeader('pricing')}

  <main id="main">
    <!-- HERO -->
    <section class="price-hero">
      <div class="price-hero__row">
        <div class="price-hero__text">
          ${(() => `<div class="eyebrow"><span class="eyebrow__label">${P('eyebrow')}</span></div>`)()}
          <h1 class="display">${P('title')}</h1>
          <p class="price-hero__sub">${P('sub')}</p>
        </div>
        <div class="price-hero__img mat mat--portrait"><img src="${G('barbara/Z52_0501.jpg')}" decoding="async" alt="Retrato boudoir · Boudoir portrait · Málaga"></div>
      </div>
    </section>

    <!-- TIERS -->
    <section class="section" style="padding-top:clamp(20px,3vh,40px)">
      <div class="section__inner">
        <div class="tiers">
${tiers}
        </div>
      </div>
    </section>

    <!-- INCLUDED + ADD-ONS -->
    <section class="section section--surface">
      <div class="section__inner pricecols">
        <div class="pricecol">
          <div class="eyebrow"><span class="eyebrow__label">${P('includedLabel')}</span></div>
          <h2 class="display">${P('includedTitle')}</h2>
          <div class="pointlist">
${included}
          </div>
        </div>
        <div class="pricecol">
          <div class="eyebrow"><span class="eyebrow__label">${P('addonsLabel')}</span></div>
          <h2 class="display">${P('addonsTitle')}</h2>
          <div>
${addons}
          </div>
        </div>
      </div>
    </section>

    <!-- TFP NOTE -->
    <section class="section">
      <div class="tfpnote">
        <p class="tfpnote__head">${P('tfpHead')}</p>
        <p>${P('tfpBody')} <a href="/#tfp">${P('tfpLink')}</a></p>
      </div>
    </section>

    <!-- CTA -->
    <section class="section contact">
      <div class="contact__inner">
        ${(() => `<div class="eyebrow eyebrow--center"><span class="eyebrow__label">${P('ctaLabel')}</span></div>`)()}
        <h2 class="display">${P('ctaTitle')}</h2>
        <p class="contact__sub">${P('ctaSub')}</p>
        <div class="contact__actions">
          <a class="pill pill--primary" href="https://wa.me/34674474418" target="_blank" rel="noopener">WhatsApp</a>
          <a class="pill pill--ghost" href="/#portfolio">${P('back')}</a>
        </div>
      </div>
    </section>
  </main>

${siteFooter()}
</body>
</html>`;
}

writeFileSync(join(ROOT, 'index.html'), renderHome());
writeFileSync(join(ROOT, 'prices.html'), renderPrices());
console.log('  ✓ index.html');
console.log('  ✓ prices.html');
