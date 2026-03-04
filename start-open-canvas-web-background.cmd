@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-open-canvas-web-background.ps1" -Port 5173 -ApiPort 8787 -OpenBrowser
