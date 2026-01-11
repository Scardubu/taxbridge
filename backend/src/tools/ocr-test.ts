import fs from 'fs';
import path from 'path';
import { performOCR } from '../lib/performOCR';

async function main() {
  const imgPath = process.argv[2];
  if (!imgPath) {
    console.error('Usage: yarn ocr:test <image-file-path>');
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), imgPath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved);

  console.log('Running performOCR on', resolved);
  try {
    const base64 = buffer.toString('base64');
    const result = await performOCR(base64, 'image/jpeg');
    console.log('OCR result:\n', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('OCR test failed:', err);
    process.exit(2);
  }
}

void main();
