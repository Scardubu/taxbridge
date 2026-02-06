# Stage 1: Google Play Store Upload Guide

**Date:** January 21, 2026  
**Status:** 📱 **READY FOR UPLOAD**  
**Target:** Internal Testing Track (100 Beta Testers)

---

## 📦 Build Artifacts Ready

### Latest Build: Android APK (v5.0.3) ⭐ NEW

| Property | Value |
|----------|-------|
| **Version** | 5.0.3 |
| **Build Number** | 50003 |
| **Build Type** | Android APK (.apk) |
| **Build ID** | 5e3d0427-3ca9-48b8-adaa-7124715c0469 |
| **Download URL** | https://expo.dev/accounts/scardubu/projects/taxbridge/builds/5e3d0427-3ca9-48b8-adaa-7124715c0469 |
| **Backend API** | https://taxbridge-api-ker8.onrender.com |
| **Build Platform** | Expo EAS |
| **Changes** | i18n fixes, hardcoded strings removed |

### Previous Build: Android App Bundle (v5.0.2)

| Property | Value |
|----------|-------|
| **Version** | 5.0.2 |
| **Build Number** | 50001 |
| **Build Type** | Android App Bundle (.aab) |
| **Build ID** | 66fdb06f-fca6-4943-9043-9a55e6f6ae84 |
| **Download URL** | https://expo.dev/artifacts/eas/dHCysRdLUbq4PzoKYvMsfq.aab |

---

## Step 1: Download Android Build (2 minutes)

### Option A: Download APK (Recommended for Direct Install)

**Open on Android device or download:**
```
https://expo.dev/accounts/scardubu/projects/taxbridge/builds/5e3d0427-3ca9-48b8-adaa-7124715c0469
```

Or scan the QR code from the EAS build page.

### Option B: Build & Download AAB (Required for Play Store)

Play Console requires an **Android App Bundle (.aab)**. For v5.0.3, generate a fresh AAB using the `production` EAS profile.

```powershell
# Run from repo root
cd c:\Users\USR\Documents\taxbridge\mobile

# Build AAB for Play Store (production profile = app-bundle)
# If you have eas installed globally, use: eas build --platform android --profile production
npx eas-cli build --platform android --profile production

# After the build completes, download the .aab from the EAS build page:
# https://expo.dev/accounts/scardubu/projects/taxbridge/builds
```

### Option C: Browser Download

1. Open: https://expo.dev/accounts/scardubu/projects/taxbridge/builds
2. Download the latest **Android App Bundle (.aab)** generated via the `production` profile
3. Save as: `taxbridge-v5.0.3-build50003.aab`
4. Location: `Downloads` folder

### Verification

```powershell
# Check file exists and is valid
$file = "$env:USERPROFILE\Downloads\taxbridge-v5.0.3-build50003.aab"
if (Test-Path $file) {
    Write-Host "✅ File ready for upload" -ForegroundColor Green
    Get-Item $file | Select-Object Name, Length, LastWriteTime
}
```

---

## Step 2: Google Play Console Setup (5-10 minutes)

### 2.1 Access Play Console

1. **Navigate to:** https://play.google.com/console
2. **Sign in** with Google account (must have Play Console access)
3. **Select app:** TaxBridge (`ng.taxbridge.app`)
   - If app doesn't exist, create new app first (see Section 2.2)

### 2.2 Create New App (First-Time Only)

**If TaxBridge app doesn't exist:**

1. **Click:** "Create app"
2. **Configure:**
   ```
   App name: TaxBridge
   Default language: English (United Kingdom)
   App or game: App
   Free or paid: Free
   ```
3. **Declarations:**
   - ✅ Accept Developer Program Policies
   - ✅ Confirm app complies with US export laws
4. **Click:** "Create app"

### 2.3 Complete App Information (Required for Testing)

**Go to:** Dashboard → "Set up your app"

**1. App Access**
- Select: "All functionality is available without restrictions"
- Click: "Save"

**2. Ads**
- Select: "No, my app does not contain ads"
- Click: "Save"

