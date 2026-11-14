import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import Galatext, { GalatextError } from '../src/index.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const client = () =>
  new Galatext('test-key', {
    accessToken: 'test-token',
    baseURL: 'http://localhost:3030/api/',
  });
function capture(response = { success: true }, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), ...options });
    return Response.json(response, { status });
  };
  return calls;
}

test('preserves API-key SMS calls and normalizes legacy recipients', async () => {
  const calls = capture();
  const sdk = client();
  await sdk.sms.send(' 254712345678 ', 'Hello', 'BRAND', {
    scheduledAt: '2030-01-01T12:00:00Z',
  });
  await sdk.sms.bulk([{ phoneNumber: ' 254798765432 ' }], 'Hello');
  assert.equal(calls[0].url.href, 'http://localhost:3030/api/sms/send-api');
  assert.deepEqual(JSON.parse(calls[0].body), {
    recipients: ['254712345678'],
    message: 'Hello',
    senderId: 'BRAND',
    scheduledAt: '2030-01-01T12:00:00Z',
  });
  assert.deepEqual(JSON.parse(calls[1].body).recipients, ['254798765432']);
  assert.equal(calls[0].headers['x-api-key'], 'test-key');
  assert.equal(calls[0].headers.Authorization, undefined);
});

test('uses the API key for existing account and sender ID methods', async () => {
  const calls = capture();
  const sdk = client();
  await sdk.sms.list(20, 10);
  await sdk.account.balance();
  await sdk.account.purchases();
  await sdk.account.verifyPayment('ref/a');
  await sdk.account.buyCredits(
    'airtime',
    null,
    500,
    'https://example.test/complete',
  );
  await sdk.senderIds.list();
  assert.equal(calls[0].url.search, '?skip=20&take=10');
  assert.equal(calls[3].url.pathname, '/api/developer/credits/verify/ref%2Fa');
  assert.deepEqual(JSON.parse(calls[4].body), {
    product: 'airtime',
    amount: 500,
    callbackUrl: 'https://example.test/complete',
  });
  for (const call of calls) {
    assert.equal(call.headers['x-api-key'], 'test-key');
    assert.equal(call.headers.Authorization, undefined);
  }
});

