$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $scriptDir 'start-open-canvas-web-background.ps1'

powershell -NoProfile -ExecutionPolicy Bypass -File $startScript -Port 5173 -ApiPort 8787 -OpenBrowser
