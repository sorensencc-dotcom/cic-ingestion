#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

Write-Host "Running Phase 1 Contract Gate..."

# Read shared keyword list
$keywords = @(Get-Content .github/phase-1-keywords.txt | Where-Object { $_ -notmatch "^#" })

# Reject SPL keywords
$stagedFiles = git diff --cached --name-only
foreach ($file in $stagedFiles) {
  $content = Get-Content $file -Raw
  foreach ($keyword in $keywords) {
    if ($content -match $keyword) {
      Write-Host "❌ Commit blocked: SPL/Phase 2/3 keyword '$keyword' detected in $file"
      exit 1
    }
  }
}

# Reject undeclared files
$allowedPatterns = @(
  "^cic-os/src/core/(ledger|maal)/",
  "^cic-ingestion/src/orchestrator/",
  "^postgres/ledgers/"
)

foreach ($file in $stagedFiles) {
  if ($file -match "^(cic-os|cic-ingestion|postgres)") {
    $isAllowed = $false
    foreach ($pattern in $allowedPatterns) {
      if ($file -match $pattern) {
        $isAllowed = $true
        break
      }
    }
    if (-not $isAllowed) {
      Write-Host "❌ Commit blocked: File not in Phase 1 contract: $file"
      exit 1
    }
  }
}

Write-Host "✓ Phase 1 gate passed. Committing..."
