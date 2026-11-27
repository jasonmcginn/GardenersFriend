// One function per page. Each receives the <main> element (and a route parameter where relevant).
window.GF = window.GF || {};

(() => {
  const V = GF.views = {};
  const S = GF.store, U = GF.ui, esc = U.esc;
  const C = { ph: '#2f7d4a', phOut: '#d9822b', ec: '#3b6fb6', ecOut: '#8a5fb8' };

  const head = (title, right = '', sub = '') =>
    `<header class="vhead"><div><h1>${esc(title)}</h1>${sub ? `<p class="lede">${sub}</p>` : ''}</div><div class="vact">${right}</div></header>`;
  const addBtn = (t, label, data = '') => `<button class="btn primary" data-act="add" data-t="${t}" ${data}>${esc(label || 'Add ' + GF.schema.entities[t].one)}</button>`;
  const byDateDesc = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
  const active = p => !p.archived && !['Harvested', 'Dead'].includes(p.stage);
  const logsFor = id => S.all('logs').filter(l => l.plantId === id);
  const zoneWatts = zid => S.all('lights').filter(l => l.zoneId === zid).reduce((s, l) => s + (+l.watts || 0), 0);
  const g = n => n >= 1000 ? (n / 1000).toFixed(2) + ' kg' : Math.round(n) + ' g';

  // ---------- generic list page ----------
  V.list = (t, sub) => root => {
    const def = GF.schema.entities[t];
    const hasDate = def.fields.some(f => f.k === 'date');
    let rows = S.all(t).slice().sort(hasDate ? byDateDesc : byName);
    root.innerHTML = head(def.label, addBtn(t), sub || '') + U.table(t, rows);
  };

  // ---------- due tasks ----------
  function tasks() {
    const out = [], td = U.today();
    S.all('plants').filter(active).forEach(p => {
      const logs = logsFor(p.id);
      const last = types => logs.filter(l => types.includes(l.type)).map(l => l.date).sort().pop();
      const add = (what, every, types) => {
        if (!every) return;
        const l = last(types);
        const due = l ? U.addDays(l, every) : td;
        out.push({ p, what, due, last: l, late: U.daysBetween(due, td) });
      };
      add('Water', p.waterEvery, ['Water', 'Feed', 'Flush']);
      add('Feed', p.feedEvery, ['Feed']);
    });
    return out.sort((a, b) => a.due.localeCompare(b.due));
  }

  // ---------- dashboard ----------
  V.dashboard = root => {
    if (S.isEmpty()) {
      root.innerHTML = head('Welcome to Gardener\'s Friend') + `<section class="card hero">
        <p>Start by adding a zone or bed (a tent, a raised bed, a windowsill), then the plants in it.
        Or load sample data to see how everything fits together.</p>
        <div class="row"><button class="btn primary" data-act="seed">Load sample data</button>
        <button class="btn" data-act="add" data-t="zones">Add a zone or bed</button>
        <button class="btn" data-act="add" data-t="plants">Add a plant</button></div></section>`;
      return;
    }
    const td = U.today();
    const all = tasks(), due = all.filter(x => x.late >= 0), soon = all.filter(x => x.late < 0 && x.late >= -2);
    const low = S.all('inventory').filter(GF.lowStock);
    const lamps = S.all('lights').filter(l => (GF.lampLife(l) || 0) >= 85);
    const week = S.all('logs').filter(l => U.daysBetween(l.date, td) <= 7).length;
    const yr = td.slice(0, 4);
    const yieldYr = S.all('harvests').filter(h => String(h.date).startsWith(yr)).reduce((s, h) => s + (+h.dry || +h.wet || 0), 0);

    const taskRow = x => `<li class="task ${x.late > 0 ? 'late' : x.late === 0 ? 'today' : ''}">
      <div><strong>${esc(x.what)}</strong> <a href="#plant/${esc(x.p.id)}">${esc(x.p.name)}</a>
      <small>${x.late > 0 ? `${x.late} day${x.late > 1 ? 's' : ''} overdue` : x.late === 0 ? 'due today' : 'due ' + esc(U.fmtDate(x.due))}${x.last ? ' · last ' + esc(U.fmtDate(x.last)) : ''}</small></div>
      <button class="btn sm" data-act="quicklog" data-plant="${esc(x.p.id)}" data-type="${esc(x.what)}">Log ${esc(x.what.toLowerCase())}</button></li>`;

    const recent = S.all('logs').slice().sort(byDateDesc).slice(0, 8);
    root.innerHTML = head('Today', addBtn('logs', 'New log entry'), esc(U.fmtDate(td))) + `
      <div class="tiles">
        <div class="tile"><b>${S.all('plants').filter(active).length}</b><span>active plants</span></div>
        <div class="tile ${due.length ? 'hot' : ''}"><b>${due.length}</b><span>tasks due or overdue</span></div>
        <div class="tile"><b>${week}</b><span>log entries this week</span></div>
        <div class="tile"><b>${g(yieldYr)}</b><span>harvested in ${yr}</span></div>
      </div>
      <div class="cols">
        <section class="card"><h2>Needs doing</h2>
          ${due.length || soon.length ? `<ul class="tasks">${due.concat(soon).map(taskRow).join('')}</ul>` : '<div class="empty">Nothing due. Set “water every” and “feed every” on a plant to get reminders here.</div>'}
        </section>
        <section class="card"><h2>Attention</h2>
          ${low.length ? `<h3>Low stock</h3><ul class="plain">${low.map(i => `<li>${esc(i.name)} — <span class="nowrap">${esc(i.qty)} ${esc(i.unit || '')}</span> left</li>`).join('')}</ul>` : ''}
          ${lamps.length ? `<h3>Lamps near end of life</h3><ul class="plain">${lamps.map(l => `<li>${esc(l.name)} — ${Math.round(GF.lampLife(l))}% used</li>`).join('')}</ul>` : ''}
          ${!low.length && !lamps.length ? '<div class="empty">Stock and lamps look fine.</div>' : ''}
          <h3>Recent activity</h3>
          ${recent.length ? `<ul class="plain">${recent.map(l => `<li><span class="nowrap muted">${esc(U.fmtDate(l.date))}</span> · ${esc(l.type)} · <a href="#plant/${esc(l.plantId)}">${esc(U.refName('plants', l.plantId))}</a>${l.phIn != null ? ` · pH ${esc(l.phIn)}` : ''}</li>`).join('')}</ul>` : '<div class="empty">No log entries yet.</div>'}
        </section>
      </div>`;
  };

  // ---------- plants ----------
  V.plants = root => {
    const showAll = GF.state.showArchived;
    const rows = S.all('plants').filter(p => showAll || !p.archived).sort(byName);
    root.innerHTML = head('Plants', `<label class="toggle"><input type="checkbox" data-ui="showArchived"${showAll ? ' checked' : ''}> Show archived</label>` + addBtn('plants')) +
      U.table('plants', rows, { link: r => '#plant/' + r.id });
  };

  V.plant = (root, id) => {
    const p = S.get('plants', id);
    if (!p) { root.innerHTML = head('Plant not found') + '<p><a href="#plants">Back to plants</a></p>'; return; }
    const td = U.today();
    const logs = logsFor(id).sort(byDateDesc);
    const sched = S.get('schedules', p.scheduleId);
    const row = sched && (sched.rows || []).find(r => r.stage === p.stage);
    const harv = S.all('harvests').filter(h => h.plantId === id).sort(byDateDesc);
    const tot = harv.reduce((s, h) => s + (+h.dry || +h.wet || 0), 0);
    const t = tasks().filter(x => x.p.id === id);
    const fact = (k, v) => v ? `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>` : '';
    const series = [
      { name: 'pH in', color: C.ph, pts: logs.map(l => [l.date, l.phIn]) },
      { name: 'Runoff pH', color: C.phOut, pts: logs.map(l => [l.date, l.phOut]) }];
    const ecSeries = [
      { name: 'EC in', color: C.ec, pts: logs.map(l => [l.date, l.ecIn]) },
      { name: 'Runoff EC', color: C.ecOut, pts: logs.map(l => [l.date, l.ecOut]) }];

    root.innerHTML = head(p.name, `<button class="btn" data-act="edit" data-t="plants" data-id="${esc(id)}">Edit plant</button>`,
      `<a href="#plants">Plants</a> · ${esc([p.crop, p.variety].filter(Boolean).join(' · '))}`) + `
      <div class="row quick">
        <button class="btn primary" data-act="quicklog" data-plant="${esc(id)}" data-type="Water">Log water</button>
        <button class="btn primary" data-act="quicklog" data-plant="${esc(id)}" data-type="Feed">Log feed</button>
        <button class="btn" data-act="quicklog" data-plant="${esc(id)}" data-type="Note">Add note</button>
        <button class="btn" data-act="add" data-t="harvests" data-plant="${esc(id)}">Record harvest</button>
      </div>
      <section class="card"><dl class="facts">
        ${fact('Stage', esc(p.stage))}
        ${fact('Zone', esc(U.refName('zones', p.zoneId)))}
        ${fact('Age', p.startDate ? `${U.daysBetween(p.startDate, td)} days` : '')}
        ${fact('Started', esc(U.fmtDate(p.startDate)))}
        ${fact('Schedule', sched ? `<a href="#schedules">${esc(sched.name)}</a>` : '')}
        ${fact('Target now', row ? `pH ${esc(row.phMin)}–${esc(row.phMax)}${row.ec ? ` · EC ${esc(row.ec)}` : ''}` : '')}
        ${t.map(x => fact('Next ' + x.what.toLowerCase(), `<span class="${x.late > 0 ? 'bad' : ''}">${esc(U.fmtDate(x.due))}</span>`)).join('')}
        ${fact('Harvested', tot ? g(tot) : '')}
      </dl>${p.notes ? `<p class="note">${esc(p.notes)}</p>` : ''}</section>
      <div class="cols">
        <section class="card"><h2>pH</h2>${U.lineChart(series, { label: 'pH over time' })}</section>
        <section class="card"><h2>EC (mS/cm)</h2>${U.lineChart(ecSeries, { label: 'EC over time', dp: 2 })}</section>
      </div>
      <section class="card"><h2>Timeline</h2>${U.table('logs', logs, { hide: ['plantId'] })}</section>
      ${harv.length ? `<section class="card"><h2>Harvests</h2>${U.table('harvests', harv, { hide: ['plantId'] })}</section>` : ''}`;
  };

  // ---------- feed schedules ----------
  V.schedules = root => {
    const nutes = S.all('inventory').filter(i => i.category === 'Nutrient').sort(byName);
    const scheds = S.all('schedules').slice().sort(byName);
    const card = s => {
      const rows = s.rows || [];
      const th = `<th>Step</th><th>Stage</th><th class="r">pH min</th><th class="r">pH max</th><th class="r">EC</th>` +
        nutes.map(n => `<th class="r">${esc(n.name)}<br><small>ml/L</small></th>`).join('') + '<th></th>';
      const inp = (i, f, v, w) => `<input class="cell" data-sched="${esc(s.id)}" data-row="${i}" data-field="${f}" value="${esc(v ?? '')}" ${w ? 'type="number" step="any" inputmode="decimal"' : ''} aria-label="${esc(f)}">`;
      const tr = rows.map((r, i) => `<tr>
        <td>${inp(i, 'label', r.label)}</td>
        <td><select class="cell" data-sched="${esc(s.id)}" data-row="${i}" data-field="stage" aria-label="Stage">${GF.STAGES.map(o => `<option${o === r.stage ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></td>
        <td>${inp(i, 'phMin', r.phMin, 1)}</td><td>${inp(i, 'phMax', r.phMax, 1)}</td><td>${inp(i, 'ec', r.ec, 1)}</td>
        ${nutes.map(n => `<td><input class="cell" type="number" step="any" inputmode="decimal" data-sched="${esc(s.id)}" data-row="${i}" data-dose="${esc(n.id)}" value="${esc((r.doses || {})[n.id] ?? '')}" aria-label="${esc(n.name)} ml per litre"></td>`).join('')}
        <td><button class="btn sm ghost danger" data-act="delrow" data-id="${esc(s.id)}" data-row="${i}" aria-label="Remove step">×</button></td></tr>`).join('');
      return `<section class="card">
        <div class="cardhead"><h2>${esc(s.name)}</h2><div>
          <a class="btn sm" href="#calc" data-act="usecalc" data-id="${esc(s.id)}">Mix it</a>
          <button class="btn sm ghost" data-act="edit" data-t="schedules" data-id="${esc(s.id)}">Rename</button>
          <button class="btn sm ghost danger" data-act="del" data-t="schedules" data-id="${esc(s.id)}">Delete</button></div></div>
        ${s.notes ? `<p class="note">${esc(s.notes)}</p>` : ''}
        <div class="scroll"><table class="grid-ed"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>
        <button class="btn sm" data-act="addrow" data-id="${esc(s.id)}">Add step</button></section>`;
    };
    root.innerHTML = head('Feed schedules', addBtn('schedules'),
      'Each step is a stage of growth with a pH range, EC target and dose per litre for each nutrient. Edits save as you type. Nutrient columns come from Inventory items in the “Nutrient” category.') +
      (nutes.length ? '' : `<div class="card warnbox">No nutrients yet. <button class="btn sm" data-act="add" data-t="inventory" data-cat="Nutrient">Add a nutrient</button></div>`) +
      (scheds.length ? scheds.map(card).join('') : '<div class="empty">No schedules yet.</div>');
  };

  // ---------- nutrient calculator ----------
  V.calc = root => {
    const st = GF.state.calc;
    const scheds = S.all('schedules').slice().sort(byName);
    if (!scheds.length) { root.innerHTML = head('Nutrient calculator') + '<div class="empty">Create a feed schedule first. <a href="#schedules">Feed schedules</a></div>'; return; }
    if (!scheds.find(s => s.id === st.sched)) st.sched = scheds[0].id;
    const s = S.get('schedules', st.sched), rows = s.rows || [];
    if (st.row >= rows.length) st.row = 0;
    const r = rows[st.row];
    const vol = Math.max(0, +st.vol || 0);
    const items = r ? Object.entries(r.doses || {}).filter(([, ml]) => +ml > 0).map(([nid, ml]) => ({ n: S.get('inventory', nid), ml: +ml })).filter(x => x.n) : [];
    const plants = S.all('plants').filter(active).sort(byName);
    root.innerHTML = head('Nutrient calculator', '', 'Pick a schedule and step, enter how much water you are mixing, and get the dose for each nutrient. Add nutrients in order, stir between each, then adjust pH last.') + `
      <div class="calc">
        <section class="card inputs">
          <div class="fld"><label for="cSched">Schedule</label><select id="cSched" data-calc="sched">${scheds.map(x => `<option value="${esc(x.id)}"${x.id === st.sched ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="fld"><label for="cRow">Step</label><select id="cRow" data-calc="row">${rows.map((x, i) => `<option value="${i}"${i === st.row ? ' selected' : ''}>${esc(x.label || x.stage)}</option>`).join('')}</select></div>
          <div class="fld"><label for="cVol">Water volume <small>(L)</small></label><input id="cVol" type="number" step="any" inputmode="decimal" min="0" data-calc="vol" value="${esc(st.vol)}"></div>
          <p class="muted small">${vol ? `${(vol / 3.785).toFixed(2)} US gal` : ''}</p>
        </section>
        <section class="card result">
          ${r ? `<p class="target">Target pH <b>${esc(r.phMin)}–${esc(r.phMax)}</b>${r.ec ? ` · EC <b>${esc(r.ec)}</b> mS/cm` : ''}</p>` : '<p>This schedule has no steps yet.</p>'}
          ${items.length ? `<table><thead><tr><th>Nutrient</th><th class="r">ml/L</th><th class="r">Add</th><th class="r">In stock</th></tr></thead><tbody>
            ${items.map(x => `<tr><td>${esc(x.n.name)}</td><td class="r">${esc(x.ml)}</td><td class="r big nowrap">${(x.ml * vol).toFixed(1)} ml</td><td class="r nowrap ${GF.lowStock(x.n) ? 'bad' : ''}">${esc(x.n.qty ?? '')} ${esc(x.n.unit || '')}</td></tr>`).join('')}
            </tbody></table>` : (r ? '<p class="muted">Plain water at this step.</p>' : '')}
          ${r ? `<div class="logit">
            <div class="fld"><label for="cPlant">Log this feed to</label><select id="cPlant"><option value="">Choose a plant…</option>${plants.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
            <label class="toggle"><input type="checkbox" id="cDeduct" checked> Deduct from inventory</label>
            <button class="btn primary" data-act="calclog">Log feed…</button></div>` : ''}
        </section>
      </div>`;
    GF.state.calcItems = items.map(x => ({ id: x.n.id, name: x.n.name, ml: +(x.ml * vol).toFixed(1) }));
  };

  // ---------- history ----------
  V.history = root => {
    const st = GF.state.hist;
    const plants = S.all('plants').slice().sort(byName);
    let logs = S.all('logs').slice().sort(byDateDesc);
    if (st.plant) logs = logs.filter(l => l.plantId === st.plant);
    if (st.type) logs = logs.filter(l => l.type === st.type);
    const chart = st.plant ? `<div class="cols">
        <section class="card"><h2>pH</h2>${U.lineChart([{ name: 'pH in', color: C.ph, pts: logs.map(l => [l.date, l.phIn]) }, { name: 'Runoff pH', color: C.phOut, pts: logs.map(l => [l.date, l.phOut]) }])}</section>
        <section class="card"><h2>EC (mS/cm)</h2>${U.lineChart([{ name: 'EC in', color: C.ec, pts: logs.map(l => [l.date, l.ecIn]) }, { name: 'Runoff EC', color: C.ecOut, pts: logs.map(l => [l.date, l.ecOut]) }], { dp: 2 })}</section></div>`
      : '<p class="muted">Choose a plant to see its pH and EC trend.</p>';
    root.innerHTML = head('History', addBtn('logs', 'New log entry')) + `
      <div class="filters">
        <div class="fld"><label for="hPlant">Plant</label><select id="hPlant" data-hist="plant"><option value="">All plants</option>${plants.map(p => `<option value="${esc(p.id)}"${p.id === st.plant ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="fld"><label for="hType">Type</label><select id="hType" data-hist="type"><option value="">All types</option>${GF.LOG_TYPES.map(t => `<option${t === st.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <p class="muted">${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}</p>
      </div>${chart}
      <section class="card">${U.table('logs', logs, st.plant ? { hide: ['plantId'] } : {})}</section>`;
  };

  // ---------- yield ----------
  V.yield = root => {
    const harv = S.all('harvests').slice().sort(byDateDesc);
    const groups = {};
    harv.forEach(h => {
      const p = S.get('plants', h.plantId) || {};
      const key = [p.crop, p.variety].filter(Boolean).join(' · ') || p.name || 'Unknown';
      const gr = groups[key] = groups[key] || { key, wet: 0, dry: 0, plants: new Set(), n: 0, q: 0, qn: 0 };
      gr.wet += +h.wet || 0; gr.dry += +h.dry || 0; gr.plants.add(h.plantId); gr.n++;
      if (h.quality) { gr.q += +h.quality; gr.qn++; }
    });
    const zones = {};
    harv.forEach(h => {
      const p = S.get('plants', h.plantId); if (!p || !p.zoneId) return;
      const z = zones[p.zoneId] = zones[p.zoneId] || { dry: 0 }; z.dry += +h.dry || 0;
    });
    const gw = Object.entries(zones).map(([zid, z]) => ({ name: U.refName('zones', zid), dry: z.dry, w: zoneWatts(zid) })).filter(z => z.w);
    const glist = Object.values(groups).sort((a, b) => b.dry - a.dry);
    root.innerHTML = head('Yield', addBtn('harvests', 'Record harvest')) + `
      <div class="cols">
        <section class="card"><h2>By crop</h2>${glist.length ? `<div class="scroll"><table class="stack"><thead><tr><th>Crop · variety</th><th class="r">Plants</th><th class="r">Harvests</th><th class="r">Wet</th><th class="r">Dry / final</th><th class="r">Per plant</th><th class="r">Avg quality</th></tr></thead><tbody>
          ${glist.map(x => `<tr><td>${esc(x.key)}</td><td class="r">${x.plants.size}</td><td class="r">${x.n}</td><td class="r nowrap">${g(x.wet)}</td><td class="r nowrap"><b>${g(x.dry)}</b></td><td class="r nowrap">${g(x.dry / x.plants.size)}</td><td class="r">${x.qn ? (x.q / x.qn).toFixed(1) : ''}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">No harvests yet.</div>'}</section>
        <section class="card"><h2>Grams per watt</h2>${gw.length ? `<ul class="plain">${gw.map(z => `<li><b>${esc(z.name)}</b> — ${(z.dry / z.w).toFixed(2)} g/W <span class="muted">(${g(z.dry)} under ${z.w} W)</span></li>`).join('')}</ul>` : '<div class="empty">Shows for zones that have lights and harvests.</div>'}</section>
      </div>
      <section class="card"><h2>All harvests</h2>${U.table('harvests', harv)}</section>`;
  };

  // ---------- soil ----------
  V.soil = root => {
    const tests = S.all('soilTests').slice().sort(byDateDesc);
    const zonesTested = [...new Set(tests.map(t => t.zoneId))];
    const palette = ['#2f7d4a', '#d9822b', '#3b6fb6', '#8a5fb8', '#b84a4a'];
    const phChart = U.lineChart(zonesTested.map((z, i) => ({ name: U.refName('zones', z) || 'Unknown', color: palette[i % palette.length], pts: tests.filter(t => t.zoneId === z).map(t => [t.date, t.ph]) })), { label: 'Soil pH by bed' });
    root.innerHTML = head('Soil', '', 'Mixes you build, test results per bed, and what you added to fix them.') + `
      <section class="card"><div class="cardhead"><h2>Soil pH by bed</h2></div>${phChart}</section>
      <section class="card"><div class="cardhead"><h2>Soil tests</h2>${addBtn('soilTests', 'Add soil test')}</div>${U.table('soilTests', tests)}</section>
      <section class="card"><div class="cardhead"><h2>Amendments applied</h2>${addBtn('amendments', 'Add amendment')}</div>${U.table('amendments', S.all('amendments').slice().sort(byDateDesc))}</section>
      <section class="card"><div class="cardhead"><h2>Soil & media mixes</h2>${addBtn('mixes', 'Add mix')}</div>${U.table('mixes', S.all('mixes').slice().sort(byName))}</section>`;
  };

})();