**3. Content Rating**
- Click: "Start questionnaire"
- Category: "Utility, Productivity, Communication, or Other"
- Answer all questions (focus on tax/invoice functionality)
- Click: "Save" → "Submit"

**4. Target Audience**
- Age groups: 18+ (business users)
- Click: "Save"

**5. App Content (Data Safety)**
- Data collection: Yes (user registration, invoice data)
- Data sharing: No third-party sharing
- Encryption: Yes (in transit and at rest)
- Data deletion: Yes (user can request deletion)
- Click: "Save"

**6. Government Apps**
- Select: "Not a government app"
- Click: "Save"

**7. Financial Features**
- Select: "My app has financial features"
- Describe: "Invoice generation, tax calculation, payment tracking"
- Click: "Save"

---

## Step 3: Create Internal Testing Release (10-15 minutes)

### 3.1 Navigate to Internal Testing

1. **Go to:** Play Console → TaxBridge app
2. **Left sidebar:** Testing → Internal testing
3. **Click:** "Create new release"

### 3.2 Upload App Bundle

1. **App bundles section:**
   - **Click:** "Upload"
   - **Select file:** `taxbridge-v5.0.3-build50003.aab`
   - **Wait:** Upload progress (~1-3 minutes depending on connection)
   - **Verify:** Green checkmark appears

2. **App bundle details (auto-populated):**
   ```
   Version code: 50003
   Version name: 5.0.3
   Minimum SDK: 21 (Android 5.0)
   Target SDK: 34 (Android 14)
   Supported devices: ~15,000 devices
   Supported languages: English, Nigerian Pidgin
   ```

### 3.3 Write Release Notes

**Release name:** `Stage 1 Beta — Mock Mode`

**Release notes (English):**
```
🎉 TaxBridge V5 Beta Release — Stage 1 Soft Launch

Thank you for joining our beta testing program!

What's New:
✅ Offline-first invoice creation
✅ NRS-compliant e-invoicing (mock mode)
✅ Receipt scanning with OCR
✅ Automated tax calculations
✅ Multi-language support (English + Pidgin)
✅ Payment tracking integration (mock mode)

Important Notes:
⚠️ This is a BETA release running in mock mode
⚠️ DigiTax and Remita integrations are simulated
⚠️ Data is for testing only — do not use for real transactions
⚠️ Expected testing period: 7 days

Known Limitations:
• No real NRS submission (mock mode)
• No real payment processing (sandbox only)
• SMS notifications not yet enabled

How to Test:
1. Register with your phone number
2. Create sample invoices (use test TINs)
3. Test offline sync functionality
4. Try receipt scanning feature
5. Report any bugs via in-app feedback

Support:
📧 support@taxbridge.ng
📱 WhatsApp: Use the internal beta group chat (invite shared by the TaxBridge team)
📖 Docs: See the tester briefing attachment

We appreciate your feedback! 🚀
```

### 3.4 Review and Rollout

1. **Review release details:**
   - Bundle uploaded: ✅
   - Release notes added: ✅
   - Version correct (5.0.3): ✅

2. **Click:** "Save"

3. **Click:** "Review release"

4. **Address any warnings:**
   - App signing key: Should be auto-managed by Google Play
   - If warnings appear, follow Google's guidance

5. **Click:** "Start rollout to Internal testing"

6. **Confirm:** Click "Rollout"

**Expected:** Release status changes to "Available to internal testers" (~5-30 minutes)

---

## Step 4: Create Tester List (5 minutes)

### 4.1 Create Email List

**Go to:** Testing → Internal testing → Testers tab

1. **Click:** "Create email list"
2. **List name:** `TaxBridge Stage 1 Beta Testers`
3. **Add email addresses:**
   - Option A: Upload CSV file (format: `email@example.com`)
   - Option B: Paste emails (one per line)

**Recommended tester profile:**
- 30 SME owners (primary users)
- 20 accountants (power users)
- 20 tech-savvy users (bug hunters)
- 20 low-tech users (UX validation)
- 10 team members (internal QA)

