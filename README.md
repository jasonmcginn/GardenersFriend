# Gardener's Friend

A web-based manager for growing plants and running a garden: feed and water schedules, nutrients, pH and EC,
soil, lights, inventory, grow progress, yield and history.

## Run it

**On your PC (with phone sync):** double-click `server\start-gf.bat`. It opens the app in its own window. Then
**Settings › Phones and computers** shows QR codes to install the phone app and pair it. Everything stays on your own
Wi-Fi — no internet, no account. See [docs/PHONE-AND-SYNC.md](docs/PHONE-AND-SYNC.md).

**Just trying it:** open `app/index.html` in a browser. It works fully, but saves only in that browser.

First time: **Settings › Load sample data** shows it working.

## What's in it

| Page | What it does |
|---|---|
| Dashboard | What needs water or feed today, low stock, lamps near end of life, recent activity |
| Plants | Every plant, its zone, stage, schedule and watering/feeding interval; detail page with timeline and pH/EC chart |
| Zones & beds | Tents, rooms, greenhouses, raised beds, containers |
| Feed schedules | A grid of growth stages × nutrients in ml per litre, with pH and EC targets |
| Calculator | Pick a schedule and stage, enter reservoir litres, get ml of each nutrient; log the feed and deduct stock |
| History | Every log entry, filterable by plant and type, with a pH/EC trend chart |
| Inventory | Nutrients, bulbs, soil, amendments, seeds, equipment; flags low stock |
| Lights | Fixtures per zone, hours per day, hours used, lamp-life %, daily light integral |
| Soil | Soil/media mixes, soil test results, amendments applied per bed |
| Yield | Harvests, wet/dry weight, totals per crop, grams per watt |
| Settings | Sync status, phones and computers (install, pair, remove), app updates, backup / restore |

See `docs/` for the feature plan, data model, architecture options and roadmap.

## License

GNU GPL v3, see `LICENSE`.

## Privacy

Your data lives on your PC (`server\data`) and on your paired devices. Nothing is sent to the internet, and none of it is
stored in this repository. Backup files you export (`gardeners-friend-backup-*.json`) are ignored by git so they don't end up
in this public repo by accident. The sample data is made up.
