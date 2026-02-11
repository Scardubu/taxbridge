---
trigger: always_on
---

# 📡 TAXBRIDGE API DOCUMENTATION
## RESTful API Reference Guide

**Base URL**: `https://api.taxbridge.ng/v1`  
**Authentication**: Bearer Token (JWT)  
**Content-Type**: `application/json`

---

## 🔐 AUTHENTICATION

### Register Business
```http
POST /auth/register
```

**Request Body**:
```json
{
  "businessName": "Acme Trading Ltd",
  "cacNumber": "RC123456",
  "tin": "12345678-0001",
  "email": "info@acmetrading.com",
  "phone": "+2348012345678",
  "password": "SecurePassword123!",
  "address": {
    "street": "123 Main Street",
    "city": "Lagos",
    "state": "Lagos",
    "zipCode": "100001"
  },
  "businessType": "limited-company"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "business": {
      "id": "bus_123abc",
      "name": "Acme Trading Ltd",
      "tin": "12345678-0001",
      "email": "info@acmetrading.com",
      "status": "PENDING"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login
```http
POST /auth/login
```

**Request Body**:
```json
{
  "email": "info@acmetrading.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "business": {
      "id": "bus_123abc",
      "name": "Acme Trading Ltd",
      "status": "VERIFIED"
    }
  }
}
```

---

## 🏢 BUSINESS MANAGEMENT

### Verify Business
```http
POST /business/verify
```

**Headers**:
```
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "tinVerification": true,
  "bvnVerification": true,
  "cacVerification": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verifications": {
      "tin": {
        "verified": true,
        "confidence": 95,
        "details": {
          "name": "Acme Trading Limited",
          "status": "active"
        },
        "reference": "YV-TIN-123456"
      },
      "bvn": {
        "verified": true,
        "confidence": 98,
        "reference": "YV-BVN-789012"
      },
      "cac": {
        "verified": true,
        "confidence": 100,
        "reference": "YV-CAC-345678"
      }
    },
    "overallStatus": "VERIFIED"
  }
}
```

### Get Business Profile
```http
GET /business/profile
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "bus_123abc",
    "name": "Acme Trading Ltd",
    "cacNumber": "RC123456",
    "tin": "12345678-0001",
    "email": "info@acmetrading.com",
    "phone": "+2348012345678",
    "address": {
      "street": "123 Main Street",
      "city": "Lagos",
      "state": "Lagos",
      "zipCode": "100001"
    },
    "businessType": "limited-company",
    "status": "VERIFIED",
    "verifiedAt": "2026-01-15T10:30:00Z",
    "createdAt": "2026-01-10T08:00:00Z"
  }
}
```

---

## 🧾 INVOICE MANAGEMENT

### Create Invoice
```http
POST /invoices
```

**Request Body**:
```json
{
  "customer": {
    "name": "ABC Corporation",
    "email": "accounts@abc.com",
    "phone": "+2348087654321",
    "tin": "87654321-0001",
    "address": "456 Business Ave, Abuja"
  },
  "items": [
    {
      "description": "Web Development Services",
      "quantity": 1,
      "unitPrice": 500000,
      "vatApplicable": true
    },
    {
      "description": "Hosting (Annual)",
      "quantity": 1,
      "unitPrice": 50000,
      "vatApplicable": true
    }
  ],
  "dueDate": "2026-03-15",
  "nrsCompliant": true
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "inv_789xyz",
      "invoiceNumber": "INV/2026/00001",
      "customer": {
        "name": "ABC Corporation",
        "email": "accounts@abc.com"
      },
      "items": [
        {
          "description": "Web Development Services",
          "quantity": 1,
          "unitPrice": 500000,
          "vatApplicable": true,
          "total": 500000,
          "vatAmount": 37500
        },
        {
          "description": "Hosting (Annual)",
          "quantity": 1,
          "unitPrice": 50000,
          "vatApplicable": true,
          "total": 50000,
          "vatAmount": 3750
        }
      ],
      "subtotal": 550000,
      "vatAmount": 41250,
      "total": 591250,
      "dueDate": "2026-03-15T00:00:00Z",
      "status": "DRAFT",
      "nrsCompliant": true,
      "firsIRN": "NRS-2026-123456789",
      "firsCSID": "CSID-ABC123",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
      "createdAt": "2026-02-06T10:00:00Z"
    }
  }
}
```

### Generate Invoice PDF
```http
POST /invoices/{invoiceId}/pdf
```

**Request Body**:
```json
{
  "template": "professional",
  "includeQR": true,
  "includeNRSBadge": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "pdfUrl": "https://storage.taxbridge.ng/invoices/inv_789xyz.pdf",
    "expiresAt": "2026-02-13T10:00:00Z",
    "fileSize": 245678
  }
}
```

### List Invoices
```http
GET /invoices?status=SENT&fromDate=2026-01-01&toDate=2026-02-06&page=1&limit=20
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "inv_789xyz",
        "invoiceNumber": "INV/2026/00001",
        "customer": { "name": "ABC Corporation" },
        "total": 591250,
        "status": "SENT",
        "dueDate": "2026-03-15T00:00:00Z",
        "createdAt": "2026-02-06T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

