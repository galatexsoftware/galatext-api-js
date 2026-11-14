# Galatext JavaScript SDK

Send SMS, manage campaigns, build USSD menus, distribute airtime, and send WhatsApp messages through Galatext.

Version 1.3.0 adds bearer-token support and the campaign, USSD, airtime, and WhatsApp methods below. Existing API-key SMS and account methods remain available.

## Installation

```bash
npm install galatext-api
```

Use Node.js 18 or later, or a browser with `fetch`, `AbortController`, `FormData`, and `Blob`. Keep API keys on your server. Browser code cannot protect an embedded API key.

To test this checkout before publishing:

```bash
npm ci
npm test
npm pack
# Install the generated galatext-api-1.3.0.tgz in your application.
```

### ES modules

```js
import Galatext, { GalatextError } from 'galatext-api';

const client = new Galatext(process.env.GALATEXT_API_KEY);
const result = await client.sms.send('254712345678', 'Your order is ready.', 'YOURBRAND');
if (!result.success) console.error(result.error, result.totalFailed);
```

### CommonJS

```js
const { Galatext } = require('galatext-api');
const client = new Galatext(process.env.GALATEXT_API_KEY);
```

### Browser bundle

After version 1.3.0 is published, the UMD bundle is available from the package CDN:

```html
<script src="https://unpkg.com/galatext-api@1.3.0/dist/galatext.umd.min.js"></script>
<script>
  // Use a token obtained through your application's authenticated session.
  const client = new Galatext.Galatext(null, { accessToken: sessionAccessToken });
</script>
```

## Authentication and configuration

API-key and bearer-token endpoints use different credentials. Provide either credential, or both if your application needs both sets of services:

```js
const client = new Galatext(process.env.GALATEXT_API_KEY, {
  accessToken: process.env.GALATEXT_ACCESS_TOKEN,
  baseURL: 'https://api.galatext.com/api',
  timeout: 30000,
});

// A bearer-only client does not need an API key.
const workspace = new Galatext(null, { accessToken: process.env.GALATEXT_ACCESS_TOKEN });
```

| Methods | Required credential |
| --- | --- |
| `sms`, `account`, `senderIds.list`, `senderIds.request` | API key, sent as `x-api-key` |
| `campaigns`, `ussd`, `airtime`, `whatsapp`, `senderIds.downloadForm` | Access token, sent as `Authorization: Bearer ...` |

For local development, set `baseURL: 'http://localhost:3030/api'`. `timeout` must be a positive number of milliseconds. Direct SMS batches can need a longer timeout.

Obtain a JWT from `POST /api/auth/login` with `{ email, password }`; use `response.tokens.accessToken`. Developer login (`/api/developer/login`) returns an API key instead. The SDK does not log in or refresh tokens automatically. After refreshing through `/api/auth/refresh`, update the client:

```js
client.setAccessToken(newAccessToken);
```

## SMS

```js
const result = await client.sms.send('254712345678', 'Your order is ready.', 'YOURBRAND');
const batch = await client.sms.bulk(
  ['254712345678', '254798765432'],
  'Our office reopens on Tuesday.',
  'YOURBRAND',
);
const sent = await client.sms.list(0, 20);
```

`send` and `bulk` call `/sms/send-api` with `recipients: string[]`. Legacy `{ phoneNumber }` recipient inputs are converted to strings. Direct requests support up to 1,000 recipients and send the same text to each number.

The default `senderId` is `GALATEX`, limited to ten sent messages per account. Use your approved sender ID for ongoing sends. SMS credit usage depends on message length and encoding.

Both methods accept a fourth argument `{ scheduledAt }` containing a future ISO timestamp. For editable drafts, cancellation, and campaign reports, use `campaigns`.

Responses contain `success`, `messageIds`, `totalSent`, `totalFailed`, and `remainingCredits`; partial failures can include `error`. `sms.list(skip, take)` returns `{ data, total }` for sent records. Sending acceptance does not confirm handset delivery.

