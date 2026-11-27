@echo off
REM Run as administrator only if phones can't reach Gardener's Friend over Wi-Fi (Windows didn't ask, or "Cancel" was chosen).
netsh advfirewall firewall add rule name="Gardener's Friend 4749" dir=in action=allow protocol=TCP localport=4749 profile=private
pause
