# TaxBridge

<div align="center">

![TaxBridge Logo](mobile/assets/logo 2000x500.png)

**Mobile-first, NRS-compliant tax platform for Nigerian SMEs**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://expo.dev/accounts/scardubu/projects/taxbridge)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](/)
[![Tests](https://img.shields.io/badge/tests-266%20passing-success)](/)
[![Production](https://img.shields.io/badge/status-production-brightgreen)](https://taxbridge-api-ker8.onrender.com/health/live)

[Documentation](docs/) • [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) • [Production Status](docs/PRODUCTION_STATUS.md) • [Implementation History](docs/IMPLEMENTATION_HISTORY.md)

</div>

---

## 🚀 v1.0.0 — Production Ready (February 10, 2026)

**TaxBridge is production-ready** with world-class UI/UX, offline-first architecture, and full NRS compliance.

- ✅ **Backend:** Live at <https://taxbridge-api-ker8.onrender.com>
- ✅ **Admin Dashboard:** Deployed at <https://taxbridge.vercel.app>
- ✅ **Mobile App:** Ready for Play Store (EAS Build: scartony357/taxbridge)
- ✅ **Tests:** 266/266 passing (100% success rate)
- ✅ **TypeScript:** 0 errors across all platforms
- ✅ **Compliance:** NRS 2026, NDPC, Nigeria Tax Act 2025

---

## ✨ Key Features

### Mobile App (React Native + Expo)

- **Offline-First:** Create invoices without internet, sync when online
- **OCR Scanner:** AI-powered receipt scanning with AR guidance
- **Tax Calculators:** PIT, VAT, CIT, CGT, WHT, PAYE (NTA 2025 compliant)
- **Multi-Language:** English + Nigerian Pidgin (1,080+ keys)
- **4-Step Onboarding:** Interactive demos with 60%+ completion target
- **Design System:** 100% token adoption, WCAG 2.1 AA accessible

### Backend API (Node.js + Fastify)

- **NRS Compliance:** Digitax integration for FIRS e-invoicing
- **Payment Gateways:** Paystack, Remita, Flutterwave
- **Business Verification:** Youverify (TIN/BVN/CAC)
- **Payroll & PAYE:** Automated calculations with remittance
- **Performance:** 50-95% query speed improvements, 70-97% API caching

### Admin Dashboard (Next.js)

- **Real-time Monitoring:** System health, integrations, metrics
- **Interactive Charts:** Invoice trends, payment analytics, user growth
- **Device Management:** Sync status, conflict resolution
- **Responsive Design:** Mobile-first, 375px-1920px support

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/scardubu/taxbridge.git
cd taxbridge

# Install dependencies
yarn install

# Start development servers
yarn dev
```

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) for production deployment instructions.

---

## 🛠 Tech Stack

**Mobile:** React Native + Expo + SQLite + Reanimated 2  
**Backend:** Node.js + Fastify + Prisma + PostgreSQL + Redis  
**Admin:** Next.js 16 + shadcn/ui + Tailwind CSS  
**Integrations:** Paystack, Remita, Flutterwave, Digitax, FIRS, Youverify  
**Monitoring:** Sentry + Custom Metrics  
**Deployment:** Render (Backend) + Vercel (Admin) + EAS (Mobile)

---

## 📚 Documentation

- [Implementation History](docs/IMPLEMENTATION_HISTORY.md) - Phases 1-10 development timeline
- [Production Status](docs/PRODUCTION_STATUS.md) - Current deployment state
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) - How to deploy all platforms
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Setup and contribution guidelines
- [API Documentation](docs/API_DOCUMENTATION.md) - Complete API reference

---

## 📊 Project Stats

- **Lines of Code:** 50,000+
- **Test Coverage:** 266 tests (100% passing)
- **i18n Keys:** 1,080+ (English + Nigerian Pidgin)
- **Components:** 147+ with 100% token adoption
- **API Endpoints:** 60+ RESTful endpoints
- **Development Time:** 6 weeks (10 phases)

---

## 🤝 Contributing

See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for setup instructions and contribution guidelines.

---

## 📄 License

Proprietary - © 2026 TaxBridge

---

**Built with excellence for Nigerian businesses** 🇳🇬
