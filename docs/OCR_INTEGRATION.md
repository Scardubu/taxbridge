# OCR Integration Guide

## Overview

This guide covers the implementation of Optical Character Recognition (OCR) for receipt scanning in the TaxBridge mobile application. The system is designed to auto-fill invoice data from receipt images.

## Current Production Implementation

TaxBridge uses **Tesseract.js** with advanced preprocessing for production OCR. The implementation includes:

### Key Features
- **Multi-pass recognition**: Multiple PSM (Page Segmentation Mode) settings for better accuracy
- **Image preprocessing**: Jimp-based deskew, adaptive thresholding, and contrast enhancement
- **Nigerian currency support**: Optimized regex patterns for ₦ (Naira) detection
- **Confidence scoring**: Word-level confidence averaging for reliability assessment
- **Retry logic**: Mobile client includes automatic retries with exponential backoff

### Backend Processing (`backend/src/lib/performOCR.ts`)

```typescript
// Multi-pass OCR with different PSM settings
const paramSets = [
  { tessedit_pageseg_mode: '6' },  // Uniform text block
  { tessedit_pageseg_mode: '3' },  // Fully automatic
  { tessedit_pageseg_mode: '11' }, // Sparse text
];

// Nigerian currency patterns
const amountRegex = /[₦$£€¥]?\s*[0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?/;
```

### Mobile Client (`mobile/src/services/ocr.ts`)

```typescript
// OCR with retry support
export async function extractReceiptData(
  image: string,
  apiBaseUrl: string,
  options: { timeoutMs?: number; maxRetries?: number; } = {}
): Promise<OCRResult>
```

## Architecture

### Client Side (Mobile App)
- **Camera Integration**: `expo-camera` for capturing receipts
- **Gallery Support**: `expo-image-picker` for selecting existing images
- **OCR Client**: Sends base64-encoded images to backend with retry logic

### Server Side (Backend)
- **OCR Engine**: Tesseract.js with Jimp preprocessing
- **API Endpoint**: `/api/v1/ocr/extract`
- **Performance Logging**: Request tracing with processing time metrics

## Implementation Options

### Option 1: TensorFlow Lite (Recommended for Production)

**Pros:**
- Fast, on-device inference
- High accuracy
- No external API calls needed after model deployment
- Cost-effective at scale

**Cons:**
- Requires model training/fine-tuning for receipts
- Higher initial setup complexity

**Installation:**
```bash
cd backend
npm install @tensorflow/tfjs @tensorflow/tfjs-node @tensorflow-models/text-detection
```

**Implementation:**
```typescript
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-node';

async function extractReceiptWithTensorFlow(imageBuffer: Buffer) {
  const image = tf.node.decodeImage(imageBuffer);
  // Load pre-trained text detection model
  // Process image to detect text regions
  // Extract bounding boxes and text
  // Parse structural information for amounts, dates, etc.
  return parsedData;
}
```

### Option 2: Tesseract.js (Free, Open-Source Fallback)

**Pros:**
- No external dependencies or API keys
- Works server-side or client-side
- Free and open-source
- Good for text-heavy receipts

**Cons:**
- Slower than TensorFlow Lite
- Lower accuracy for handwritten text
- Larger bundle size

**Installation:**
```bash
cd backend
npm install tesseract.js
```

**Implementation:**
```typescript
import Tesseract from 'tesseract.js';

async function extractReceiptWithTesseract(imageBuffer: Buffer) {
  const { data: { text } } = await Tesseract.recognize(
    imageBuffer,
    'eng'
  );
  
  // Parse extracted text
  return parseReceiptText(text);
}

function parseReceiptText(text: string) {
  const amount = extractAmount(text);
  const date = extractDate(text);
  const items = extractItems(text);
  
  return {
    amount,
    date,
    items,
    confidence: calculateConfidence(text),
  };
}
```

### Option 3: Google Cloud Vision API

**Pros:**
- Highest accuracy
- Handles various formats and languages
- Minimal setup required

**Cons:**
- Pay-per-request pricing
- Requires external API calls
- Internet dependency

**Installation & Setup:**
```bash
cd backend
npm install @google-cloud/vision
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
```

**Implementation:**
```typescript
import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient();

async function extractReceiptWithGoogleVision(imageBuffer: Buffer) {
  const request = {
    image: { content: imageBuffer },
  };

  const [result] = await client.textDetection(request);
  const detections = result.textAnnotations || [];

  // Parse detected text for receipt data
  return parseVisionResponse(detections);
}
```

### Option 4: AWS Textract

**Pros:**
- Excellent for structured documents
- Handles tables and forms well
- AWS integration

**Cons:**
- AWS account and credentials required
- Per-page pricing
- Requires AWS SDK

**Setup:**
```bash
cd backend
npm install aws-sdk
```

## Receipt Parsing Logic

### Text Extraction
Once you have raw text from the receipt, implement parsing to extract:

