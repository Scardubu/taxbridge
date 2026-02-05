# TaxBridge Documentation Structure

**Last Updated:** February 6, 2026  
**Status:** ✅ Reorganized & Cleaned

---

## Overview

TaxBridge documentation has been reorganized for clarity, maintainability, and production readiness. Historical snapshots have been archived, and active documentation is structured by purpose.

---

## Root-Level Documentation (Production Critical)

These files remain in the repository root as they are actively referenced by deployment scripts, CI/CD pipelines, or are essential for onboarding:

| File | Purpose | Audience |
|------|---------|----------|
| **README.md** | Main project overview, setup instructions, API reference | All contributors |
| **CHANGELOG.md** | Release history and version-specific changes | All contributors |
| **PRODUCTION_STATUS.md** | Current production deployment status | DevOps, PM |
| **PRODUCTION_DEPLOYMENT_GUIDE.md** | Step-by-step deployment instructions | DevOps |
| **PRODUCTION_DEPLOYMENT_CHECKLIST.md** | Pre-deployment verification checklist | DevOps |
| **PRODUCTION_LAUNCH_AUTHORIZATION.md** | Official sign-off for production | PM, Legal |
| **FINAL_PRODUCTION_READINESS_REPORT.md** | Comprehensive readiness report | All stakeholders |
| **FEBRUARY_2026_PRODUCTION_VALIDATION.md** | Latest validation session results | Engineering |
| **UI_SIGN_OFF_CHECKLIST.md** | UI/UX compliance verification | Design, QA |

---

## Organized Documentation

### docs/archive/v1.0.0-snapshots/

Historical documentation snapshots from the v1.0.0 release cycle. These are preserved for audit purposes but are no longer actively referenced:

- `BUILD_FIX_v1.0.0.md` — Build error resolutions (Feb 3, 2026)
- `COMPREHENSIVE_ERROR_AUDIT_v1.0.0.md` — Error audit from v1.0.0
- `DEPLOYMENT_CHECKLIST_v1.0.0.md` — Original deployment checklist
- `DEPLOYMENT_STATUS_v1.0.0.md` — Deployment status snapshot (Feb 1, 2026)
- `FINAL_IMPLEMENTATION_SUMMARY_v1.0.0.md` — Implementation summary
- `FINAL_PRODUCTION_READINESS_REPORT_v1.0.0.md` — V1 readiness report
- `PRODUCTION_FINAL_OCR_INTEGRATION_v1.0.0.md` — OCR integration completion
- `PRODUCTION_READINESS_COMPLETE_v1.0.0.md` — Readiness completion doc
- `PRODUCTION_READINESS_SUMMARY_v1.0.0.md` — Readiness summary
- `SESSION_SUMMARY.md` — Session summary (covered by FEBRUARY_2026_PRODUCTION_VALIDATION.md)
- `REACT_DUPLICATE_FIX_STATUS.md` — React duplicate fix status (resolved)

---

### docs/reference/

Quick-start guides, technical references, and troubleshooting documentation for developers:

- `DEPLOY_QUICK_REFERENCE.md` — Quick deployment command reference
- `VERIFICATION_CHECKLIST.md` — Local dev verification steps
- `ONBOARDING_QUICKSTART.md` — User onboarding quick guide
- `REMITA_QUICKSTART.md` — Remita integration quick start
- `SECURITY_QUICKSTART.md` — Security setup quick reference
- `QUICK_START_GUIDE.md` — General project quick start
- `ONBOARDING_UI_WIREFRAME.md` — Onboarding UI wireframes
- `REACT_DUPLICATE_FIX.md` — React duplicate troubleshooting
- `EAS_CONFIGURATION_FIX.md` — EAS build configuration fixes
- `CUSTOMER_TIN_MIGRATION_GUIDE.md` — Database migration guide
- `ASSET_INTEGRATION_GUIDE.md` — Brand asset integration
- `RENDER_DATABASE_URL_OPTIMIZATION.md` — Database connection optimization

---

### docs/integrations/

Integration-specific implementation documentation:

- `REMITA_IMPLEMENTATION.md` — Remita payment gateway integration details

---

### docs/security/

Security setup, incident response, and compliance documentation:

