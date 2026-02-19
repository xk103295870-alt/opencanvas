param(
  [int]$Port = 5173
)

$ErrorActionPreference = 'SilentlyContinue'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $appDir '.runtime'
$pidFile = Join-Path $runtimeDir "vite-$Port.pid"
$stopped = $false

if (Test-Path -LiteralPath $pidFile) {
  $pidText = Get-Content -Path $pidFile -Raw
  $pid = 0
  if ([int]::TryParse(($pidText.Trim()), [ref]$pid) -and $pid -gt 0) {
    $proc = Get-Process -Id $pid
    if ($proc) {
      Stop-Process -Id $pid -Force
      $stopped = $true
    }
  }
  Remove-Item -Path $pidFile -Force
}

if (Get-Command Get-NetTCPConnection) {
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($ownerPid in $listeners) {
    if ($ownerPid -and $ownerPid -gt 0) {
      Stop-Process -Id $ownerPid -Force
      $stopped = $true
    }
  }
}

if ($stopped) {
  Write-Output "Open Canvas background service stopped (port $Port)."
} else {
  Write-Output "No running Open Canvas background service found on port $Port."
}

