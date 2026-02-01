# Quick Verification Checklist

## Execute These Commands Now

### 1. Restart Metro (Recommended)
```powershell
cd C:\Users\USR\Documents\taxbridge
.\restart-metro.ps1
```

**Alternative (manual):**
```powershell
cd C:\Users\USR\Documents\taxbridge\mobile
yarn start --clear --reset-cache
```

**Wait for:** "Metro waiting on exp://127.0.0.1:8081"

---

### 2. Open Fresh Browser
- Close ALL existing localhost:8081 tabs
- Open NEW incognito window: `Ctrl+Shift+N`
- Navigate to: http://localhost:8081
- Open DevTools: `F12`

---

### 3. Check Console Output

#### ✅ GOOD - You should see:
```
[Sentry] Initialized in development mode
Running application "main" with appParams
[sync-engine] Warming up sync engine
[sync-engine] Device identity established
[sync-engine] Device state loaded
```

#### ❌ BAD - You should NOT see:
```
Invalid hook call
Cannot read properties of null (reading 'useContext')
TypeError: Cannot read properties of null
```

---

### 4. Report Results

**If GOOD (no errors):**
✅ React duplicate issue RESOLVED  
✅ App loads successfully  
✅ Ready to proceed with production deployment  

**If BAD (still errors):**
Execute diagnostic:
```powershell
cd C:\Users\USR\Documents\taxbridge
yarn list react react-dom --depth=0
```

Then execute nuclear reinstall:
```powershell
Get-Process -Name node | Stop-Process -Force
Remove-Item -Recurse -Force node_modules, mobile\node_modules, yarn.lock
yarn install
cd mobile
yarn start
```

---

## Quick Status Check

After Metro starts, look for these indicators:

| Indicator | Expected |
|-----------|----------|
| Metro QR code displayed | ✅ YES |
| "Metro waiting on..." message | ✅ YES |
| "Web is waiting on http://localhost:8081" | ✅ YES |
| App loads in browser | ✅ YES |
| "Invalid hook call" error | ❌ NO |
| "Cannot read properties of null" | ❌ NO |

---

**Current Status:** Nuclear fix applied, Metro was restarted successfully but then stopped. Manual restart and verification required.

**Next Action:** Execute step 1 above (restart Metro) and verify in browser.
