# Architecture and options

## Decided (Nov 27, 2026): PC server + phone app, synced over Wi-Fi

Like Field Service Ops: a small Node server on the PC is the hub; the phone app (Android, Capacitor) and any browser keep
their own copy and sync with it. Entirely offline: no cloud, no account. Details in [PHONE-AND-SYNC.md](PHONE-AND-SYNC.md).
The options below are kept for reference.

## Before that: local-first, no build

Plain HTML, CSS and JavaScript. Runs from the file system. Data in localStorage, JSON backup.
Why: zero setup, nothing to host, fast to change while the feature set settles.

Limits: one browser per data set, ~5 MB storage, no photos at scale, no reminders when the page is closed.

The seam for growing out of it is `app/js/store.js`: every page calls `GF.store.all/get/save/remove`.
Replace that file with an adapter that talks to an API (or IndexedDB) and the pages don't change.

## Options for the next step

| Option | What it is | Good for | Cost / effort |
|---|---|---|---|
| **A. PWA + IndexedDB** (recommended next) | Same app, installable on phone and PC, works offline, photos stored locally | Using it in the garden on a phone; photos | Low; still one device unless you export/import |
| **B. Small self-hosted backend** | Node (Express) or Python (FastAPI) + SQLite, run on a home PC/NAS/Raspberry Pi | Multi-device on home Wi-Fi, sensor ingestion later, full control of data | Medium; you run a little server |
| **C. Hosted backend-as-a-service** | Supabase (Postgres + auth + storage) or Firebase | Access anywhere, accounts, sharing with a friend, push reminders | Medium; free tiers usually enough for one grower; data with a provider |

Suggested path: **A now-ish → B or C when multi-device sync matters.** If sensors (Home Assistant, MQTT) are
likely, lean B, since it sits on the same network as the hardware.

## Front-end framework?

Not yet. If the UI grows past ~15 pages or needs rich interactivity (drag-and-drop bed planner), move to
Vite + a light framework (Svelte, Vue or React) and keep `schema.js` as the single source of field definitions.
