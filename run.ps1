param(
    [switch]$NoBrowser,
    [switch]$NoBuild,
    [switch]$ResetData,
    [switch]$OpenArchive
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$appUrl = 'http://localhost:8081'
$archiveUrl = 'http://localhost:8081/history.html'
$healthUrl = 'http://localhost:8080/actuator/health'

function Write-Step([string]$Message) {
    Write-Host "[CascadeTrace] $Message" -ForegroundColor Cyan
}

function Fail([string]$Message) {
    Write-Host "[CascadeTrace] $Message" -ForegroundColor Red
    exit 1
}

function Test-DockerReady {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Test-Url([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Open-CascadeTrace {
    if ($NoBrowser) { return }
    Start-Process $(if ($OpenArchive) { $archiveUrl } else { $appUrl })
}

if ((Test-Url $appUrl) -and (Test-Url $healthUrl) -and -not $ResetData) {
    Write-Host 'CascadeTrace is already running.' -ForegroundColor Green
    Write-Host "Simulator : $appUrl"
    Write-Host "Archive   : $archiveUrl"
    Open-CascadeTrace
    exit 0
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail 'Docker Desktop is required. Install Docker Desktop, then run RUN-CASCADETRACE.bat again.'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Fail 'Docker Compose is not available. Update Docker Desktop, then try again.'
}

if (-not (Test-DockerReady)) {
    $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'

    if (-not (Test-Path $dockerDesktop)) {
        Fail 'Docker Desktop is installed but its engine is not running. Start Docker Desktop and try again.'
    }

    Write-Step 'Starting Docker Desktop...'
    Start-Process $dockerDesktop | Out-Null

    $dockerDeadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 3
        if (Test-DockerReady) { break }
    } while ((Get-Date) -lt $dockerDeadline)

    if (-not (Test-DockerReady)) {
        Fail 'Docker Desktop did not become ready within two minutes.'
    }
}

if ($ResetData) {
    Write-Step 'Resetting local containers and PostgreSQL volume...'
    docker compose down -v --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        Fail 'Could not reset the CascadeTrace Docker environment.'
    }
}

if ($NoBuild) {
    Write-Step 'Starting PostgreSQL, Spring Boot, and React using existing images...'
    docker compose up -d
} else {
    Write-Step 'Building and starting PostgreSQL, Spring Boot, and React...'
    docker compose up --build -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    docker compose ps
    Write-Host ''
    docker compose logs --tail 80
    Fail 'Docker Compose could not start CascadeTrace. Diagnostics are shown above.'
}

Write-Step 'Waiting for PostgreSQL, backend, and frontend readiness...'
$deadline = (Get-Date).AddMinutes(4)
$ready = $false

while ((Get-Date) -lt $deadline) {
    if ((Test-Url $appUrl) -and (Test-Url $healthUrl)) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Host ''
    docker compose ps
    Write-Host ''
    docker compose logs --tail 80
    Fail 'Containers started, but CascadeTrace did not become healthy in time.'
}

Write-Host ''
Write-Host 'CascadeTrace is running.' -ForegroundColor Green
Write-Host "Simulator : $appUrl"
Write-Host "Archive   : $archiveUrl"
Write-Host 'Swagger   : http://localhost:8080/swagger-ui.html'
Write-Host "API health: $healthUrl"
Write-Host ''
Write-Host 'To stop everything, double-click STOP-CASCADETRACE.bat.' -ForegroundColor DarkGray
Write-Host 'Advanced: .\run.ps1 -NoBuild | -OpenArchive | -ResetData | -NoBrowser' -ForegroundColor DarkGray

Open-CascadeTrace
