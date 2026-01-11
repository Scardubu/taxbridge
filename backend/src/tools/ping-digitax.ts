import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const url = process.env.DIGITAX_API_URL || 'https://sandbox.digitax.com/api';
  console.log('Pinging', url);
  try {
    const res = await fetch(url, { method: 'GET' });
    console.log('status', res.status);
    const text = await res.text().catch(() => '');
    console.log(text.slice(0, 500));
  } catch (err: any) {
    console.error('ping failed:', err?.message || err);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('error', e);
  process.exit(1);
});
