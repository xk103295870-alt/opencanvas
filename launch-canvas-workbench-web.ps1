$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $scriptDir 'start-canvas-workbench-web-background.ps1'

powershell -NoProfile -ExecutionPolicy Bypass -File $startScript -Port 5173 -ApiPort 8799 -OpenBrowser
