@echo off
REM Gardener's Friend - get the latest version from GitHub (git pull). Your data folder is never touched.
setlocal
cd /d "%~dp0.."
set "GIT="
where git >nul 2>&1 && set "GIT=git"
if not defined GIT if exist "%USERPROFILE%\PortableGit\cmd\git.exe" set "GIT=%USERPROFILE%\PortableGit\cmd\git.exe"
if not defined GIT for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do if exist "%%D\resources\app\git\cmd\git.exe" set "GIT=%%D\resources\app\git\cmd\git.exe"
if not defined GIT (
  echo Couldn't find git. Install GitHub Desktop or PortableGit, or update from GitHub Desktop: Repository - Pull.
  pause
  exit /b 1
)
echo Getting the latest version...
"%GIT%" pull --ff-only
if errorlevel 1 (echo. & echo The update didn't apply. Discard any changes to the app's files in GitHub Desktop and try again. & pause & exit /b 1)
echo.
echo Updated. Restart the server (close its window, run server\start-gf.bat). Phones offer the new version
echo by themselves next time they sync: Settings - Install and restart.
pause
