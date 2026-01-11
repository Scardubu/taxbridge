# TaxBridge — Complete PRD & Engineering Implementation Guide

## Executive Summary

TaxBridge is a **mobile-first, NRS-compliant e-invoicing and tax assistance platform** designed for Nigerian SMEs, micro-entrepreneurs, and informal traders. It addresses the **mandatory e-invoicing requirements** under Nigeria's 2025 Tax Act by providing offline-capable, multilingual (Pidgin + English minimum), UBL 3.0-compliant invoicing through **NITDA-accredited Access Point Providers (APPs)** like DigiTax, integrated with Remita for seamless tax payments.

**Key Innovation:** Combines regulatory compliance with radical inclusion—offline-first architecture, USSD/SMS fallbacks, on-device OCR for receipt capture, and AI-powered tax guidance in local languages—making tax compliance accessible to Nigeria's 40+ million informal businesses.

---

## PART 1 — PRODUCT REQUIREMENTS DOCUMENT (PRD)

### 1.1 Product Overview & Vision

**Product Name:** TaxBridge  
**Category:** GovTech × FinTech × AI  
**Vision Statement:**

> Democratize tax compliance for Nigeria's informal economy by making NRS-certified e-invoicing as simple as sending a text message—enabling millions of micro-entrepreneurs to participate in the formal economy with dignity, confidence, and zero fear of penalties.

**Strategic Context (January 2026):**

Based on recent regulatory updates:

- **Mandatory E-Invoicing:** Nigeria's National Regulatory Services (NRS) requires all businesses to submit real-time e-invoices using UBL 3.0/Peppol BIS Billing 3.0 format through **NITDA-accredited Access Point Providers (APPs)** only
- **Accredited APP Integration:** Direct NRS API access is restricted; must use certified APPs like DigiTax, Voxel, or approved providers
- **Cryptographic Stamping:** All valid e-invoices receive a Cryptographic Stamp Identifier (CSID) and Invoice Reference Number (IRN) from NRS via APP
- **Progressive Compliance:** B2B/B2G mandatory Jan 2026; B2C phased by turnover thresholds (₦25M+ by Q2 2026)
- **TaxPro Max Portal:** Official FIRS filing portal; initial MVP exports UBL/PDF/CSV bundles for manual upload (automated API filing pending NRS API availability)
- **Remita Dominance:** 90%+ government tax payments flow through Remita RRR system

**Alignment with National Goals:**
- **Tax Act 2025 Compliance:** Supports progressive tax rates (0-25%), SME exemptions, simplified filing
- **SDG 8 & 10:** Promotes decent work, economic growth, and reduced inequalities through financial inclusion
- **Revenue Expansion:** Targets Nigeria's ₦20 trillion informal economy (60% of GDP)

---

### 1.2 Target Users & Personas

| Persona | Profile | Pain Points | TaxBridge Value |
|---------|---------|-------------|-----------------|
| **Aunty Ngozi** (Market Trader) | 45, urban market seller, primary school education, basic Android phone, ₦50K-150K monthly sales | Manual receipt books, fears tax authorities, no internet at market stall, cannot afford accountant | One-tap invoicing with voice prompts in Pidgin, offline sync, free tier covers her volume, USSD status checks |
| **Chinedu** (Gig Worker) | 28, freelance graphic designer, tech-savvy, occasional invoices, ₦200K-500K monthly income | Needs professional invoices for clients, confused about VAT obligations, manual receipt tracking for expenses | Quick receipt scan with OCR, automatic VAT calculation, NRS-stamped invoices boost client trust, filing guidance |
| **Sade** (SME Owner) | 35, runs boutique with 3 staff, has POS system, ₦2M-5M monthly revenue | Must issue compliant invoices or lose B2B contracts, existing POS lacks NRS integration, filing complexity | Bulk invoice upload, POS plugin (future), automated UBL submission via DigiTax, accountant-friendly exports |
| **Ibrahim** (Accountant) | 42, serves 20+ small business clients, licensed tax practitioner | Manually preparing UBL XML is time-consuming, tracking client compliance status, multiple filing formats | Multi-client agent portal, bulk submission dashboard, audit trail exports, white-label option for his practice |
| **Grace** (NGO Officer) | 31, conducts tax literacy clinics in rural LGAs, works with cooperatives | Target users have no smartphones or data, language barriers, distrust of digital tools | USSD/SMS tools for registration and status checks, offline training materials, community onboarding kits |

**User Segmentation:**
- **Tier 1 (Informal/Micro):** 0-₦500K monthly sales — 60% of user base
- **Tier 2 (Small):** ₦500K-5M monthly sales — 30% of user base  
- **Tier 3 (SME):** ₦5M-25M monthly sales — 8% of user base
- **Agents/Accountants:** Manage multiple clients — 2% of user base

---

### 1.3 Key Problems Solved & Value Proposition

#### Problems

**Regulatory Compliance Gap:**
- **Mandatory e-invoicing** with UBL 3.0 format is legally required but technically inaccessible to 95% of Nigerian SMEs
- Direct NRS integration not allowed—must use accredited APPs, adding complexity and cost
- Non-compliance penalties: ₦50,000 first offense, ₦100,000+ repeat offenses, potential business closure

**Digital Divide:**
- 70% of target users have unreliable internet; 40% use feature phones only
- Existing e-invoicing solutions require stable connectivity and desktop computers
- No solutions support Pidgin, Hausa, Yoruba, or Igbo—only English interfaces

**Financial Literacy & Trust:**
- 80% of informal traders don't understand VAT obligations or tax exemptions
- Manual calculation errors lead to overpayment or underpayment
- Fear of tax authorities prevents voluntary compliance

**Technical Barriers:**
- Receipt and bookkeeping are entirely manual (paper receipts, ledger books)
- No affordable tools for receipt digitization or expense tracking
- Existing accounting software costs ₦10,000-50,000/month—prohibitive for micro-businesses

#### Value Proposition

**For Users:**
- ✅ **Legal Compliance Made Simple:** NRS-certified e-invoices in 3 taps via accredited APP integration
- ✅ **Radical Inclusion:** Works offline, supports USSD/SMS, speaks Pidgin—designed for 40M informal traders
- ✅ **Financial Empowerment:** Automated tax calculations, exemption detection (< ₦25M turnover), filing guidance
- ✅ **Cost-Effective:** Free tier for micro-businesses (≤50 invoices/month), ₦1,000-5,000/month for higher volumes
- ✅ **Trust & Transparency:** AI chatbot explains obligations in plain language; audit trails build confidence

