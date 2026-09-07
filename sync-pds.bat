@echo off
setlocal
cd /d "%~dp0"
title PDS Sync

where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo PowerShell is not available.
  pause
  exit /b 1
)

if not exist "%~dp0sync-pds.ps1" (
  echo sync-pds.ps1 was not found in the project root.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-pds.ps1"
exit /b %errorlevel%
