a# React Duplicate Instance Fix

**Critical Issue:** Multiple React instances causing "Invalid hook call" error  
**Status:** ⚠️ REQUIRES MANUAL RESTART

---

## Problem Identification

The error stack shows:
```
Invalid hook call. Hooks can only be called inside of the body of a function component.
This could happen for one of the following reasons:
1. You might have mismatching versions of React and the renderer (such as React DOM)
2. You might be breaking the Rules of Hooks
3. You might have more than one copy of React in the same app
```

**Root Cause:** Multiple React instances in the monorepo despite resolutions in root package.json

---

## Fix Applied

### 1. Updated `mobile/metro.config.js` ✅

Created comprehensive Metro configuration with:
- `extraNodeModules` to force single React/React-DOM resolution
- `blockList` to prevent nested node_modules React instances
- Workspace root watching for monorepo support

**Key Configuration:**
```javascript
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-dom': path.resolve(workspaceRoot, 'node_modules/react-dom'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  'react-native-web': path.resolve(workspaceRoot, 'node_modules/react-native-web'),
};
```

---

## Required Manual Steps

### Step 1: Kill All Metro Processes
```powershell
# Stop all running Metro bundlers
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Or press Ctrl+C in all terminal windows running Expo/Metro
```

### Step 2: Clean All Caches
```powershell
cd C:\Users\USR\Documents\taxbridge

# Clean Yarn cache
yarn cache clean

# Clean Metro bundler cache
Remove-Item -Recurse -Force mobile\.expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force mobile\node_modules\.cache -ErrorAction SilentlyContinue

# Clean web cache
Remove-Item -Recurse -Force mobile\.expo-web -ErrorAction SilentlyContinue
```

### Step 3: Reinstall Dependencies (CRITICAL)
```powershell
# Remove all node_modules
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force mobile\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force admin-dashboard\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force backend\node_modules -ErrorAction SilentlyContinue

# Reinstall with resolutions enforced
yarn install --force
```

### Step 4: Verify Single React Instance
```powershell
# Should only show ONE React version (19.1.0)
yarn list react --depth=0

# Expected output:
# └─ react@19.1.0
```

### Step 5: Start Metro with New Config
```powershell
cd mobile
yarn start

# Or for web specifically:
yarn web
```

---

## Verification Checklist

After restart, verify:
- [ ] Metro starts without errors
- [ ] No "Invalid hook call" errors in console
- [ ] App loads successfully on web
- [ ] SyncProvider initializes without errors
- [ ] All context providers work (Network, Device, Sync)

---

## Alternative: Quick Reset (If Above Fails)

If the full reinstall doesn't work:

```powershell
# Nuclear option - complete workspace reset
cd C:\Users\USR\Documents\taxbridge

# Remove everything
Remove-Item -Recurse -Force node_modules, mobile\node_modules, admin-dashboard\node_modules, backend\node_modules, yarn.lock -ErrorAction SilentlyContinue

# Fresh install
yarn install

# Start Metro
cd mobile
yarn start --clear
```

---

## Why This Happens

1. **Yarn Workspaces + React Native:** Workspace hoisting can create multiple React instances
2. **nohoist Configuration:** The package.json has nohoist rules, but they may not cover all cases
3. **Transitive Dependencies:** Libraries like `use-sync-external-store` may bundle their own React
4. **Metro Default Config:** Default Metro doesn't resolve modules to workspace root

---

## Expected Console Output (Success)

After fix, you should see:
```
[Sentry] Initialized in development mode
Running application "main" with appParams
[sync-engine] Warming up sync engine
[sync-engine] Device identity established
[sync-engine] Device state loaded
```

**WITHOUT:**
- ❌ "Invalid hook call"
- ❌ "Cannot read properties of null"
- ❌ "Multiple copies of React"

---

## Additional Debugging

If error persists after all steps:

```powershell
# Check for duplicate React installations
Get-ChildItem -Recurse -Filter "package.json" -Path node_modules | Where-Object { $_.FullName -match "react[\\\/]package.json$" -and $_.FullName -notmatch "react-[^\\\/]+[\\\/]" } | ForEach-Object { Write-Host $_.Directory.FullName }

# Should only show: C:\Users\USR\Documents\taxbridge\node_modules\react
```

If you see multiple paths, React is duplicated and metro.config.js needs stronger blockList rules.

---

## Status: REQUIRES IMMEDIATE ACTION

🚨 **Metro must be restarted with new configuration to fix the issue**

The metro.config.js has been updated, but the running Metro process has the old configuration cached. Manual restart required.

---

**Next Steps:**
1. Execute Step 1-5 above
2. Restart Metro bundler
3. Verify app loads without hook errors
4. Update DEPLOYMENT_STATUS_v5.0.6.md if successful
