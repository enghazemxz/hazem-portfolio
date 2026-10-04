import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/contact/submit.js';

const env = {
  RESEND_API_KEY: 'test-key',
  CONTACT_TO_EMAIL: 'owner@example.com',
  CONTACT_FROM_EMAIL: 'Portfolio <portfolio@example.com>',
  CONTACT_SUCCESS_MESSAGE: 'Sent.'
};

function contactRequest(fields = {}, origin = 'https://portfolio.example') {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Hazem Client',
    email: 'client@example.com',
    message: 'I would like to discuss a new 3D project.',
    ...fields
  })) form.set(key, value);
  return new Request('https://portfolio.example/contact/submit', {
    method: 'POST',
    headers: { Origin: origin },
    body: form
  });
}

test('delivers a valid inquiry through Resend', async () => {
  const originalFetch = globalThis.fetch;
  let delivery;
  globalThis.fetch = async (url, options) => {
    delivery = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  };
  try {
    const response = await onRequestPost({ request: contactRequest({ focus: '3D Visualization' }), env });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, message: 'Sent.' });
    assert.equal(delivery.url, 'https://api.resend.com/emails');
    assert.equal(delivery.body.reply_to, 'client@example.com');
    assert.match(delivery.body.html, /3D Visualization/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('silently accepts the honeypot without sending email', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(null, { status: 200 });
  };
  try {
    const response = await onRequestPost({ request: contactRequest({ company_website: 'spam.example' }), env });
    assert.equal(response.status, 200);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects invalid email addresses', async () => {
  const response = await onRequestPost({ request: contactRequest({ email: 'not-an-email' }), env });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).ok, false);
});

test('rejects cross-origin submissions', async () => {
  const response = await onRequestPost({ request: contactRequest({}, 'https://attacker.example'), env });
  assert.equal(response.status, 403);
});

test('reports missing production configuration without leaking names', async () => {
  const response = await onRequestPost({ request: contactRequest(), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, 'Contact delivery is temporarily unavailable.');
});