## 💰 PAYMENT MANAGEMENT

### Initialize Payment
```http
POST /payments/initialize
```

**Request Body**:
```json
{
  "invoiceId": "inv_789xyz",
  "gateway": "paystack",
  "email": "accounts@abc.com",
  "callbackUrl": "https://yourapp.com/payment/callback"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_456def",
    "reference": "TB-1707214800-A3B9C2",
    "authorizationUrl": "https://checkout.paystack.com/xyz123",
    "accessCode": "xyz123abc456",
    "gateway": "paystack",
    "amount": 591250,
    "status": "PENDING"
  }
}
```

### Verify Payment
```http
GET /payments/verify/{reference}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "pay_456def",
      "reference": "TB-1707214800-A3B9C2",
      "invoiceId": "inv_789xyz",
      "amount": 591250,
      "gateway": "paystack",
      "status": "SUCCESS",
      "paidAt": "2026-02-06T11:30:00Z",
      "customer": {
        "email": "accounts@abc.com"
      },
      "metadata": {
        "channel": "card",
        "cardType": "visa",
        "last4": "4081"
      }
    },
    "invoice": {
      "id": "inv_789xyz",
      "invoiceNumber": "INV/2026/00001",
      "status": "PAID"
    }
  }
}
```

### List Payments
```http
GET /payments?status=SUCCESS&page=1&limit=20
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "pay_456def",
        "reference": "TB-1707214800-A3B9C2",
        "amount": 591250,
        "gateway": "paystack",
        "status": "SUCCESS",
        "paidAt": "2026-02-06T11:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

## 🧮 TAX CALCULATIONS

### Calculate PIT
```http
POST /tax/calculate/pit
```

**Request Body**:
```json
{
  "grossIncome": 5000000,
  "reliefs": {
    "cra": true,
    "pension": 400000,
    "nhf": 125000,
    "lifeInsurance": 100000
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "grossIncome": 5000000,
    "taxableIncome": 4375000,
    "taxAmount": 893750,
    "effectiveRate": 0.17875,
    "netIncome": 4106250,
    "breakdown": [
      {
        "bracket": "₦0 - ₦300,000",
        "rate": 0.07,
        "amount": 21000
      },
      {
        "bracket": "₦300,000 - ₦600,000",
        "rate": 0.11,
        "amount": 33000
      },
      {
        "bracket": "₦600,000 - ₦1,100,000",
        "rate": 0.15,
        "amount": 75000
      },
      {
        "bracket": "₦1,100,000 - ₦1,600,000",
        "rate": 0.19,
        "amount": 95000
      },
      {
        "bracket": "₦1,600,000 - ₦3,200,000",
        "rate": 0.21,
        "amount": 336000
      },
      {
        "bracket": "₦3,200,000 - ₦∞",
        "rate": 0.24,
        "amount": 333750
      }
    ],
    "reliefs": {
      "cra": 200000,
      "pension": 400000,
      "nhf": 125000,
      "lifeInsurance": 100000
    }
  }
}
```

### Calculate VAT
```http
POST /tax/calculate/vat
```

**Request Body**:
```json
{
  "amount": 1000000,
  "category": "standard"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "amount": 1000000,
    "vatRate": 0.075,
    "vatAmount": 75000,
    "totalAmount": 1075000,
    "category": "standard"
  }
}
```

### Calculate CIT
```http
POST /tax/calculate/cit
```

**Request Body**:
```json
{
  "revenue": 50000000,
  "expenses": 30000000
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "revenue": 50000000,
    "expenses": 30000000,
    "profit": 20000000,
    "taxRate": 0.20,
    "taxAmount": 4000000,
    "effectiveRate": 0.08,
    "netProfit": 16000000,
    "category": "Medium Company (≤₦100M)",
    "breakdown": [
      {
        "bracket": "Medium Company (≤₦100M)",
        "rate": 0.20,
        "amount": 4000000
      }
    ]
  }
}
```

### Calculate PAYE
```http
POST /tax/calculate/paye
```

**Request Body**:
```json
{
  "grossSalary": 500000,
  "allowances": {
    "housing": 100000,
    "transport": 50000,
    "meal": 30000,
    "others": 20000
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "grossIncome": 700000,
    "totalAllowances": 200000,
    "taxableIncome": 44000,
    "totalReliefs": 256000,
    "taxDue": 5880,
    "pensionContribution": 56000,
    "nhfContribution": 17500,
    "netPay": 620620,
    "breakdown": [
      {
        "description": "Gross Salary",
        "amount": 500000
      },
      {
        "description": "Housing Allowance",
        "amount": 100000
      },
      {
        "description": "Transport Allowance",
        "amount": 50000
      },
      {
        "description": "Meal Allowance",
        "amount": 30000
      },
      {
        "description": "Other Allowances",
        "amount": 20000
      },
      {
        "description": "Gross Income",
        "amount": 700000
      },
      {
        "description": "Pension (8%)",
        "amount": -56000
      },
      {
        "description": "NHF (2.5%)",
        "amount": -17500
      },
      {
        "description": "PAYE Tax",
        "amount": -5880
      },
      {
        "description": "Net Pay",
        "amount": 620620
      }
    ]
  }
}
```

---

## 💼 PAYROLL MANAGEMENT

### Create Employee
```http
POST /payroll/employees
```

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john.doe@acmetrading.com",
  "phone": "+2348011112222",
  "grossSalary": 500000,
  "allowances": {
    "housing": 100000,
    "transport": 50000,
    "meal": 30000,
    "others": 20000
  },
  "startDate": "2026-01-01"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "employee": {
      "id": "emp_111aaa",
      "name": "John Doe",
      "email": "john.doe@acmetrading.com",
      "grossSalary": 500000,
      "allowances": {
        "housing": 100000,
        "transport": 50000,
        "meal": 30000,
        "others": 20000
      },
      "status": "active",
      "startDate": "2026-01-01T00:00:00Z",
      "createdAt": "2026-02-06T10:00:00Z"
    }
  }
}
```

