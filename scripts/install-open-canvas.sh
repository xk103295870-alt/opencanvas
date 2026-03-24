#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git+https://github.com/xk103295870-alt/opencanvas.git}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install open-canvas." >&2
  exit 1
fi

echo "Installing open-canvas from $REPO_URL"
npm install -g "$REPO_URL"

echo "open-canvas is now available. Try: open-canvas status"
