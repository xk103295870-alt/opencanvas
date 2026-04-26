#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git+https://github.com/xk103295870-alt/opencanvas.git}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install canvas-workbench." >&2
  exit 1
fi

echo "Installing canvas-workbench from $REPO_URL"
npm install -g "$REPO_URL"

echo "canvas-workbench is now available. Try: canvas-workbench status"
