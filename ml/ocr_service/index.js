const express = require('express');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ocr-service'
  });
});

// OCR processing endpoint
app.post('/extract', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Preprocess image with Jimp
    const jimpImage = await Jimp.read(buffer);
    await jimpImage
      .greyscale()
      .contrast(0.3)
      .normalize();

    const preprocessedBuffer = await jimpImage.getBufferAsync(Jimp.MIME_PNG);

    // Perform OCR with multiple PSM settings
    const psmSettings = [6, 3, 11]; // Block, Auto, Sparse text
    let bestResult = { text: '', confidence: 0 };

    for (const psm of psmSettings) {
      const result = await Tesseract.recognize(preprocessedBuffer, 'eng', {
        tessedit_pageseg_mode: psm.toString()
      });

      if (result.data.confidence > bestResult.confidence) {
        bestResult = {
          text: result.data.text,
          confidence: result.data.confidence
        };
      }
    }

    // Extract structured data (amount, date, items)
    const extractedData = parseReceiptText(bestResult.text);

    res.json({
      success: true,
      text: bestResult.text,
      confidence: bestResult.confidence,
      data: extractedData
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'OCR processing failed',
      message: error.message 
    });
  }
});

function parseReceiptText(text) {
  // Extract amount (₦ or NGN)
  const amountRegex = /[₦NGN]\s*([0-9,]+(?:\.[0-9]{2})?)/i;
  const amountMatch = text.match(amountRegex);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

  // Extract date
  const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;
  const dateMatch = text.match(dateRegex);
  const date = dateMatch ? dateMatch[1] : null;

  // Extract line items (simplified)
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const items = lines
    .filter(line => /\d+\.\d{2}/.test(line))
    .map(line => {
      const parts = line.split(/\s{2,}/);
      return {
        description: parts[0] || '',
        amount: parseFloat((line.match(/\d+\.\d{2}/) || [])[0] || '0')
      };
    });

  return { amount, date, items };
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OCR Service listening on port ${PORT}`);
});
