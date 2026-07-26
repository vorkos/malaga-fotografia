/**
 * build-apply.mjs — stamps the shared chrome into /apply/index.html.
 *
 * /apply/ is the one page written by hand: it carries a real form with its own
 * validation, so generating the whole thing would bury the interesting part in
 * template strings. But hand-mirroring the header is what let it drift — by
 * 2026-07-26 it had the old `/prices.html` nav, its own Google Fonts request
 * with a different weight set, and a footer year frozen at 2026.
 *
 * So: the page stays hand-written, the chrome is stamped in. Everything between
 * the `chrome:start`/`chrome:end` and `foot:start`/`foot:end` markers belongs to
 * blog/lib/chrome.mjs and is overwritten on every build.
 *
 * Run: `npm run build:apply` (or `npm run build`, which chains it).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { siteHeader, siteFooter } from './lib/chrome.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = join(__dirname, '..', 'apply', 'index.html');

/** Replace the body of a marked region, keeping the markers themselves. */
function stamp(html, name, body) {
  const re = new RegExp(`(<!-- ${name}:start[\\s\\S]*?-->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(html)) {
    throw new Error(`apply/index.html has no <!-- ${name}:start --> … <!-- ${name}:end --> markers`);
  }
  return html.replace(re, (_, open, close) => `${open}\n${body}\n  ${close}`);
}

let html = readFileSync(PAGE, 'utf8');
html = stamp(html, 'chrome', siteHeader('')); // no nav key: /apply/ isn't in NAV
html = stamp(html, 'foot', siteFooter());
writeFileSync(PAGE, html);
console.log('  ✓ apply/index.html (chrome + footer)');
