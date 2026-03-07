import dotenv from 'dotenv';
import { createLogger } from '../lib/logger';

dotenv.config();

const log = createLogger('ping-digitax');

async function run() {
  const url = process.env.DIGITAX_API_URL || 'https://sandbox.digitax.com/api';
  log.info('Pinging', { url });
  try {
    const res = await fetch(url, { method: 'GET' });
    log.info('Response status', { status: res.status });
    const text = await res.text().catch(() => '');
    log.info('Response body', { body: text.slice(0, 500) });
  } catch (err: any) {
    log.error('Ping failed', { err: err?.message || err });
    process.exit(1);
  }
}

run().catch((e) => {
  log.error('Error', { err: e });
  process.exit(1);
});
