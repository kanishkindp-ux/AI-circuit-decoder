<#
.SYNOPSIS
    Launches the FastAPI development server.

.PARAMETER Port
    The port for uvicorn to listen on. Default: 8000.

.PARAMETER NoReload
    When specified, disables uvicorn's --reload flag.

.EXAMPLE
    .\start_server.ps1
    .\start_server.ps1 -Port 8080
    .\start_server.ps1 -Port 3001 -NoReload
#>
param(
    [int]$Port = 8000,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
# Fallback: if the script is invoked from repo root, detect backend/ beside us
if (-not (Test-Path (Join-Path $RepoRoot "backend"))) {
    $RepoRoot = Get-Location
}
$BackendDir = Join-Path $RepoRoot "backend"
$VenvPython = Join-Path $BackendDir "venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual environment not found at $VenvPython. Run: python -m venv backend\venv"
    exit 1
}

# Build uvicorn args
$uvicornArgs = @("main:app", "--host", "0.0.0.0", "--port", $Port.ToString())
if (-not $NoReload) {
    $uvicornArgs += "--reload"
}

Write-Host ""
Write-Host "=== FastAPI Dev Runner ===" -ForegroundColor Cyan
Write-Host "  Port   : $Port"
Write-Host "  Reload : $(-not $NoReload)"
Write-Host "  Dir    : $BackendDir"
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Launch uvicorn via the venv python
Push-Location $BackendDir
try {
    & $VenvPython -m uvicorn @uvicornArgs
} finally {
    Pop-Location
}
