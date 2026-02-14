# FILE: scripts/0-Analyze-Repository.ps1
# PURPOSE: Understand current codebase structure and identify critical paths

Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  TaxBridge Repository Analysis" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

# Verify branch structure
Write-Host "`n🌿 Current Branch Information" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
$currentBranch = git branch --show-current
Write-Host "  Active Branch: $currentBranch" -ForegroundColor White
git branch -a | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

# Check repository status
Write-Host "`n📊 Repository Status" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
$gitStatus = git status --short
if ($gitStatus) {
    Write-Host "  ⚠️  Uncommitted changes detected:" -ForegroundColor Yellow
    $gitStatus | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  ✓ Working tree clean" -ForegroundColor Green
}

# Analyze directory structure
Write-Host "`n🏗️  Repository Structure" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray

$structure = @{
    "Mobile App" = "mobile"
    "Backend API" = "backend"
    "Admin Dashboard" = "admin-dashboard"
    "Shared Packages" = "packages"
    "Documentation" = "docs"
    "Infrastructure" = "infra"
}

foreach ($item in $structure.GetEnumerator()) {
    if (Test-Path $item.Value) {
        Write-Host "  ✓ $($item.Key): $($item.Value)/" -ForegroundColor Green
        
        $tsFiles = (Get-ChildItem -Path $item.Value -Filter "*.ts" -Recurse -ErrorAction SilentlyContinue).Count
        $tsxFiles = (Get-ChildItem -Path $item.Value -Filter "*.tsx" -Recurse -ErrorAction SilentlyContinue).Count
        Write-Host "    Files: $tsFiles .ts, $tsxFiles .tsx" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ $($item.Key): NOT FOUND" -ForegroundColor Red
    }
}

# Detect package manager
Write-Host "`n📦 Package Manager Detection" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray

if (Test-Path "yarn.lock") {
    Write-Host "  ✓ Detected: Yarn" -ForegroundColor Green
    $env:PKG_MANAGER = "yarn"
} elseif (Test-Path "pnpm-lock.yaml") {
    Write-Host "  ✓ Detected: pnpm" -ForegroundColor Green
    $env:PKG_MANAGER = "pnpm"
} elseif (Test-Path "package-lock.json") {
    Write-Host "  ✓ Detected: npm" -ForegroundColor Green
    $env:PKG_MANAGER = "npm"
} else {
    Write-Host "  ⚠️  No lock file found, defaulting to npm" -ForegroundColor Yellow
    $env:PKG_MANAGER = "npm"
}

# Check Node.js version
Write-Host "`n🟢 Node.js Environment" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray
$nodeVersion = node --version
Write-Host "  Node.js: $nodeVersion" -ForegroundColor White

$requiredNode = "v18.0.0"
if ([version]$nodeVersion.Substring(1) -lt [version]$requiredNode.Substring(1)) {
    Write-Host "  ⚠️  Node.js $requiredNode or higher recommended" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Version meets requirements" -ForegroundColor Green
}

# Analyze critical files
Write-Host "`n📄 Critical Files Check" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray

$criticalFiles = @(
    @{ Path = "mobile/App.tsx"; Name = "Mobile App Entry" },
    @{ Path = "mobile/app.json"; Name = "Expo Configuration" },
    @{ Path = "mobile/eas.json"; Name = "EAS Build Config" },
    @{ Path = "backend/src/server.ts"; Name = "Backend Server" },
    @{ Path = "backend/prisma/schema.prisma"; Name = "Database Schema" },
    @{ Path = "admin-dashboard/app/layout.tsx"; Name = "Admin Layout" },
    @{ Path = "render.yaml"; Name = "Render Deploy Config" }
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file.Path) {
        $size = (Get-Item $file.Path).Length
        Write-Host "  ✓ $($file.Name): $($file.Path) ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $($file.Name): $($file.Path) MISSING" -ForegroundColor Yellow
    }
}

# Check mobile crash protection
Write-Host "`n🛡️  Mobile Crash Protection" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray

$crashProtectionFiles = @(
    @{ Path = "mobile/src/components/ErrorBoundary.tsx"; Name = "ErrorBoundary" },
    @{ Path = "mobile/src/screens/SplashScreen.tsx"; Name = "SplashScreen (Boot Orchestrator)" },
    @{ Path = "mobile/src/screens/OnboardingScreen.tsx"; Name = "OnboardingScreen" },
    @{ Path = "mobile/src/components/onboarding/WelcomeStep.tsx"; Name = "WelcomeStep (CTA)" },
    @{ Path = "mobile/src/services/sentry.ts"; Name = "Sentry Error Tracking" },
    @{ Path = "mobile/src/services/analytics.ts"; Name = "Analytics Service" }
)

foreach ($file in $crashProtectionFiles) {
    if (Test-Path $file.Path) {
        Write-Host "  ✓ $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($file.Name) MISSING" -ForegroundColor Red
    }
}

# Android build compatibility
Write-Host "`n🤖 Android Build Compatibility" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Gray

if (Test-Path "mobile/app.json") {
    try {
        $mobileAppJson = Get-Content "mobile/app.json" -Raw | ConvertFrom-Json
        $kotlinVer = $null
        foreach ($plugin in $mobileAppJson.expo.plugins) {
            if ($plugin -is [System.Array] -and $plugin[0] -eq "expo-build-properties") {
                $kotlinVer = $plugin[1].android.kotlinVersion
            }
        }
        if ($kotlinVer) {
            Write-Host "  Kotlin Version: $kotlinVer" -ForegroundColor White
            if ($kotlinVer -match "^1\.") {
                Write-Host "  ✗ KSP incompatible! Must be 2.0.0+. Update app.json." -ForegroundColor Red
            } else {
                Write-Host "  ✓ KSP compatible" -ForegroundColor Green
            }
        } else {
            Write-Host "  kotlinVersion: not set (Expo default)" -ForegroundColor Gray
        }

        $expoSdk = $mobileAppJson.expo.plugins | ForEach-Object { $_ } | Out-Null
        $rnVersion = (Get-Content "mobile/package.json" -Raw | ConvertFrom-Json).dependencies.'react-native'
        $expoVersion = (Get-Content "mobile/package.json" -Raw | ConvertFrom-Json).dependencies.expo
        Write-Host "  Expo SDK: $expoVersion" -ForegroundColor White
        Write-Host "  React Native: $rnVersion" -ForegroundColor White
    } catch {
        Write-Host "  ⚠️  Could not parse mobile/app.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  mobile/app.json not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Analysis Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "  1. Run: .\scripts\1-Install-Dependencies.ps1" -ForegroundColor White
Write-Host "  2. Run: .\scripts\7-Post-Deployment-Smoke-Tests.ps1" -ForegroundColor White
Write-Host "  3. Run: .\scripts\8-Build-Mobile-App.ps1" -ForegroundColor White
