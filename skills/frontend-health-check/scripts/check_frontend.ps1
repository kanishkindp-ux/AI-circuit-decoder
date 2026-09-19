<#
.SYNOPSIS
    Runs frontend health checks (lint + dry-run build).

.PARAMETER LintOnly
    Only run ESLint, skip the build step.

.PARAMETER BuildOnly
    Only run the Vite production build, skip lint.

.EXAMPLE
    .\check_frontend.ps1
    .\check_frontend.ps1 -LintOnly
    .\check_frontend.ps1 -BuildOnly
#>
param(
    [switch]$LintOnly,
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
if (-not (Test-Path (Join-Path $RepoRoot "frontend"))) {
    $RepoRoot = Get-Location
}
$FrontendDir = Join-Path $RepoRoot "frontend"

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Error "node_modules not found. Run: cd frontend && npm install"
    exit 1
}

$exitCode = 0

Write-Host ""
Write-Host "=== Frontend Health Check ===" -ForegroundColor Cyan
Write-Host "  Directory: $FrontendDir"
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

Push-Location $FrontendDir
try {
    # --- Lint ---
    if (-not $BuildOnly) {
        Write-Host "[STEP] Running ESLint..." -ForegroundColor Yellow
        npm run lint 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[PASS] Lint — No errors found" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Lint — ESLint reported violations (exit code $LASTEXITCODE)" -ForegroundColor Red
            $exitCode = 1
        }
        Write-Host ""
    }

    # --- Build ---
    if (-not $LintOnly) {
        Write-Host "[STEP] Running Vite production build..." -ForegroundColor Yellow
        npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[PASS] Build — Production bundle compiled successfully" -ForegroundColor Green
            # Clean up the dist folder to keep it a dry run
            $distDir = Join-Path $FrontendDir "dist"
            if (Test-Path $distDir) {
                Remove-Item -Recurse -Force $distDir
                Write-Host "       (cleaned up dist/ — this was a dry-run)" -ForegroundColor DarkGray
            }
        } else {
            Write-Host "[FAIL] Build — Vite build failed (exit code $LASTEXITCODE)" -ForegroundColor Red
            $exitCode = 1
        }
        Write-Host ""
    }

    # --- Summary ---
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "=== RESULT: ALL CHECKS PASSED ===" -ForegroundColor Green
    } else {
        Write-Host "=== RESULT: SOME CHECKS FAILED ===" -ForegroundColor Red
    }
} finally {
    Pop-Location
}

exit $exitCode
