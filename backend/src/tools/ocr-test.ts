import fs from 'fs';
import path from 'path';
import { performOCR } from '../lib/performOCR';
import { createLogger } from '../lib/logger';

const log = createLogger('ocr-test');

async function main() {
  const imgPath = process.argv[2];
  if (!imgPath) {
    log.error('Usage: yarn ocr:test <image-file-path>');
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), imgPath);
  if (!fs.existsSync(resolved)) {
    log.error('File not found', { resolved });
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved);

  log.info('Running performOCR', { path: resolved });
  try {
    const base64 = buffer.toString('base64');
    const result = await performOCR(base64, 'image/jpeg');
    log.info('OCR result', { result: JSON.stringify(result, null, 2) });
    process.exit(0);
  } catch (err) {
    log.error('OCR test failed', { err });
    process.exit(2);
  }
}

void main();
