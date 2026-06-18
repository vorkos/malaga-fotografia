export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/gallery/')) {
      const key = url.pathname.slice(1); // strip leading /
      const obj = await env.PHOTOS.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(obj.body, { headers });
    }

    return env.ASSETS.fetch(request);
  },
};
