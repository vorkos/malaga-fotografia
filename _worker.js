/**
 * Response headers every reply carries.
 *
 * The site shipped with none of these. The one that earns its place first is
 * Referrer-Policy: the Instagram and WhatsApp links are outbound navigations,
 * so without it the full path — including /apply/ — travelled to those sites in
 * the Referer header. `strict-origin-when-cross-origin` sends the bare origin
 * instead, which is all a third party needs.
 *
 * The CSP allows inline script and style because the site genuinely uses both:
 * LANG_BOOT has to run before paint, and /apply/ carries a <style> block. It is
 * still worth setting — it pins where scripts, images and fonts may come from,
 * and now that the fonts are self-hosted that list is simply 'self'.
 */
const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; '),
};

/** Add the headers without disturbing the body or the status. */
function secure(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}

export default {
  async fetch(request, env) {
    return secure(await route(request, env));
  },
};

async function route(request, env) {
  const url = new URL(request.url);

  // Canonical host+scheme: everything on the custom domain lives at
  // https://malaga-fotografia.com — www and plain-http variants 301 here,
  // otherwise Google flags them as duplicate pages. workers.dev is left
  // alone as a dev/test entry point.
  if (
    url.hostname === 'www.malaga-fotografia.com' ||
    (url.hostname === 'malaga-fotografia.com' && url.protocol === 'http:')
  ) {
    url.protocol = 'https:';
    url.hostname = 'malaga-fotografia.com';
    return Response.redirect(url.toString(), 301);
  }

  // Legacy pricing URL (pre-2026-06-18 nav link) still indexed by Google.
  if (url.pathname === '/price') {
    url.pathname = '/prices';
    return Response.redirect(url.toString(), 301);
  }

  if (url.pathname.startsWith('/gallery/')) {
    const key = url.pathname.slice(1); // strip leading /
    const obj = await env.PHOTOS.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    return new Response(obj.body, { headers });
  }

  // Photo listing for the R2 blog-post picker (blog/tools/pick-r2.mjs).
  // Token-gated: R2 holds ALL uploaded selects, not just the curated public
  // subset shown on the site, so the filename list must not be openly
  // enumerable. Set with `wrangler secret put LIST_TOKEN`.
  if (url.pathname.startsWith('/api/photos/')) {
    const auth = request.headers.get('authorization');
    if (!env.LIST_TOKEN || auth !== `Bearer ${env.LIST_TOKEN}`) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (url.pathname === '/api/photos/models') {
      const out = await env.PHOTOS.list({ prefix: 'gallery/', delimiter: '/' });
      const models = (out.delimitedPrefixes || [])
        .map((p) => p.slice('gallery/'.length).replace(/\/$/, ''))
        .filter(Boolean)
        .sort();
      return json({ models });
    }
    if (url.pathname === '/api/photos/by-model') {
      const model = url.searchParams.get('model') || '';
      if (!/^[a-zA-Z0-9._-]+$/.test(model)) return json({ error: 'bad model' }, 400);
      const prefix = `gallery/${model}/`;
      const photos = [];
      let cursor;
      do {
        const out = await env.PHOTOS.list({ prefix, cursor, limit: 1000 });
        for (const o of out.objects) {
          // source images only — skip the .avif/.webp variants
          if (/\.(jpe?g|png)$/i.test(o.key)) photos.push({ key: o.key, url: '/' + o.key });
        }
        cursor = out.truncated ? out.cursor : undefined;
      } while (cursor);
      photos.sort((a, b) => a.key.localeCompare(b.key));
      return json({ model, photos });
    }
    return json({ error: 'not_found' }, 404);
  }

  // TFP application intake (see /apply/). Stores to R2; optionally emails.
  if (url.pathname === '/api/apply' && request.method === 'POST') {
    return handleApply(request, env);
  }

  return env.ASSETS.fetch(request);
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Good enough to decide whether Resend will accept it as a Reply-To. Not an
 *  attempt to validate deliverability — just to keep a typo out of a header. */
const LOOKS_LIKE_EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

async function handleApply(request, env) {
  // The honeypot only catches bots naive enough to fill a hidden field; nothing
  // stopped a loop from writing R2 objects and firing notification emails all
  // day. Five a minute per IP is far above any real applicant.
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (env.APPLY_RATE && ip) {
    const { success } = await env.APPLY_RATE.limit({ key: ip });
    if (!success) {
      return json({ ok: false, error: 'Too many attempts — please wait a minute.' }, 429);
    }
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16384) return json({ ok: false, error: 'Too large.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Bad request.' }, 400);
  }

  // Honeypot: bots fill this hidden field; real users never see it. Drop silently.
  if (body.website) return json({ ok: true });

  const name = clip(body.name, 120).trim();
  const email = clip(body.email, 160).trim();
  const instagram = clip(body.instagram, 200).trim();
  if (!name) return json({ ok: false, error: 'Name is required.' }, 400);
  if (!email && !instagram) return json({ ok: false, error: 'Please give an email or Instagram link.' }, 400);
  if (body.over18 !== true) return json({ ok: false, error: 'Please confirm you are 18 or older.' }, 400);
  if (body.consent !== true) return json({ ok: false, error: 'Please tick the consent box.' }, 400);

  const rec = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    name,
    email,
    instagram,
    experience: clip(body.experience, 60),
    comfort: Array.isArray(body.comfort) ? body.comfort.slice(0, 10).map((c) => clip(c, 60)) : [],
    availability: clip(body.availability, 200),
    note: clip(body.note, 2000),
    ip: request.headers.get('cf-connecting-ip') || '',
    ua: clip(request.headers.get('user-agent') || '', 300),
    country: request.cf?.country || '',
  };

  // Store to R2 (source of truth). No /gallery/ route serves `applications/`,
  // so these are not web-accessible — only via wrangler / the dashboard.
  const day = rec.ts.slice(0, 10);
  const key = `applications/${day}/${rec.ts.replace(/[:.]/g, '-')}-${rec.id.slice(0, 8)}.json`;
  await env.PHOTOS.put(key, JSON.stringify(rec, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Best-effort email; storage already succeeded, so never fail the request on this.
  if (env.RESEND_API_KEY && env.APPLY_NOTIFY_TO) {
    try {
      await sendEmail(env, rec);
      console.log(`apply: emailed notification for ${rec.id}`);
    } catch (e) {
      console.log(`apply: email failed for ${rec.id}: ${e}`);
    }
  }

  return json({ ok: true });
}

async function sendEmail(env, rec) {
  // RESEND_API_KEY is a Secrets Store binding (async .get()); tolerate a plain
  // string too (classic `wrangler secret put`) so either setup works.
  const apiKey =
    typeof env.RESEND_API_KEY?.get === 'function' ? await env.RESEND_API_KEY.get() : env.RESEND_API_KEY;
  const esc = (s) => String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const lines = [
    `Name: ${rec.name}`,
    rec.email && `Email: ${rec.email}`,
    rec.instagram && `Instagram: ${rec.instagram}`,
    rec.experience && `Experience: ${rec.experience}`,
    rec.comfort.length && `Open to: ${rec.comfort.join(', ')}`,
    rec.availability && `Availability: ${rec.availability}`,
    rec.note && `\nNote:\n${rec.note}`,
    `\n${rec.country} · ${rec.ts}`,
  ].filter(Boolean);
  const html = `<h2 style="font-family:Georgia,serif">New TFP application</h2>
    <pre style="font:14px/1.6 -apple-system,sans-serif;white-space:pre-wrap;background:#f7f4ee;padding:16px;border-radius:8px">${esc(lines.join('\n'))}</pre>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.APPLY_FROM || 'Málaga Fotografía <onboarding@resend.dev>',
      to: [env.APPLY_NOTIFY_TO],
      // An address Resend rejects fails the WHOLE send, and the caller only
      // logs it — so one mistyped email meant an application saved to R2 that
      // you were never told about. Drop the header rather than the message.
      reply_to: LOOKS_LIKE_EMAIL.test(rec.email) ? rec.email : undefined,
      subject: `New TFP application — ${rec.name}`,
      html,
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}`);
}
