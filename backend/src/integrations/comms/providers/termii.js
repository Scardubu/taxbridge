const axios = require('axios');
const crypto = require('crypto');

const API_BASE = process.env.TERMII_API_URL || 'https://api.termii.com';
const API_KEY = process.env.TERMII_API_KEY || '';
const SIGNING_SECRET = process.env.TERMII_SIGNATURE_SECRET || '';

async function sendSMSTermii(to, message, from) {
  const url = `${API_BASE}/api/sms/send`;
  const payload = {
    to,
    from: from || process.env.TERMII_SENDER || 'TaxBridge',
    sms: message,
    api_key: API_KEY,
  };

  const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
  const data = res.data;
  const messageId = data && (data.message_id || data['message-id'] || data.messageId);
  return { provider: 'termii', messageId, raw: data };
}

function verifyTermiiSignature(body, headers) {
  try {
    const sig = headers['x-termii-signature'] || headers.signature;
    if (!sig) {
      // fallback: check api_key in body
      if (API_KEY && body && body.api_key && body.api_key === API_KEY) return true;
      return false;
    }

    if (!SIGNING_SECRET) return false;
    const payload = typeof body === 'string' ? body : JSON.stringify(body || {});
    const hmac = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
    return hmac === String(sig);
  } catch (err) {
    return false;
  }
}

function parseTermiiDelivery(body) {
  if (!body) return { raw: body };
  const messageId = body.message_id || body.messageId || body.msg_id || body.id;
  const to = body.to || body.destination || body.msisdn;
  let status = body.status || body.del_status || body.delivery_status || 'unknown';
  return { messageId: messageId ? String(messageId) : undefined, to: to ? String(to) : undefined, status: String(status || 'unknown'), raw: body };
}

module.exports = { sendSMSTermii, verifyTermiiSignature, parseTermiiDelivery };
