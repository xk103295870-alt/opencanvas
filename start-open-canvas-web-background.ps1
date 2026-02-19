param(
  [int]$Port = 5173,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $appDir '.runtime'
$pidFile = Join-Path $runtimeDir "vite-$Port.pid"
$logFile = Join-Path $runtimeDir "vite-$Port.log"
$appUrl = "http://127.0.0.1:$Port"

function Test-AppUrl {
  param([string]$Url)
  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $resp.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Ensure-RuntimeDir {
  if (-not (Test-Path -LiteralPath $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
  }
}

if (Test-AppUrl -Url $appUrl) {
  Write-Output "Open Canvas already running on $appUrl"
  if ($OpenBrowser) {
    Start-Process $appUrl | Out-Null
  }
  exit 0
}

Ensure-RuntimeDir

$cmd = "/c npm run dev -- --host 127.0.0.1 --port $Port --strictPort >> `"$logFile`" 2>&1"
$proc = Start-Process -FilePath 'cmd.exe' -WorkingDirectory $appDir -ArgumentList $cmd -WindowStyle Hidden -PassThru
Set-Content -Path $pidFile -Value $proc.Id -Encoding ascii

$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-AppUrl -Url $appUrl) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  Write-Output "Open Canvas startup check timed out. Check log: $logFile"
  exit 1
}

$listenerPid = $null
if (Get-Command Get-NetTCPConnection) {
  $listenerPid = Get-NetTCPConnection -LocalPort $Port -State Listen |
    Select-Object -ExpandProperty OwningProcess -Unique |
    Select-Object -First 1
}
if ($listenerPid) {
  Set-Content -Path $pidFile -Value $listenerPid -Encoding ascii
}

Write-Output "Open Canvas started silently at $appUrl"
if ($OpenBrowser) {
  Start-Process $appUrl | Out-Null
}
