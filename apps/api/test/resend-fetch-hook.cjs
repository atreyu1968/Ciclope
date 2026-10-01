'use strict';

const { appendFileSync } = require('node:fs');

const originalFetch = globalThis.fetch;
const logPath = process.env.E2E_RESEND_LOG;

if (typeof originalFetch !== 'function') {
  throw new Error('El runtime E2E no dispone de fetch global.');
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input?.url || '';
}

globalThis.fetch = async function ciclopeE2eFetch(input, init) {
  const url = requestUrl(input);
  if (url !== 'https://api.resend.com/emails') {
    return originalFetch(input, init);
  }

  const headers = new Headers(init?.headers);
  let payload = null;
  if (init?.body) {
    try {
      payload = JSON.parse(String(init.body));
    } catch {
      payload = String(init.body);
    }
  }

  if (logPath) {
    appendFileSync(logPath, JSON.stringify({
      at: new Date().toISOString(),
      authorization: headers.get('authorization'),
      idempotencyKey: headers.get('Idempotency-Key'),
      payload,
    }) + '\n', 'utf8');
  }

  return new Response(JSON.stringify({ id: `e2e-resend-${Date.now()}` }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
