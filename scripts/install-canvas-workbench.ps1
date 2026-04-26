param(
  [string]$RepoUrl = "git+https://github.com/xk103295870-alt/opencanvas.git"
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required to install canvas-workbench."
  exit 1
}

Write-Output "Installing canvas-workbench from $RepoUrl"
npm install -g $RepoUrl

Write-Output "canvas-workbench is now available. Try: canvas-workbench status"