4. **Click:** "Save changes"

### 4.2 Add Tester List to Release

1. **Internal testing page → Testers tab**
2. **Click:** "Add email list"
3. **Select:** `TaxBridge Stage 1 Beta Testers`
4. **Click:** "Add"

**Result:** All 100 testers can now access the beta via opt-in link

---

## Step 5: Share Opt-In Link (2 minutes)

### 5.1 Get Opt-In URL

**Go to:** Internal testing → "How testers join your test" section

**Copy opt-in link** (format):
```
https://play.google.com/apps/internaltest/XXXXXXXXXXXXXXXXX
```

### 5.2 Invite Testers

**Email Template:**

```
Subject: 🎉 You're Invited: TaxBridge V5 Beta Testing

Hi [Tester Name],

You've been selected to join the TaxBridge V5 beta testing program!

TaxBridge helps Nigerian SMEs create NRS-compliant e-invoices, 
track payments, and manage tax obligations — all offline-first.

🔗 Join the Beta:
https://play.google.com/apps/internaltest/XXXXXXXXXXXXXXXXX

📱 What to Do:
1. Click the link above (must be on Android device)
2. Accept the invitation
3. Install TaxBridge from Play Store
4. Register with your phone number
5. Start testing!

⚠️ Important Notes:
• This is a BETA release in mock mode
• Do not use for real business transactions
• Testing period: 7 days
• Your feedback is crucial!

📖 Testing Guide:
See attached STAGE_1_TESTER_BRIEFING.md

🐛 Report Bugs:
• In-app feedback button
• Email: beta@taxbridge.ng
• WhatsApp: Reply in the internal beta group chat

Thank you for helping us build TaxBridge!

The TaxBridge Team
```

**Distribution Channels:**
- ✅ Email (primary)
- ✅ WhatsApp groups
- ✅ Slack/Teams channels (internal testers)
- ✅ SMS (opt-in link shortener: bit.ly or goo.gl)

---

## Step 6: Monitor Internal Testing (Ongoing — 7 Days)

### 6.1 Key Metrics Dashboard

**Access:** Play Console → TaxBridge → Internal testing → Statistics

**Daily Metrics to Track:**

| Metric | Target | Check Frequency |
|--------|--------|-----------------|
| **Installation Rate** | ≥80% of invitees | Daily |
| **Crash-Free Sessions** | ≥99% | 2x daily |
| **ANRs (App Not Responding)** | <0.5% | Daily |
| **Active Testers** | ≥70% DAU | Daily |
| **Uninstall Rate** | <10% | Daily |
| **Average Session Duration** | ≥5 minutes | Daily |

### 6.2 Play Console Monitoring Locations

**1. Dashboard → Statistics**
- Installations
- Crashes
- ANRs
- User ratings (internal)

**2. Release → Internal testing → Feedback**
- Bug reports
- Feature requests
- User comments

**3. Quality → Android vitals**
- Crash rate breakdown
- ANR rate breakdown
- Battery usage
- Render time

**4. Pre-launch report (if enabled)**
- Automated testing results
- Device compatibility
- Accessibility issues

### 6.3 External Monitoring (Render + Sentry)

**Backend Health:**
```powershell
# Run every 6 hours
$PROD_URL = "https://taxbridge-api-ker8.onrender.com"
$checks = @("live","ready","db","queues","digitax","remita")

foreach ($check in $checks) {
    $response = Invoke-RestMethod -Uri "$PROD_URL/health/$check" -ErrorAction SilentlyContinue
    if ($response.status -eq "ok" -or $response.status -eq "healthy") {
        Write-Host "✅ /health/$check" -ForegroundColor Green
    } else {
        Write-Host "❌ /health/$check — ALERT" -ForegroundColor Red
    }
}
```

**Render Logs:**
- Go to: https://dashboard.render.com/web/srv-d62gsicr85hc73a34nc0
- Monitor: Events tab for errors
- Check: Metrics tab for latency spikes

---

## Step 7: Collect and Analyze Feedback (Day 1-7)

### 7.1 Feedback Collection Channels