## Campaigns

Requires `accessToken`.

```js
const draft = await client.campaigns.create({
  name: 'Office notice',
  message: 'Our office will be closed on Monday.',
  senderId: 'YOURBRAND',
  manualNumbers: ['254712345678'],
  saveAsDraft: true,
  requestId: crypto.randomUUID(),
});
await client.campaigns.update(draft.id, { message: 'Our office reopens on Tuesday.' });
await client.campaigns.send(draft.id);
const report = await client.campaigns.get(draft.id);
const page = await client.campaigns.list({ page: 1, limit: 10, search: 'notice', status: 'DRAFT' });
const totals = await client.campaigns.stats();
```

Use `contactGroupIds` to include your contact groups. Galatext normalizes and deduplicates the combined Kenyan audience. `name`, `message`, and `senderId` are required, with at least one valid recipient. A future `scheduledAt` schedules sending; omitting both scheduling and `saveAsDraft` queues an immediate send.

Reuse the same UUID `requestId` with the identical creation payload for retries. A changed payload returns `409`. Only draft and future scheduled campaigns can be edited. `cancel(id)` cancels an eligible draft or scheduled campaign; `delete(id)` removes an eligible campaign. Cancel scheduled campaigns before deleting them. Sending campaigns cannot be cancelled or deleted.

