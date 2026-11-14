import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('published entry points support ESM and CommonJS', async () => {
  const esm = await import('galatext-api');
  const cjs = createRequire(import.meta.url)('galatext-api');
  for (const entry of [esm, cjs]) {
    assert.equal(typeof entry.Galatext, 'function');
    assert.equal(typeof entry.GalatextError, 'function');
    const client = new entry.Galatext(null, { accessToken: 'token' });
    assert.equal(typeof client.ussd.saveMenu, 'function');
    assert.equal(typeof client.campaigns.create, 'function');
  }
  assert.equal(esm.default, esm.Galatext);
});

for (const bundle of ['galatext.umd.js', 'galatext.umd.min.js']) {
  test(`${bundle} exposes the documented browser namespace`, () => {
    const context = {};
    runInNewContext(
      readFileSync(new URL('../dist/' + bundle, import.meta.url), 'utf8'),
      context,
    );
    const client = new context.Galatext.Galatext(null, {
      accessToken: 'token',
    });
    assert.equal(typeof client.airtime.networks, 'function');
    assert.equal(typeof client.whatsapp.send, 'function');
  });
}