### Process Payroll
```http
POST /payroll/process
```

**Request Body**:
```json
{
  "period": "2026-02"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "payroll": {
      "period": "2026-02",
      "employeeCount": 5,
      "totalGross": 3500000,
      "totalTax": 123400,
      "totalPension": 280000,
      "totalNHF": 87500,
      "totalNet": 3009100,
      "processedAt": "2026-02-06T12:00:00Z"
    },
    "payslips": [
      {
        "id": "slip_222bbb",
        "employeeId": "emp_111aaa",
        "period": "2026-02",
        "grossIncome": 700000,
        "taxDue": 5880,
        "netPay": 620620,
        "pdfUrl": "https://storage.taxbridge.ng/payslips/slip_222bbb.pdf"
      }
    ]
  }
}
```

### Generate Payslips
```http
POST /payroll/payslips/generate
```

**Request Body**:
```json
{
  "payrollId": "payroll_333ccc",
  "format": "pdf"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "payslips": [
      {
        "employeeId": "emp_111aaa",
        "employeeName": "John Doe",
        "pdfUrl": "https://storage.taxbridge.ng/payslips/emp_111aaa_2026-02.pdf"
      }
    ]
  }
}
```

---

## 📊 EXPENSE MANAGEMENT

### Create Expense
```http
POST /expenses
```

