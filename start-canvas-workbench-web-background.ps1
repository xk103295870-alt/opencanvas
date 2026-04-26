param(
  [int]$Port = 5173,
  [int]$ApiPort = 8787,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $appDir '.runtime'
$webPidFile = Join-Path $runtimeDir "vite-$Port.pid"
$webLogFile = Join-Path $runtimeDir "vite-$Port.log"
$apiPidFile = Join-Path $runtimeDir "api-$ApiPort.pid"
$apiLogFile = Join-Path $runtimeDir "api-$ApiPort.log"
$appUrl = "http://127.0.0.1:$Port"
$apiHealthUrl = "http://127.0.0.1:$ApiPort/health"

function Test-AppUrl {
  param([string]$Url)
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $resp.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-ApiHealth {
  param([string]$Url)
  try {
    $resp = Invoke-RestMethod -Uri $Url -TimeoutSec 2
    return $resp.ok -eq $true
  } catch {
    return $false
  }
}

function Ensure-RuntimeDir {
  if (-not (Test-Path -LiteralPath $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
  }
}

function Resolve-ListenerPid {
  param([int]$LocalPort)
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    return $null
  }
  return (
    Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Select-Object -First 1
  )
}

function Wait-UntilReady {
  param(
    [scriptblock]$Check,
    [int]$RetryCount = 24,
    [int]$DelayMs = 500
  )
  for ($i = 0; $i -lt $RetryCount; $i++) {
    Start-Sleep -Milliseconds $DelayMs
    if (& $Check) {
      return $true
    }
  }
  return $false
}

Ensure-RuntimeDir

$webRunning = Test-AppUrl -Url $appUrl
$apiRunning = Test-ApiHealth -Url $apiHealthUrl

if ($webRunning -and $apiRunning) {
  Write-Output "Open Canvas already running. Web: $appUrl | API: http://127.0.0.1:$ApiPort"
  if ($OpenBrowser) {
    Start-Process $appUrl | Out-Null
  }
  exit 0
}

if (-not $webRunning) {
  $webCmd = "/c npm run dev -- --host 127.0.0.1 --port $Port --strictPort >> `"$webLogFile`" 2>&1"
  $webProc = Start-Process -FilePath 'cmd.exe' -WorkingDirectory $appDir -ArgumentList $webCmd -WindowStyle Hidden -PassThru
  Set-Content -Path $webPidFile -Value $webProc.Id -Encoding ascii
}

if (-not $apiRunning) {
  $apiCmd = "/c set CANVAS_WORKBENCH_API_HOST=127.0.0.1&& set CANVAS_WORKBENCH_API_PORT=$ApiPort&& npm run api:dev >> `"$apiLogFile`" 2>&1"
  $apiProc = Start-Process -FilePath 'cmd.exe' -WorkingDirectory $appDir -ArgumentList $apiCmd -WindowStyle Hidden -PassThru
  Set-Content -Path $apiPidFile -Value $apiProc.Id -Encoding ascii
}

$webReady = Test-AppUrl -Url $appUrl
$apiReady = Test-ApiHealth -Url $apiHealthUrl

if (-not $webReady) {
  $webReady = Wait-UntilReady -Check { Test-AppUrl -Url $appUrl }
}
if (-not $apiReady) {
  $apiReady = Wait-UntilReady -Check { Test-ApiHealth -Url $apiHealthUrl }
}

if (-not $webReady) {
  Write-Output "Web startup check timed out. Check log: $webLogFile"
  exit 1
}
if (-not $apiReady) {
  Write-Output "API startup check timed out. Check log: $apiLogFile"
  exit 1
}

$webListenerPid = Resolve-ListenerPid -LocalPort $Port
if ($webListenerPid) {
  Set-Content -Path $webPidFile -Value $webListenerPid -Encoding ascii
}
$apiListenerPid = Resolve-ListenerPid -LocalPort $ApiPort
if ($apiListenerPid) {
  Set-Content -Path $apiPidFile -Value $apiListenerPid -Encoding ascii
}

Write-Output "Open Canvas started silently. Web: $appUrl | API: http://127.0.0.1:$ApiPort"
if ($OpenBrowser) {
  Start-Process $appUrl | Out-Null
}
