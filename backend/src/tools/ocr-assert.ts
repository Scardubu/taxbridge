import performOCR from '../lib/performOCR';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../lib/logger';

const log = createLogger('ocr-assert');

async function main() {
  const imgArg = process.argv[2] || path.resolve(__dirname, '../../docs/receipt.jpeg');
  const imgPath = path.isAbsolute(imgArg) ? imgArg : path.resolve(process.cwd(), imgArg);
  if (!fs.existsSync(imgPath)) {
    log.error('Image not found', { imgPath });
    process.exit(2);
  }

  const b = fs.readFileSync(imgPath);
  const base64 = b.toString('base64');
  try {
    const res = await performOCR(base64, 'image/jpeg');
    log.info('OCR assert result', { result: res });
    if ((res.confidence || 0) < 0.6) {
      log.error('Confidence too low', { confidence: res.confidence });
      process.exit(3);
    }
    if (!res.amount || res.amount < 1 || res.amount > 10_000_000) {
      log.error('Amount out of range', { amount: res.amount });
      process.exit(4);
    }
    log.info('OCR assertions passed');
    process.exit(0);
  } catch (err) {
    log.error('OCR assert failed', { err });
    process.exit(5);
  }
}

void main();
