# Gardener's Friend server

The small server that runs on your PC. It serves the app to this PC and syncs it with your phone and other computers
over your own Wi-Fi. No internet, no account, no cloud.

| File | What it does |
|---|---|
| `start-gf.bat` | Starts the server and opens the app. First run gets portable Node.js if the PC doesn't have it. |
| `stop-gf.bat` | Stops it. Data is kept. |
| `get-phone-app.bat` | Downloads the phone app once, so this PC can hand it to phones (Settings shows a QR code). |
| `update-gf.bat` | Gets the latest version with git. |
| `open-firewall.bat` | Only if phones can't connect: allows port 4749 on private networks (needs admin once). |
| `trust-ca.ps1`, `open-app.ps1` | Make this PC's browser trust the server's own certificate, then open the app in its own window (run by start-gf.bat). |
| `server.js`, `bundle.js` | The server. Node.js 20+, no add-on libraries. |
| `data\` | Your data: `db.json`, a daily copy in `backups\` (last 30), certificates in `tls\`. Never in git. |

Settings: `PORT` (default 4749), `DATA_DIR`, `GF_DAILY_KEEP` (daily copies kept, default 30), `GF_TLS=0` (plain http, testing only).

See `docs/PHONE-AND-SYNC.md` for how pairing and sync work.