const menu = {
  screens: [{ id: 'main', type: 'END', text: 'Thank you.', options: [] }],
};
const draft = {
  name: 'Notice',
  message: 'Office closed.',
  senderId: 'BRAND',
  manualNumbers: ['254712345678'],
  saveAsDraft: true,
  requestId: 'ad2637e6-823a-4f56-9c3c-312b6f087be1',
};
const message = {
  requestId: draft.requestId,
  recipients: ['254712345678'],
  contentSid: 'tpl_' + 'a'.repeat(64),
  contentVariables: { 1: 'Jane' },
};
const routes = [
  [
    'campaign create',
    (c) => c.campaigns.create(draft),
    'POST',
    '/sms/campaigns',
    draft,
  ],
  [
    'campaign list',
    (c) =>
      c.campaigns.list({
        page: 2,
        limit: 10,
        search: 'a & b',
        status: 'DRAFT',
      }),
    'GET',
    '/sms/campaigns',
    null,
    { page: '2', limit: '10', search: 'a & b', status: 'DRAFT' },
  ],
  ['campaign stats', (c) => c.campaigns.stats(), 'GET', '/sms/campaigns/stats'],
  ['campaign detail', (c) => c.campaigns.get(12), 'GET', '/sms/campaigns/12'],
  [
    'campaign update',
    (c) => c.campaigns.update(12, { scheduledAt: null }),
    'PATCH',
    '/sms/campaigns/12',
    { scheduledAt: null },
  ],
  [
    'campaign delete',
    (c) => c.campaigns.delete(12),
    'DELETE',
    '/sms/campaigns/12',
  ],
  [
    'campaign send',
    (c) => c.campaigns.send(12),
    'POST',
    '/sms/campaigns/12/send',
  ],
  [
    'campaign cancel',
    (c) => c.campaigns.cancel(12),
    'POST',
    '/sms/campaigns/12/cancel',
  ],
  [
    'USSD create',
    (c) =>
      c.ussd.create({
        name: 'Support',
        description: 'Customer support menu.',
        codeType: 'SHARED',
      }),
    'POST',
    '/ussd/applications',
    {
      name: 'Support',
      description: 'Customer support menu.',
      codeType: 'SHARED',
    },
  ],
  [
    'USSD list',
    (c) => c.ussd.list({ page: 1, status: 'ACTIVE', search: undefined }),
    'GET',
    '/ussd/applications',
    null,
    { page: '1', status: 'ACTIVE' },
  ],
  ['USSD stats', (c) => c.ussd.stats(), 'GET', '/ussd/stats'],
  [
    'USSD detail',
    (c) => c.ussd.get('service-id'),
    'GET',
    '/ussd/applications/service-id',
  ],
  [
    'USSD save menu',
    (c) => c.ussd.saveMenu('service-id', 3, menu),
    'PUT',
    '/ussd/applications/service-id/menu',
    { version: 3, menu },
  ],
  [
    'USSD publish',
    (c) => c.ussd.publish('service-id', 4),
    'POST',
    '/ussd/applications/service-id/publish',
    { version: 4 },
  ],
  [
    'USSD saved preview',
    (c) => c.ussd.preview('service-id'),
    'POST',
    '/ussd/applications/service-id/preview',
    { text: '' },
  ],
  [
    'USSD unsaved preview',
    (c) => c.ussd.preview('service-id', '1*2', menu),
    'POST',
    '/ussd/applications/service-id/preview',
    { text: '1*2', menu },
  ],
  [
    'USSD sessions',
    (c) =>
      c.ussd.sessions('service-id', { page: 2, limit: 20, status: 'EXPIRED' }),
    'GET',
    '/ussd/applications/service-id/sessions',
    null,
    { page: '2', limit: '20', status: 'EXPIRED' },
  ],
  ['airtime networks', (c) => c.airtime.networks(), 'GET', '/airtime/networks'],
  ['airtime balance', (c) => c.airtime.balance(), 'GET', '/airtime/balance'],
  [
    'airtime history',
    (c) => c.airtime.transactions(),
    'GET',
    '/airtime/transactions',
  ],
  [
    'airtime bulk purchase',
    (c) =>
      c.airtime.purchase({
        network: 'safaricom',
        recipients: [{ recipient: '254712345678', amount: 100 }],
      }),
    'POST',
    '/airtime/purchase',
    {
      network: 'safaricom',
      recipients: [{ recipient: '254712345678', amount: 100 }],
    },
  ],
  [
    'airtime single purchase',
    (c) =>
      c.airtime.purchase({
        network: 'safaricom',
        phone_number: '254712345678',
        amount: 50,
      }),
    'POST',
    '/airtime/purchase',
    { network: 'safaricom', phone_number: '254712345678', amount: 50 },
  ],
  [
    'WhatsApp configuration',
    (c) => c.whatsapp.configuration(),
    'GET',
    '/whatsapp/configuration',
  ],
  [
    'WhatsApp templates',
    (c) => c.whatsapp.templates(),
    'GET',
    '/whatsapp/templates',
  ],
  [
    'WhatsApp audience',
    (c) => c.whatsapp.audience([' 254712345678 ']),
    'POST',
    '/whatsapp/audience',
    { recipients: ['254712345678'] },
  ],
  [
    'WhatsApp send',
    (c) => c.whatsapp.send(message),
    'POST',
    '/whatsapp/send',
    message,
  ],
  [
    'WhatsApp logs',
    (c) => c.whatsapp.logs(25),
    'GET',
    '/whatsapp/logs',
    null,
    { limit: '25' },
  ],
  [
    'WhatsApp batch',
    (c) => c.whatsapp.batch('batch/id'),
    'GET',
    '/whatsapp/batches/batch%2Fid',
  ],
];
for (const [name, invoke, method, path, body, query] of routes) {
  test(`${name} matches the backend contract and sends only the bearer token`, async () => {
    const calls = capture();
    await invoke(client());
    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.equal(call.method, method);
    assert.equal(call.url.pathname, '/api' + path);
    assert.equal(call.headers.Authorization, 'Bearer test-token');
    assert.equal(call.headers['x-api-key'], undefined);
    assert.deepEqual(
      call.body ? JSON.parse(call.body) : undefined,
      body ?? undefined,
    );
    assert.deepEqual(Object.fromEntries(call.url.searchParams), query || {});
  });
}

