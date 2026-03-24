param(
  [string]$RepoUrl = "git+https://github.com/xk103295870-alt/opencanvas.git"
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm is required to install open-canvas."
  exit 1
}

Write-Output "Installing open-canvas from $RepoUrl"
npm install -g $RepoUrl

Write-Output "open-canvas is now available. Try: open-canvas status"
