// Sample data so the app can be tried before real data goes in. Dates are relative to today.
window.GF = window.GF || {};

GF.loadSample = () => {
  const S = GF.store, U = GF.ui, t = U.today(), ago = n => U.addDays(t, -n);
  const save = (tb, r) => S.save(tb, r);

  const mixCoco = save('mixes', { name: 'Coco / perlite 70:30', components: '70% coco coir, 30% perlite', phTarget: 5.9 });
  const mixBed = save('mixes', { name: 'Raised bed blend', components: '40% topsoil, 30% compost, 20% peat, 10% worm castings', phTarget: 6.5 });

  const tent = save('zones', { name: 'Tent A', kind: 'Indoor tent', size: '4x4 ft', mixId: mixCoco.id });
  const bed = save('zones', { name: 'Raised bed 1', kind: 'Raised bed', size: '4x8 ft', mixId: mixBed.id });

  const grow = save('inventory', { name: 'Base nutrient – Grow', category: 'Nutrient', npk: '3-1-2', qty: 650, unit: 'ml', reorderAt: 250, cost: 24.99 });
  const bloom = save('inventory', { name: 'Base nutrient – Bloom', category: 'Nutrient', npk: '1-3-4', qty: 900, unit: 'ml', reorderAt: 250, cost: 24.99 });
  const calmag = save('inventory', { name: 'Cal-Mag', category: 'Nutrient', qty: 180, unit: 'ml', reorderAt: 200, cost: 18.5 });
  save('inventory', { name: 'pH Down', category: 'Nutrient', qty: 400, unit: 'ml', reorderAt: 100, cost: 12 });
  save('inventory', { name: 'Coco coir brick 5 kg', category: 'Soil / medium', qty: 2, unit: 'units', reorderAt: 1, cost: 16 });
  const bone = save('inventory', { name: 'Bone meal', category: 'Amendment', npk: '3-15-0', qty: 1.5, unit: 'kg', reorderAt: 0.5 });
  const lime = save('inventory', { name: 'Garden lime', category: 'Amendment', qty: 4, unit: 'kg', reorderAt: 1 });
  save('inventory', { name: 'Neem oil', category: 'Pest control', qty: 250, unit: 'ml', reorderAt: 100 });
  save('inventory', { name: 'Spare T5 tubes 4 ft', category: 'Bulb / lamp', qty: 1, unit: 'units', reorderAt: 2 });

  save('lights', { name: 'LED bar fixture', zoneId: tent.id, type: 'LED', watts: 320, hoursOn: 18, ppfd: 600, installDate: ago(400), ratedHours: 50000 });
  save('lights', { name: 'T5 seedling shelf', zoneId: tent.id, type: 'T5 fluorescent', watts: 54, hoursOn: 16, ppfd: 200, installDate: ago(1700), ratedHours: 30000 });

  const sched = save('schedules', {
    name: 'Fruiting veg – liquid feed', notes: 'Half strength for seedlings. Flush the last week.',
    rows: [
      { id: 'r661', label: 'Seedling', stage: 'Seedling', phMin: 5.8, phMax: 6.2, ec: 0.6, doses: { [grow.id]: 0.5, [calmag.id]: 0.5 } },
      { id: 'r7784', label: 'Veg', stage: 'Vegetative', phMin: 5.8, phMax: 6.3, ec: 1.2, doses: { [grow.id]: 2, [calmag.id]: 1 } },
      { id: 'r2073', label: 'Flower / fruit', stage: 'Flowering / fruiting', phMin: 6.0, phMax: 6.5, ec: 1.6, doses: { [grow.id]: 1, [bloom.id]: 2, [calmag.id]: 1 } },
      { id: 'r3890', label: 'Flush', stage: 'Ripening', phMin: 6.0, phMax: 6.5, ec: 0.2, doses: {} }
    ]
  });

  const pepper = save('plants', { name: 'Habanero #1', crop: 'Pepper', variety: 'Habanero Orange', zoneId: tent.id, startDate: ago(70), stage: 'Flowering / fruiting', scheduleId: sched.id, waterEvery: 2, feedEvery: 4 });
  const tom = save('plants', { name: 'Tomato – Micro Tom', crop: 'Tomato', variety: 'Micro Tom', zoneId: tent.id, startDate: ago(45), stage: 'Vegetative', scheduleId: sched.id, waterEvery: 2, feedEvery: 3 });
  const basil = save('plants', { name: 'Basil tray', crop: 'Basil', variety: 'Genovese', zoneId: tent.id, startDate: ago(20), stage: 'Seedling', scheduleId: sched.id, waterEvery: 1 });
  const garlic = save('plants', { name: 'Garlic row', crop: 'Garlic', variety: 'Music', zoneId: bed.id, startDate: ago(40), stage: 'Vegetative' });
  const lettuce = save('plants', { name: 'Lettuce – fall crop', crop: 'Lettuce', variety: 'Buttercrunch', zoneId: bed.id, startDate: ago(75), stage: 'Harvested', archived: true });

  // Watering / feeding history for the pepper and tomato
  [[pepper, 4], [tom, 3]].forEach(([p, feedN]) => {
    for (let d = 30, i = 0; d >= 2; d -= 2, i++) {
      const feed = i % 2 === 0;
      save('logs', {
        plantId: p.id, date: ago(d), type: feed ? 'Feed' : 'Water', volume: p === pepper ? 1.5 : 1,
        phIn: +(5.9 + Math.sin(i) * 0.15).toFixed(1), ecIn: feed ? +(1.2 + i * 0.02).toFixed(2) : 0.3,
        phOut: +(6.1 + Math.cos(i) * 0.2 + i * 0.015).toFixed(1), ecOut: +(1.4 + i * 0.04).toFixed(2),
        nutrients: feed ? 'Grow 3 ml, Cal-Mag 1.5 ml' : ''
      });
    }
  });
  save('logs', { plantId: pepper.id, date: ago(10), type: 'Training / pruning', notes: 'Removed lower leaves, topped main stem.' });
  save('logs', { plantId: pepper.id, date: ago(18), type: 'Stage change', notes: 'First flowers.' });
  save('logs', { plantId: basil.id, date: ago(1), type: 'Water', volume: 0.5, phIn: 6.0 });

  save('harvests', { plantId: lettuce.id, date: ago(30), wet: 310, dry: 310, quality: '4', notes: 'Outer leaves' });
  save('harvests', { plantId: lettuce.id, date: ago(12), wet: 420, dry: 420, quality: '5', notes: 'Whole heads' });
  save('harvests', { plantId: pepper.id, date: ago(3), wet: 85, dry: 85, quality: '4', notes: 'First 9 pods' });

  save('soilTests', { zoneId: bed.id, date: ago(200), ph: 5.8, n: 'Low', p: 'Medium', k: 'Medium', om: 4.2, notes: 'Spring test kit' });
  save('soilTests', { zoneId: bed.id, date: ago(60), ph: 6.3, n: 'Medium', p: 'High', k: 'Medium', om: 5.1 });
  save('amendments', { zoneId: bed.id, date: ago(190), itemId: lime.id, amount: 1, unit: 'kg', notes: 'Raise pH' });
  save('amendments', { zoneId: bed.id, date: ago(45), itemId: bone.id, amount: 400, unit: 'g', notes: 'Before planting garlic' });
};
