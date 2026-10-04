import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('serves non-contact requests from the static asset binding', async () => {
  let requestedUrl = '';
  const env = {
    ASSETS: {
      fetch(request) {
        requestedUrl = request.url;
        return new Response('asset', { status: 200 });
      }
    }
  };
  const response = await worker.fetch(new Request('https://portfolio.example/about'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset');
  assert.equal(requestedUrl, 'https://portfolio.example/about');
});

test('rejects unsupported contact methods', async () => {
  const response = await worker.fetch(new Request('https://portfolio.example/contact/submit'), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
});
