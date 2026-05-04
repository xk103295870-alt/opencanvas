@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-canvas-workbench-web-background.ps1" -Port 5173 -ApiPort 8799 -OpenBrowser
