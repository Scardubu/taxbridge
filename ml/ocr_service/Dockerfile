# TaxBridge OCR Service Dockerfile
# Optimized for receipt processing with Tesseract.js

FROM node:18-alpine

WORKDIR /app

# Install Tesseract and required dependencies
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    curl \
    wget \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Download trained data if needed
RUN mkdir -p /app/data && \
    wget https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata -O /app/data/eng.traineddata || true

# Create non-root user
RUN addgroup -g 1001 -S ocruser && \
    adduser -S ocruser -u 1001
USER ocruser

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["node", "index.js"]
