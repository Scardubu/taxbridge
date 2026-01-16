# ML Churn Prediction Implementation Guide

**Status:** Pending – Requires infrastructure setup  
**Priority:** Phase 2 (Post-launch enhancement)  
**Owner:** ML/Data Team

---

## Overview

This document outlines the implementation of ML-based churn prediction for TaxBridge users. The system analyzes user behavior patterns to predict churn risk and automatically trigger reactivation campaigns.

---

## Current Status

✅ **Completed:**
- `GrowthService.predictChurnRisk()` method with heuristic-based scoring
- Churn risk calculation based on:
  - Days since last invoice
  - Invoice count
  - Payment success rate
- Auto-trigger reactivation when risk > 0.5

⏳ **Pending:**
- TensorFlow.js installation (requires Visual Studio C++ build tools on Windows)
- Pre-trained ML model training/deployment
- Feature engineering pipeline

---

## Architecture

### Heuristic Model (Current - MVP)

Located in [`backend/src/services/growth.ts`](../backend/src/services/growth.ts#L350-L420)

**Features:**
1. **Inactivity:** Days since last invoice (weight: 0.6)
   - 14+ days → +0.3 risk
   - 30+ days → +0.3 risk (total 0.6)
2. **Low Usage:** Invoice count (weight: 0.2)
   - <3 invoices → +0.2 risk
3. **Payment Failures:** Payment success rate (weight: 0.2)
   - <70% success → +0.2 risk

**Scoring:**
- Risk = 0-1 (0 = no risk, 1 = certain churn)
- Trigger reactivation if risk > 0.5

**Pros:**
- No ML infrastructure required
- Instant predictions
- Explainable to users

**Cons:**
- Less accurate than ML model
- Fixed weights (no learning)
- Limited features

### ML Model (Future - Phase 2+)

**Model Type:** Binary classification (churn vs. retain)

**Features (10+):**
```typescript
interface ChurnFeatures {
  // Activity
  daysSinceLastInvoice: number;
  invoiceCount: number;
  invoicesLast7Days: number;
  invoicesLast30Days: number;
  
  // Engagement
  lastLoginDays: number;
  appOpenCount: number;
  featureUsageScore: number; // OCR, exports, etc.
  
  // Financial
  totalRevenue: number;
  avgInvoiceValue: number;
  paymentSuccessRate: number;
  
  // Cohort
  accountAgeDays: number;
  referralSource: string; // ambassador, organic, paid
  segment: string; // trader, freelancer, etc.
}
```

**Model Architecture:**
- **Algorithm:** Logistic Regression or Gradient Boosted Trees (XGBoost)
- **Training:** Python (scikit-learn / TensorFlow Keras)
- **Inference:** TensorFlow.js (Node.js backend)
- **Model Size:** <10MB (compressed)
- **Latency:** <100ms (P95)

---

## Implementation Steps

### Phase 2.1: Environment Setup (Windows)

**Prerequisites:**
- Visual Studio 2022 (Community Edition - free)
- "Desktop development with C++" workload
- Node.js 18.x+ (already installed)

**Installation Commands:**
```powershell
# Install Visual Studio Build Tools (if full VS not installed)
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Build Tools for Visual Studio 2022"
# Check "Desktop development with C++"

# After VS installation, install TensorFlow.js
cd backend
npm install @tensorflow/tfjs-node --legacy-peer-deps

# Verify installation
node -e "const tf = require('@tensorflow/tfjs-node'); console.log(tf.version);"
```

**Alternative (Linux/Docker):**
```bash
# Use Dockerized backend for TensorFlow.js (no build tools needed)
docker-compose up backend
```

### Phase 2.2: Model Training (Python)

**Training Script:** `ml/models/train_churn_model.py`

```python
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Load historical data
df = pd.read_csv('data/user_churn_history.csv')

# Features
X = df[[
    'days_since_last_invoice',
    'invoice_count',
    'invoices_last_7_days',
    'invoices_last_30_days',
    'last_login_days',
    'app_open_count',
    'feature_usage_score',
    'total_revenue',
    'avg_invoice_value',
    'payment_success_rate',
    'account_age_days'
]]

# Target (1 = churned, 0 = retained)
y = df['churned']

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Build model
model = tf.keras.Sequential([
    tf.keras.layers.Dense(64, activation='relu', input_shape=(11,)),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(32, activation='relu'),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy', 'AUC']
)

# Train
history = model.fit(
    X_train_scaled, y_train,
    epochs=50,
    batch_size=32,
    validation_split=0.2,
    callbacks=[
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)
    ]
)

# Evaluate
test_loss, test_acc, test_auc = model.evaluate(X_test_scaled, y_test)
print(f'Test Accuracy: {test_acc:.3f}, AUC: {test_auc:.3f}')

# Save model (TensorFlow.js format)
import tensorflowjs as tfjs
tfjs.converters.save_keras_model(model, 'ml/models/churn_model_tfjs')
print('Model saved to ml/models/churn_model_tfjs')
```

**Expected Performance:**
- Accuracy: 75-85%
- AUC: 0.80-0.90
- Precision: 70-80% (minimize false positives)
- Recall: 75-85% (catch most churners)

### Phase 2.3: Model Deployment

**Directory Structure:**
```
ml/
├── models/
│   ├── churn_model_tfjs/
│   │   ├── model.json         # Model architecture
│   │   ├── weights.bin        # Model weights (<10MB)
│   │   └── metadata.json      # Feature names, scaler params
│   └── scaler.json            # StandardScaler parameters
└── README.md
```

**Environment Variables:**
```bash
# .env (backend)
ML_MODEL_PATH=ml/models/churn_model_tfjs/model.json
```

**Backend Integration:**
```typescript
// backend/src/services/growth.ts (updated predictChurnRisk method)

import * as tf from '@tensorflow/tfjs-node';
import fs from 'fs';
import path from 'path';

let churnModel: tf.LayersModel | null = null;
let scalerParams: { mean: number[]; std: number[] } | null = null;

async function loadChurnModel() {
  if (churnModel) return churnModel;

  const modelPath = process.env.ML_MODEL_PATH;
  if (!modelPath || !fs.existsSync(modelPath)) {
    logger.warn('ML_MODEL_PATH not set or model not found, using heuristic fallback');
    return null;
  }

  try {
    churnModel = await tf.loadLayersModel(`file://${modelPath}`);
    
    // Load scaler params
    const scalerPath = path.join(path.dirname(modelPath), 'scaler.json');
    if (fs.existsSync(scalerPath)) {
      scalerParams = JSON.parse(fs.readFileSync(scalerPath, 'utf-8'));
    }
    
    logger.info('Churn prediction model loaded successfully');
    return churnModel;
  } catch (error) {
    logger.error('Failed to load churn model', { err: error });
    return null;
  }
}

