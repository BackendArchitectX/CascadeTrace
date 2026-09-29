$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

$failures = 0

function Test-Step([string]$Label, [scriptblock]$Check) {
    try {
        $ok = & $Check
        if ($ok) {
            Write-Host "[PASS] $Label" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] $Label" -ForegroundColor Red
            $script:failures++
        }
    } catch {
        Write-Host "[FAIL] $Label - $($_.Exception.Message)" -ForegroundColor Red
        $script:failures++
    }
}

Test-Step 'Docker CLI available' { return $null -ne (Get-Command docker -ErrorAction SilentlyContinue) }
Test-Step 'Docker Compose v2 available' {
    docker compose version *> $null
    return $LASTEXITCODE -eq 0
}
Test-Step 'Docker daemon reachable' {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}
Test-Step 'Compose file valid' {
    docker compose config --quiet *> $null
    return $LASTEXITCODE -eq 0
}

try {
    $backend = Invoke-WebRequest -Uri 'http://localhost:8080/actuator/health' -UseBasicParsing -TimeoutSec 2
    Write-Host "[PASS] Backend health endpoint reachable ($($backend.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host '[INFO] Backend is not currently running.' -ForegroundColor DarkGray
}

try {
    $frontend = Invoke-WebRequest -Uri 'http://localhost:8081' -UseBasicParsing -TimeoutSec 2
    Write-Host "[PASS] Frontend endpoint reachable ($($frontend.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host '[INFO] Frontend is not currently running.' -ForegroundColor DarkGray
}

Write-Host ''
if ($failures -gt 0) {
    Write-Host "CascadeTrace doctor found $failures blocking issue(s)." -ForegroundColor Red
    exit 1
}

Write-Host 'CascadeTrace environment is ready. Double-click RUN-CASCADETRACE.bat.' -ForegroundColor Green
exit 0
