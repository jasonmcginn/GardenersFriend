# Gardener's Friend - trust this PC's certificate (once), then open the app in its own window (Edge app mode) or the browser.
param([int]$Port = 4749)
& (Join-Path $PSScriptRoot 'trust-ca.ps1')
$u = "https://localhost:$Port"
for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest -UseBasicParsing "$u/health" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 } }
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edge) { Start-Process $edge "--app=$u" } else { Start-Process $u }
