@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

title PDS Sync
echo ========================================
echo PDS Git Sync - Reliable Mode
echo ========================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed or not in PATH.
    pause
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: This BAT must be placed in the PDS project root.
    pause
    exit /b 1
)

rem Protect tracked local edits. Untracked helper files are allowed.
git diff --quiet
if errorlevel 1 goto DIRTY
git diff --cached --quiet
if errorlevel 1 goto DIRTY

echo [1/4] Checking branch...
git checkout master >nul 2>&1
if errorlevel 1 goto ERROR

echo [2/4] Checking GitHub remote...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ERROR: Remote "origin" is missing.
    pause
    exit /b 1
)

echo [3/4] Downloading latest code from GitHub...
set RETRY=0
:FETCH_RETRY
set /a RETRY+=1
echo Attempt !RETRY! of 5...

rem HTTP/1.1 is more reliable on some Windows networks/proxies.
rem Disable Git low-speed abort so temporary network stalls do not fail immediately.
git -c http.version=HTTP/1.1 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 fetch --prune origin master
if not errorlevel 1 goto FETCH_OK

if !RETRY! GEQ 5 goto NETWORK
echo.
echo Connection failed. Retrying in 4 seconds...
timeout /t 4 /nobreak >nul
goto FETCH_RETRY

:FETCH_OK
echo.
echo [4/4] Applying downloaded master...
git merge --ff-only origin/master
if errorlevel 1 goto ERROR

echo.
echo ========================================
echo SUCCESS: PDS is now up to date.
echo ========================================
git log -1 --pretty=format:"Latest commit: %%h  %%s"
echo.
echo.
pause
exit /b 0

:DIRTY
echo.
echo ========================================
echo LOCAL CHANGES DETECTED
echo ========================================
echo The sync was stopped to protect your tracked edits.
echo.
git status --short
echo.
echo Commit, stash, or discard tracked changes and run this BAT again.
pause
exit /b 1

:NETWORK
echo.
echo ========================================
echo GITHUB CONNECTION FAILED AFTER 5 TRIES
echo ========================================
echo Your project was NOT changed.
echo.
echo Common causes:
echo   1. GitHub connection is unstable.
echo   2. VPN/proxy route is unstable.
echo   3. github.com:443 is temporarily unreachable.
echo.
echo Wait a moment and double-click this BAT again.
pause
exit /b 1

:ERROR
echo.
echo ========================================
echo UPDATE FAILED
echo ========================================
echo Your project was not force-overwritten.
echo Run "git status" if you need more details.
pause
exit /b 1
