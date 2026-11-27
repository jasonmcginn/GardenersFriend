// Entity definitions. The generic table and form are built from these.
// Field: {k, label, type: text|number|date|select|ref|textarea|checkbox, options, ref, unit, step, ph, req, list}
window.GF = window.GF || {};

GF.STAGES = ['Seed', 'Seedling', 'Vegetative', 'Flowering / fruiting', 'Ripening', 'Harvested', 'Dead'];
GF.LOG_TYPES = ['Water', 'Feed', 'pH adjust', 'Flush', 'Transplant', 'Training / pruning', 'Pest / disease', 'Stage change', 'Note'];
GF.INV_CATS = ['Nutrient', 'Bulb / lamp', 'Soil / medium', 'Amendment', 'Pest control', 'Seeds', 'Equipment', 'Other'];

GF.num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;

GF.schema = {
  entities: {
    zones: {
      label: 'Zones & beds', one: 'zone or bed',
      fields: [
        { k: 'name', label: 'Name', type: 'text', req: 1, list: 1 },
        { k: 'kind', label: 'Type', type: 'select', list: 1, options: ['Indoor tent', 'Grow room', 'Greenhouse', 'Raised bed', 'In-ground bed', 'Containers / patio', 'Hydro system'] },
        { k: 'size', label: 'Size', type: 'text', ph: 'e.g. 4x4 ft or 1.2 m²', list: 1 },
        { k: 'mixId', label: 'Soil / medium mix', type: 'ref', ref: 'mixes', list: 1 },
        { k: 'notes', label: 'Notes', type: 'textarea' }
      ]
    },
    plants: {
      label: 'Plants', one: 'plant',
      fields: [
        { k: 'name', label: 'Plant name', type: 'text', req: 1, list: 1 },
        { k: 'crop', label: 'Crop', type: 'text', ph: 'Tomato, basil, pepper…', list: 1 },
        { k: 'variety', label: 'Variety / cultivar', type: 'text', list: 1 },
        { k: 'zoneId', label: 'Zone / bed', type: 'ref', ref: 'zones', list: 1 },
        { k: 'startDate', label: 'Start date', type: 'date', list: 1 },
        { k: 'stage', label: 'Stage', type: 'select', options: GF.STAGES, list: 1 },
        { k: 'scheduleId', label: 'Feed schedule', type: 'ref', ref: 'schedules' },
        { k: 'waterEvery', label: 'Water every', type: 'number', unit: 'days', step: 1 },
        { k: 'feedEvery', label: 'Feed every', type: 'number', unit: 'days', step: 1 },
        { k: 'archived', label: 'Archived', type: 'checkbox' },
        { k: 'notes', label: 'Notes', type: 'textarea' }
      ]
    },
    logs: {
      label: 'Log entries', one: 'log entry',
      fields: [
        { k: 'plantId', label: 'Plant', type: 'ref', ref: 'plants', req: 1, list: 1 },
        { k: 'date', label: 'Date', type: 'date', req: 1, list: 1 },
        { k: 'type', label: 'Type', type: 'select', options: GF.LOG_TYPES, req: 1, list: 1 },
        { k: 'volume', label: 'Volume', type: 'number', unit: 'L', step: 0.1, list: 1 },
        { k: 'phIn', label: 'pH in', type: 'number', step: 0.1, list: 1 },
        { k: 'ecIn', label: 'EC in', type: 'number', unit: 'mS/cm', step: 0.01, list: 1 },
        { k: 'phOut', label: 'Runoff pH', type: 'number', step: 0.1, list: 1 },
        { k: 'ecOut', label: 'Runoff EC', type: 'number', unit: 'mS/cm', step: 0.01, list: 1 },
        { k: 'nutrients', label: 'Nutrients used', type: 'text', ph: 'e.g. Grow 20 ml, Cal-Mag 10 ml' },
        { k: 'notes', label: 'Notes', type: 'textarea', list: 1 }
      ]
    },
    schedules: {
      label: 'Feed schedules', one: 'feed schedule',
      fields: [
        { k: 'name', label: 'Name', type: 'text', req: 1, list: 1 },
        { k: 'notes', label: 'Notes', type: 'textarea', list: 1 }
      ]
    },
    inventory: {
      label: 'Inventory', one: 'inventory item',
      fields: [
        { k: 'name', label: 'Item', type: 'text', req: 1, list: 1 },
        { k: 'category', label: 'Category', type: 'select', options: GF.INV_CATS, req: 1, list: 1 },
        { k: 'brand', label: 'Brand', type: 'text', list: 1 },
        { k: 'npk', label: 'N-P-K', type: 'text', ph: 'e.g. 3-1-2' },
        { k: 'qty', label: 'Quantity', type: 'number', step: 'any', list: 1 },
        { k: 'unit', label: 'Unit', type: 'select', options: ['ml', 'L', 'g', 'kg', 'units', 'bags'], list: 1 },
        { k: 'reorderAt', label: 'Reorder at', type: 'number', step: 'any' },
        { k: 'cost', label: 'Cost', type: 'number', unit: '$', step: 0.01 },
        { k: 'supplier', label: 'Supplier', type: 'text' },
        { k: 'notes', label: 'Notes', type: 'textarea' }
      ],
      computed: [{ label: 'Stock', fn: r => GF.lowStock(r) ? '<span class="tag warn">Reorder</span>' : '<span class="tag ok">OK</span>' }]
    },
    lights: {
      label: 'Lights', one: 'light',
      fields: [
        { k: 'name', label: 'Fixture', type: 'text', req: 1, list: 1 },
        { k: 'zoneId', label: 'Zone', type: 'ref', ref: 'zones', list: 1 },
        { k: 'type', label: 'Type', type: 'select', options: ['LED', 'HPS', 'MH', 'CMH / LEC', 'T5 fluorescent', 'CFL', 'Other'], list: 1 },
        { k: 'watts', label: 'Watts', type: 'number', unit: 'W', list: 1 },
        { k: 'hoursOn', label: 'On per day', type: 'number', unit: 'h', step: 0.5, list: 1 },
        { k: 'ppfd', label: 'PPFD at canopy', type: 'number', unit: 'µmol/m²/s' },
        { k: 'installDate', label: 'Installed / last replaced', type: 'date' },
        { k: 'ratedHours', label: 'Rated lamp life', type: 'number', unit: 'h' },
        { k: 'notes', label: 'Notes', type: 'textarea' }
      ],
      computed: [
        { label: 'Hours used', fn: r => { const h = GF.lampHours(r); return h == null ? '' : Math.round(h).toLocaleString(); } },
        { label: 'Life', fn: r => { const p = GF.lampLife(r); return p == null ? '' : `<span class="tag ${p >= 85 ? 'warn' : 'ok'}">${Math.round(p)}%</span>`; } },
        { label: 'DLI', fn: r => (r.ppfd && r.hoursOn) ? (r.ppfd * r.hoursOn * 3600 / 1e6).toFixed(1) : '' }
      ]
    },
    mixes: {
      label: 'Soil & media mixes', one: 'mix',
      fields: [
        { k: 'name', label: 'Mix name', type: 'text', req: 1, list: 1 },
        { k: 'components', label: 'Recipe', type: 'textarea', ph: 'e.g. 40% peat, 30% compost, 20% perlite, 10% worm castings', list: 1 },
        { k: 'phTarget', label: 'Target pH', type: 'number', step: 0.1, list: 1 },
        { k: 'notes', label: 'Notes', type: 'textarea' }
      ]
    },
    soilTests: {
      label: 'Soil tests', one: 'soil test',
      fields: [
        { k: 'zoneId', label: 'Bed / zone', type: 'ref', ref: 'zones', req: 1, list: 1 },
        { k: 'date', label: 'Date', type: 'date', req: 1, list: 1 },
        { k: 'ph', label: 'pH', type: 'number', step: 0.1, list: 1 },
        { k: 'ec', label: 'EC', type: 'number', unit: 'mS/cm', step: 0.01, list: 1 },
        { k: 'n', label: 'Nitrogen', type: 'text', ph: 'ppm or low/med/high', list: 1 },
        { k: 'p', label: 'Phosphorus', type: 'text', list: 1 },
        { k: 'k', label: 'Potassium', type: 'text', list: 1 },
        { k: 'om', label: 'Organic matter', type: 'number', unit: '%', step: 0.1, list: 1 },
        { k: 'notes', label: 'Notes', type: 'textarea' }
      ]
    },
    amendments: {
      label: 'Amendments applied', one: 'amendment',
      fields: [
        { k: 'zoneId', label: 'Bed / zone', type: 'ref', ref: 'zones', req: 1, list: 1 },
        { k: 'date', label: 'Date', type: 'date', req: 1, list: 1 },
        { k: 'itemId', label: 'Product', type: 'ref', ref: 'inventory', list: 1 },
        { k: 'amount', label: 'Amount', type: 'number', step: 'any', list: 1 },
        { k: 'unit', label: 'Unit', type: 'text', ph: 'g, kg, L…', list: 1 },
        { k: 'notes', label: 'Notes', type: 'textarea', list: 1 }
      ]
    },
    harvests: {
      label: 'Harvests', one: 'harvest',
      fields: [
        { k: 'plantId', label: 'Plant', type: 'ref', ref: 'plants', req: 1, list: 1 },
        { k: 'date', label: 'Date', type: 'date', req: 1, list: 1 },
        { k: 'wet', label: 'Wet weight', type: 'number', unit: 'g', step: 'any', list: 1 },
        { k: 'dry', label: 'Dry / final weight', type: 'number', unit: 'g', step: 'any', list: 1 },
        { k: 'quality', label: 'Quality', type: 'select', options: ['1', '2', '3', '4', '5'], list: 1 },
        { k: 'notes', label: 'Notes', type: 'textarea', list: 1 }
      ]
    }
  }
};

GF.lowStock = r => GF.num(r.qty) != null && GF.num(r.reorderAt) != null && +r.qty <= +r.reorderAt;
GF.lampHours = r => {
  if (!r.installDate || !r.hoursOn) return null;
  const days = (Date.now() - new Date(r.installDate + 'T00:00').getTime()) / 864e5;
  return Math.max(0, days) * r.hoursOn;
};
GF.lampLife = r => { const h = GF.lampHours(r); return (h == null || !r.ratedHours) ? null : h / r.ratedHours * 100; };
