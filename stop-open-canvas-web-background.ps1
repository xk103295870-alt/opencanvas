param(
  [int]$Port = 5173,
  [int]$ApiPort = 8787
)

$ErrorActionPreference = 'SilentlyContinue'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $appDir '.runtime'
$webPidFile = Join-Path $runtimeDir "vite-$Port.pid"
$apiPidFile = Join-Path $runtimeDir "api-$ApiPort.pid"
$stoppedAny = $false

function Stop-ByPidFile {
  param([string]$PidFilePath)

  if (-not (Test-Path -LiteralPath $PidFilePath)) {
    return $false
  }

  $pidText = Get-Content -Path $PidFilePath -Raw
  Remove-Item -Path $PidFilePath -Force

  [int]$processId = 0
  if (-not [int]::TryParse(($pidText.Trim()), [ref]$processId)) {
    return $false
  }
  if ($processId -le 0) {
    return $false
  }

  $proc = Get-Process -Id $processId
  if ($proc) {
    Stop-Process -Id $processId -Force
    return $true
  }
  return $false
}

function Stop-ByPort {
  param([int]$LocalPort)
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    return $false
  }
  $stopped = $false
  $listeners = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($ownerProcessId in $listeners) {
    if ($ownerProcessId -and $ownerProcessId -gt 0) {
      Stop-Process -Id $ownerProcessId -Force
      $stopped = $true
    }
  }
  return $stopped
}

$stoppedAny = (Stop-ByPidFile -PidFilePath $webPidFile) -or $stoppedAny
$stoppedAny = (Stop-ByPidFile -PidFilePath $apiPidFile) -or $stoppedAny

$stoppedAny = (Stop-ByPort -LocalPort $Port) -or $stoppedAny
$stoppedAny = (Stop-ByPort -LocalPort $ApiPort) -or $stoppedAny

if ($stoppedAny) {
  Write-Output "Open Canvas background services stopped (web:$Port api:$ApiPort)."
} else {
  Write-Output "No running Open Canvas background services found (web:$Port api:$ApiPort)."
}
