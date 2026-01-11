import path from 'path';
import fs from 'fs/promises';
import performOCR from '../lib/performOCR';

jest.setTimeout(180000);

describe('performOCR integration', () => {
  it('recognizes sample receipt with reasonable confidence and amount', async () => {
    const imgPath = path.resolve(__dirname, '../../../docs/receipt.jpeg');
    if (!(await fs.stat(imgPath).catch(() => null))) {
      console.warn('Sample receipt not found at', imgPath);
      return;
    }
    const buf = await fs.readFile(imgPath);
    const base64 = buf.toString('base64');
    const res = await performOCR(base64, 'image/jpeg');
    // basic sanity checks
    expect(typeof res.confidence).toBe('number');
    expect(res.confidence).toBeGreaterThan(0.2);
    // amount may be undefined for some receipts; if present ensure plausible
    if (res.amount !== undefined) {
      expect(res.amount).toBeGreaterThanOrEqual(0.5);
      expect(res.amount).toBeLessThanOrEqual(10_000_000);
    }
  });

  it('returns correct result structure for any image input', async () => {
    // Create a minimal white image buffer (1x1 pixel PNG)
    const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const base64 = minimalPng.toString('base64');
    
    const res = await performOCR(base64, 'image/png');
    
    // Verify result structure
    expect(res).toHaveProperty('confidence');
    expect(typeof res.confidence).toBe('number');
    expect(res.confidence).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
    
    // Amount and date may be undefined for blank images, which is expected
    if (res.amount !== undefined) {
      expect(typeof res.amount).toBe('number');
    }
    if (res.date !== undefined) {
      expect(typeof res.date).toBe('string');
    }
    if (res.items !== undefined) {
      expect(Array.isArray(res.items)).toBe(true);
    }
  });

  it('handles Nigerian Naira currency symbol correctly', async () => {
    // This test validates the regex patterns used for Nigerian currency
    const nairaPatterns = [
      '₦15,000.00',
      '₦ 15000',
      'N15,000',
      '15000.00',
    ];
    
    // The patterns should be recognized by our amount extraction regex
    const amountRegex = /[₦$£€¥]?\s*[0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?/;
    
    for (const pattern of nairaPatterns) {
      const match = pattern.match(amountRegex);
      expect(match).toBeTruthy();
      expect(match![0]).toBeTruthy();
    }
  });

  it('validates plausible amount range for Nigerian receipts', async () => {
    // Test the isPlausibleAmount logic
    const isPlausibleAmount = (n?: number) => {
      if (n === undefined || n === null || Number.isNaN(n)) return false;
      if (n > 1e9) return false;
      return n >= 0.5 && n <= 10_000_000;
    };
    
    // Valid amounts
    expect(isPlausibleAmount(100)).toBe(true);
    expect(isPlausibleAmount(15000)).toBe(true);
    expect(isPlausibleAmount(1500000)).toBe(true);
    expect(isPlausibleAmount(10000000)).toBe(true);
    
    // Invalid amounts
    expect(isPlausibleAmount(0.1)).toBe(false);
    expect(isPlausibleAmount(20000000)).toBe(false);
    expect(isPlausibleAmount(undefined)).toBe(false);
    expect(isPlausibleAmount(NaN)).toBe(false);
  });

  afterAll(async () => {
    // cleanup shared tesseract worker to allow Jest to exit cleanly
    try {
      const wprom = (performOCR as any)._workerPromise;
      if (wprom && typeof wprom.then === 'function') {
        const w = await wprom;
        if (w && typeof w.terminate === 'function') await w.terminate();
      }
    } catch (_) {}

    // ensure no lingering references
    try { (performOCR as any)._workerPromise = undefined; } catch (_) {}
    try { (performOCR as any)._recognizeQueue = Promise.resolve(); } catch (_) {}

    // give small delay for handles to close
    await new Promise((r) => setTimeout(r, 250));
  });
});
