@echo off
REM Stops the server started by start-gf.bat (same as closing its window). Your data is kept.
taskkill /FI "WINDOWTITLE eq Gardener's Friend server*" /T /F >nul 2>&1
if errorlevel 1 (echo The server wasn't running.) else (echo Gardener's Friend stopped.)
timeout /t 3 >nul