**For Government:**
- 📈 **Tax Base Expansion:** Onboard 150K+ informal businesses in Year 1, ₦500B+ new revenue potential
- 📊 **Real-Time Visibility:** Every transaction reported to NRS via APP; reduces tax evasion
- 🎯 **Policy Alignment:** Supports Tax Act 2025 progressive taxation and SME exemptions
- 🤝 **Formalization Driver:** Digital invoicing → digital payments → credit access → economic growth

**For Ecosystem:**
- 🏦 **Banks/Fintechs:** White-label licensing for POS providers (Moniepoint, Paga); transaction fee revenue share
- 📱 **Telcos:** Zero-rating partnerships drive data usage; USSD revenue
- 🎓 **Capacity Building:** NGO partnerships for rural tax clinics; train-the-trainer programs

---

### 1.4 Core Features (Prioritized for 12-Week MVP)

#### Must-Have (MVP — Weeks 1-12)

**1. Mobile-First Invoice Creation (React Native + Expo)**
- ✅ Offline-first architecture using SQLite for local storage
- ✅ Simple form: Customer (optional), Line items (description, qty, price), Auto-calculate VAT (7.5%)
- ✅ Camera integration for attaching receipt photos
- ✅ Save offline with sync queue; auto-sync when online
- ✅ Multilingual UI: English + Pidgin (minimum); voice prompts for key flows
- ✅ Visual status indicators: Queued (yellow) → Syncing (blue) → Stamped (green) → Failed (red)

**2. Backend Sync & UBL Generation (Node.js + TypeScript + Fastify)**
- ✅ RESTful API: `POST /api/v1/invoices`, `GET /api/v1/invoices/:id`, `PUT /api/v1/invoices/:id`
- ✅ Invoice data model: merchant_id, customer, items[], totals{subtotal, vat, total}, attachments[], status, timestamps
- ✅ BullMQ job queue for async processing with Redis
- ✅ UBL 3.0 (BIS Billing 3.0) XML generator: Convert JSON → Valid UBL XML with mandatory fields
- ✅ Schema validation against official BIS Billing 3.0 XSD
- ✅ Idempotency keys (UUID) to prevent duplicate submissions

**3. APP Integration (DigiTax Sandbox → Production)**
- ✅ Adapter module for DigiTax API: HMAC-signed requests, retry logic (exponential backoff)
- ✅ Submit UBL XML via POST; handle responses (accepted/rejected/validation errors)
- ✅ Capture CSID (Cryptographic Stamp Identifier), IRN (Invoice Reference Number), QR code from APP response
- ✅ Store NRS reference and stamp metadata in database
- ✅ Webhook endpoint `/webhooks/nrs/einvoice` for async stamp notifications (HMAC verification)
- ✅ Error classification: Transport errors (retry), UBL schema errors (user fix), Business rule violations (display guidance)

**4. Tax Dashboard (Basic Analytics)**
- ✅ Monthly summary: Total sales, VAT collected, Estimated tax payable
- ✅ Exemption detection: Flag if < ₦25M annual turnover (simplified filing eligible)
- ✅ Progressive tax calculator aligned with Tax Act 2025 rates:
  - 0% (₦0-800K)
  - 15% (₦800K-3.2M)
  - 19% (₦3.2M-8M)
  - 21% (₦8M-15M)
  - 25% (₦15M+)
- ✅ Export options: CSV, PDF summary, UBL XML bundle (for TaxPro Max manual upload)
- ✅ Filing guidance: Step-by-step instructions for TaxPro Max submission

**5. Receipt OCR (On-Device + Server Enrichment)**
- ✅ On-device OCR: TensorFlow Lite + Tesseract for offline text extraction
- ✅ Extract: Amount, Date, Merchant name, Line items (best-effort)
- ✅ Server-side enrichment (FastAPI): Normalize dates, clean amounts, validate merchant TIN
- ✅ Nigerian receipt fine-tuning: Train on local receipt formats (supermarkets, POS printouts, handwritten)
- ✅ Accuracy target: ≥85% for amount/date extraction in MVP
- ✅ Fallback: Manual entry if OCR confidence < 70%

**6. Remita Payment Integration**
- ✅ Generate RRR (Remita Retrieval Reference) for tax payments via API
- ✅ One-click payment flow: Tax Dashboard → Generate RRR → Open Remita URL → Pay via bank transfer/card/USSD
- ✅ Webhook handler `/webhooks/remita/payment` for payment confirmation (HMAC verification)
- ✅ Reconciliation: Link payment to invoice/filing; update status to "paid"
- ✅ Payment history with receipts