**Request Body**:
```json
{
  "amount": 25000,
  "category": "office-supplies",
  "description": "Printer cartridges and paper",
  "date": "2026-02-05",
  "vatAmount": 1875,
  "vatEligible": true,
  "receiptImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "expense": {
      "id": "exp_444ddd",
      "amount": 25000,
      "category": "office-supplies",
      "description": "Printer cartridges and paper",
      "date": "2026-02-05T00:00:00Z",
      "vatAmount": 1875,
      "vatEligible": true,
      "receiptImage": "https://storage.taxbridge.ng/receipts/exp_444ddd.jpg",
      "status": "pending",
      "createdAt": "2026-02-06T10:00:00Z"
    }
  }
}
```

### Scan Receipt (OCR)
```http
POST /expenses/scan-receipt
```

**Request Body**:
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "merchantName": "Office Depot Nigeria",
    "date": "2026-02-05",
    "amount": 25000,
    "category": "office-supplies",
    "confidence": 92,
    "vatAmount": 1875,
    "vatEligible": true,
    "rawText": "OFFICE DEPOT NIGERIA\n123 Main St\nReceipt #12345\nDate: 05/02/2026..."
  }
}
```

### Approve/Reject Expense
```http
POST /expenses/{expenseId}/approve
```

**Request Body**:
```json
{
  "action": "approve",
  "comment": "Approved for Q1 office supplies budget"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "expense": {
      "id": "exp_444ddd",
      "status": "approved",
      "approvedBy": "user_555eee",
      "approvedAt": "2026-02-06T13:00:00Z",
      "comment": "Approved for Q1 office supplies budget"
    }
  }
}
```

---

## 📅 COMPLIANCE & REMINDERS

### Get Compliance Calendar
```http
GET /compliance/calendar?year=2026
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "calendar": [
      {
        "type": "VAT",
        "description": "VAT Return and Payment for January 2026",
        "dueDate": "2026-02-21T23:59:59Z",
        "status": "upcoming",
        "daysRemaining": 15
      },
      {
        "type": "PAYE",
        "description": "PAYE Remittance for January 2026",
        "dueDate": "2026-02-10T23:59:59Z",
        "status": "overdue",
        "daysOverdue": 4
      },
      {
        "type": "CIT",
        "description": "Company Income Tax Return for FY 2025",
        "dueDate": "2026-06-30T23:59:59Z",
        "status": "upcoming",
        "daysRemaining": 144
      }
    ]
  }
}
```

### Create Reminder
```http
POST /compliance/reminders
```

**Request Body**:
```json
{
  "type": "VAT",
  "dueDate": "2026-03-21",
  "amount": 150000,
  "notifyBefore": 7
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "reminder": {
      "id": "rem_666fff",
      "type": "VAT",
      "description": "VAT Return and Payment",
      "dueDate": "2026-03-21T23:59:59Z",
      "amount": 150000,
      "notifyBefore": 7,
      "notifyAt": "2026-03-14T09:00:00Z",
      "status": "pending"
    }
  }
}
```

---

## 📈 REPORTS & ANALYTICS

### Get Dashboard Summary
```http
GET /reports/dashboard?period=2026-02
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "period": "2026-02",
    "summary": {
      "invoices": {
        "total": 25,
        "sent": 18,
        "paid": 12,
        "overdue": 6,
        "totalAmount": 14750000,
        "paidAmount": 8850000
      },
      "payments": {
        "total": 12,
        "successful": 11,
        "failed": 1,
        "totalAmount": 8850000
      },
      "expenses": {
        "total": 45,
        "approved": 38,
        "pending": 7,
        "totalAmount": 2340000,
        "vatEligible": 1755000
      },
      "tax": {
        "vatCollected": 663750,
        "vatPaid": 131625,
        "netVAT": 532125,
        "payeDeducted": 245600,
        "withholdingTax": 88500
      }
    }
  }
}
```

### Generate Tax Report
```http
POST /reports/tax
```

**Request Body**:
```json
{
  "taxType": "VAT",
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31",
  "format": "pdf"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "report": {
      "taxType": "VAT",
      "period": "January 2026",
      "vatCollected": 663750,
      "vatPaid": 131625,
      "netVAT": 532125,
      "dueDate": "2026-02-21",
      "pdfUrl": "https://storage.taxbridge.ng/reports/vat_2026-01.pdf",
      "generatedAt": "2026-02-06T14:00:00Z"
    }
  }
}
```

---

## ⚙️ WEBHOOKS

### Paystack Webhook
```http
POST /webhooks/paystack
```

**Headers**:
```
x-paystack-signature: {signature}
```

**Request Body**:
```json
{
  "event": "charge.success",
  "data": {
    "id": 123456789,
    "reference": "TB-1707214800-A3B9C2",
    "amount": 59125000,
    "status": "success",
    "paid_at": "2026-02-06T11:30:00Z",
    "customer": {
      "email": "accounts@abc.com"
    }
  }
}
```

**Response** (200 OK):
```json
{
  "status": "received"
}
```

---

## 🚨 ERROR RESPONSES

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "amount",
        "message": "Amount must be greater than 0"
      }
    ]
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service error |

---

## 📝 RATE LIMITS

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 requests per 15 minutes |
| Authentication | 10 requests per 15 minutes |
| Webhooks | 100 requests per minute |
| File Uploads | 20 requests per hour |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1707215700
```