**1. In-App Feedback (Primary)**
- Mobile app feedback button
- Sends to backend `/api/v1/feedback` endpoint
- Stores in database with device/session context

**2. Email (beta@taxbridge.ng)**
- Manual triage
- Categorize: Bug / Feature / Question / Praise

**3. WhatsApp Group Support (Internal Testers)**
- Real-time support for urgent issues
- Use the internal beta group chat invite shared by the TaxBridge team
- Log all issues in tracking sheet

**4. Play Console Reviews**
- Internal testing feedback section
- Cannot be public replies (internal only)

### 7.2 Issue Prioritization

**P0 — Critical (Fix within 24h):**
- App crashes on launch
- Data loss
- Security vulnerabilities
- Cannot complete registration

**P1 — High (Fix within 3 days):**
- Major feature broken (invoice creation fails)
- Sync issues
- Performance degradation
- Accessibility blockers

**P2 — Medium (Fix before Stage 2):**
- Minor UI bugs
- Non-critical features
- Usability improvements

**P3 — Low (Backlog):**
- Nice-to-have features
- Edge cases
- Cosmetic issues

### 7.3 Daily Standup Checklist

**Every morning during Stage 1:**

- [ ] Check Play Console crash reports (target: 0 new crashes)
- [ ] Review backend health endpoints (target: 6/6 green)
- [ ] Triage new feedback/bug reports (target: <2h response time)
- [ ] Update bug tracking board (Jira/Linear/GitHub Issues)
- [ ] Monitor active tester count (target: ≥70 DAU)
- [ ] Check Render logs for errors (target: <10 errors/day)
- [ ] Respond to tester questions (target: <4h response time)

---

## Step 8: Go/No-Go Decision for Stage 2 (Day 7)

### Success Criteria

**All must pass to proceed to Stage 2 (1,000 users):**

| Criterion | Target | Pass/Fail |
|-----------|--------|-----------|
| **Crash-Free Rate** | ≥99% | [ ] |
| **ANR Rate** | <0.5% | [ ] |
| **Sync Success** | ≥99% | [ ] |
| **P95 API Latency** | <400ms | [ ] |
| **Error Rate** | <1% | [ ] |
| **Installation Rate** | ≥80% | [ ] |
| **Active Daily Testers** | ≥70 | [ ] |
| **Critical Bugs** | 0 open | [ ] |
| **High Priority Bugs** | <3 open | [ ] |
| **Tester Satisfaction** | ≥4.0/5.0 | [ ] |

### If All Pass → Proceed to Stage 2

1. **Expand tester list** to 1,000 users (closed testing)
2. **Enable real DigiTax integration** (sandbox mode)
3. **Enable real Remita integration** (sandbox mode)
4. **Upgrade Render plan** to Starter Pro (if needed)
5. **Enable Sentry monitoring** (full error tracking)
6. **Create Stage 2 release** (v5.0.3)

### If Any Fail → Extend Stage 1

1. **Identify root cause** of failing metric
2. **Implement fixes** and deploy hotfix
3. **Reset 7-day timer** after fix deployed
4. **Re-run validation** with same criteria
5. **Document lessons learned**

---

## Troubleshooting Common Issues

### Issue: Upload Rejected — "Duplicate Version Code"

**Cause:** Version code `50001` already exists in Play Console

**Fix:**
1. Increment version code in `mobile/app.json` (`expo.android.versionCode`)
2. Rebuild: `eas build --platform android --profile production`
3. Upload new AAB

### Issue: "App Bundle Signature Verification Failed"

**Cause:** Signing key mismatch

**Fix:**
1. Ensure using Google Play App Signing
2. Upload signing key to Play Console (Settings → App signing)
3. Re-upload bundle

### Issue: Testers Can't Accept Invitation

**Cause:** Opt-in link expired or incorrect email

**Fix:**
1. Verify email address matches Google account
2. Regenerate opt-in link from Play Console
3. Ensure tester uses same Google account on device

### Issue: App Shows "Not Compatible" on Device