async predictChurnRisk(userId: string): Promise<ChurnRiskProfile | null> {
  const model = await loadChurnModel();
  
  // If model not available, fallback to heuristic
  if (!model) {
    return this.predictChurnRiskHeuristic(userId);
  }

  // Extract features from database
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      invoices: { select: { createdAt: true, totalAmount: true } },
      payments: { select: { status: true } },
      sessions: { select: { createdAt: true } }
    }
  });

  if (!user) return null;

  // Calculate features
  const features = this.extractChurnFeatures(user);

  // Normalize features (using scaler params)
  const normalizedFeatures = this.normalizeFeatures(features, scalerParams);

  // Run inference
  const inputTensor = tf.tensor2d([normalizedFeatures]);
  const prediction = model.predict(inputTensor) as tf.Tensor;
  const riskScore = (await prediction.data())[0];

  inputTensor.dispose();
  prediction.dispose();

  // Explain prediction (feature importance)
  const triggers = this.explainChurnRisk(features, riskScore);

  return {
    userId,
    riskScore,
    lastActivity: user.sessions[0]?.createdAt || user.createdAt,
    invoiceCount: user.invoices.length,
    daysSinceLastInvoice: this.calculateDaysSince(user.invoices[0]?.createdAt),
    triggers
  };
}
```

### Phase 2.4: Monitoring & Retraining

**Model Drift Detection:**
- Track prediction accuracy over time (compare predicted vs. actual churn)
- Alert if accuracy drops > 10% (retrain needed)

**Retraining Schedule:**
- Monthly (first 6 months)
- Quarterly (after stabilization)
- Triggered by model drift

**Metrics Dashboard (Grafana):**
- Churn rate (predicted vs. actual)
- Model accuracy, precision, recall
- Feature importance (which features drive churn)
- Reactivation campaign success rate

---

## Rollout Plan

### Phase 2.1: Infrastructure (Week 1)
- [ ] Install Visual Studio C++ build tools
- [ ] Install TensorFlow.js (`@tensorflow/tfjs-node`)
- [ ] Verify model loading (`node -e "const tf = require('@tensorflow/tfjs-node');"`)

### Phase 2.2: Model Training (Week 2-3)
- [ ] Export user churn history (Prisma → CSV)
- [ ] Train model (Python script)
- [ ] Validate accuracy (>75%) and AUC (>0.80)
- [ ] Convert to TensorFlow.js format
- [ ] Upload to `ml/models/churn_model_tfjs/`

### Phase 2.3: Backend Integration (Week 4)
- [ ] Update `GrowthService.predictChurnRisk()` with ML inference
- [ ] Add fallback to heuristic if model unavailable
- [ ] Test inference latency (<100ms P95)
- [ ] Deploy to staging

### Phase 2.4: Validation (Week 5)
- [ ] Run predictions on 1,000 test users
- [ ] Compare ML vs. heuristic accuracy
- [ ] A/B test: 50% ML, 50% heuristic
- [ ] Monitor reactivation success rates

### Phase 2.5: Production (Week 6)
- [ ] Deploy to production (gradual rollout)
- [ ] Enable ML predictions for 100% of users
- [ ] Monitor model performance (Grafana)
- [ ] Schedule first retrain (Month 1)

---

## Cost & Performance

**Infrastructure:**
- TensorFlow.js (Node.js): Free (included in backend)
- Model training (Python): Run locally or Colab (free)
- Model storage: <10MB (fits in backend repo)

**Performance:**
- Inference latency: 50-100ms (P95)
- Memory: +50MB RAM (model loaded once)
- CPU: Minimal (batch predictions overnight)

**Cost Impact:**
- $0/month (no external ML APIs)
- Stays within <$50/month budget

---

## Alternatives (If TensorFlow.js Blocked)

### Option 1: Python Microservice
- Separate Flask/FastAPI service for ML inference
- Backend calls via HTTP (`POST /predict`)
- Pros: No C++ build tools needed
- Cons: Extra service to manage (+$10/month)

### Option 2: Cloud ML (Vertex AI, Azure ML)
- Upload model to cloud ML service
- Backend calls via REST API
- Pros: Managed infrastructure, auto-scaling
- Cons: Cost ($20-50/month), vendor lock-in

### Option 3: Heuristic Only (Current)
- Keep heuristic-based scoring
- Tune weights based on historical data
- Pros: Simple, fast, explainable
- Cons: Less accurate (70% vs. 80%+ with ML)

**Recommendation:** Start with heuristic (Phase 1-2), add ML in Phase 3+ when infrastructure allows.

---

## Success Metrics

**Churn Prediction Accuracy:**
- Target: 80%+ (vs. 70% heuristic)
- Measure: Monthly retro (predicted vs. actual churn)

**Reactivation Campaign ROI:**
- Target: 20%+ reactivation rate (churners returning within 30 days)
- Cost: ₦50 SMS + ₦100 staff time = ₦150 per user
- Revenue: Reactivated user LTV = ₦5,000+ (33x ROI)

**Model Performance:**
- Inference latency: <100ms (P95)
- Model size: <10MB
- Uptime: 99.9% (fallback to heuristic if model fails)

---

## References

- [GrowthService Implementation](../backend/src/services/growth.ts)
- [Pre-Launch Check Script](../infra/scripts/pre-launch-check.sh) (ML validation section)
- [TensorFlow.js Docs](https://www.tensorflow.org/js)
- [Node.js ML Guide](https://www.tensorflow.org/js/guide/nodejs)

---

**Status:** Ready for Phase 2 implementation (pending Visual Studio C++ install)  
**Next Steps:** Export user data, train model, deploy to staging  
**Owner:** ML/Data Team  
**Timeline:** 6 weeks (Week 1-6)
