const BASE_URL = 'https://api.galatext.com/api';

class GalatextError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GalatextError';
    this.status = status;
    this.code = code;
  }
}

class Galatext {
  constructor(apiKey, options = {}) {
    if (!apiKey) throw new GalatextError('API key is required', 0, 'MISSING_API_KEY');
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || BASE_URL;
    this.timeout = options.timeout || 30000;
  }

  // ── Internal request helper ───────────────────────────────────────────────

  async _request(method, path, body = null, query = {}) {
    const url = new URL(`${this.baseURL}${path}`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new GalatextError(
          data.message || data.error || `Request failed with status ${res.status}`,
          res.status,
          data.code || 'API_ERROR',
        );
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new GalatextError('Request timed out', 408, 'TIMEOUT');
      }
      if (err instanceof GalatextError) throw err;
      throw new GalatextError(err.message, 0, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }

  // ── SMS ───────────────────────────────────────────────────────────────────

  sms = {
    send: (phoneNumber, message, senderId = 'GALATEX', reference = null) =>
      this._request('POST', '/sms/send-api', {
        recipients: [{ phoneNumber }],
        message,
        senderId,
        ...(reference ? { reference } : {}),
      }),

    bulk: (recipients, message, senderId = 'GALATEX', reference = null) =>
      this._request('POST', '/sms/send-api', {
        recipients,
        message,
        senderId,
        ...(reference ? { reference } : {}),
      }),

    list: (skip = 0, take = 20) =>
      this._request('GET', '/developer/messages', null, { skip, take }),
  };

  // ── Account ───────────────────────────────────────────────────────────────

  account = {
    balance: () =>
      this._request('GET', '/developer/balance'),

    purchases: () =>
      this._request('GET', '/developer/purchases'),

    verifyPayment: (reference) =>
      this._request('GET', `/developer/credits/verify/${reference}`),

    buyCredits: (product, quantity = null, amount = null, callbackUrl = null) =>
      this._request('POST', '/developer/credits/purchase', {
        product,
        ...(quantity !== null ? { quantity } : {}),
        ...(amount !== null ? { amount } : {}),
        ...(callbackUrl ? { callbackUrl } : {}),
      }),
  };

  // ── Sender IDs ────────────────────────────────────────────────────────────

  senderIds = {
    list: () =>
      this._request('GET', '/developer/senderids'),
  };
}

export { Galatext, GalatextError };
export default Galatext;