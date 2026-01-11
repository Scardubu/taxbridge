const axios = require('axios');
const crypto = require('crypto');

const API_BASE = process.env.INFOBIP_API_URL || 'https://api.infobip.com';
const API_KEY = process.env.INFOBIP_API_KEY || '';
const SIGNING_SECRET = process.env.INFOBIP_SIGNATURE_SECRET || '';

async function sendSMSInfobip(to, message, from) {
  const url = `${API_BASE}/sms/1/text/single`;
  const payload = {
    from: from || process.env.INFOBIP_SENDER || 'TaxBridge',
    to,
    text: message,
  };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) headers.Authorization = `App ${API_KEY}`;

  const res = await axios.post(url, payload, { headers });
  const data = res.data;
  const messageId = data && data.messages && data.messages[0] && data.messages[0].messageId;
  return { provider: 'infobip', messageId, raw: data };
}

// Verify signature using HMAC-SHA256 over JSON body if header 'x-infobip-signature' present
function verifyInfobipSignature(body, headers) {
  try {
    const sigHeader = headers['x-infobip-signature'] || headers['x-hub-signature'] || headers['x-infobip-signature256'];
    if (!sigHeader) {
      // Fallback: check Authorization header token match
      const auth = headers.authorization || '';
      if (auth && API_KEY && auth.includes(API_KEY)) return true;
      return false;
    }

    if (!SIGNING_SECRET) return false;
    const payload = typeof body === 'string' ? body : JSON.stringify(body || {});
    const hmac = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
    return hmac === String(sigHeader);
  } catch (err) {
    return false;
  }
}

function parseInfobipDelivery(body) {
  // Infobip sends delivery callbacks in various shapes. Try common ones.
  if (!body) return { raw: body };
  // Example: { messageId, to, status }
  const messageId = body.messageId || body.message_id || (body.messages && body.messages[0] && body.messages[0].messageId);
  const to = body.to || body.destination || body.msisdn || (body.messages && body.messages[0] && body.messages[0].to);
  let status = body.status || body.deliveryStatus || (body.messages && body.messages[0] && body.messages[0].status) || 'unknown';
  if (typeof status === 'object' && status.name) status = status.name;
  return { messageId: messageId ? String(messageId) : undefined, to: to ? String(to) : undefined, status: String(status || 'unknown'), raw: body };
}

module.exports = { sendSMSInfobip, verifyInfobipSignature, parseInfobipDelivery };
