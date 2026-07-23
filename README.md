# Galatext API — JavaScript SDK

Official SDK for the [Galatext](https://galatext.com) messaging API. Send SMS, check balances, manage sender IDs, and purchase credits.

## Installation

### npm

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

## Usage

```js
import Galatext from 'galatext-api';

const client = new Galatext('YOUR_API_KEY');

// Send SMS
const result = await client.sms.send(
  '+254712345678',
  'Hello from Galatext!',
  'YOURBRAND'
);

// Send bulk SMS
const result = await client.sms.bulk(
  [{ phoneNumber: '+254712345678' }, { phoneNumber: '+254798765432' }],
  'Welcome to our platform!',
  'YOURBRAND'
);

// Get sent messages
const messages = await client.sms.list(0, 20);

// Check balance
const balance = await client.account.balance();
console.log(balance.smsBalance, balance.whatsappBalance);

// Purchase credits
const payment = await client.account.buyCredits('sms', 100);
// Redirect user to payment.authorizationUrl

// Purchase history
const purchases = await client.account.purchases();

// List sender IDs
const senderIds = await client.senderIds.list();
```

## API

### `new Galatext(apiKey, options?)`

| Option    | Default                          | Description          |
|-----------|----------------------------------|----------------------|
| `baseURL` | `https://api.galatext.com/api`   | API base URL         |
| `timeout` | `30000`                          | Request timeout (ms) |

### `client.sms`

| Method                          | Description          |
|---------------------------------|----------------------|
| `send(phone, message, senderId, reference?)` | Send a single SMS     |
| `bulk(recipients[], message, senderId, reference?)` | Send bulk SMS         |
| `list(skip?, take?)`            | Get sent messages     |

### `client.account`

| Method                          | Description          |
|---------------------------------|----------------------|
| `balance()`                     | Get credit balances  |
| `purchases()`                   | Purchase history     |
| `buyCredits(product, quantity?, amount?)` | Initiate credit purchase |

### `client.senderIds`

| Method                          | Description          |
|---------------------------------|----------------------|
| `list()`                        | List sender IDs      |

## License

MIT