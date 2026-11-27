# Gardener's Friend phone app (Android)

The whole app packaged for Android. It keeps its own copy of your data, works with no network, and syncs with the PC
when they're on the same Wi-Fi. Same design as the Field Service Ops phone app.

- **Get it:** on the PC run `server\get-phone-app.bat` once, then scan the QR code in **Settings › Phones and computers**.
  (It comes from this repository's **phone-latest** release, built by `.github/workflows/phone-app.yml` on every change.)
- **Pair:** in the phone app, **Settings › Scan the PC's QR code**, then **Accept** on the PC. Or type the PC's address and
  compare the security code.
- **Sync:** by itself when something changes and every 30 seconds while the app is open and the PC is reachable.
  If the PC's address changes (another Wi-Fi), the phone tries the PC's other addresses, but only connects to one with the
  same security code.
- **Updates:** when the PC runs a newer version of the app, the phone offers **Install and restart** (Settings). A new APK is
  only needed when the phone's native part changes.

## Signing (once)

Android only installs an update over the app if both are signed with the same key. GitHub Actions signs with two secrets
(repository **Settings › Secrets and variables › Actions**):

- `GF_SIGNING_PFX`: the key file (PKCS#12), base64. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("gf-signing.pfx")) | Set-Clipboard`
- `GF_SIGNING_PASS`: its password.

You can reuse the Field Service Ops key, or make a new one:
`keytool -genkeypair -keystore gf-signing.pfx -storetype PKCS12 -alias gf -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Gardener's Friend"`.
Keep the file and password in your password manager, never in the repository. Optionally set the repository variable
`GF_SIGNING_CERT_SHA256` to the certificate's SHA-256 (the build prints it) so a wrong key stops the build.

## Build by hand

`npm install`, `node build-www.js`, `npx cap add android`, copy `android-src` into `android/app/src/main` (see the workflow),
`npx cap sync android`, then build in Android Studio.
