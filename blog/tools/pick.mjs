/**
 * blog/tools/pick.mjs — local photo-picker + post scaffolder for the Journal.
 *
 * Run:  node blog/tools/pick.mjs "C:\path\to\shoot-folder" [--model barbara] [--port 8150]
 *   or: npm run pick -- "C:\path\to\shoot-folder"
 *
 * Opens a local web page showing every photo in the folder. You click the ones
 * you want (click order = carousel order), mark a cover, fill in the story, and
 * hit Publish. The tool then:
 *   1. uploads the selected photos to R2 under  gallery/<model>/<file>
 *      (photos on R2 are organised by model name), via `wrangler r2 object put`,
 *   2. writes the post to  blog/content/<date>-<slug>.md,
 *   3. runs the static build (`npm run build:blog`).
 * It never pushes — you review the local preview, then `git push` to go live.
 *
 * Node builtins only. Requires wrangler to be installed + logged in (it is,
 * since the site deploys from this machine).
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..'); // malaga-fotografia/
const CONTENT_DIR = join(REPO_ROOT, 'blog', 'content');
const BUCKET = 'photos';
const SITE = 'https://malaga-fotografia.com';
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// --- args ---
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const FOLDER = positional[0] ? resolve(positional[0]) : null;
const MODEL_DEFAULT = opt('model', '');
const PORT = Number(opt('port', '8150'));

if (!FOLDER || !existsSync(FOLDER) || !statSync(FOLDER).isDirectory()) {
  console.error(`\nUsage: node blog/tools/pick.mjs "<shoot-folder>" [--model <name>] [--port 8150]`);
  console.error(FOLDER ? `Folder not found: ${FOLDER}` : 'Missing <shoot-folder> argument.');
  process.exit(1);
}

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function listImages() {
  return readdirSync(FOLDER).filter((f) => IMG_EXT.has(extname(f).toLowerCase())).sort();
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function uploadToR2(model, file) {
  const key = `${BUCKET}/gallery/${model}/${file}`;
  const localPath = join(FOLDER, file);
  const ct = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', 'r2', 'object', 'put', key, `--file=${localPath}`, `--content-type=${ct}`, '--remote'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return { ok: r.status === 0, key, err: (r.stderr || '').trim().split('\n').slice(-1)[0] };
}

function writePost(data) {
  const model = slugify(data.model || 'model');
  const slug = slugify(data.slug || data.title || model);
  const date = data.date || new Date().toISOString().slice(0, 10);
  const imgUrl = (f) => `${SITE}/gallery/${model}/${f}`;
  const order = data.order || [];
  const cover = data.cover && order.includes(data.cover) ? data.cover : order[0];
  const fm = [
    '---',
    `title: ${JSON.stringify(data.title || `${data.model} — session`)}`,
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
  return { mdPath, slug, model };
}

function runBuild() {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:blog'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    return send(res, 200, readFileSync(join(__dirname, 'picker.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  if (url.pathname === '/api/config') {
    return send(res, 200, JSON.stringify({ folder: FOLDER, model: MODEL_DEFAULT, images: listImages() }));
  }
  if (url.pathname === '/thumb') {
    const name = url.searchParams.get('f') || '';
    const safe = basename(name);
    const p = join(FOLDER, safe);
    if (!IMG_EXT.has(extname(safe).toLowerCase()) || !existsSync(p)) return send(res, 404, 'nf', 'text/plain');
    return send(res, 200, readFileSync(p), MIME[extname(safe).toLowerCase()] || 'application/octet-stream');
  }
  if (url.pathname === '/api/publish' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
      const order = Array.isArray(data.order) ? data.order : [];
      if (!order.length) return send(res, 400, JSON.stringify({ error: 'no photos selected' }));
      const model = slugify(data.model || '');
      if (!model) return send(res, 400, JSON.stringify({ error: 'model name required' }));

      const uploads = [];
      if (!data.dryRun) {
        for (const f of order) {
          const u = uploadToR2(model, f);
          uploads.push(u);
          if (!u.ok) return send(res, 500, JSON.stringify({ error: `upload failed: ${f}: ${u.err}`, uploads }));
        }
      }
      const { mdPath, slug } = writePost(data);
      const build = data.dryRun ? { ok: true, out: '(dry run — build skipped)' } : runBuild();
      return send(res, 200, JSON.stringify({
        ok: build.ok,
        uploaded: uploads.length,
        mdPath,
        postUrl: `${SITE}/blog/${slug}/`,
        previewHint: `Review locally, then: git add -A && git commit && git push origin main`,
        build: build.out.trim().split('\n').slice(-4).join('\n'),
      }));
    });
    return;
  }
  send(res, 404, 'not found', 'text/plain');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Photo picker ready:  http://127.0.0.1:${PORT}`);
  console.log(`  Folder: ${FOLDER}`);
  console.log(`  ${listImages().length} images. Ctrl+C to stop.\n`);
});