```typescript
function parseReceiptText(text: string) {
  // Extract total amount (usually at the bottom)
  const amountMatch = text.match(/total[:\s]+([0-9]+\.?[0-9]*)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;

  // Extract date
  const dateMatch = text.match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{2}[\/\-]\d{2})/
  );
  const date = dateMatch ? parseDateString(dateMatch[0]) : undefined;

  // Extract line items (amount + description)
  const items = extractLineItems(text);

  return { amount, date, items };
}

function extractLineItems(text: string) {
  // Parse each line for item description and price
  const lines = text.split('\n');
  const items = [];

  for (const line of lines) {
    const match = line.match(/(.+?)\s+([0-9]+\.?[0-9]*)\s*$/);
    if (match) {
      items.push({
        description: match[1].trim(),
        quantity: 1,
        unitPrice: parseFloat(match[2]),
      });
    }
  }

  return items;
}
```

## API Endpoint Implementation

### Request Format
```json
{
  "image": "data:image/jpeg;base64,...",
  "mimeType": "image/jpeg"
}
```

### Response Format
```json
{
  "amount": 15000.00,
  "date": "2024-01-05T00:00:00Z",
  "items": [
    {
      "description": "Rice bag",
      "quantity": 1,
      "unitPrice": 10000
    },
    {
      "description": "Oil bottle",
      "quantity": 1,
      "unitPrice": 5000
    }
  ],
  "confidence": 0.85
}
```

## Error Handling

```typescript
router.post('/extract', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    // Validate input
    if (!image?.length || !mimeType) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'image and mimeType are required'
      });
    }

    // Check file size
    if (image.length > 5 * 1024 * 1024) {
      return res.status(413).json({
        error: 'File too large',
        details: 'Maximum image size is 5MB'
      });
    }

    // Validate MIME type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(mimeType)) {
      return res.status(400).json({
        error: 'Invalid image format',
        details: `Supported formats: ${validMimes.join(', ')}`
      });
    }

    const result = await performOCR(image, mimeType);
    res.json(result);

  } catch (error) {
    logger.error('OCR error:', error);
    res.status(500).json({
      error: 'OCR processing failed',
      message: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Internal server error'
    });
  }
});
```

## Testing

### Unit Tests
```typescript
describe('OCR Receipt Parsing', () => {
  it('should extract amount from receipt text', () => {
    const text = 'Item 1\nTotal: 15000.50';
    const result = parseReceiptText(text);
    expect(result.amount).toBe(15000.50);
  });

  it('should extract items from receipt text', () => {
    const text = 'Rice bag 10000\nOil bottle 5000';
    const result = parseReceiptText(text);
    expect(result.items).toHaveLength(2);
  });

  it('should handle dates in multiple formats', () => {
    expect(parseDate('01/05/2024')).toBeDefined();
    expect(parseDate('2024-01-05')).toBeDefined();
  });
});
```

### Integration Tests
```typescript
describe('OCR API Endpoint', () => {
  it('POST /api/v1/ocr/extract should process receipt image', async () => {
    const response = await request(app)
      .post('/api/v1/ocr/extract')
      .send({
        image: testImageBase64,
        mimeType: 'image/jpeg'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('amount');
    expect(response.body).toHaveProperty('confidence');
  });
});
```

## Performance Considerations

1. **Image Size Limits**: Keep max size at 5MB to prevent memory issues
2. **Processing Timeout**: Set 30-second timeout for OCR operations
3. **Caching**: Consider caching frequently processed receipt types
4. **Async Processing**: For large scale, use job queues (Bull, RabbitMQ)

## Production Deployment

### Environment Variables
```env
# For Google Cloud Vision
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# For AWS Textract
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1

# OCR Configuration
OCR_ENGINE=tensorflow|tesseract|google-vision|aws-textract
OCR_TIMEOUT=30000
OCR_MAX_FILE_SIZE=5242880
```

### Recommended Stack for Production
1. **TensorFlow Lite** for accuracy and speed
2. **Tesseract.js** as fallback for unreliable receipts
3. **Google Cloud Vision** for complex/multilingual receipts
4. **Caching layer** (Redis) for frequently processed patterns

## Troubleshooting

### Low Confidence Scores
- Check image quality (brightness, angle, focus)
- Ensure receipt is fully visible in frame
- Try different OCR engine

### Parsing Errors
- Receipt format might be unsupported
- Text might be in different language
- Items might not have clear price separation

### Performance Issues
- Reduce image quality/size before sending
- Implement request caching
- Use async job queue for batch processing

## Cost Analysis

| Engine | Cost | Speed | Accuracy |
|--------|------|-------|----------|
| TensorFlow Lite | One-time | Fast | 85-90% |
| Tesseract.js | Free | Medium | 75-85% |
| Google Vision | $1.50-3.50/1000 | Fast | 95%+ |
| AWS Textract | $0.015/page | Medium | 95%+ |

Choose based on your scale, budget, and accuracy requirements.
