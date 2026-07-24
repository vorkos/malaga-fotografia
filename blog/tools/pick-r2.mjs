/**
 * blog/tools/pick-r2.mjs — build a Journal post from photos ALREADY in R2.
 *
 * Unlike pick.mjs (which uploads a local shoot folder), this picks from photos
 * that are already stored under gallery/<model>/ in R2 — so you can turn an
 * earlier shoot's selects into a blog post without re-uploading anything.
 *
 * Run:  node blog/tools/pick-r2.mjs <model> [--port 8151]
 *       node blog/tools/pick-r2.mjs --list          (list models, then exit)
 *   or: npm run pick-r2 -- <model>
 *
 * Reuses the same picker UI (picker.html). Reads the model list + photos from
 * the site's token-gated /api/photos endpoint (LIST_TOKEN from .dev.vars or
 * $MF_LIST_TOKEN). Publish writes blog/content/<date>-<slug>.md referencing the
 * existing R2 URLs and runs the build — it never uploads and never pushes.
 *
 * Node builtins only.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const CONTENT_DIR = join(REPO_ROOT, 'blog', 'content');
const SITE = 'https://malaga-fotografia.com';

// --- LIST_TOKEN (from $MF_LIST_TOKEN or malaga-fotografia/.dev.vars) --------
function listToken() {
  if (process.env.MF_LIST_TOKEN) return process.env.MF_LIST_TOKEN.trim();
  const dv = join(REPO_ROOT, '.dev.vars');
  if (existsSync(dv)) {
    const m = readFileSync(dv, 'utf8').match(/^\s*LIST_TOKEN\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim();
  }
  return '';
}
const TOKEN = listToken();

async function api(path) {
  const r = await fetch(`${SITE}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${(await r.text().catch(() => '')).slice(0, 120)}`);
  return r.json();
}

// --- args ---
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const PORT = Number(opt('port', '8151'));
const MODEL = positional[0] || opt('model', '');
const LIST_ONLY = args.includes('--list');

if (!TOKEN) {
  console.error('\nNo LIST_TOKEN found. Set $MF_LIST_TOKEN or add LIST_TOKEN=... to malaga-fotografia/.dev.vars');
  console.error('and make sure the worker has it: `wrangler secret put LIST_TOKEN`.\n');
  process.exit(1);
}

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

// Post writer — image URLs use the actual R2 folder (r2Folder), while the
// front-matter `model` keeps the display name the photographer typed.
function writePost(data, r2Folder) {
  const slug = slugify(data.slug || data.title || data.model || r2Folder);
  const date = data.date || new Date().toISOString().slice(0, 10);
  const imgUrl = (f) => `${SITE}/gallery/${r2Folder}/${f}`;
  const order = data.order || [];
  const cover = data.cover && order.includes(data.cover) ? data.cover : order[0];
  const fm = [
    '---',
    `title: ${JSON.stringify(data.title || `${data.model || r2Folder} — session`)}`,
    `slug: ${slug}`,
    `date: ${date}`,
    `lang: ${data.lang === 'es' ? 'es' : 'en'}`,
    `location: ${JSON.stringify(data.location || 'Málaga')}`,
    `summary: ${JSON.stringify(data.summary || '')}`,
    `model: ${JSON.stringify(data.model || '')}`,
    `model_link: ${JSON.stringify(data.model_link || '')}`,
    `cover: ${JSON.stringify(imgUrl(cover))}`,
    'images:',
    ...order.map((f) => `  - ${JSON.stringify(imgUrl(f))}`),
    `quote: ${JSON.stringify(data.quote || '')}`,
    `quote_by: ${JSON.stringify(data.quote_by || data.model || '')}`,
    'published: true',
    '---',
    '',
    (data.story || '').trim(),
    '',
  ].join('\n');
  const mdPath = join(CONTENT_DIR, `${date}-${slug}.md`);
  writeFileSync(mdPath, fm, 'utf8');
  return { mdPath, slug };
}

function runBuild() {
  const r = spawnSync('npm run build:blog', {
    shell: true, cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};
function serveStatic(res, urlPath) {
  const root = resolve(REPO_ROOT);
  let full = resolve(root, decodeURIComponent(urlPath).replace(/^\/+/, ''));
  if (full !== root && !full.startsWith(root + (process.platform === 'win32' ? '\\' : '/'))) {
    return send(res, 403, 'forbidden', 'text/plain');
  }
  if (existsSync(full) && statSync(full).isDirectory()) full = join(full, 'index.html');
  if (!existsSync(full) || !statSync(full).isFile()) return send(res, 404, 'not found', 'text/plain');
  return send(res, 200, readFileSync(full), STATIC_MIME[extname(full).toLowerCase()] || 'application/octet-stream');
}

async function main() {
  const { models } = await api('/api/photos/models');

  if (LIST_ONLY || !MODEL) {
    console.log(`\nModels in R2 (${models.length}):`);
    for (const m of models) console.log('  ' + m);
    if (!MODEL && !LIST_ONLY) console.log(`\nThen:  node blog/tools/pick-r2.mjs <model>\n`);
    process.exit(0);
  }
  if (!models.includes(MODEL)) {
    console.error(`\nUnknown model "${MODEL}". Available: ${models.join(', ')}\n`);
    process.exit(1);
  }

  const { photos } = await api(`/api/photos/by-model?model=${encodeURIComponent(MODEL)}`);
  const files = photos.map((p) => p.key.split('/').pop());
  if (!files.length) { console.error(`No photos under gallery/${MODEL}/`); process.exit(1); }

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/') {
      return send(res, 200, readFileSync(join(__dirname, 'picker.html'), 'utf8'), 'text/html; charset=utf-8');
    }
    if (url.pathname === '/api/config') {
      return send(res, 200, JSON.stringify({ images: files, folder: `R2 · gallery/${MODEL}/`, model: MODEL, aiDraft: false }));
    }
    if (url.pathname === '/thumb') {
      const f = (url.searchParams.get('f') || '').split('/').pop();
      if (!files.includes(f)) return send(res, 404, 'nf', 'text/plain');
      res.writeHead(302, { location: `${SITE}/gallery/${MODEL}/${encodeURIComponent(f)}` });
      return res.end();
    }
    if (url.pathname === '/api/publish' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body); } catch { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
        const order = Array.isArray(data.order) ? data.order : [];
        if (!order.length) return send(res, 400, JSON.stringify({ error: 'no photos selected' }));
        const { mdPath, slug } = writePost(data, MODEL);
        const build = runBuild();
        return send(res, 200, JSON.stringify({
          ok: build.ok,
          uploaded: order.length, // reused from R2 (no upload)
          mdPath,
          previewUrl: `http://127.0.0.1:${PORT}/blog/${slug}/`,
          liveUrl: `${SITE}/blog/${slug}/`,
          build: build.out.trim().split('\n').slice(-4).join('\n'),
        }));
      });
      return;
    }
    if (req.method === 'GET') return serveStatic(res, url.pathname);
    send(res, 404, 'not found', 'text/plain');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  R2 photo picker ready:  http://127.0.0.1:${PORT}`);
    console.log(`  Model: ${MODEL}  (${files.length} photos in R2)`);
    console.log(`  Pick photos, write the post, Publish. Then review the preview + git push. Ctrl+C to stop.\n`);
  });
}

main().catch((e) => { console.error('\n' + e.message + '\n'); process.exit(1); });
