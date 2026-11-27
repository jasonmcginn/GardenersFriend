@echo off
REM Gardener's Friend - downloads the latest phone app (GardenersFriend.apk) from GitHub into server\downloads, once.
REM After that this PC serves it to phones over Wi-Fi: Settings - Phones and computers shows its QR code.
setlocal
cd /d "%~dp0"
if not exist downloads mkdir downloads
echo Downloading the phone app...
powershell -NoProfile -Command "$ErrorActionPreference='Stop'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12 } catch {}; Invoke-WebRequest -UseBasicParsing 'https://github.com/jasonmcginn/GardenersFriend/releases/download/phone-latest/GardenersFriend.apk' -OutFile '%~dp0downloads\GardenersFriend.apk'"
if exist "%~dp0downloads\GardenersFriend.apk" (echo Done. Open Settings in the app for the QR code.) else (echo Couldn't download it. Get GardenersFriend.apk from the repository's Releases page and put it in %~dp0downloads)
pause
