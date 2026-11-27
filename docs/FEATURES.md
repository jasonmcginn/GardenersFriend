# Features and options

## What existing apps do well (and what to borrow)

| Kind of app | Examples | Strengths worth borrowing | Gaps for us |
|---|---|---|---|
| Grow diaries | GrowDiaries, Grow Buddy-style journals | Per-plant week-by-week journal, photos, nutrient calculator, stage tracking | Weak on inventory, soil and outdoor gardens |
| Commercial grow platforms | Growlink, AROYA, TrolMaster | Sensor dashboards (pH, EC, VPD, substrate moisture), automation, batch/yield reporting | Expensive, hardware-tied, overkill for one grower |
| Houseplant care | Planta, Greg | Smart watering reminders, simple "what needs doing today" home screen | No nutrients, pH, yield |
| Garden planners | Seedtime, GrowVeg / Garden Planner | Bed layouts, planting calendars by frost date, succession planting, crop rotation | Little feeding/pH/indoor support |
| Spreadsheets | Most serious growers | Total flexibility | No reminders, no charts without effort, easy to break |

Our angle: one place that covers **indoor and outdoor**, the **chemistry** (feed, pH, EC, soil), the **stuff**
(inventory, lights) and the **results** (yield, history) — without hardware lock-in.

## Feature catalogue

Status: **v0.1** = in the starter app · **Next** = good next step · **Later** = bigger or optional.

### Grow progress
- v0.1 Plants with crop, variety, zone, start date, stage (seed → harvested), archive.
- v0.1 Per-plant timeline of every event; age in days.
- Next Photos per log entry (IndexedDB blobs) and a photo timeline.
- Next Grow "runs" / batches grouping plants that started together.
- Later Height / node / canopy measurements and growth chart.

### Watering and feeding
- v0.1 Water-every / feed-every intervals per plant → due and overdue tasks on the dashboard.
- v0.1 Log water, feed, flush with volume, pH in/out, EC in/out, nutrients used.
- v0.1 Feed schedules: stages × nutrients (ml/L) with pH range and EC target.
- v0.1 Calculator: reservoir volume → ml of each nutrient; log it and deduct stock.
- Next Week-based schedules that advance automatically from start/flip date.
- Next "Feed, feed, water" rotation patterns.
- Later Notifications (browser push / email) for due tasks.

### Nutrient and pH management
- v0.1 pH and EC trend chart per plant; targets from the plant's schedule and stage.
- Next Out-of-range warnings (runoff pH drifting, EC climbing = salt build-up).
- Next PPM ↔ EC conversion (500 / 700 scales).
- Later N-P-K totals per feed from product labels.

### Soil management
- v0.1 Soil and media mixes (recipe, target pH).
- v0.1 Soil tests per bed: pH, EC, N, P, K, organic matter.
- v0.1 Amendments applied per bed, linked to inventory.
- Next Soil pH / nutrient trend per bed; amendment suggestions from test results.
- Next Crop rotation history per bed (what grew where, by year).
- Later Compost tracking (piles, inputs, turn dates, ready date).

### Light management
- v0.1 Fixtures per zone: type, watts, hours/day, PPFD, install date, rated hours.
- v0.1 Hours used, lamp-life %, daily light integral (DLI); dashboard flags lamps ≥ 85% life.
- Next Photoperiod schedule changes by stage (18/6 → 12/12); energy cost per month.
- Later Smart-plug / controller integration.

### Inventory
- v0.1 Nutrients, bulbs/lamps, soil/media, amendments, pest control, seeds, equipment.
- v0.1 Quantity, unit, reorder level → low-stock flag; cost and supplier.
- Next Seed inventory with germination rate and packet year.
- Next Shopping list generated from low stock.
- Later Cost per harvest (inputs + electricity ÷ yield).

### Yield and history
- v0.1 Harvests per plant: wet and dry weight, quality 1–5.
- v0.1 Totals per crop/variety; grams per watt for indoor zones.
- v0.1 History page: all logs filterable by plant and type, with charts.
- Next Compare runs side by side (same variety, different schedule).
- Later Yearly garden report.

### Garden planning (outdoor)
- Next Planting calendar from local frost dates (sow indoors / transplant / direct sow windows).
- Later Visual bed layout planner.

### Environment and sensors
- Next Manual temperature / humidity log per zone → VPD.
- Later Sensor ingestion (Bluetooth pH/EC pens, Home Assistant, MQTT, controller APIs).

### Platform
- v0.1 Runs in any browser, JSON backup/restore.
- Done PC server + Android app, synced over Wi-Fi with no internet; install, pair and update from Settings.
- Next Windows package (one .exe, no Node download), like Field Service Ops.
- Later Multi-device sync, accounts, sharing with a friend (see ARCHITECTURE.md).
