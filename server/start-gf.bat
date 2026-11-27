@echo off
REM Gardener's Friend - starts the server on this PC (no admin rights, no install).
REM Uses Node.js if it's installed; otherwise the first start downloads portable Node.js into .\node (about 30 MB, once).
REM After that nothing uses the internet: phones sync with this PC over your Wi-Fi.
REM Your data stays in .\data next to this file. Close this window (or run stop-gf.bat) to stop.
setlocal
title Gardener's Friend server
cd /d "%~dp0"

set "NODE_VER=v20.18.1"
set "ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=arm64"
set "NODE=%~dp0node\node.exe"
if exist "%NODE%" goto run
where node >nul 2>&1 && (for /f "tokens=1 delims=v." %%M in ('node -v') do if %%M GEQ 20 (set "NODE=node" & goto run))

echo.
echo Node.js isn't on this PC yet. Downloading the portable version %NODE_VER% (%ARCH%) - once only...
echo No install and no admin rights needed. It goes in: %~dp0node
echo.
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12 } catch {}; $n='node-%NODE_VER%-win-%ARCH%'; $z=Join-Path $env:TEMP 'gf-node.zip'; Invoke-WebRequest -UseBasicParsing ('https://nodejs.org/dist/%NODE_VER%/' + $n + '.zip') -OutFile $z; Expand-Archive $z '%~dp0' -Force; Rename-Item (Join-Path '%~dp0' $n) 'node'; Remove-Item $z -Force"
if not exist "%NODE%" (
  echo.
  echo Couldn't download Node.js automatically. Do it by hand:
  echo   1. In a browser open https://nodejs.org/dist/%NODE_VER%/node-%NODE_VER%-win-%ARCH%.zip
  echo   2. Unzip it, rename the folder inside to  node  and put it here: %~dp0
  echo      so that this file exists: %~dp0node\node.exe
  echo   3. Run this file again.
  echo.
  pause
  exit /b 1
)

:run
if not defined PORT set "PORT=4749"
set "DATA_DIR=%~dp0data"
if not defined GF_HOST_NAME set "GF_HOST_NAME=%COMPUTERNAME%"
echo.
echo Starting Gardener's Friend on port %PORT% ...
echo   On this PC: https://localhost:%PORT%
echo   Phones on the same Wi-Fi: Settings in the app shows the QR codes.
echo   If Windows asks about the firewall, "Allow" on private networks lets phones connect.
echo   To stop: close this window.
echo.
REM HTTPS uses this PC's own certificate: trust it once (Windows asks), then open the app in its own window.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-app.ps1" -Port %PORT%
"%NODE%" server.js
echo.
echo The server stopped. If it says the port is in use, Gardener's Friend is probably already running.
echo To run a second copy on another port:  set PORT=4750  then run this file.
pause