**7. USSD/SMS Fallback (Inclusion Layer)**
- ✅ USSD gateway integration (Africa's Talking or MTN/Airtel direct)
- ✅ Core flows:
  - `*123*1#` → Register with NIN → Receive Tax ID
  - `*123*2#` → Check invoice status by ID
  - `*123*3#` → Get latest VAT amount due
- ✅ SMS notifications:
  - Invoice stamped successfully
  - Payment confirmed
  - Filing deadline reminders (1 week, 1 day before)
- ✅ Cost control: SMS only for critical alerts; USSD preferred for queries

**8. Admin Console (Internal Ops)**
- ✅ Web dashboard: View all users, invoices, submission logs
- ✅ Filter by status: Queued, Processing, Stamped, Failed
- ✅ Error drill-down: UBL validation errors, APP response codes, retry history
- ✅ Manual requeue for failed invoices
- ✅ DigiTax sandbox/production key management (environment-specific)
- ✅ Basic analytics: Submission success rate, average processing time, top error types
- ✅ User management: Block/unblock, reset account, view audit logs

**9. Security & Compliance Baseline**
- ✅ NDPC DPIA (Nigeria Data Protection Commission): Data flow mapping, consent screens, retention policy
- ✅ Encryption: TLS 1.3 in transit, AES-256 at rest for sensitive data (TIN, NIN)
- ✅ Authentication: OAuth2 + JWT; phone number verification via OTP
- ✅ Webhook security: HMAC-SHA256 signature verification for DigiTax and Remita callbacks
- ✅ Audit logs: Immutable record of all invoice submissions, status changes, admin actions
- ✅ Data minimization: Only collect data required for compliance; no unnecessary PII
- ✅ User consent: Explicit opt-in for data processing, AI chatbot usage, SMS notifications

#### Should-Have (Post-MVP — Weeks 13-24)

**10. Agent/Accountant Multi-Tenant Portal**
- Multi-client dashboard: Switch between client accounts
- Bulk invoice upload (CSV → UBL batch conversion)
- White-label option: Accountants can rebrand for their practice
- Client onboarding wizard with compliance checklist

**11. AI Tax Chatbot (Multilingual Education)**
- NLP chatbot supporting Pidgin, Hausa, Yoruba, Igbo
- Retrieval-based FAQ + small LLM for conversational responses
- Sample questions:
  - "Who dey pay VAT?" (Who pays VAT?)
  - "Wetin be exemption?" (What is an exemption?)
  - "How I go file return?" (How do I file a return?)
- Content sources: Tax Act 2025 summaries, FIRS guidance docs, community FAQs
- Explicit disclaimer: "Educational support only—not legal/tax advice"
- Usage analytics: Track most-asked questions to improve content

**12. Enhanced ML Models**
- Fine-tuned OCR on 1,000+ Nigerian receipts (supermarkets, pharmacies, POS, handwritten)
- Receipt type classification: Retail, restaurant, transport, medical
- Expense categorization for better bookkeeping
- Anomaly detection: Flag unusual patterns for user review (not enforcement)

**13. Gamification & Engagement**
- Compliance badges: "Compliant Seller," "Tax Hero," "Early Filer"
- Leaderboards for community cooperatives (optional, privacy-respecting)
- Monthly challenges: "File on time 3 months in a row → Earn premium features"
- Referral rewards: Invite 5 friends → 1 month free premium

**14. TaxPro Max Auto-Filing (If NRS Opens API)**
- Direct API integration with TaxPro Max for automated filing
- Pre-fill returns with TaxBridge data
- One-click submission with digital signature
- Real-time filing status updates

#### Nice-to-Have (Phase 2 — Months 6-12)

**15. POS & Marketplace Integrations**
- Plugin for Moniepoint, Paga, Paystack POS terminals
- Shopify/WooCommerce plugin for online sellers
- API for third-party ERPs (QuickBooks, Xero)

**16. Voice-First IVR Assistant**
- AI-powered speech recognition for Pidgin/Hausa/Yoruba
- Call center alternative: Dial number → Ask tax questions → Get voice responses
- Accessibility for visually impaired users

**17. Advanced Analytics & Insights**
- Cash flow forecasting based on invoice history
- Tax optimization recommendations (legal deductions, credits)
- Benchmark against similar businesses (anonymized)

**18. Community Features**
- Market union/cooperative group accounts
- Shared payment pools for collective tax filing
- Peer support forums moderated by tax experts

---

### 1.5 Non-Functional Requirements

#### Performance
- **Offline Capability:** Core flows (create invoice, scan receipt, view history) must work 100% offline
- **Sync Reliability:** ≥95% successful sync rate; automatic retry with exponential backoff (max 5 attempts)
- **Response Time:** API endpoints < 500ms (p95); mobile screens load < 2s on 3G
- **OCR Speed:** On-device processing < 5s on low-end Android (Snapdragon 450 equivalent)
- **Scalability:** Support 10,000 concurrent users in MVP; 100K+ in Year 1

#### Localization
- **Languages (MVP):** English, Pidgin (mandatory); Hausa, Yoruba, Igbo (post-MVP)
- **Voice Prompts:** TTS support for key flows (create invoice, payment confirmation)
- **Cultural Sensitivity:** Avoid technical jargon; use local business terms (e.g., "Mama put" for small restaurant)
- **Date/Currency Formats:** Nigerian date format (DD/MM/YYYY), Naira symbol (₦)

#### Security & Privacy (NDPC Compliance)
- **Data Protection:** Full compliance with Nigeria Data Protection Regulation (NDPR)
- **DPIA Completed:** Before production launch
- **User Rights:** Access, rectification, deletion, portability
- **Data Retention:** Invoices 7 years (tax law), Personal data purged on account closure
- **Encryption:** AES-256-GCM at rest, TLS 1.3 in transit
- **Key Management:** HSM for cryptographic operations if ECDSA signing required by APP
- **Penetration Testing:** External pentest before production; critical vulnerabilities blocked

#### Reliability
- **Uptime:** 99.5% SLA for backend (excluding planned maintenance)
- **Data Durability:** 99.999% (five nines) via PostgreSQL replication + daily backups
- **Disaster Recovery:** RPO < 4 hours, RTO < 8 hours
- **Idempotency:** All write operations idempotent (prevent duplicate invoices/payments)
- **Error Handling:** Graceful degradation; user-friendly error messages in local languages

#### Accessibility
- **WCAG 2.1 AA:** For web admin console
- **Mobile Accessibility:** Large touch targets (min 44px), high contrast mode, screen reader support
- **Low-Literacy Design:** Icon-driven navigation, visual status indicators, minimal text
- **Offline Indicators:** Clear visual cues when device is offline vs online

#### Compliance (Legal/Regulatory)
- **UBL 3.0 Validation:** 100% schema compliance; automated tests against BIS Billing 3.0 XSD
- **APP Certification:** Production deployment only after DigiTax (or chosen APP) certification
- **Tax Act 2025 Alignment:** Progressive rates, exemption thresholds, simplified filing paths
- **Audit Trail:** Immutable logs for all invoice submissions, status changes, admin actions (7-year retention)
- **FIRS Reporting:** Export formats compatible with TaxPro Max (CSV, PDF, UBL XML bundle)

---

### 1.6 Success Metrics & KPIs

| Category | Metric | MVP Target (Month 1) | 6-Month Target | 12-Month Target |
|----------|--------|---------------------|----------------|-----------------|
| **Adoption** | Merchants onboarded | 150 | 5,000 | 50,000 |
| **Inclusion** | % Informal/micro users | ≥40% | ≥50% | ≥60% |
| **Engagement** | MAU (Monthly Active Users) | 100 | 3,500 | 35,000 |
| **Conversion** | Free → Paid (90 days) | ≥25% | ≥30% | ≥35% |
| **Compliance** | NRS submission success rate | ≥95% | ≥98% | ≥99% |
| **Data Quality** | OCR accuracy (amount/date) | ≥85% | ≥90% | ≥95% |
| **Reliability** | App uptime | 99% | 99.5% | 99.9% |
| **User Satisfaction** | NPS (Net Promoter Score) | ≥7/10 | ≥8/10 | ≥9/10 |
| **Trust** | % users report reduced tax fear | ≥80% | ≥85% | ≥90% |
| **Offline Usage** | % invoices created offline | ≥40% | ≥35% | ≥30% |
| **USSD Adoption** | % users using USSD feature | ≥10% | ≥15% | ≥20% |
| **Revenue** | MRR (Monthly Recurring Revenue) | ₦100K | ₦3M | ₦30M |
| **Impact** | Estimated new tax revenue generated | ₦50M | ₦2B | ₦20B |

**North Star Metric:** Number of NRS-stamped invoices created by informal/micro users (measures both adoption and inclusion)

---

### 1.7 Risks & Dependencies

#### Regulatory & Integration Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **APP Certification Delays** | Cannot go to production without DigiTax/APP approval | Start sandbox integration immediately; engage DigiTax BD team; prepare compliance docs in parallel |
| **NRS Schema Changes** | UBL generator breaks if BIS Billing spec updated | Subscribe to NRS/PEPPOL updates; implement schema versioning; automated validation tests |
| **CSID/ECDSA Signing Complexity** | APP may require HSM or specific crypto implementation | Confirm requirements early; budget for HSM if needed; use APP's signing service if available |
| **TaxPro Max API Unavailable** | Must rely on manual CSV/PDF upload | Build export flows first; engage NRS for API roadmap; prioritize user experience for manual process |
| **Policy Changes** | Tax Act amendments could change rates/thresholds | Modular tax calculation engine; config-driven rates; monitor FIRS announcements |

#### Third-Party Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| **DigiTax (APP)** | Single point of failure if API downtime | SLA negotiation; implement robust retry logic; monitor status page; fallback to queue |
| **Remita** | Merchant onboarding delays; RRR generation failures | Start onboarding early; test sandbox thoroughly; implement webhook retries; display clear errors |
| **Telco USSD Gateways** | Partnership approval timeframes; cost per session | Use Africa's Talking free trial initially; negotiate bulk rates; provide SMS fallback |
| **Supabase/Hosting** | Free tier limits; potential migrations | Monitor usage; plan upgrade triggers; design for database portability (PostgreSQL standard SQL) |

#### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OCR Accuracy on Nigerian Receipts** | Poor extraction → user frustration | Build diverse training dataset; allow manual corrections; iterate based on feedback |
| **Offline Sync Edge Cases** | Duplicate invoices; data corruption | Robust idempotency; conflict resolution logic; comprehensive testing; user-initiated sync option |
| **Low-End Device Performance** | App crashes on older Androids | Optimize bundle size; lazy load features; test on real devices (Tecno, Infinix); set minimum SDK |
| **Multilingual NLP Quality** | Chatbot misunderstands Pidgin queries | Start with curated FAQ; log failed queries; iterative model fine-tuning; fallback to human support |

#### Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Support Overload** | Can't scale support for 50K users | Build comprehensive help center; train community ambassadors; chatbot deflects common questions |
| **Fraud/Abuse** | Fake invoices; account farming | Rate limiting; TIN/NIN verification; anomaly detection; manual review for high-value transactions |
| **Cash Flow** | Freemium model → slow revenue ramp | Secure pilot funding (grants, CSR); B2B licensing to banks; transaction fees on payments |

---

### 1.8 Monetization & Go-to-Market

#### Monetization Strategy

**Freemium Model:**
- **Free Tier:** ≤50 invoices/month, basic features, TaxBridge branding
- **Premium Tier (₦1,000-2,000/month):** ≤200 invoices/month, priority support, white-label option
- **Business Tier (₦5,000/month):** Unlimited invoices, multi-user, API access, dedicated account manager
- **Agent/Accountant Tier (₦10,000/month):** Manage up to 20 clients, bulk operations, branded reports

**Transaction Fees:**
- 0.2% on Remita payments (split with Remita; negotiate partnership)
- Optional: ₦50 per NRS submission for high-volume users (above free tier)

**B2B Licensing:**
- White-label SDK for POS providers (Moniepoint, Paga): ₦500K-1M setup + ₦100/transaction
- Marketplace plugins (Shopify, Jumia): Revenue share (10-15% of subscription)
- Bank partnerships: SME banking packages include TaxBridge (licensing fee + transaction share)

**Grants & CSR:**
- Developmental organizations (World Bank, GIZ): Rural pilot funding (₦5-10M)
- Corporate CSR (banks, telcos): Sponsor tax literacy clinics; co-branding opportunities
- Government programs: Apply for NITDA/FIRS innovation grants

#### Go-to-Market Strategy

**Phase 1: Pilot (Months 1-3) — Lagos + 1 Rural LGA**
- **Target:** 150 merchants (100 Lagos, 50 rural)
- **Channels:**
  - Partner with 3 market unions (e.g., Balogun Market, Computer Village)
  - NGO partnership for rural onboarding (1 LGA in Ogun/Oyo State)
  - Tax clinic events with FIRS/LIRS support
- **Tactics:**
  - Community ambassadors (1 per market): ₦50K/month + commission
  - Free tier + 3-month premium trial for early adopters
  - QR code posters in markets: "Scan to join TaxBridge"
  - WhatsApp group for pilot users (support + feedback)
- **Success Criteria:** 80% of pilot users create ≥5 invoices; NPS ≥7

**Phase 2: Scale (Months 4-9) — 5 States**
- **Target:** 5,000 merchants (Lagos, Kano, Port Harcourt, Abuja, Ibadan)
- **Channels:**
  - DigiTax co-marketing: Joint webinars, case studies
  - Remita partnership: Cross-promote in payment confirmations
  - Telco partnerships: MTN/Airtel SMS campaigns to SME database
  - Accountant outreach: ICAN/ANAN chapters; CPD training sessions
- **Tactics:**
  - Referral program: ₦500 credit for each successful referral
  - Gamification launch: Compliance badges; monthly winners get premium free
  - Regional language expansion: Add Hausa (Kano), Yoruba (Ibadan)
  - Media: Press releases; TechCabal, Nairametrics coverage
- **Success Criteria:** 3,500 MAU; ≥25% conversion to paid; break-even on variable costs

**Phase 3: National (Months 10-24) — All 36 States**
- **Target:** 50,000 merchants nationwide
- **Channels:**
  - National TV/radio campaigns (NTA, Wazobia FM): Tax compliance PSAs featuring TaxBridge
  - POS integration rollout: Moniepoint pilot → national deployment
  - Government partnerships: SMEDAN, BOI, NEF endorsements
  - Banking partnerships: GTBank, FirstBank SME packages include TaxBridge
- **Tactics:**
  - USSD shortcode activation: Dial *123# from any phone
  - Offline-first marketing: Flyers, posters, community radio in rural areas
  - Agent network: Recruit 500 tax agents; provide sales training + tools
  - B2B pipeline: Direct sales team for enterprise/government contracts
- **Success Criteria:** 35,000 MAU; ₦30M MRR; self-sustaining unit economics

**Key Partnerships:**

| Partner | Value | Terms |
|---------|-------|-------|
| **DigiTax (APP)** | NRS integration; co-marketing | Revenue share on enterprise deals; joint case studies |
| **Remita** | Payment infrastructure | Transaction fee split (negotiate 50/50); co-branded campaigns |
| **MTN/Airtel** | USSD gateway; SMS; zero-rating | Bulk USSD rates; pilot zero-rating for TaxBridge traffic |
| **Market Unions** | User acquisition; trust | Commission on paid conversions; co-branded onboarding events |
| **ICAN/ANAN** | Accountant network; credibility | CPD credits for TaxBridge training; agent program |
| **NGOs (DAI, Mercy Corps)** | Rural outreach; funding | Grant funding for pilot; train-the-trainer programs |

---

## PART 2 — ENGINEERING TICKETS (30 Tickets)

### Ticket Structure

Each ticket includes:
- **Key:** Unique ID (e.g., SETUP-1, BACKEND-5)
- **Epic:** Grouping (color-coded in Jira)
- **Title:** Clear, action-oriented
- **Description:** Context, technical approach, edge cases
- **Acceptance Criteria (AC):** Testable conditions for "done"
- **Story Points (SP):** Fibonacci scale (1, 2, 3, 5, 8, 13)
- **Dependencies:** Blocking tickets (must complete first)
- **Priority:** P0 (critical path), P1 (MVP), P2 (post-MVP)

### Epic A: Project Setup & Infrastructure (SETUP)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **SETUP-1** | Initialize Monorepo | Create Git org `taxbridge-ng`; monorepo structure: `/mobile` (Expo), `/backend` (Node), `/ml` (Python), `/infra` (Terraform). Add README, .gitignore, license (MIT). | - Repos created with folder structure<br>- README with setup instructions<br>- GitHub Actions CI placeholder<br>- Branch protection on `main` | 3 | None | P0 |
| **SETUP-2** | Provision Dev Database | Create Supabase free-tier project; provision PostgreSQL database. Add `.env.example` with `DATABASE_URL`, `DATABASE_KEY`. Write migration script `db/migrations/001_initial_schema.sql` for `users`, `invoices`, `invoice_items`, `sync_queue` tables. | - Supabase project created<br>- Migration script runs successfully<br>- Tables created with proper indexes<br>- Connection verified via `psql` or Supabase UI | 5 | SETUP-1 | P0 |
| **SETUP-3** | Setup Redis Queue | Provision Redis instance (Render free tier or Supabase add-on). Add `REDIS_URL` to `.env.example`. Install BullMQ dependencies. Create test job queue. | - Redis accessible from backend<br>- BullMQ queue initialized<br>- Test job enqueued and processed<br>- Dashboard accessible (Bull Board) | 3 | SETUP-1 | P0 |
| **SETUP-4** | CI/CD Pipeline | Setup GitHub Actions workflows: (1) Backend tests + linting, (2) Mobile build (Expo
EAS), (3) Deploy staging (Render). Add status badges to README. | - Push to `main` triggers all workflows<br>- Test failures block merge<br>- Staging auto-deploys on success<br>- Badges visible in README | 5 | SETUP-1, SETUP-2 | P1 |
| **SETUP-5** | Logging & Monitoring | Integrate Sentry (free tier) for error tracking. Setup Prometheus + Grafana (dev environment). Add basic metrics: request count, response time, queue depth. | - Errors reported to Sentry with stack traces<br>- Grafana dashboard shows live metrics<br>- Alerts configured for critical errors | 3 | SETUP-2, SETUP-3 | P1 |

### Epic B: Backend Core (BACKEND)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **BACKEND-1** | Invoice Data Model & API | Implement Fastify server with TypeScript. Create `/api/v1/invoices` endpoints: POST (create), GET (list), GET/:id (detail), PUT/:id (update). Define Prisma schema for `invoices` table with fields: `id`, `merchant_id`, `customer_name`, `status`, `subtotal`, `vat`, `total`, `items` (JSON), `ubl_xml`, `nrs_reference`, `created_at`, `updated_at`. | - POST returns 201 with `invoice_id` and `status: queued`<br>- GET returns paginated list with filters (status, date range)<br>- Data persists to PostgreSQL<br>- Validation errors return 400 with details | 5 | SETUP-2 | P0 |
| **BACKEND-2** | Sync Queue Worker | Implement BullMQ worker that processes `invoice-sync` jobs. Worker picks invoices with `status: queued`, marks them `processing`, calls UBL generator, then DigiTax adapter. Handle success (mark `stamped`) and failure (mark `failed`, log error). | - Worker processes test job in < 2s<br>- Status transitions logged<br>- Failed jobs retry 3x with exponential backoff<br>- Dead letter queue for permanent failures | 5 | SETUP-3, BACKEND-1 | P0 |
| **BACKEND-3** | UBL 3.0 Generator | Create module `lib/ubl/generator.ts` that converts invoice JSON to UBL 3.0 XML (BIS Billing 3.0 format). Use `xmlbuilder2` library. Include mandatory fields: `cbc:ID`, `cbc:IssueDate`, `cac:AccountingSupplierParty` (with TIN), `cac:AccountingCustomerParty`, `cac:InvoiceLine`, `cac:TaxTotal`, `cac:LegalMonetaryTotal`. Validate against BIS Billing 3.0 XSD schema. | - Sample JSON input converts to valid UBL XML<br>- XML validates against XSD (no errors)<br>- Output includes all mandatory fields<br>- Unit tests cover 5 invoice scenarios | 8 | BACKEND-1 | P0 |
| **BACKEND-4** | DigiTax Adapter (Sandbox) | Implement `integrations/digitax/adapter.ts` to POST UBL XML to DigiTax sandbox API. Add HMAC-SHA256 signing for authentication. Parse response to extract `nrsReference`, `csid`, `irn`, `qrCode`. Handle errors: 4xx (validation), 5xx (retry), timeout. | - Successful submission returns `nrsReference`<br>- HMAC signature verified by DigiTax<br>- Errors logged with full context<br>- Integration test with mocked DigiTax endpoint | 8 | BACKEND-2, BACKEND-3 | P0 |
| **BACKEND-5** | Idempotency & Retries | Add idempotency middleware: Use `Idempotency-Key` header (UUID). Store key + response hash in `idempotency_cache` table. If duplicate request, return cached response (200). Implement retry logic for DigiTax calls: Exponential backoff (1s, 2s, 4s, 8s, 16s). Max 5 retries. | - Duplicate POST with same key returns 200 (not 201)<br>- Retries triggered on 5xx or timeout<br>- Retry count and timestamps logged<br>- Circuit breaker after 10 consecutive failures | 5 | BACKEND-4 | P0 |
| **BACKEND-6** | Webhook Endpoints | Implement webhook handlers: (1) `/webhooks/nrs/einvoice` for DigiTax stamp notifications, (2) `/webhooks/remita/payment` for payment confirmations. Verify HMAC signatures. Update invoice status and metadata. Return 200 immediately; process async. | - Valid webhook updates invoice status<br>- Invalid HMAC returns 401<br>- Idempotent (duplicate webhooks ignored)<br>- Async processing via queue (no blocking) | 5 | BACKEND-4 | P0 |
| **BACKEND-7** | Admin Console Backend | Create admin API endpoints: (1) `GET /admin/invoices` with filters (status, date, merchant), (2) `POST /admin/invoices/:id/requeue`, (3) `GET /admin/stats` (success rate, error counts), (4) `GET /admin/logs/:invoice_id`. Add JWT-based admin auth. | - Admin can filter and view all invoices<br>- Requeue triggers new sync job<br>- Stats calculated in real-time<br>- Logs display full sync history | 5 | BACKEND-2, BACKEND-5 | P1 |
| **BACKEND-8** | Tax Calculation Engine | Implement module `lib/tax/calculator.ts` with functions: (1) `calculateVAT(subtotal)` → 7.5%, (2) `calculateIncomeTax(annualRevenue)` → progressive rates per Tax Act 2025, (3) `checkExemption(annualRevenue)` → boolean (< ₦25M). Make rates configurable (database or config file). | - VAT calculated correctly for test cases<br>- Income tax matches Tax Act 2025 brackets<br>- Exemption logic accurate<br>- Unit tests with edge cases (₦0, negative, boundary values) | 3 | None | P1 |

### Epic C: Mobile Frontend (MOBILE)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **MOBILE-1** | Expo Project Setup | Initialize Expo app with TypeScript. Setup navigation (React Navigation v6): Tabs for Home, Create, Invoices, Settings. Add i18n library (`react-i18next`) with English + Pidgin locales. Configure theme (colors, fonts). | - App runs on Expo Go<br>- Tab navigation functional<br>- Language toggle switches strings<br>- Theme applied consistently | 3 | SETUP-1 | P0 |
| **MOBILE-2** | Home Dashboard Screen | Build Home screen with: (1) Welcome header (user name + TIN), (2) Quick stats card (monthly sales, VAT, tax due), (3) Action buttons (Create Invoice, Scan Receipt, View Invoices), (4) Sync status indicator. | - UI matches mockup design<br>- Stats fetched from backend API<br>- Buttons navigate to correct screens<br>- Sync status updates in real-time | 5 | MOBILE-1, BACKEND-1 | P0 |
| **MOBILE-3** | Create Invoice Screen | Build form with fields: Customer (optional), Item description, Quantity, Unit price, Add Item button. Display live totals (subtotal, VAT, total). Add Camera button to attach receipt photo. Save button stores locally (SQLite) and queues sync. | - Form validates inputs (required fields, numeric values)<br>- Totals calculated dynamically<br>- Camera integration works (Expo Camera)<br>- Offline save creates SQLite record with `status: queued` | 8 | MOBILE-1 | P0 |
| **MOBILE-4** | Offline Storage (SQLite) | Integrate `expo-sqlite`. Create local schema mirroring backend: `invoices`, `invoice_items`, `sync_queue`. Implement CRUD functions: `saveInvoice()`, `getInvoices()`, `updateInvoiceStatus()`. Handle migrations for schema changes. | - Invoice saved offline accessible after app restart<br>- Data persists across sessions<br>- Schema migrations applied automatically<br>- No data loss on SQLite errors (rollback) | 5 | MOBILE-3 | P0 |
| **MOBILE-5** | Sync Worker (Offline→Online) | Implement background sync worker using `expo-task-manager`. On network change (offline→online), fetch queued invoices from SQLite, POST to backend API with idempotency key, update local status based on response. | - Sync triggered automatically on reconnect<br>- Idempotency key prevents duplicates<br>- Status updated in SQLite and UI<br>- Manual "Sync Now" button works | 8 | MOBILE-4, BACKEND-1 | P0 |
| **MOBILE-6** | Invoice List Screen | Build list screen displaying all invoices (local + synced). Show status badges: Queued (yellow), Syncing (blue), Stamped (green), Failed (red). Filter by status. Pull-to-refresh. Tap invoice to view details. | - List shows all invoices sorted by date (newest first)<br>- Status badges accurate<br>- Pull-to-refresh triggers sync<br>- Navigation to detail screen works | 5 | MOBILE-4, MOBILE-5 | P0 |
| **MOBILE-7** | Invoice Detail Screen | Build detail screen showing: Customer, Items list with prices, Totals breakdown, Status timeline (created → synced → stamped), QR code (if stamped), NRS reference, Share button (PDF/image export). | - All invoice data displayed correctly<br>- QR code renders if available<br>- Share exports PDF with invoice details<br>- Accessible on offline-created invoices | 5 | MOBILE-6 | P0 |
| **MOBILE-8** | Multilingual Support | Add Pidgin translations for all screens (minimum 80% coverage). Implement language selector in Settings. Add voice prompts (TTS) for Create Invoice screen: "Enter customer name," "Add item," "Save successful." | - Pidgin translations grammatically correct<br>- Language persists after app restart<br>- Voice prompts play correctly (test on device)<br>- Fallback to English if TTS fails | 5 | MOBILE-1 | P1 |
| **MOBILE-9** | Push Notifications | Integrate Firebase Cloud Messaging. Handle notifications: (1) Invoice stamped, (2) Sync failed, (3) Payment confirmed, (4) Filing deadline reminder. Show in-app banner and system notification. | - Notifications delivered when app backgrounded<br>- Tap opens relevant screen<br>- Notification preferences in Settings<br>- Deep linking works (notification → invoice detail) | 5 | MOBILE-2 | P1 |

### Epic D: ML & OCR (ML)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **ML-1** | On-Device OCR Pipeline | Integrate Tesseract OCR (`react-native-tesseract-ocr`) into mobile app. Implement image preprocessing: grayscale, contrast adjustment, rotation correction. Extract text from receipt photo. Parse for amount (₦ or Naira), date (DD/MM/YYYY), merchant name. | - OCR extracts text from sample receipt in < 5s<br>- Amount detected with ≥80% accuracy on 20 test images<br>- Date detected with ≥75% accuracy<br>- Merchant name extracted (best-effort) | 8 | MOBILE-3 | P0 |
| **ML-2** | Server-Side OCR Enrichment | Build FastAPI microservice at `/ml/ocr_service`. Accept base64 image, run Tesseract, apply NLP post-processing (regex for amounts, date parsing with `dateutil`), validate merchant TIN via lookup. Return structured JSON: `{amount, date, merchant, confidence}`. | - Endpoint returns JSON in < 3s for sample image<br>- Confidence scores accurate (0-1 scale)<br>- Date normalization handles multiple formats<br>- Merchant TIN lookup works (mock database for MVP) | 5 | ML-1, SETUP-2 | P1 |
| **ML-3** | Training Dataset Collection | Collect 100 Nigerian receipts: supermarkets (50), POS printouts (30), handwritten (20). Anonymize PII. Label ground truth (amount, date, merchant). Store in `/ml/dataset/receipts/`. Document receipt types and common patterns. | - 100 receipts collected and labeled<br>- CSV metadata file with paths + labels<br>- Diversity across receipt types<br>- Privacy review completed (no real TINs/names) | 3 | None | P1 |
| **ML-4** | Fine-Tuned OCR Model | Fine-tune TensorFlow Lite model on Nigerian receipt dataset. Train on amount/date extraction. Export `.tflite` model for mobile deployment. Compare accuracy: baseline vs fine-tuned. | - Fine-tuned model improves accuracy by ≥10% over baseline<br>- `.tflite` model < 10MB (mobile-friendly)<br>- Inference time < 500ms on device<br>- A/B test plan documented | 8 | ML-3 | P2 |

### Epic E: Integrations (INTEGRATIONS)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **INT-1** | DigiTax Sandbox Registration | Register TaxBridge with DigiTax developer portal. Obtain sandbox API keys, endpoints, HMAC secret. Document authentication flow, rate limits, webhook setup. Test basic connectivity (health check endpoint). | - Sandbox keys obtained and documented<br>- Health check returns 200<br>- Rate limits documented (requests/min)<br>- Webhook URL registered with DigiTax | 2 | None | P0 |
| **INT-2** | DigiTax Production Certification | Prepare production readiness checklist: DPIA, pentest report, UBL validation tests, sandbox metrics (success rate). Submit application to DigiTax for production keys. Undergo certification review. | - Checklist completed (100% items)<br>- Application submitted<br>- Production keys received<br>- Certification letter obtained | 8 | INT-1, BACKEND-4, SEC-1 | P1 |
| **INT-3** | Remita Merchant Onboarding | Register TaxBridge as Remita merchant. Obtain sandbox merchant ID, API key, secret key. Test RRR generation API (`POST /remita/generate`). Setup webhook endpoint for payment confirmations. | - Sandbox merchant account active<br>- RRR generated successfully for test amount<br>- Webhook receives payment confirmation<br>- Reconciliation flow documented | 5 | None | P0 |
| **INT-4** | Remita Payment Flow | Implement payment generation in backend: `/api/v1/payments/generate` accepts `invoice_id` + `amount`, calls Remita API to create RRR, returns RRR + payment URL. Frontend opens payment URL in in-app browser. Handle webhook to mark invoice `paid`. | - RRR generated for test invoice<br>- Payment URL opens correctly<br>- Webhook updates invoice status<br>- Payment history stored in database | 5 | INT-3, BACKEND-6 | P0 |
| **INT-5** | USSD Gateway (Africa's Talking) | Sign up for Africa's Talking sandbox. Create USSD code (`*123*45#`). Implement USSD session handler in backend: (1) Menu flow, (2) NIN → Tax ID lookup, (3) Invoice status check. Test on sandbox shortcode. | - USSD menu displays correctly<br>- User can navigate options<br>- Tax ID lookup returns result (mock data OK for MVP)<br>- Invoice status query works | 5 | BACKEND-1 | P1 |
| **INT-6** | SMS Notifications | Integrate Africa's Talking SMS API. Implement SMS sending function: `sendSMS(phone, message)`. Trigger SMS on: (1) Invoice stamped, (2) Payment confirmed, (3) Filing reminder (7 days before). Rate limit: Max 3 SMS/user/day. | - SMS delivered to test number in < 10s<br>- Message templates support variables (name, amount)<br>- Rate limiting enforced<br>- Opt-out mechanism implemented (reply STOP) | 3 | None | P1 |

### Epic F: Chatbot & AI Assistant (CHATBOT)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **BOT-1** | FAQ Corpus Creation | Compile 50 FAQs about Nigerian taxes: VAT basics, exemptions, filing deadlines, penalties. Write answers in simple English + Pidgin. Source from Tax Act 2025, FIRS guidance. Store in JSON format: `[{q, a_en, a_pidgin, tags}]`. | - 50 QA pairs documented<br>- Pidgin translations reviewed by native speaker<br>- Tags added for categorization<br>- Legal disclaimer added to all tax advice | 3 | None | P1 |
| **BOT-2** | Retrieval-Based Chatbot | Implement simple chatbot using cosine similarity (TF-IDF or sentence embeddings). User query → find most similar FAQ → return answer. Support English + Pidgin input. Add fallback: "I don't know, contact support." Integrate into mobile app (chat screen). | - Chatbot answers 80% of test queries correctly<br>- Response time < 2s<br>- Works offline (local FAQ storage)<br>- Disclaimer shown before first use | 5 | BOT-1, MOBILE-1 | P2 |
| **BOT-3** | LLM Integration (Optional) | Integrate small open-source LLM (e.g., Llama 3.2 3B via Hugging Face Inference API free tier). Use for conversational follow-ups beyond FAQ. Implement prompt template: "You are a tax education assistant for Nigerian SMEs. Use simple language. Never give legal advice." | - LLM generates coherent responses<br>- Stays in character (educational only)<br>- Cost < $5/month (free tier usage)<br>- Logs queries for improvement | 5 | BOT-2 | P2 |

### Epic G: Security & Compliance (SEC)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **SEC-1** | NDPC DPIA Completion | Conduct Data Protection Impact Assessment (DPIA): (1) Map data flows (what, where, why), (2) Identify risks (breach, misuse), (3) Define mitigations (encryption, access controls), (4) Document retention policy (invoices 7 years, PII purged on account deletion). Submit to legal review. | - DPIA document completed (min 10 pages)<br>- Data flow diagrams created<br>- Risk matrix with mitigations<br>- Legal sign-off obtained | 8 | SETUP-2, BACKEND-1 | P0 |
| **SEC-2** | Authentication & Authorization | Implement OAuth2 + JWT authentication. Phone number verification via OTP (Twilio or Africa's Talking). Role-based access control (RBAC): User, Agent, Admin. Secure password hashing (bcrypt). Session management (refresh tokens). | - User can register and login<br>- OTP verification works<br>- JWT expires after 24h (refresh after 7 days)<br>- Admin cannot access user API without proper role | 5 | BACKEND-1 | P0 |
| **SEC-3** | Encryption Implementation | Implement encryption: (1) TLS 1.3 for all API traffic (Cloudflare or Let's Encrypt), (2) AES-256-GCM for PII at rest (TIN, NIN, phone), (3) Encrypt SQLite database on mobile (expo-secure-store for keys). Document key management (rotation every 90 days). | - All API endpoints use HTTPS<br>- PII encrypted in database (verified via query)<br>- Mobile SQLite encrypted (test on device)<br>- Key rotation procedure documented | 5 | SEC-2 | P0 |
| **SEC-4** | Penetration Testing | Hire external security firm (budget ₦500K) for penetration test. Scope: Backend APIs, mobile app, admin console. Provide test credentials. Review report, prioritize fixes (Critical/High first). Retest after fixes. | - Pentest report received<br>- Zero critical vulnerabilities<br>- High vulnerabilities fixed or mitigated<br>- Retest confirms fixes | 8 | SEC-1, SEC-2, SEC-3 | P1 |
| **SEC-5** | Audit Logging | Implement immutable audit log: (1) Invoice submissions (user, timestamp, status), (2) Admin actions (requeue, user block), (3) Data access (who viewed what). Store in separate table `audit_logs` with append-only constraint. Retention: 7 years. | - All critical actions logged<br>- Logs cannot be deleted/modified<br>- Admin dashboard shows recent audit events<br>- Export audit log for compliance | 3 | BACKEND-1 | P1 |

### Epic H: Testing & Deployment (TEST)

| Key | Title | Description | AC | SP | Dependencies | Priority |
|-----|-------|-------------|----|----|--------------|----------|
| **TEST-1** | Unit Test Coverage | Write unit tests (Jest) for backend modules: UBL generator, tax calculator, idempotency middleware. Target: ≥80% code coverage. Mock external dependencies (DigiTax, Remita). | - Coverage report shows ≥80%<br>- All critical paths tested<br>- Tests run in CI (passing required for merge)<br>- Mock data realistic (based on real invoices) | 5 | BACKEND-3, BACKEND-8 | P1 |
| **TEST-2** | Integration Tests | Write integration tests (Supertest) for API endpoints: Create invoice → UBL generation → DigiTax mock submission → Webhook → Status update. Test error paths (validation failures, network errors). | - End-to-end flow passes in < 10s<br>- Error scenarios handled gracefully<br>- Tests isolated (no shared state)<br>- Runs on every PR | 8 | BACKEND-2, BACKEND-4, BACKEND-6 | P1 |
| **TEST-3** | Mobile E2E Tests | Write E2E tests (Detox or Maestro) for mobile: (1) Create invoice offline, (2) Sync when online, (3) View stamped invoice with QR. Run on emulator in CI. | - Tests pass on Android emulator<br>- Offline mode tested (airplane mode simulation)<br>- Screenshots captured on failure<br>- Test runs in < 5 minutes | 8 | MOBILE-5, MOBILE-7 | P2 |
| **TEST-4** | Performance Testing | Load test backend with K6: Simulate 1,000 concurrent users creating invoices. Measure: Response time (p95 < 500ms), error rate (< 1%), queue processing time. Identify bottlenecks. | - Load test script documented<br>- Results show system handles 1K users<br>- Bottlenecks identified and logged<br>- Optimization plan created | 5 | BACKEND-2, TEST-2 | P2 |
| **TEST-5** | Staging Deployment | Deploy to staging environment (Render free tier): Backend, database, Redis. Configure environment variables (sandbox keys). Test full flow with DigiTax sandbox. | - Staging URL accessible<br>- Full invoice flow works end-to-end<br>- Logs visible in Render dashboard<br>- Rollback procedure documented | 5 | SETUP-4, INT-1 | P1 |
| **TEST-6** | Production Deployment | Deploy to production (Render paid tier or DigitalOcean): Scale to 2 instances, add load balancer, enable auto-scaling (CPU > 70%). Setup monitoring alerts (Sentry, Uptime Robot). | - Production URL live<br>- Auto-scaling tested (simulate load)<br>- Alerts triggered correctly<br>- Rollback procedure tested | 8 | TEST-5, INT-2, SEC-4 | P1 |

### Summary of Tickets by Epic

| Epic | Tickets | Total SP | Priority |
|------|---------|----------|----------|
| **A: Setup & Infra** | 5 | 19 | P0-P1 |
| **B: Backend Core** | 8 | 44 | P0-P1 |
| **C: Mobile Frontend** | 9 | 49 | P0-P1 |
| **D: ML & OCR** | 4 | 24 | P0-P2 |
| **E: Integrations** | 6 | 25 | P0-P1 |
| **F: Chatbot & AI** | 3 | 13 | P1-P2 |
| **G: Security & Compliance** | 5 | 29 | P0-P1 |
| **H: Testing & Deployment** | 6 | 39 | P1-P2 |
| **TOTAL** | **46** | **242** | — |

**Sprint Planning (12 Weeks = 6 Sprints):**
- **Sprint 1-2:** Setup + Backend Core (P0 tickets) — 63 SP
- **Sprint 3-4:** Mobile Frontend + Integrations (P0 tickets) — 79 SP
- **Sprint 5:** ML/OCR + Security (P0-P1) — 53 SP
- **Sprint 6:** Testing + Deployment + Polish (P1-P2) — 47 SP