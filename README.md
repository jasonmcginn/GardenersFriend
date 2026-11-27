# Gardener's Friend

A web-based manager for growing plants and running a garden: feed and water schedules, nutrients, pH and EC,
soil, lights, inventory, grow progress, yield and history.

## Run it

Open `app/index.html` in Chrome, Edge or Firefox. No install, no build, no server.

First time: go to **Backup → Load sample data** to see it working, or start adding your own zones and plants.

Your data stays in this browser (localStorage). Use **Backup → Export** regularly; the file can be imported
on another computer or browser.

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
| Backup | Export / import JSON, sample data, clear all |

See `docs/` for the feature plan, data model, architecture options and roadmap.

## License

GNU GPL v3, see `LICENSE`.

## Privacy

The app keeps all your data in your own browser; nothing is sent anywhere and none of it is stored in this
repository. Backup files you export (`gardeners-friend-backup-*.json`) are ignored by git so they don't end up
in this public repo by accident. The sample data is made up.
