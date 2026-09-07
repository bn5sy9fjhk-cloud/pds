@echo off
cd /d "%~dp0"

echo ========================================
echo PDS Git Sync
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
    echo ERROR: This folder is not a Git repository.
    echo Put this BAT file in the PDS project root folder.
    pause
    exit /b 1
)

rem Only block on tracked/staged changes. Untracked helper files do not stop sync.
git diff --quiet
if errorlevel 1 goto DIRTY

git diff --cached --quiet
if errorlevel 1 goto DIRTY

echo Switching to master...
git checkout master
if errorlevel 1 goto ERROR

echo Fetching latest code from GitHub...
git fetch origin master
if errorlevel 1 goto NETWORK

echo Applying fetched master locally...
git merge --ff-only origin/master
if errorlevel 1 goto ERROR

echo.
echo ========================================
echo PDS is now up to date.
echo ========================================
pause
exit /b 0

:DIRTY
echo.
echo Local tracked changes detected.
echo.
git status --short
echo.
echo Sync stopped to protect your local edits.
echo Commit, stash, or discard tracked changes first.
pause
exit /b 1

:NETWORK
echo.
echo ========================================
echo GITHUB CONNECTION FAILED
echo ========================================
echo GitHub could not be reached. Try again later or check your network.
pause
exit /b 1

:ERROR
echo.
echo ========================================
echo UPDATE FAILED
echo ========================================
echo Check Git branch or local repository status.
pause
exit /b 1