List responses contain `{ data, total, page, limit, totalPages }`. Campaign sending counters do not confirm handset delivery. See the [campaign guide](https://developers.galatext.com/sms-api/campaigns) for state and audience replacement rules.

## USSD

Requires `accessToken`. Galatext allocates and activates codes; customers manage menus and view their own sessions.

```js
const service = await client.ussd.create({
  name: 'Customer support',
  description: 'Customers can view our opening hours and contact details.',
  codeType: 'SHARED',
});
const menu = {
  screens: [
    { id: 'main', type: 'MENU', text: 'Welcome to Acme.', options: [
      { key: '1', label: 'Opening hours', next: 'hours' },
    ] },
    { id: 'hours', type: 'END', text: 'Monday to Friday, 8am to 5pm.', options: [] },
  ],
};
const saved = await client.ussd.saveMenu(service.id, service.menuVersion, menu);
await client.ussd.publish(service.id, saved.menuVersion);
const preview = await client.ussd.preview(service.id, '1');
const sessions = await client.ussd.sessions(service.id, { page: 1, limit: 20 });
const services = await client.ussd.list({ status: 'ACTIVE' });
const current = await client.ussd.get(service.id);
const totals = await client.ussd.stats();
```

Use `SHARED` or `DEDICATED` for `codeType`. New services start in `REQUESTED`. Menus support 1–30 reachable screens rooted at `main`, numeric options `1`–`9`, and end messages. Each rendered screen must fit 160 characters, including options and navigation. `0` returns to the main menu and `00` exits.

Saving increments `menuVersion`; publishing requires the current saved version. Reload after `409` before editing again. Pass an optional third `menu` argument to `preview(id, text, menu)` to test unsaved changes. Preview uses cumulative input such as `1*2`, creates no live sessions, and consumes no credits.

The menu engine does not collect free-text responses or call external business APIs. Galatext manages service activation and charges. See the [USSD guide](https://developers.galatext.com/ussd-api/overview).

## Airtime

Requires `accessToken`.

```js
const networks = await client.airtime.networks();
const { balance } = await client.airtime.balance();
const result = await client.airtime.purchase({
  network: 'safaricom',
  recipients: [{ recipient: '254712345678', amount: 100 }],
});
const transactions = await client.airtime.transactions();
```

Amounts are in KES. Use network IDs returned by `networks()`. For a single recipient, `purchase` also accepts `{ network, phone_number, amount }`. Sending airtime consumes the airtime balance. `account.buyCredits('airtime', null, amount)` funds that balance through checkout; it does not itself top up a phone.

## WhatsApp

Requires `accessToken`. Galatext manages sender setup and template approval.

```js
const configuration = await client.whatsapp.configuration();
const templates = await client.whatsapp.templates();
const audience = await client.whatsapp.audience(['254712345678']);
const result = await client.whatsapp.send({
  requestId: crypto.randomUUID(),
  recipients: ['254712345678'],
  contentSid: approvedTemplate.sid,
  contentVariables: { '1': 'Jane', '2': 'ORD-12345' },
});
const batch = await client.whatsapp.batch(result.batchId);
const logs = await client.whatsapp.logs(50);
```

Use a template from `templates()` when `audience.needsTemplate` contains the recipient. Within an open reply window, send `{ requestId, recipients, body }` instead. Each send supports up to 500 recipients. Reuse the same `requestId` and content for retries. Templates use opaque Galatext `tpl_` references.

## Credits and payments

These methods require an API key.

```js
const balances = await client.account.balance();
const payment = await client.account.buyCredits('sms', 1000, null, 'https://example.com/payment/complete');
// Direct the user to payment.authorizationUrl and wait for checkout to finish.
const verification = await client.account.verifyPayment(payment.reference);
const purchases = await client.account.purchases();
```

`buyCredits(product, quantity?, amount?, callbackUrl?)` accepts `sms`, `whatsapp`, `airtime`, `ussd`, and `senderid` as purchase products. A `ussd` purchase does not request or activate a code; use the USSD workflow and arrange service charges with Galatext. Do not treat the checkout redirect alone as confirmation that a payment succeeded.

## Sender IDs

```js
const senderIds = await client.senderIds.list();
const form = await client.senderIds.downloadForm(); // Blob; requires a bearer token
```

Complete the Word form on company letterhead. Purchase the `senderid` product, complete payment, verify it, and submit the same account's payment reference with the completed document:

```js
await client.senderIds.request({
  name: 'YOURBRAND',
  companyName: 'Acme Ltd',
  contactPerson: 'Jane Doe',
  phoneNumber: '254712345678',
  email: 'jane@example.com',
  paymentReference: completedPaymentReference,
  registrationDocument: completedForm,
});
```

The current registration fee is KES 10,000. Names must contain 3–11 alphanumeric characters. Requests remain subject to approval. File uploads accept PDF, DOC, DOCX, PNG, JPG, and JPEG up to 5 MB. In Node.js, pass a Blob's filename explicitly when needed:

```js
await client.senderIds.request(body, { filename: 'completed-form.pdf' });
```

The SDK builds `FormData` and lets the runtime set the multipart boundary.

## Errors and retries

```js
try {
  const result = await client.sms.send('254712345678', 'Your order is ready.', 'YOURBRAND');
  if (!result.success) console.error(result.error);
} catch (error) {
  if (error instanceof GalatextError) {
    console.error(error.status, error.code, error.message);
  } else {
    throw error;
  }
}
```

HTTP failures become `GalatextError`, with validation message arrays joined into a string. Errors without an API code use `API_ERROR`. Other SDK codes include `TIMEOUT`, `NETWORK_ERROR`, `MISSING_API_KEY`, `MISSING_ACCESS_TOKEN`, `INVALID_TIMEOUT`, `INVALID_RECIPIENT`, and `MISSING_RECIPIENTS`.

Successful HTTP bodies are returned unchanged, including business-level failures. The SDK does not retry requests automatically. Review history before repeating direct SMS or airtime after a timeout. Campaign creation and WhatsApp sends support retry-safe UUID request IDs when the payload is unchanged.

## Documentation and support

- [Developer portal](https://developers.galatext.com)
- [Customer API reference](https://developers.galatext.com/api-reference/)
- [Source repository](https://github.com/galatexsoftware/galatext-api-js)
- [info@galatext.com](mailto:info@galatext.com)

## License

MIT
