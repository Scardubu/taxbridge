import performOCR from '../lib/performOCR';
import fs from 'fs';
import path from 'path';

async function main() {
  const imgArg = process.argv[2] || path.resolve(__dirname, '../../docs/receipt.jpeg');
  const imgPath = path.isAbsolute(imgArg) ? imgArg : path.resolve(process.cwd(), imgArg);
  if (!fs.existsSync(imgPath)) {
    console.error('Image not found:', imgPath);
    process.exit(2);
  }

  const b = fs.readFileSync(imgPath);
  const base64 = b.toString('base64');
  try {
    const res = await performOCR(base64, 'image/jpeg');
    console.log('OCR assert result:', res);
    if ((res.confidence || 0) < 0.6) {
      console.error('Confidence too low:', res.confidence);
      process.exit(3);
    }
    if (!res.amount || res.amount < 1 || res.amount > 10_000_000) {
      console.error('Amount out of range:', res.amount);
      process.exit(4);
    }
    console.log('OCR assertions passed');
    process.exit(0);
  } catch (err) {
    console.error('OCR assert failed:', err);
    process.exit(5);
  }
}

void main();
