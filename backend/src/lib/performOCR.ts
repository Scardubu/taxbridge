import { Buffer } from 'buffer';

type OCRResult = {
  amount?: number;
  date?: string;
  items?: Array<{ description: string; quantity: number; unitPrice: number }>;
  confidence: number;
};

export async function performOCR(base64Image: string, mimeType: string): Promise<OCRResult> {
  // Decode buffer
  const buffer = Buffer.from(base64Image, 'base64');

  // Optional preprocessing: prefer OpenCV if available for deskew + adaptive thresholding.
  // Otherwise, use Jimp with a PCA-based deskew and integral-image adaptive threshold as fallback.
  let imageBuffer = buffer;
  const __ocrPreStart = Date.now();
  try {
    // Try OpenCV bindings first (may not be installed in all environments)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cvCandidates = ['opencv4nodejs', '@u4/opencv4nodejs'];
    let cv: any = null;
    for (const mod of cvCandidates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        cv = require(mod);
        break;
      } catch (_e) {
        /* ignore */
      }
    }

    if (cv) {
      try {
        const mat = cv.imdecode(buffer);
        let gray = mat;
        if (mat.channels && mat.channels > 1) gray = mat.bgrToGray();

        // Estimate skew using Hough lines on edges
        const edges = gray.canny(50, 150);
        const lines = edges.houghLinesP(1, Math.PI / 180, 100, 50, 10) || [];
        let angle = 0;
        if (lines.length) {
          let sum = 0;
          let count = 0;
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            const dx = l.x2 - l.x1;
            const dy = l.y2 - l.y1;
            if (Math.abs(dx) < 1e-3) continue;
            const a = Math.atan2(dy, dx);
            // ignore near-vertical lines
            if (Math.abs(Math.abs(a) - Math.PI / 2) < Math.PI / 4) continue;
            sum += a;
            count++;
          }
          if (count) angle = (sum / count) * (180 / Math.PI);
        }

        if (Math.abs(angle) > 0.25) {
          const center = new cv.Point2(mat.cols / 2, mat.rows / 2);
          const M = cv.getRotationMatrix2D(center, -angle, 1);
          const rotated = mat.warpAffine(M, new cv.Size(mat.cols, mat.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255));
          gray = rotated.channels && rotated.channels > 1 ? rotated.bgrToGray() : rotated;
        }

        // Adaptive threshold fallback to Otsu when adaptiveThresh not available
        let bin = null;
        try {
          bin = gray.adaptiveThreshold(255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 15, 10);
        } catch (_) {
          bin = gray.threshold(0, 255, cv.THRESH_OTSU | cv.THRESH_BINARY);
        }

        imageBuffer = Buffer.from(cv.imencode('.png', bin));
      } catch (cvErr) {
        // if anything fails in cv path, fallback to Jimp below
        cv = null;
      }
    }

    if (!cv) {
      // Jimp fallback preprocessing with multi-variant generation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Jimp = require('jimp');
      const orig = await Jimp.read(buffer);

      const scales = [1200, 1600, 2000];
      const variants: Buffer[] = [];

      for (const targetW of scales) {
        const img = orig.clone();
        img.resize(Math.min(targetW, img.getWidth()), Jimp.AUTO).grayscale().contrast(0.35).normalize();

        // mild unsharp mask: blur then enhance
        try {
          if (typeof (img as any).blur === 'function') {
            const clone = img.clone();
            clone.blur(1);
            // unsharp: original + (original - blurred)*k where k=1
            const k = 1;
            const { data, width, height } = img.bitmap as any;
            const { data: bdata } = clone.bitmap as any;
            for (let i = 0; i < data.length; i += 4) {
              let val = data[i] + k * (data[i] - bdata[i]);
              val = Math.max(0, Math.min(255, Math.round(val)));
              data[i] = data[i + 1] = data[i + 2] = val;
            }
          }
        } catch (_) {}

        // sharpen kernel
        try {
          const kernel = [
            [0, -1, 0],
            [-1, 7, -1],
            [0, -1, 0],
          ];
          if (typeof (img as any).convolute === 'function') (img as any).convolute(kernel);
        } catch (_) {}

        // PCA deskew
        try {
          const { data, width, height } = img.bitmap as any;
          const gxKernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
          const gyKernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
          const edgePoints: Array<[number, number]> = [];
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              let gx = 0; let gy = 0; let k = 0;
              for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4;
                const val = data[idx]; gx += gxKernel[k] * val; gy += gyKernel[k] * val; k++;
              }
              const mag = Math.hypot(gx, gy);
              if (mag > 80) edgePoints.push([x, y]);
            }
          }
          if (edgePoints.length > 50) {
            let sumX = 0; let sumY = 0; for (const [x, y] of edgePoints) { sumX += x; sumY += y; }
            const meanX = sumX / edgePoints.length; const meanY = sumY / edgePoints.length;
            let sxx = 0; let syy = 0; let sxy = 0;
            for (const [x, y] of edgePoints) { const dx = x - meanX; const dy = y - meanY; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
            const angleRad = 0.5 * Math.atan2(2 * sxy, sxx - syy); const angleDeg = angleRad * (180 / Math.PI);
            if (Math.abs(angleDeg) > 0.25) img.rotate(-angleDeg);
          }
        } catch (_) {}

        // integral-image adaptive threshold with multiple window sizes and C values
        try {
          const { data, width, height } = img.bitmap as any;
          const computeIntegral = (dataBuf: Uint8ClampedArray, w: number, h: number) => {
            const integralArr = new Uint32Array((w + 1) * (h + 1));
            for (let yy = 1; yy <= h; yy++) {
              let rowSum = 0;
              for (let xx = 1; xx <= w; xx++) {
                const idx = ((yy - 1) * w + (xx - 1)) * 4;
                rowSum += dataBuf[idx];
                integralArr[yy * (w + 1) + xx] = integralArr[(yy - 1) * (w + 1) + xx] + rowSum;
              }
            }
            return integralArr;
          };

          const windowBase = Math.max(15, Math.floor(Math.min(width, height) / 16) * 2 + 1);
          const windowSizes = [windowBase, windowBase + 8];
          const Cs = [8, 10, 12];

          for (const win of windowSizes) {
            for (const Cval of Cs) {
              try {
                const clone = img.clone();
                const { data: cdata, width: cw, height: ch } = clone.bitmap as any;
                const integral = computeIntegral(cdata, cw, ch);
                clone.scan(0, 0, cw, ch, function (this: any, x: number, y: number, idx: number) {
                  const x1 = Math.max(0, x - Math.floor(win / 2));
                  const y1 = Math.max(0, y - Math.floor(win / 2));
                  const x2 = Math.min(cw - 1, x + Math.floor(win / 2));
                  const y2 = Math.min(ch - 1, y + Math.floor(win / 2));
                  const A = integral[y1 * (cw + 1) + x1];
                  const B = integral[y1 * (cw + 1) + (x2 + 1)];
                  const Cc = integral[(y2 + 1) * (cw + 1) + x1];
                  const D = integral[(y2 + 1) * (cw + 1) + (x2 + 1)];
                  const sum = D - B - Cc + A;
                  const area = (x2 - x1 + 1) * (y2 - y1 + 1);
                  const mean = sum / area;
                  const v = this.bitmap.data[idx];
                  const out = v * area < mean * (area - Cval) ? 0 : 255;
                  this.bitmap.data[idx] = out;
                  this.bitmap.data[idx + 1] = out;
                  this.bitmap.data[idx + 2] = out;
                  this.bitmap.data[idx + 3] = 255;
                });

                // push normal and inverted
                variants.push(await clone.getBufferAsync(Jimp.MIME_PNG));
                const inv = clone.clone();
                inv.invert();
                variants.push(await inv.getBufferAsync(Jimp.MIME_PNG));

                // small rotation sweep to handle residual skew
                const angles = [-3, -2, -1, 0, 1, 2, 3];
                for (const a of angles) {
                  if (a === 0) continue;
                  const r = clone.clone();
                  r.rotate(a);
                  variants.push(await r.getBufferAsync(Jimp.MIME_PNG));
                  const ir = r.clone();
                  ir.invert();
                  variants.push(await ir.getBufferAsync(Jimp.MIME_PNG));
                }
              } catch (_) {
                /* ignore per-variant failures */
              }
            }
          }
        } catch (_) {}
      }

      // pick the first variant as default imageBuffer
      if (variants.length) imageBuffer = Buffer.from(variants[0] as any);

      // Expose variants for multi-pass recognition
      (performOCR as any)._preprocessedVariants = variants;
    }
  } catch (err) {
    // preprocessing failed; continue with original buffer
    if (process.env.DEBUG_OCR === '1' || process.env.DEBUG_OCR === 'true') {
      console.warn('[performOCR] preprocessing failed', (err as any)?.message ?? err);
    }
  } finally {
    const __ocrPreprocessMs = Date.now() - (__ocrPreStart || Date.now());
    const variantsCount = (performOCR as any)._preprocessedVariants ? (performOCR as any)._preprocessedVariants.length : 0;
    if (process.env.DEBUG_OCR === '1' || process.env.DEBUG_OCR === 'true') {
      let methodUsed = 'none';
      try {
        if (variantsCount) methodUsed = 'jimp';
        else if (imageBuffer && imageBuffer !== buffer) methodUsed = 'opencv';
      } catch (_) {}
      console.log('[performOCR] preprocess', { method: methodUsed, variants: variantsCount, preprocessMs: __ocrPreprocessMs });
    }
  }

  // Use tesseract.js if available; fall back to a simple recognise() call
  let extractedText = '';
  let averageConfidence = 0.0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tesseract = require('tesseract.js');

    // Prefer worker reuse when available
    if (!(performOCR as any)._workerPromise) {
      (performOCR as any)._workerPromise = (async () => {
        const { createWorker } = tesseract;
        const worker = createWorker({ logger: (m: any) => {} });
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        try {
          await worker.setParameters({ tessedit_pageseg_mode: '6', user_defined_dpi: '300' });
        } catch (_) {}
        return worker;
      })();
    }

    if (!(performOCR as any)._recognizeQueue) (performOCR as any)._recognizeQueue = Promise.resolve();

    // Multi-pass recognition: try several PSM settings and a numeric-whitelist pass to improve totals detection
    const doRecognizeMulti = async () => {
      const worker = await (performOCR as any)._workerPromise;
      if (!worker || typeof worker.recognize !== 'function') {
        // fallback to single call
        return tesseract.recognize(imageBuffer, 'eng').then((r: any) => ({ params: {}, res: r }));
      }

      // Candidate buffers: preprocessed variants (if any) + primary imageBuffer
      const variants: Buffer[] = Array.isArray((performOCR as any)._preprocessedVariants) && (performOCR as any)._preprocessedVariants.length
        ? [(performOCR as any)._preprocessedVariants[0], ...(performOCR as any)._preprocessedVariants.slice(1)]
        : [imageBuffer];

      const paramSets = [
        { tessedit_pageseg_mode: '6' }, // Assume a single uniform block of text
        { tessedit_pageseg_mode: '3' }, // Fully automatic page segmentation
        { tessedit_pageseg_mode: '11' }, // Sparse text
      ];

      const whitelist = { tessedit_char_whitelist: '0123456789.,₦$£€' };

      const tries: Array<{ params: any; data: any; avgConf: number }> = [];

      for (const buf of variants) {
        for (const params of paramSets) {
          try { await worker.setParameters(params); } catch (_) {}
          const r = await worker.recognize(buf);
          const d = r?.data ?? r;
          const txt = (d?.text || '').trim();
          const words = d?.words || [];
          let avg = 0.5;
          if (Array.isArray(words) && words.length) {
            const confidences = words.map((w: any) => Number(w.confidence) || 0);
            avg = confidences.reduce((s: number, v: number) => s + v, 0) / confidences.length / 100;
          } else if (typeof d?.confidence === 'number') {
            avg = (d.confidence || 0) / 100;
          }
          tries.push({ params, data: { text: txt, words: d?.words }, avgConf: avg });
        }

        // Whitelist pass on this buffer
        try { await worker.setParameters({ ...whitelist, tessedit_pageseg_mode: '7' }); } catch (_) {}
        try {
          const r = await worker.recognize(buf);
          const d = r?.data ?? r;
          const txt = (d?.text || '').trim();
          const words = d?.words || [];
          let avg = 0.5;
          if (Array.isArray(words) && words.length) {
            const confidences = words.map((w: any) => Number(w.confidence) || 0);
            avg = confidences.reduce((s: number, v: number) => s + v, 0) / confidences.length / 100;
          } else if (typeof d?.confidence === 'number') {
            avg = (d.confidence || 0) / 100;
          }
          tries.push({ params: { ...whitelist, tessedit_pageseg_mode: '7' }, data: { text: txt, words: d?.words }, avgConf: avg });
        } catch (_) {}
      }

      // Choose best try with small boost if it contains an amount
      const amountRegex = /[₦$£€¥]?\s*[0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?/;
      let best = tries[0];
      for (const t of tries) {
        let score = t.avgConf;
        if (amountRegex.test(t.data.text)) score += 0.05;
        if (score > best.avgConf + (amountRegex.test(best.data.text) ? 0.05 : 0)) best = t;
      }

      return { params: best.params, res: { data: best.data } };
    };

    const multiRes = await ((performOCR as any)._recognizeQueue = (performOCR as any)._recognizeQueue.then(doRecognizeMulti, doRecognizeMulti));
    const data = multiRes?.res?.data ?? multiRes?.data ?? multiRes;
    extractedText = (data?.text || '').trim();
    const words = data?.words || [];
    if (Array.isArray(words) && words.length) {
      const confidences = words.map((w: any) => Number(w.confidence) || 0);
      averageConfidence = confidences.reduce((s: number, v: number) => s + v, 0) / confidences.length / 100;
    } else if (typeof data?.confidence === 'number') {
      averageConfidence = (data.confidence || 0) / 100;
    } else {
      averageConfidence = 0.5;
    }
  } catch (tessErr) {
    // Last-resort: try tesseract.recognize global API
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { recognize } = require('tesseract.js');
      const res = await recognize(imageBuffer, 'eng');
      extractedText = (res?.data?.text || '').trim();
      const words = res?.data?.words || [];
      if (Array.isArray(words) && words.length) {
        const confidences = words.map((w: any) => Number(w.confidence) || 0);
        averageConfidence = confidences.reduce((s: number, v: number) => s + v, 0) / confidences.length / 100;
      } else {
        averageConfidence = 0.4;
      }
    } catch (finalErr) {
      // Give up and return low-confidence result
      extractedText = buffer.toString('utf8').slice(0, 2000);
      averageConfidence = 0.2;
    }
  }

  // Heuristic parsing: amounts, dates, and items
  const lower = extractedText.replace(/\u00A0/g, ' ').replace(/\t/g, ' ');

  // Better amount heuristics: look for lines containing total keywords and largest numeric token near end
  const lines = lower.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let amount: number | undefined;

  // search lines for keywords first
  const totalKeywords = ['total', 'amount', 'amt', 'grand total', 'balance', 'net total'];
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i];
    if (totalKeywords.some((k) => ln.includes(k))) {
      const m = ln.match(/([₦$£€¥]?\s*[0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)/);
      if (m && m[1]) {
        const raw = m[1].replace(/[₦$£€¥\s,]/g, '');
        const n = Number(raw);
        if (!Number.isNaN(n)) { amount = n; break; }
      }
    }
  }

  // fallback: largest numeric value in the document (often total)
  if (amount === undefined) {
    const nums = lower.match(/([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)/g) || [];
    let best = -Infinity;
    for (const nraw of nums) {
      const n = Number(nraw.replace(/[\s,]/g, ''));
      if (!Number.isNaN(n) && n > best) best = n;
    }
    if (best !== -Infinity) amount = best;
  }

  // Date extraction: prefer ISO-like or dd/mm/yyyy patterns
  const dateRegex = /(\b\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\b)|(\b\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}\b)/;
  let date: string | undefined;
  const dateMatch = lower.match(dateRegex);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[0]);
      if (!isNaN(d.getTime())) date = d.toISOString();
    } catch {}
  }

  // Items: lines that look like description and a trailing price
  const items: Array<{ description: string; quantity: number; unitPrice: number }> = [];

  const isPlausibleAmount = (n?: number) => {
    if (n === undefined || n === null || Number.isNaN(n)) return false;
    // discard timestamps or extremely large numbers (> 1 billion)
    if (n > 1e9) return false;
    // reasonable invoice amounts: at least ₦0.5, and less than 10 million by default
    return n >= 0.5 && n <= 10_000_000;
  };

  const metadataKeywords = ['payment date', 'billing ref', 'receipt', 'invoice', 'paid', 'to:'];

  for (const ln of lines) {
    // skip lines that look like metadata
    const low = ln.toLowerCase();
    if (metadataKeywords.some((k) => low.includes(k))) continue;

    const m = ln.match(/^(.*?)(?:\s+|\s*[-@x]\s*)([0-9]+)\s*[x@]\s*([0-9.,]+)/i) || ln.match(/^(.*?)[\s\t]+([0-9.,]+)$/i);
    if (m) {
      try {
        if (m.length >= 4) {
          const desc = (m[1] || '').trim();
          const qty = Math.max(1, Math.min(10000, Number((m[2] || '1').replace(/[\s,]/g, '')) || 1));
          let price = Number((m[3] || '0').replace(/[\s,]/g, '')) || 0;
          // ignore implausible prices
          if (!isPlausibleAmount(price)) continue;
          items.push({ description: desc, quantity: qty, unitPrice: price });
        } else {
          const desc = (m[1] || '').trim();
          const price = Number((m[2] || '0').replace(/[\s,]/g, '')) || 0;
          if (!isPlausibleAmount(price)) continue;
          items.push({ description: desc, quantity: 1, unitPrice: price });
        }
      } catch {}
    }
  }

  // Post-process amounts: prefer a detected amount near a 'total' keyword and plausible; otherwise prefer the sum of items if it matches
  if (!isPlausibleAmount(amount)) {
    // try to pick the largest plausible numeric token near the end of the document
    const nums = lower.match(/([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?)/g) || [];
    let best = -Infinity;
    for (const nraw of nums) {
      const n = Number(nraw.replace(/[\s,]/g, ''));
      if (isPlausibleAmount(n) && n > best) best = n;
    }
    if (best !== -Infinity) amount = best;
  }

  const itemsTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  if (itemsTotal > 0 && (!amount || Math.abs(itemsTotal - amount) / Math.max(1, amount || 1) < 0.1)) {
    // if items total is within 10% of amount (or amount missing), prefer itemsTotal
    amount = Math.round(itemsTotal * 100) / 100;
  }

  // As a final sanity check, if amount is implausibly large, discard it
  if (!isPlausibleAmount(amount)) amount = undefined;

  return { amount, date, items, confidence: Math.max(0, Math.min(1, averageConfidence || 0)) };
}

export default performOCR;
