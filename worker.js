import { onRequestOptions, onRequestPost } from './functions/contact/submit.js';

const METHOD_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  Allow: 'POST, OPTIONS'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/contact/submit') {
      if (request.method === 'POST') return onRequestPost({ request, env });
      if (request.method === 'OPTIONS') return onRequestOptions();
      return new Response(JSON.stringify({ ok: false, message: 'Method not allowed.' }), {
        status: 405,
        headers: METHOD_HEADERS
      });
    }
    return env.ASSETS.fetch(request);
  }
};