---

## 🔧 PAGINATION

All list endpoints support pagination:

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response Format**:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

---

## 🔍 FILTERING & SORTING

### Query Parameters
```
GET /invoices?status=PAID&fromDate=2026-01-01&toDate=2026-01-31&sortBy=createdAt&order=desc
```

**Common Filters**:
- `status`: Filter by status
- `fromDate`, `toDate`: Date range
- `search`: Search term
- `sortBy`: Field to sort by
- `order`: `asc` or `desc`

---

## 📚 SDK EXAMPLES

### JavaScript/TypeScript
```typescript
import { TaxBridgeClient } from '@taxbridge/sdk';

const client = new TaxBridgeClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.taxbridge.ng/v1'
});

// Create invoice
const invoice = await client.invoices.create({
  customer: {
    name: 'ABC Corp',
    email: 'accounts@abc.com'
  },
  items: [
    {
      description: 'Consulting Services',
      quantity: 1,
      unitPrice: 500000,
      vatApplicable: true
    }
  ],
  dueDate: '2026-03-15'
});

// Calculate PAYE
const paye = await client.tax.calculatePAYE({
  grossSalary: 500000,
  allowances: {
    housing: 100000,
    transport: 50000
  }
});
```

### Python
```python
from taxbridge import TaxBridgeClient

client = TaxBridgeClient(
    api_key='your-api-key',
    base_url='https://api.taxbridge.ng/v1'
)

# Create invoice
invoice = client.invoices.create(
    customer={
        'name': 'ABC Corp',
        'email': 'accounts@abc.com'
    },
    items=[
        {
            'description': 'Consulting Services',
            'quantity': 1,
            'unitPrice': 500000,
            'vatApplicable': True
        }
    ],
    dueDate='2026-03-15'
)
```

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Support**: api-support@taxbridge.ng
