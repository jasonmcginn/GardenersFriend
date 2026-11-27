# Gardener's Friend - trust this PC's own certificate authority, so the browser opens https://localhost:4749 without a warning.
# The server makes the authority the first time it starts (data\tls\ca.crt). This adds it to the current Windows user's
# Trusted Root store, once (Windows asks to confirm). No admin rights needed. Run by start-gf.bat.
$ErrorActionPreference = 'SilentlyContinue'
$data = if ($env:DATA_DIR) { $env:DATA_DIR } else { Join-Path $PSScriptRoot 'data' }
$ca = Join-Path $data 'tls\ca.crt'
for ($i = 0; $i -lt 60 -and -not (Test-Path $ca); $i++) { Start-Sleep -Seconds 1 }
if (-not (Test-Path $ca)) { Write-Host 'The certificate authority is not there yet. Run this again once Gardener''s Friend has started.'; exit 1 }
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $ca
if (Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }) { exit 0 }
Write-Host 'HTTPS: Windows will ask to install the Gardener''s Friend certificate authority. Choose Yes.'
Import-Certificate -FilePath $ca -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