- `SECURITY_DEPLOYMENT_CHECKLIST.md` — Security pre-deployment checklist
- `SECURITY_INCIDENT_ROTATION.md` — Incident response & credential rotation

---

### docs/stage-1/

Stage 1 pilot launch documentation (100-user soft launch):

- `STAGE_1_MONITORING_CHECKLIST.md` — Day 1-7 monitoring plan
- `STAGE_1_PLAYSTORE_UPLOAD_GUIDE.md` — Google Play Store upload instructions
- `STAGE_1_TESTER_BRIEFING.md` — Beta tester onboarding brief

---

## Scripts & Automation

### Root-Level Scripts (Active)

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-status.ps1` | Quick production readiness check | Before deployment |
| `deploy-production.ps1` | Production deployment orchestration | Production release |
| `validate-production.ps1` | Comprehensive production validation | Post-deployment verification |
| `validate-production-readiness.ps1` | Pre-flight readiness validation | Before production release |
| `verify-deployment-ready.ps1` | Final pre-deployment checks | Immediately before deploy |
| `verify-security.ps1` | Security configuration verification | Before any deployment |
| `restart-metro.ps1` | Restart Metro bundler with clean cache | Local development |
| `nuclear-cache-wipe.ps1` | Nuclear cache clear (use sparingly) | When all else fails |
| `setup-monitoring.ps1` | Configure production monitoring | Initial setup only |

### Subdirectory Scripts

- `backend/start-server.ps1` — Start backend development server
- `backend/test-security-integration.ps1` — Backend security integration tests
- `backend/scripts/staging-deploy-status.ps1` — Staging deployment status
- `admin-dashboard/deploy-vercel.ps1` — Deploy admin dashboard to Vercel

---

## Maintenance Guidelines

### Adding New Documentation

1. **Production-Critical Docs** → Root directory
2. **Quick Guides / References** → `docs/reference/`
3. **Integration Guides** → `docs/integrations/`
4. **Security Docs** → `docs/security/`
5. **Stage-Specific Docs** → `docs/stage-N/`
6. **Historical Snapshots** → `docs/archive/`

### Archiving Old Documentation

When a document is superseded or no longer actively referenced:

1. Move to `docs/archive/[context-name]/`
2. Update any references in scripts or other docs
3. Add note to this structure document

### Removing Documentation

**Never remove** documentation without:

1. Verifying zero references in codebase (grep search)
2. Checking PowerShell scripts for dependencies
3. Verifying no CI/CD pipeline usage
4. Moving to archive (don't delete unless truly orphaned)

---

## Quick Reference

### For New Developers

Start here:
1. [README.md](../README.md) — Project overview
2. [docs/reference/QUICK_START_GUIDE.md](reference/QUICK_START_GUIDE.md) — Development setup

### For DevOps Engineers

Start here:
1. [PRODUCTION_DEPLOYMENT_GUIDE.md](../PRODUCTION_DEPLOYMENT_GUIDE.md) — Full deployment guide
2. [PRODUCTION_DEPLOYMENT_CHECKLIST.md](../PRODUCTION_DEPLOYMENT_CHECKLIST.md) — Pre-deployment checklist
3. [check-status.ps1](../check-status.ps1) — Quick production status check

### For QA / Product Managers

Start here:
1. [UI_SIGN_OFF_CHECKLIST.md](../UI_SIGN_OFF_CHECKLIST.md) — UI/UX verification
2. [FEBRUARY_2026_PRODUCTION_VALIDATION.md](../FEBRUARY_2026_PRODUCTION_VALIDATION.md) — Latest validation status

---

## Compliance & Audit

All archived documentation is retained for:

- **Regulatory audits** (NDPC data protection, NRS compliance)
- **Historical tracking** (decision rationale, implementation timeline)
- **Knowledge transfer** (onboarding new team members)
- **Incident investigation** (understanding past fixes)

**Retention Policy:** Indefinite (until explicitly obsoleted by regulatory changes)

---

## Next Steps

After this reorganization:

1. ✅ Run `check-status.ps1` to verify no broken references
2. ✅ Update README.md to reflect new structure
3. ✅ Commit with message: `docs: reorganize documentation structure for production readiness`
4. ✅ Update CI/CD pipelines to reference new paths (if applicable)

---

**Document Version:** 1.0  
**Approved By:** Production Finalization Team  
**Date:** February 6, 2026
