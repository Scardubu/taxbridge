# FILE: scripts/8-Build-Mobile-App.ps1
# PURPOSE: Complete mobile app build workflow for EAS

param(
    [ValidateSet("development", "preview", "production")]
    [string]$Profile = "production",
    
    [ValidateSet("android", "ios", "all")]
    [string]$Platform = "android",
    
    [switch]$Submit,
    [switch]$NoWait
)

Write-Host "📱 TaxBridge Mobile App Build" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

Push-Location mobile

# ═══════════════════════════════════════════════════════════
# 1. PRE-BUILD CHECKS
# ═══════════════════════════════════════════════════════════

Write-Host "`n📋 Pre-Build Checks" -ForegroundColor Yellow

# Check if EAS CLI is installed
Write-Host "  Checking EAS CLI..." -NoNewline
try {
    $easVersion = eas --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓ ($easVersion)" -ForegroundColor Green
    } else {
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "  Installing EAS CLI..." -ForegroundColor Yellow
        npm install -g eas-cli
    }
} catch {
    Write-Host " ✗ (install with: npm install -g eas-cli)" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Check if logged in to Expo
Write-Host "  Checking Expo authentication..." -NoNewline
try {
    $whoami = eas whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓ ($whoami)" -ForegroundColor Green
    } else {
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "  Please log in: eas login" -ForegroundColor Yellow
        Pop-Location
        exit 1
    }
} catch {
    Write-Host " ✗ (run: eas login)" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Verify app.json
Write-Host "  Verifying app.json..." -NoNewline
if (Test-Path "app.json") {
    $appJson = Get-Content "app.json" -Raw | ConvertFrom-Json
    $version = $appJson.expo.version
    $bundleId = $appJson.expo.android.package
    
    Write-Host " ✓" -ForegroundColor Green
    Write-Host "    Version: $version" -ForegroundColor Gray
    Write-Host "    Bundle ID: $bundleId" -ForegroundColor Gray
} else {
    Write-Host " ✗ app.json not found" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Verify eas.json
Write-Host "  Verifying eas.json..." -NoNewline
if (Test-Path "eas.json") {
    $easJson = Get-Content "eas.json" -Raw | ConvertFrom-Json
    if ($easJson.build.$Profile) {
        Write-Host " ✓ (profile '$Profile' found)" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  Profile '$Profile' not found in eas.json" -ForegroundColor Yellow
    }
} else {
    Write-Host " ✗ eas.json not found" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Kotlin/KSP compatibility guard
Write-Host "  Checking Kotlin/KSP compatibility..." -NoNewline
$kotlinVersionApp = $null
$kotlinVersionRoot = $null

# Check app.json expo-build-properties
try {
    $plugins = $appJson.expo.plugins
    foreach ($plugin in $plugins) {
        if ($plugin -is [System.Array] -and $plugin[0] -eq "expo-build-properties") {
            $kotlinVersionApp = $plugin[1].android.kotlinVersion
        }
    }
} catch {}

# Check android/build.gradle ext.kotlinVersion
try {
    $buildGradlePath = Join-Path $mobileDir "android\build.gradle"
    if (Test-Path $buildGradlePath) {
        $buildGradleContent = Get-Content $buildGradlePath -Raw
        if ($buildGradleContent -match "kotlinVersion\s*=\s*['""]([^'""]+)['""]") {
            $kotlinVersionRoot = $matches[1]
        }
    }
} catch {}

# Validate both are set and match
if ($kotlinVersionApp -and $kotlinVersionRoot) {
    if ($kotlinVersionApp -ne $kotlinVersionRoot) {
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "    Kotlin version mismatch:" -ForegroundColor Red
        Write-Host "      app.json: $kotlinVersionApp" -ForegroundColor Yellow
        Write-Host "      android/build.gradle: $kotlinVersionRoot" -ForegroundColor Yellow
        Write-Host "    Both must be identical to avoid KSP conflicts." -ForegroundColor Yellow
        Pop-Location
        exit 1
    }
    if ($kotlinVersionApp -match "^1\.") {
        Write-Host " ✗" -ForegroundColor Red
        Write-Host "    kotlinVersion '$kotlinVersionApp' is NOT supported by KSP." -ForegroundColor Red
        Write-Host "    Supported: 2.0.0 - 2.2.x. Update both app.json and android/build.gradle." -ForegroundColor Yellow
        Pop-Location
        exit 1
    }
    Write-Host " ✓ (Kotlin $kotlinVersionApp)" -ForegroundColor Green
} elseif ($kotlinVersionApp -or $kotlinVersionRoot) {
    Write-Host " ✗" -ForegroundColor Red
    Write-Host "    Kotlin version must be set in BOTH app.json and android/build.gradle." -ForegroundColor Red
    Write-Host "      app.json: $($kotlinVersionApp ?? 'NOT SET')" -ForegroundColor Yellow
    Write-Host "      android/build.gradle: $($kotlinVersionRoot ?? 'NOT SET')" -ForegroundColor Yellow
    Pop-Location
    exit 1
} else {
    Write-Host " ⚠️  (kotlinVersion not set, using Expo default)" -ForegroundColor Yellow
}

# Check node_modules
Write-Host "  Checking dependencies..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " ✓" -ForegroundColor Green
} else {
    Write-Host " ✗ (run: npm install)" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ═══════════════════════════════════════════════════════════
# 2. BUILD
# ═══════════════════════════════════════════════════════════

Write-Host "`n🔧 Build Configuration" -ForegroundColor Yellow
Write-Host "  Profile: $Profile" -ForegroundColor White
Write-Host "  Platform: $Platform" -ForegroundColor White
Write-Host "  Submit: $Submit" -ForegroundColor White

$confirm = Read-Host "`nProceed with build? (y/n)"
if ($confirm -ne "y") {
    Write-Host "  ❌ Build cancelled" -ForegroundColor Red
    Pop-Location
    exit 0
}

Write-Host "`n🔨 Starting Build..." -ForegroundColor Yellow

$buildArgs = @("build", "--platform", $Platform, "--profile", $Profile)

if ($NoWait) {
    $buildArgs += "--no-wait"
}

Write-Host "  Command: eas $($buildArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

& eas @buildArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# ═══════════════════════════════════════════════════════════
# 3. POST-BUILD
# ═══════════════════════════════════════════════════════════

Write-Host "`n✅ Build Started Successfully!" -ForegroundColor Green

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Monitor build: eas build:list" -ForegroundColor White
Write-Host "  2. Download APK/AAB: eas build:download --latest" -ForegroundColor White
Write-Host "  3. Test on device before submission" -ForegroundColor White

if ($Submit) {
    Write-Host "`n📤 Submitting to store..." -ForegroundColor Yellow
    eas submit --platform $Platform --profile $Profile --latest
}

Pop-Location
