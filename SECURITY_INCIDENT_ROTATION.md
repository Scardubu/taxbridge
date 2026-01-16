# TaxBridge Security Incident - Secret Rotation Required

**Date:** January 16, 2026  
**Severity:** 🔴 HIGH  
**Status:** ⏳ ROTATION REQUIRED

---

## Incident Summary

GitHub push protection flagged a **compromised Slack webhook URL** in commit `3aaca70` (`.env.production.example` line 116).

**Exposed Secret:**
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T0A***REDACTED***/B0A***REDACTED***/***REDACTED***
```

**Impact:**
- Webhook can be used to send unauthorized messages to TaxBridge Slack channel
- Potential for social engineering attacks
- Monitoring alerts could be spoofed

**Remediation Status:**
- ✅ Secret removed from `.env.production.example` (commit `6b5d66d`)
- ✅ Git history amended (amend last commit)
- ⏳ **Slack webhook rotation pending**
- ⏳ GitHub force-push pending

---

## Required Actions

### 1. Rotate Slack Webhook (IMMEDIATE)

**Steps:**
1. Go to Slack workspace: https://api.slack.com/apps
2. Select TaxBridge app → Incoming Webhooks
3. **Revoke** the compromised webhook (check Slack dashboard for full URL)
4. Generate new webhook URL
5. Update secrets in:
   - Render environment variables (`SLACK_WEBHOOK_URL`)
   - Local `.env.production` (do NOT commit)
   - Team password manager (1Password/LastPass)

**Priority:** 🔴 **CRITICAL - DO NOW**

### 2. Audit Other Exposed Secrets

Based on previous sanitization audit, the following secrets were previously exposed and **MUST be rotated**:

| Secret | Location | Status | Action |
|--------|----------|--------|--------|
| `SLACK_WEBHOOK_URL` | Commit 3aaca70 | 🔴 EXPOSED | Rotate now |
| `DATABASE_URL` (password) | Sanitized earlier | ⚠️ ROTATED | Verify new creds in use |
| `REDIS_URL` (password) | Sanitized earlier | ⚠️ ROTATED | Verify new creds in use |
| `DIGITAX_API_KEY` | Sanitized earlier | ⚠️ ROTATED | Request new key from DigiTax |
| `TERMII_API_KEY` | Sanitized earlier | ⚠️ ROTATED | Request new key from Termii |
| `JWT_SECRET` | Sanitized earlier | ⚠️ ROTATED | Re-generate via script |
| `JWT_REFRESH_SECRET` | Sanitized earlier | ⚠️ ROTATED | Re-generate via script |
| `ENCRYPTION_KEY` | Sanitized earlier | ⚠️ ROTATED | **PENDING** (requires data re-encryption) |
| `SESSION_SECRET` | Sanitized earlier | ⚠️ ROTATED | Re-generate via script |
| `WEBHOOK_SECRET` | Sanitized earlier | ⚠️ ROTATED | Re-generate via script |

### 3. Verify Rotation Scripts Executed

Run the following to ensure all secrets rotated:

```bash
# JWT secrets (with dual-key support)
cd infra/scripts
bash rotate-jwt-secrets.sh

# Webhook secrets
bash rotate-webhook-secrets.sh

# Verify no plaintext secrets in history
git log --all --full-history -- .env.production.example | grep -E "(SLACK_WEBHOOK|API_KEY|SECRET)"
```

### 4. Update Render Environment Variables

```bash
# Set via Render Dashboard or API
curl -X PATCH https://api.render.com/v1/services/srv-d5kq9tmmcj7s73a55ds0/env-vars \
  -H "Authorization: Bearer $RENDER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/NEW/WEBHOOK/URL",
    "DIGITAX_API_KEY": "new_digitax_key_here",
    "JWT_SECRET": "new_jwt_secret_64_chars",
    "ENCRYPTION_KEY": "new_encryption_key_64_chars"
  }'
```

### 5. Force-Push Clean History

**⚠️ Only after all secrets rotated:**

```bash
cd c:\Users\USR\Documents\taxbridge

# Force-push amended commit (removes old webhook)
git push origin master --force-with-lease

# If blocked again, use GitHub's "Allow secret" option ONLY if webhook already rotated
```

---

## Prevention Measures

### Immediate (Phase F)

- [x] Add `.env.production.example` to pre-commit hook validation
- [x] Configure GitHub secret scanning (already active)
- [ ] Add secret scanning to CI/CD pipeline
- [ ] Enable Doppler/Vault integration (Phase G)

### Long-term (Phase G)

- [ ] Migrate all secrets to Azure Key Vault or AWS Secrets Manager
- [ ] Implement automated secret rotation (90-day cycle)
- [ ] Add secret expiry monitoring
- [ ] Enable secret audit logging

---

## Lessons Learned

1. **Never put real values in `.env.*.example` files** - even temporarily
2. **Use placeholder text** like `YOUR_SLACK_WEBHOOK_URL` instead of real URLs
3. **Pre-commit hooks** should validate `.env.example` files for secret patterns
4. **Immediate rotation** is non-negotiable when secrets are exposed

---

## Sign-Off

| Action | Owner | Status | Date |
|--------|-------|--------|------|
| Revoke compromised Slack webhook | DevOps | ⏳ | |
| Generate new Slack webhook | DevOps | ⏳ | |
| Update Render env vars | DevOps | ⏳ | |
| Force-push clean history | Engineering | ⏳ | |
| Verify rotation complete | Security | ⏳ | |

---

**Next Step:** Rotate Slack webhook, then run:
```bash
git push origin master --force-with-lease
```
