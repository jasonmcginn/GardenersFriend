# Data model (v0.1)

All records carry `id`, `created`, `updated`. Dates are `YYYY-MM-DD`. Units are metric.
Definitions live in `app/js/schema.js`; this file mirrors them.

```
zones ─┬─< plants ─┬─< logs
       │           └─< harvests
       ├─< lights
       ├─< soilTests
       └─< amendments >── inventory
mixes ──< zones
schedules ──< plants     (schedule.rows[].doses keyed by inventory id)
```

| Entity | Key fields |
|---|---|
| **zones** | name, kind (tent, room, greenhouse, raised bed, in-ground, containers, hydro), size, mixId, notes |
| **plants** | name, variety, crop, zoneId, startDate, stage, scheduleId, waterEvery (days), feedEvery (days), archived, notes |
| **logs** | plantId, date, type (Water, Feed, pH adjust, Flush, Transplant, Training / pruning, Pest / disease, Stage change, Note), volume (L), phIn, ecIn, phOut, ecOut, nutrients (text), notes |
| **schedules** | name, notes, rows: `[{label, stage, phMin, phMax, ec, doses: {inventoryId: mlPerL}}]` |
| **inventory** | name, category (Nutrient, Bulb / lamp, Soil / medium, Amendment, Pest control, Seeds, Equipment, Other), brand, npk, qty, unit, reorderAt, cost, supplier, notes |
| **lights** | name, zoneId, type, watts, hoursOn, ppfd, installDate, ratedHours, notes · computed: hours used, life %, DLI |
| **mixes** | name, components, phTarget, notes |
| **soilTests** | zoneId, date, ph, ec, n, p, k, om (%), notes |
| **amendments** | zoneId, date, itemId (inventory), amount, unit, notes |
| **harvests** | plantId, date, wet (g), dry (g), quality (1–5), notes |

## Derived values

- Next water due = latest Water/Feed/Flush log + `waterEvery`; next feed = latest Feed log + `feedEvery`.
- Lamp hours used = days since install × hoursOn; life % = used ÷ ratedHours.
- DLI (mol/m²/day) = PPFD × hoursOn × 3600 ÷ 1,000,000.
- g/W = dry grams ÷ total watts of lights in the plant's zone.

## Storage

v0.1: one JSON object in `localStorage['gardenersFriend.v1']`, `{zones:[...], plants:[...], ..., meta:{version}}`.
When moving to a database each entity becomes a table; `schedule.rows` becomes `schedule_rows` + `schedule_doses`.