test('missing credentials fail before a request and tokens can be replaced', async () => {
  const calls = capture();
  const sdk = new Galatext('key');
  await assert.rejects(sdk.ussd.list(), { code: 'MISSING_ACCESS_TOKEN' });
  const workspace = new Galatext(null, { accessToken: 'token' });
  await assert.rejects(workspace.account.balance(), {
    code: 'MISSING_API_KEY',
  });
  assert.equal(calls.length, 0);
  sdk.setAccessToken('replacement');
  await sdk.ussd.list();
  assert.equal(calls[0].headers.Authorization, 'Bearer replacement');
});

test('invalid credentials, timeout, and recipient inputs are rejected locally', () => {
  capture();
  assert.throws(() => new Galatext(), GalatextError);
  assert.throws(() => new Galatext('key', { timeout: -1 }), {
    code: 'INVALID_TIMEOUT',
  });
  assert.throws(() => client().setAccessToken(''), {
    code: 'MISSING_ACCESS_TOKEN',
  });
  assert.throws(() => client().sms.bulk([], 'Hello'), {
    code: 'MISSING_RECIPIENTS',
  });
  assert.throws(() => client().sms.bulk([{}], 'Hello'), {
    code: 'INVALID_RECIPIENT',
  });
});

test('downloads the sender ID Word form as a Blob using a bearer token', async () => {
  let request;
  globalThis.fetch = async (_url, options) => {
    request = options;
    return new Response('docx-bytes', {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    });
  };
  const form = await client().senderIds.downloadForm();
  assert.ok(form instanceof Blob);
  assert.equal(await form.text(), 'docx-bytes');
  assert.equal(request.headers.Authorization, 'Bearer test-token');
});

test('multipart registration retains the filename and leaves the boundary to fetch', async () => {
  const calls = capture();
  await client().senderIds.request(
    {
      name: 'BRAND',
      paymentReference: 'paid-ref',
      notes: undefined,
      registrationDocument: new Blob(['pdf'], { type: 'application/pdf' }),
    },
    { filename: 'completed.pdf' },
  );
  const call = calls[0];
  assert.equal(call.headers['Content-Type'], undefined);
  assert.equal(call.headers['x-api-key'], 'test-key');
  assert.equal(call.body.get('paymentReference'), 'paid-ref');
  assert.equal(call.body.get('registrationDocument').name, 'completed.pdf');
  assert.equal(call.body.has('notes'), false);
});

test('returns business-level and partial failures unchanged on HTTP 200', async () => {
  const response = {
    success: false,
    totalSent: 1,
    totalFailed: 1,
    error: 'One send failed',
  };
  capture(response);
  assert.deepEqual(
    await client().sms.bulk(['254712345678'], 'Hello'),
    response,
  );
});

test('normalizes validation errors, nested API errors, and non-JSON HTTP failures', async () => {
  capture({ message: ['Invalid menu', 'Version required'] }, 400);
  await assert.rejects(client().ussd.publish('service-id', 0), {
    name: 'GalatextError',
    status: 400,
    code: 'API_ERROR',
    message: 'Invalid menu; Version required',
  });
  capture({ error: { message: 'Conflict', code: 'CONFLICT' } }, 409);
  await assert.rejects(client().campaigns.send(1), {
    status: 409,
    code: 'CONFLICT',
    message: 'Conflict',
  });
  globalThis.fetch = async () => new Response('Bad gateway', { status: 502 });
  await assert.rejects(client().airtime.balance(), {
    status: 502,
    code: 'API_ERROR',
  });
});

test('normalizes transport failures and aborts requests at the configured timeout', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Connection failed');
  };
  await assert.rejects(client().account.balance(), {
    status: 0,
    code: 'NETWORK_ERROR',
  });
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    });
  await assert.rejects(new Galatext('key', { timeout: 10 }).account.balance(), {
    status: 408,
    code: 'TIMEOUT',
  });
});
