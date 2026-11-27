# Gardener's Friend — project context

A web-based plant and garden manager for one grower (Jason McGinn). It tracks plants from seed to harvest
and everything around them: watering, feeding, nutrients, pH/EC, soil, lights, inventory, yield and history.

GitHub: https://github.com/jasonmcginn/GardenersFriend

## Current state (v0.1 — starter framework)

- `app/` is a working, no-build, local-first web app. Open `app/index.html` in a browser (double-click works;
  classic `<script>` tags, no ES modules, so `file://` is fine).
- Data lives in the browser's `localStorage` under the key `gardenersFriend.v1`.
  Backup / restore is JSON export / import on the Backup page.
- Metric units throughout: litres, ml, grams, EC in mS/cm. pH to 0.1.

## Layout

```
app/
  index.html        shell: sidebar nav, <main id="view">, <dialog id="dlg">
  css/styles.css    all styling (CSS variables at top)
  js/schema.js      ENTITY DEFINITIONS — fields, list columns, computed columns. Start here.
  js/store.js       storage adapter (localStorage). Swap for an API adapter later; keep the method names.
  js/ui.js          helpers: escaping, dates, generic table, generic form dialog, SVG line chart
  js/views.js       one function per page (dashboard, plant detail, schedules, calculator, history, yield, soil...)
  js/sample.js      "Load sample data" generator
  js/app.js         hash router + delegated event handling
docs/
  FEATURES.md       feature catalogue, what other apps do, MVP / next / later options
  DATA_MODEL.md     entities and fields
  ARCHITECTURE.md   tech options and the path from local-first to hosted
  ROADMAP.md        phased plan
```

## Conventions

- Script load order matters: schema → store → ui → sample → views → app. Everything hangs off `window.GF`.
- To add a field: add it to the entity in `schema.js`. The generic table and form pick it up automatically.
  `list:1` shows it as a column; `computed:[{label, fn}]` adds derived columns.
- To add a simple page for a new entity: add the entity to `schema.js`, then a route in `app.js` using
  `GF.views.list('<entity>')` and a nav link in `index.html`.
- All user data rendered into HTML must go through `GF.ui.esc()`.
- Records get `id`, `created`, `updated` from the store. Dates are `YYYY-MM-DD` strings (local date).
- Deleting a plant cascades to its logs and harvests.
- Keep it dependency-free until there is a real reason (see docs/ARCHITECTURE.md).

## Modules in v0.1

Dashboard (due tasks, low stock, lamp life, recent activity) · Plants (+ detail page with timeline and pH/EC chart)
· Zones & beds · Feed schedules (stage × nutrient ml/L grid) · Nutrient calculator (mix for a reservoir volume,
log it to a plant, deduct stock) · History (filterable log + chart) · Inventory (low-stock flag)
· Lights (hours used, lamp life %, DLI) · Soil (mixes, soil tests, amendments) · Yield (harvests, totals, g/W) · Backup.

## Open decisions (ask Jason before choosing)

- Hosting: stay local-first + PWA, or move to a backend (see ARCHITECTURE.md options A–C).
- Multi-device sync and phone use in the garden.
- Sensor integration (pH/EC pens, Home Assistant / MQTT) — later phase.
