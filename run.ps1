param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Write-Step([string]$Message) {
    Write-Host "[CascadeTrace] $Message" -ForegroundColor Cyan
}

function Test-DockerReady {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Fail([string]$Message) {
    Write-Host "[CascadeTrace] $Message" -ForegroundColor Red
    exit 1
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

Write-Step 'Building and starting PostgreSQL, Spring Boot, and React...'
docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    Fail 'Docker Compose could not start CascadeTrace. Run "docker compose logs" for details.'
}

Write-Step 'Waiting for the application to become ready...'
$appUrl = 'http://localhost:8081'
$deadline = (Get-Date).AddMinutes(4)
$ready = $false

while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            $ready = $true
            break
        }
    } catch {
        # Containers may still be starting.
    }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Host ''
    docker compose ps
    Fail 'Containers started, but the web application did not become ready in time.'
}

Write-Host ''
Write-Host 'CascadeTrace is running.' -ForegroundColor Green
Write-Host "Simulator : $appUrl"
Write-Host 'Archive   : http://localhost:8081/history.html'
Write-Host 'Swagger   : http://localhost:8080/swagger-ui.html'
Write-Host 'API health: http://localhost:8080/actuator/health'
Write-Host ''
Write-Host 'To stop everything, double-click STOP-CASCADETRACE.bat.' -ForegroundColor DarkGray

if (-not $NoBrowser) {
    Start-Process $appUrl
}
