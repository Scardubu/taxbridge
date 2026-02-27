Set-Location "c:\Users\USR\Documents\taxbridge"

# Stage new files
$newFiles = @(
  "admin-dashboard/components/AIInsightsPanel.tsx",
  "backend/src/__tests__/tax-intelligence.integration.test.ts",
  "backend/src/queues/nrs-queue.ts",
  "backend/src/routes/nrs-queue-routes.ts",
  "backend/src/services/tax-intelligence.ts",
  "docker-compose.yml",
  "mobile/__tests__/taxEngine.test.ts",
  "mobile/src/api/client.ts",
  "mobile/src/components/DeadlineWidget.tsx",
  "mobile/src/components/education/TaxEducation.tsx",
  "mobile/src/design-system/components.tsx",
  "mobile/src/design-system/tokens.ts",
  "mobile/src/hooks/useOfflineSync.tsx",
  "mobile/src/screens/auth/AuthScreens.tsx",
  "mobile/src/screens/filing/CreateInvoiceScreen.tsx",
  "mobile/src/screens/tabs/DashboardScreen.tsx",
  "mobile/src/screens/tabs/ExpensesScreen.tsx",
  "mobile/src/screens/tabs/InsightsScreen.tsx",
  "mobile/src/screens/tabs/ProfileScreen.tsx",
  "mobile/src/screens/tabs/ScanReceiptScreen.tsx",
  "mobile/src/screens/tabs/TaxToolsScreen.tsx",
  "mobile/src/store/authStore.ts",
  "mobile/src/store/queries.ts",
  "packages/contracts/src/nta2025.ts"
)

foreach ($f in $newFiles) {
  git add $f
}

# Stage modified files
git add -u

# Check status
$status = git status --short 2>&1
Write-Host "=== STATUS ===" 
$status | ForEach-Object { Write-Host $_ }

# Commit
git commit -F ".git/COMMIT_EDITMSG_v310.txt"
Write-Host "COMMIT_EXIT:$LASTEXITCODE"
