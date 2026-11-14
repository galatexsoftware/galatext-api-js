const BASE_URL = 'https://api.galatext.com/api';

class GalatextError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'GalatextError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Normalise a recipient into a bare MSISDN string.
 *
 * The API's `BulkSmsDto.recipients` is `@IsString({ each: true })` and the
 * gateway runs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`,
 * so `{ phoneNumber }` objects are rejected with a 400 — and `phoneNumber` is
 * itself a non-whitelisted key. The object form is accepted here for backwards
 * compatibility, but a string is always what goes on the wire.
 */
function toRecipient(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.phoneNumber === 'string')
    return value.phoneNumber.trim();
  throw new GalatextError(
    'Each recipient must be a phone number string or { phoneNumber }',
    0,
    'INVALID_RECIPIENT',
  );
}

function toRecipientList(recipients) {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  if (list.length === 0) {
    throw new GalatextError(
      'At least one recipient is required',
      0,
      'MISSING_RECIPIENTS',
    );
  }
  return list.map(toRecipient);
}

class Galatext {
  constructor(apiKey, options = {}) {
    if (!apiKey && !options.accessToken) {
      throw new GalatextError(
        'An API key or access token is required',
        0,
        'MISSING_API_KEY',
      );
    }
    this.apiKey = apiKey;
    this.accessToken = options.accessToken;
    this.baseURL = (options.baseURL || BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout ?? 30000;
    if (!Number.isFinite(this.timeout) || this.timeout <= 0) {
      throw new GalatextError(
        'Timeout must be a positive number',
        0,
        'INVALID_TIMEOUT',
      );
    }
  }

  setAccessToken(accessToken) {
    if (!accessToken)
      throw new GalatextError(
        'Access token is required',
        0,
        'MISSING_ACCESS_TOKEN',
      );
    this.accessToken = accessToken;
    return this;
  }

  // ── Internal request helper ───────────────────────────────────────────────

  async _request(
    method,
    path,
    body = null,
    query = {},
    isFormData = false,
    auth = 'apiKey',
    responseType = 'json',
  ) {
    const credential = auth === 'accessToken' ? this.accessToken : this.apiKey;
    if (!credential) {
      throw new GalatextError(
        auth === 'accessToken'
          ? 'This endpoint requires options.accessToken (a bearer JWT)'
          : 'This endpoint requires an API key',
        0,
        auth === 'accessToken' ? 'MISSING_ACCESS_TOKEN' : 'MISSING_API_KEY',
      );
    }
    const url = new URL(`${this.baseURL}${path}`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method,
        // Never set Content-Type on a FormData body — the runtime has to add
        // the multipart boundary itself.
        headers: {
          ...(auth === 'accessToken'
            ? { Authorization: `Bearer ${credential}` }
            : { 'x-api-key': credential }),
          ...(!isFormData && body !== null
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.ok && responseType === 'blob') return await res.blob();
      const data = (await res.json().catch(() => ({}))) || {};

      if (!res.ok) {
        // Nest's ValidationPipe answers with `message` as an array of strings;
        // join it so callers get a sentence rather than "[object Object]".
        const message = Array.isArray(data.message)
          ? data.message.join('; ')
          : data.message ||
            data.error?.message ||
            (typeof data.error === 'string' ? data.error : null) ||
            `Request failed with status ${res.status}`;
        throw new GalatextError(
          message,
          res.status,
          data.code || data.error?.code || 'API_ERROR',
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

  _authenticated(method, path, body = null, query = {}) {
    return this._request(method, path, body, query, false, 'accessToken');
  }

  // ── SMS ───────────────────────────────────────────────────────────────────

  sms = {
    /**
     * Send one SMS.
     * @param {string} phoneNumber
     * @param {string} message
     * @param {string} [senderId]
     * @param {{ scheduledAt?: string }} [options] ISO date to schedule delivery
     */
    send: (phoneNumber, message, senderId = 'GALATEX', options = {}) =>
      this._request('POST', '/sms/send-api', {
        recipients: [toRecipient(phoneNumber)],
        message,
        senderId,
        ...(options.scheduledAt ? { scheduledAt: options.scheduledAt } : {}),
      }),

    /**
     * Send the same message to many recipients.
     * @param {(string|{phoneNumber: string})[]} recipients
     * @param {string} message
     * @param {string} [senderId]
     * @param {{ scheduledAt?: string }} [options]
     */
    bulk: (recipients, message, senderId = 'GALATEX', options = {}) =>
      this._request('POST', '/sms/send-api', {
        recipients: toRecipientList(recipients),
        message,
        senderId,
        ...(options.scheduledAt ? { scheduledAt: options.scheduledAt } : {}),
      }),

    list: (skip = 0, take = 20) =>
      this._request('GET', '/developer/messages', null, { skip, take }),
  };

  // ── Account ───────────────────────────────────────────────────────────────

  account = {
    balance: () => this._request('GET', '/developer/balance'),

    purchases: () => this._request('GET', '/developer/purchases'),

    verifyPayment: (reference) =>
      this._request(
        'GET',
        `/developer/credits/verify/${encodeURIComponent(reference)}`,
      ),

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
    list: () => this._request('GET', '/developer/senderids'),

    /** Download the registration form as a Blob. Requires a bearer token. */
    downloadForm: () =>
      this._request(
        'GET',
        '/senderids/download-form',
        null,
        {},
        false,
        'accessToken',
        'blob',
      ),

    /**
     * Request a new Sender ID.
     *
     * Requires a **paid** `senderid` credit purchase by this same account —
     * buy one first with `account.buyCredits('senderid', 1)` and pass the
     * Paystack reference here as `paymentReference`. Without it the API answers
     * 400, because the KES 10,000 registration fee is not collected by this
     * call.
     *
     * @param {object} body
     * @param {string} body.name                3–11 alphanumeric characters
     * @param {string} body.companyName
     * @param {string} body.contactPerson
     * @param {string} body.phoneNumber
     * @param {string} body.email
     * @param {string} body.paymentReference    Paystack ref for the senderid purchase
     * @param {string} [body.notes]
     * @param {File|Blob} [body.registrationDocument]
     * @param {{ filename?: string }} [options] Filename for a Node.js Blob upload
     */
    request: (body, options = {}) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) {
        if (value === undefined || value === null) continue;
        if (key === 'registrationDocument' && value instanceof Blob) {
          form.append(
            key,
            value,
            options.filename || value.name || 'registration.docx',
          );
        } else {
          form.append(key, value);
        }
      }
      return this._request(
        'POST',
        '/developer/senderids/request',
        form,
        {},
        true,
      );
    },
  };

  // Dashboard APIs require a bearer JWT, independent of the developer API key.
  campaigns = {
    create: (body) => this._authenticated('POST', '/sms/campaigns', body),
    list: (query = {}) =>
      this._authenticated('GET', '/sms/campaigns', null, query),
    stats: () => this._authenticated('GET', '/sms/campaigns/stats'),
    get: (id) =>
      this._authenticated('GET', `/sms/campaigns/${encodeURIComponent(id)}`),
    update: (id, body) =>
      this._authenticated(
        'PATCH',
        `/sms/campaigns/${encodeURIComponent(id)}`,
        body,
      ),
    delete: (id) =>
      this._authenticated('DELETE', `/sms/campaigns/${encodeURIComponent(id)}`),
    send: (id) =>
      this._authenticated(
        'POST',
        `/sms/campaigns/${encodeURIComponent(id)}/send`,
      ),
    cancel: (id) =>
      this._authenticated(
        'POST',
        `/sms/campaigns/${encodeURIComponent(id)}/cancel`,
      ),
  };

  ussd = {
    create: (body) => this._authenticated('POST', '/ussd/applications', body),
    list: (query = {}) =>
      this._authenticated('GET', '/ussd/applications', null, query),
    stats: () => this._authenticated('GET', '/ussd/stats'),
    get: (id) =>
      this._authenticated(
        'GET',
        `/ussd/applications/${encodeURIComponent(id)}`,
      ),
    saveMenu: (id, version, menu) =>
      this._authenticated(
        'PUT',
        `/ussd/applications/${encodeURIComponent(id)}/menu`,
        { version, menu },
      ),
    publish: (id, version) =>
      this._authenticated(
        'POST',
        `/ussd/applications/${encodeURIComponent(id)}/publish`,
        { version },
      ),
    preview: (id, text = '', menu) =>
      this._authenticated(
        'POST',
        `/ussd/applications/${encodeURIComponent(id)}/preview`,
        {
          text,
          ...(menu !== undefined ? { menu } : {}),
        },
      ),
    sessions: (id, query = {}) =>
      this._authenticated(
        'GET',
        `/ussd/applications/${encodeURIComponent(id)}/sessions`,
        null,
        query,
      ),
  };

  airtime = {
    networks: () => this._authenticated('GET', '/airtime/networks'),
    balance: () => this._authenticated('GET', '/airtime/balance'),
    transactions: () => this._authenticated('GET', '/airtime/transactions'),
    purchase: (body) => this._authenticated('POST', '/airtime/purchase', body),
  };

  whatsapp = {
    configuration: () => this._authenticated('GET', '/whatsapp/configuration'),
    templates: () => this._authenticated('GET', '/whatsapp/templates'),
    audience: (recipients) =>
      this._authenticated('POST', '/whatsapp/audience', {
        recipients: toRecipientList(recipients),
      }),
    send: (body) => this._authenticated('POST', '/whatsapp/send', body),
    logs: (limit = 50) =>
      this._authenticated('GET', '/whatsapp/logs', null, { limit }),
    batch: (id) =>
      this._authenticated('GET', `/whatsapp/batches/${encodeURIComponent(id)}`),
  };
}

export { Galatext, GalatextError };
export default Galatext;
