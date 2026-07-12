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
// AI "Draft with AI" is OFF by default so it never spawns the paid model
// unless explicitly enabled with --ai (its ~$0.04/photo counts against whatever
// your local `claude` CLI is authenticated with).
const AI_DRAFT = args.includes('--ai');

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

function cleanErr(r) {
  // strip ANSI/spinner noise; keep the last couple of meaningful lines
  const raw = `${r.stderr || ''}\n${r.stdout || ''}`.replace(/\x1b\[[0-9;]*m/g, '').replace(/[⠁-⣿⛅▲✘│─]/g, '');
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l && !/^wrangler \d/.test(l) && !/report any issues/i.test(l));
  return lines.slice(-2).join(' — ') || (r.error ? String(r.error) : `exit ${r.status}`);
}

function uploadToR2(model, file) {
  const key = `${BUCKET}/gallery/${model}/${file}`;
  const localPath = join(FOLDER, file);
  const ct = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  // wrangler --remote hiccups intermittently (token refresh / rate limit), so
  // retry a few times with backoff before giving up on a file.
  // Run via the shell so `npx` resolves to npx.cmd on Windows. Spawning the
  // .cmd directly throws EINVAL on modern Node (CVE-2024-27980 hardening); the
  // shell wrapper avoids that. Paths are double-quoted for cmd/sh.
  const cmd = `npx wrangler r2 object put "${key}" --file="${localPath}" --content-type=${ct} --remote`;
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = spawnSync(cmd, {
      shell: true, cwd: REPO_ROOT, encoding: 'utf8', timeout: 90000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
    });
    if (r.status === 0) return { ok: true, key, attempts: attempt };
    last = r;
    // small backoff; spawnSync is sync so a busy-wait sleep keeps it simple
    const until = Date.now() + attempt * 1500;
    while (Date.now() < until) { /* backoff */ }
  }
  return { ok: false, key, err: cleanErr(last) };
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
  // shell:true so `npm` resolves to npm.cmd on Windows (see uploadToR2 note).
  const r = spawnSync('npm run build:blog', {
    shell: true, cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}

// AI draft: call the local `claude` CLI headless (Sonnet) to look at a sample of
// the selected photos and pre-fill the post text fields. Read-only (Read tool),
// no network beyond the model; the photographer edits the result before publish.
const MAX_DRAFT_IMAGES = 5;
function sampleImages(order) {
  if (order.length <= MAX_DRAFT_IMAGES) return order.slice();
  // spread evenly across the selection so the model sees the shoot's range
  const step = (order.length - 1) / (MAX_DRAFT_IMAGES - 1);
  return Array.from({ length: MAX_DRAFT_IMAGES }, (_, i) => order[Math.round(i * step)]);
}

function aiDraft(modelName, order) {
  const sample = sampleImages(order);
  const model = modelName || 'the model';
  const prompt = `You are helping a fine-art portrait, boudoir and nude photographer in Málaga write a short Journal (blog) post about a collaborative TFP photo shoot with a model named "${model}".

Read these image files from the shoot (they are in the current directory) using the Read tool:
${sample.map((f) => `- ${f}`).join('\n')}

Then write tasteful, professional, warm post text. Respond with ONLY a JSON object (no prose, no markdown code fences) with exactly these keys:
- "title": short evocative title, format "${model} — <theme or place>". Human, not clickbait.
- "summary": one sentence, max ~20 words, for the intro and social preview.
- "story": 120-180 words, first person from the photographer; narrative and warm; describe the mood, light and sense of collaboration visible in the images; emphasise the model's professionalism and ease; do NOT invent specific unverifiable facts (exact places, dates, events); SFW language only.
- "location": a short guess at the setting shown (e.g. "Indoor studio, Málaga"), or just "Málaga" if unclear.
- "quote": do NOT fabricate the model's words — put exactly this placeholder: "[Add a sentence from ${model} about her experience]".

Base everything only on what is actually visible. Keep it SFW and respectful.`;

  const bin = 'claude';
  const r = spawnSync(bin, ['-p', '--model', 'sonnet', '--allowed-tools', 'Read', '--output-format', 'json'], {
    cwd: FOLDER,
    input: prompt,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.status !== 0) {
    return { ok: false, error: `claude CLI exited ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 300)}` };
  }
  let envelope;
  try { envelope = JSON.parse(r.stdout); } catch { return { ok: false, error: 'could not parse claude output' }; }
  if (envelope.is_error) return { ok: false, error: envelope.result || 'claude returned an error' };
  let text = String(envelope.result || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let draft;
  try { draft = JSON.parse(text); } catch { return { ok: false, error: 'model did not return valid JSON', raw: text.slice(0, 400) }; }
  return { ok: true, draft, cost: envelope.total_cost_usd, images: sample.length };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/') {
    return send(res, 200, readFileSync(join(__dirname, 'picker.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  if (url.pathname === '/api/config') {
    return send(res, 200, JSON.stringify({ folder: FOLDER, model: MODEL_DEFAULT, images: listImages(), aiDraft: AI_DRAFT }));
  }
  if (url.pathname === '/thumb') {
    const name = url.searchParams.get('f') || '';
    const safe = basename(name);
    const p = join(FOLDER, safe);
    if (!IMG_EXT.has(extname(safe).toLowerCase()) || !existsSync(p)) return send(res, 404, 'nf', 'text/plain');
    return send(res, 200, readFileSync(p), MIME[extname(safe).toLowerCase()] || 'application/octet-stream');
  }
  if (url.pathname === '/api/draft' && req.method === 'POST') {
    if (!AI_DRAFT) return send(res, 403, JSON.stringify({ error: 'AI draft is disabled. Relaunch with --ai to enable it.' }));
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body); } catch { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
      const order = Array.isArray(data.order) ? data.order : [];
      if (!order.length) return send(res, 400, JSON.stringify({ error: 'select photos first' }));
      console.log(`  drafting text with Sonnet from ${Math.min(order.length, MAX_DRAFT_IMAGES)} image(s)…`);
      const r = aiDraft(data.model, order);
      if (!r.ok) return send(res, 500, JSON.stringify({ error: r.error, raw: r.raw }));
      console.log(`  draft ready (cost ~$${(r.cost || 0).toFixed(3)})`);
      return send(res, 200, JSON.stringify(r));
    });
    return;
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
  console.log(`  ${listImages().length} images.`);
  console.log(`  AI draft: ${AI_DRAFT ? 'ON (uses your claude CLI, ~$0.04/photo)' : 'off — add --ai to enable'}. Ctrl+C to stop.\n`);
});
