export default {
  async fetch(request, env) {
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

    if (url.pathname.startsWith('/gallery/')) {
      const key = url.pathname.slice(1); // strip leading /
      const obj = await env.PHOTOS.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers });
    }

    // TFP application intake (see /apply/). Stores to R2; optionally emails.
    if (url.pathname === '/api/apply' && request.method === 'POST') {
      return handleApply(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

async function handleApply(request, env) {
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
      reply_to: rec.email || undefined,
      subject: `New TFP application — ${rec.name}`,
      html,
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}`);
}