**Cause:** Device below minimum SDK 21 or architecture mismatch

**Fix:**
1. Check device Android version (need ≥5.0)
2. Verify device architecture (ARM/ARM64/x86)
3. Review supported devices list in Play Console

### Issue: High Crash Rate (>1%)

**Cause:** Unhandled exception in production code

**Fix:**
1. Check Play Console → Crashes & ANRs
2. Identify crash stack trace
3. Fix in codebase
4. Deploy hotfix (see Hotfix Process below)

---

## Hotfix Process (Emergency Updates)

**If P0 bug found during testing:**

### 1. Create Hotfix Branch (Local)

```powershell
cd c:\Users\USR\Documents\taxbridge
git checkout -b hotfix/v5.0.3-[bug-description]
```

### 2. Implement Fix

- Make minimal code changes
- Test locally
- Commit with clear message:
  ```bash
  git commit -m "hotfix: [P0] Fix [bug description] affecting Stage 1 beta"
  ```

### 3. Rebuild Mobile App

```powershell
cd mobile
eas build --platform android --profile production
```

### 4. Upload to Play Console

- Follow Steps 3.1-3.4 (Create new release)
- Version: 5.0.3
- Release notes: "Hotfix: [bug description]"

### 5. Notify Testers

**Email:**
```
Subject: TaxBridge Beta Update (v5.0.3) — Hotfix Available

Hi Testers,

We've released a hotfix (v5.0.3) to address [bug description].

📱 Update Now:
Your Play Store should auto-update within 24 hours.
To update immediately: Play Store → TaxBridge → Update

🐛 What Was Fixed:
[Brief description of fix]

Thank you for your patience!
```

### 6. Merge Hotfix

```powershell
git checkout master
git merge hotfix/v5.0.3-[bug-description]
git push origin master
```

---

## Success Indicators

**You'll know Stage 1 is successful when:**

✅ Installation emails stop asking "how do I install?"  
✅ Feedback shifts from bugs to feature requests  
✅ Testers start using app daily (not just testing)  
✅ Zero critical bugs reported in last 3 days  
✅ Backend health checks stay green 24/7  
✅ Play Console shows ≥99% crash-free rate  
✅ Testers recommend app to colleagues  
✅ No support backlog (all questions answered)  
✅ Team confident to expand to 1,000 users  

---

## Quick Reference Commands

### Download AAB
```powershell
cd $env:USERPROFILE\Downloads
Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/dHCysRdLUbq4PzoKYvMsfq.aab" -OutFile "taxbridge-v5.0.2-build50001.aab"
```

### Check Backend Health
```powershell
Invoke-RestMethod -Uri "https://taxbridge-api-ker8.onrender.com/health/ready" | ConvertTo-Json
```

### Get Play Console Link
```
https://play.google.com/console → TaxBridge → Internal testing
```

---

## Timeline Estimate

| Step | Estimated Time | Can Parallelize? |
|------|----------------|------------------|
| 1. Download AAB | 2 min | No |
| 2. Play Console setup | 5-10 min | No |
| 3. Create release | 10-15 min | No |
| 4. Create tester list | 5 min | Yes |
| 5. Send invitations | 2 min | Yes |
| **Total (First Upload)** | **24-34 min** | |
| 6. Monitor (ongoing) | 7 days | Yes |
| 7. Collect feedback | 7 days | Yes |
| 8. Go/No-Go decision | 2h meeting | No |

**Total Time to Stage 2:** 7-14 days (depending on bug severity)

---

## Next Steps

After completing this guide:

1. ✅ Mobile app in internal testing (100 users)
2. 📊 Set up monitoring dashboard (see STAGE_1_MONITORING_CHECKLIST.md)
3. 📖 Brief testers (see STAGE_1_TESTER_BRIEFING.md)
4. 🔄 Monitor for 7 days
5. ✅ Make Go/No-Go decision
6. 🚀 Proceed to Stage 2 or iterate

---

**Last Updated:** January 20, 2026  
**Status:** Ready for execution  
**Estimated Completion:** January 27, 2026 (7-day testing period)
