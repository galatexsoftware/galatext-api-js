# Galatext API — JavaScript SDK

Official SDK for the [Galatext](https://galatext.com) messaging API. Send SMS, check balances, manage sender IDs, and purchase credits.

## Installation

```bash
npm install galatext-api
```

### CDN (script tag)

```html
<script src="https://unpkg.com/galatext-api"></script>
<script>
  const client = new Galatext('YOUR_API_KEY');
</script>
```

## Quick Start

```js
import Galatext from 'galatext-api';

const client = new Galatext('YOUR_API_KEY');

// Send a single SMS
const result = await client.sms.send(
  '+254712345678',
  'Hello from Galatext!',
  'YOURBRAND'
);
```

## Configuration

```js
const client = new Galatext('YOUR_API_KEY', {
  baseURL: 'https://api.galatext.com/api',  // default
  timeout: 30000,                             // default (ms)
});
```

---

## SMS

### Send a Single SMS

```js
const result = await client.sms.send(
  phoneNumber,   // string — recipient phone number
  message,       // string — SMS text
  senderId,      // string — your approved sender ID (default: 'GALATEX')
  reference?     // string — optional unique reference for tracking
);
```

### Send Bulk SMS

```js
const result = await client.sms.bulk(
  recipients,    // array — [{ phoneNumber: '+2547...' }, ...]
  message,       // string — SMS text
  senderId,      // string — sender ID
  reference?     // string — optional unique reference
);
```

### Get Sent Messages

```js
const messages = await client.sms.list(
  skip?,  // number — offset (default: 0)
  take?   // number — page size (default: 20)
);
```

---

## Account

### Check Balance

```js
const balance = await client.account.balance();
console.log(balance.smsBalance);      // e.g. 1500
console.log(balance.whatsappBalance); // e.g. 500
```

### Purchase Credits (Paystack)

```js
const payment = await client.account.buyCredits(
  product,       // 'sms' | 'whatsapp' | 'airtime' | 'ussd'
  quantity?,     // number — credits to buy (for SMS/WhatsApp)
  amount?,       // number — custom amount in KES (for airtime)
  callbackUrl?   // string — URL to redirect back to after Paystack payment
);

// Returns: { authorizationUrl, reference, amount, currency, ... }
// Redirect user to Paystack:
window.location.href = payment.authorizationUrl;
```

### Verify Payment (after Paystack redirect)

Call this on your `callbackUrl` page when Paystack redirects back with a `?reference=` query param:

```js
// Handle the redirect from Paystack
const params = new URLSearchParams(window.location.search);
const ref = params.get('reference');

if (ref) {
  const result = await client.account.verifyPayment(ref);
  if (result.verified) {
    // Credits have been added to your account
    console.log('Payment successful!', result);
  }
}
```

### Full Payment Flow

```js
// 1. Initiate purchase
const payment = await client.account.buyCredits(
  'sms', 1000, null,
  'https://myapp.com/payment/success'
);

// 2. Redirect to Paystack
window.location.href = payment.authorizationUrl;

// 3. On your callbackUrl page (https://myapp.com/payment/success)
//    Paystack redirects here with ?reference=TRX_REF
//    Call verifyPayment to confirm and credit your account
```

### Purchase History

```js
const purchases = await client.account.purchases();
```

---

## Sender IDs

### List Sender IDs

```js
const senderIds = await client.senderIds.list();
```

---

## API Reference

### `new Galatext(apiKey, options?)`

| Option    | Type    | Default                          | Description          |
|-----------|---------|----------------------------------|----------------------|
| `apiKey`  | string  | *required*                       | Your Galatext API key |
| `baseURL` | string  | `https://api.galatext.com/api`   | API base URL         |
| `timeout` | number  | `30000`                          | Request timeout (ms) |

### `client.sms`

| Method | Returns | Description |
|--------|---------|-------------|
| `send(phone, message, senderId?, reference?)` | `object` | Send a single SMS |
| `bulk(recipients[], message, senderId?, reference?)` | `object` | Send bulk SMS |
| `list(skip?, take?)` | `array` | Get sent messages |

### `client.account`

| Method | Returns | Description |
|--------|---------|-------------|
| `balance()` | `{ smsBalance, whatsappBalance }` | Get credit balances |
| `purchases()` | `array` | Get purchase history |
| `buyCredits(product, quantity?, amount?, callbackUrl?)` | `{ authorizationUrl, reference }` | Initiate Paystack purchase |
| `verifyPayment(reference)` | `{ verified, credits, ... }` | Verify payment after redirect |

### `client.senderIds`

| Method | Returns | Description |
|--------|---------|-------------|
| `list()` | `array` | List registered sender IDs |

---

## Error Handling

```js
import Galatext, { GalatextError } from 'galatext-api';

try {
  const result = await client.sms.send('+2547...', 'Hello', 'BRAND');
} catch (err) {
  if (err instanceof GalatextError) {
    console.log(err.message);   // Human-readable error
    console.log(err.status);    // HTTP status code
    console.log(err.code);      // Error code (e.g. 'API_ERROR')
  }
}
```

---

## Links

- [GitHub Repository](https://github.com/galatexsoftware/galatext-api-js)
- [NPM Package](https://www.npmjs.com/package/galatext-api)
- [Developer Portal](https://developers.galatext.com)
- [API Reference](https://developers.galatext.com/api-reference/)

## License

MIT