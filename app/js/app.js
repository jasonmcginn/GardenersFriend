// Router and delegated event handling.
window.GF = window.GF || {};

(() => {
  const S = GF.store, U = GF.ui, V = GF.views;
  GF.state = { showArchived: false, calc: { sched: '', row: 0, vol: 10 }, hist: { plant: '', type: '' }, calcItems: [] };

  const routes = {
    dashboard: V.dashboard,
    plants: V.plants,
    plant: V.plant,
    zones: V.list('zones', 'Tents, rooms, greenhouses, beds and containers. Plants, lights and soil tests belong to a zone.'),
    schedules: V.schedules,
    calc: V.calc,
    history: V.history,
    inventory: V.list('inventory', 'Set a “reorder at” level to get low-stock warnings on the dashboard.'),
    lights: V.list('lights', 'Hours used and lamp life count from the install date. DLI = daily light integral in mol/m²/day.'),
    soil: V.soil,
    yield: V.yield,
    backup: V.backup
  };

  const main = document.getElementById('view');

  function render() {
    const [name, param] = (location.hash.slice(1) || 'dashboard').split('/');
    const fn = routes[name] || routes.dashboard;
    const navName = name === 'plant' ? 'plants' : (routes[name] ? name : 'dashboard');
    document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + navName));
    try {
      fn(main, param);
      // label table cells so tables can stack on phones
      main.querySelectorAll('table.stack').forEach(tb => {
        const hs = [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim());
        tb.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { td.dataset.l = hs[i] || ''; }));
      });
    }
    catch (e) { console.error(e); main.innerHTML = `<div class="card warnbox">Something went wrong drawing this page: ${U.esc(e.message)}</div>`; }
    document.body.classList.remove('menu-open');
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  const DATED = ['logs', 'harvests', 'soilTests', 'amendments'];

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-close],[data-menu]');
    if (!b) return;
    if (b.hasAttribute('data-close')) { document.getElementById('dlg').close(); return; }
    if (b.hasAttribute('data-menu')) { document.body.classList.toggle('menu-open'); return; }
    const { act, t, id } = b.dataset;
    switch (act) {
      case 'add': {
        const pre = {};
        if (DATED.includes(t)) pre.date = U.today();
        if (b.dataset.plant) pre.plantId = b.dataset.plant;
        if (b.dataset.cat) pre.category = b.dataset.cat;
        if (t === 'plants') { pre.startDate = U.today(); pre.stage = 'Seed'; }
        if (t === 'schedules') pre.rows = [];
        U.openForm(t, null, pre, render);
        break;
      }
      case 'edit': U.openForm(t, S.get(t, id), null, render); break;
      case 'del': {
        const r = S.get(t, id); if (!r) return;
        const label = r.name || U.refName('plants', r.plantId) || 'this entry';
        if (t === 'plants') {
          const n = S.all('logs').filter(l => l.plantId === id).length + S.all('harvests').filter(h => h.plantId === id).length;
          if (!confirm(`Delete “${label}”${n ? ` and its ${n} log and harvest entries` : ''}? This can't be undone.`)) return;
          S.removeWhere('logs', l => l.plantId === id); S.removeWhere('harvests', h => h.plantId === id);
          S.remove(t, id);
          if (location.hash.startsWith('#plant/')) { location.hash = '#plants'; return; }
        } else {
          if (!confirm(`Delete ${t === 'logs' ? 'this log entry' : '“' + label + '”'}? This can't be undone.`)) return;
          S.remove(t, id);
        }
        render(); break;
      }
      case 'quicklog':
        U.openForm('logs', null, { plantId: b.dataset.plant, type: b.dataset.type, date: U.today() }, render); break;
      case 'addrow': {
        const s = S.get('schedules', id); s.rows = s.rows || [];
        const prev = s.rows[s.rows.length - 1];
        s.rows.push({ label: 'Step ' + (s.rows.length + 1), stage: prev ? prev.stage : 'Vegetative', phMin: prev ? prev.phMin : 5.8, phMax: prev ? prev.phMax : 6.5, ec: '', doses: prev ? { ...prev.doses } : {} });
        S.save('schedules', s); render(); break;
      }
      case 'delrow': {
        const s = S.get('schedules', id); s.rows.splice(+b.dataset.row, 1); S.save('schedules', s); render(); break;
      }
      case 'usecalc': GF.state.calc.sched = id; GF.state.calc.row = 0; break;
      case 'calclog': {
        const pid = document.getElementById('cPlant').value;
        if (!pid) { document.getElementById('cPlant').focus(); return; }
        const deduct = document.getElementById('cDeduct').checked;
        const items = GF.state.calcItems.slice();
        const vol = +GF.state.calc.vol || null;
        U.openForm('logs', null, { plantId: pid, type: 'Feed', date: U.today(), volume: vol, nutrients: items.map(x => `${x.name} ${x.ml} ml`).join(', ') }, () => {
          if (deduct) items.forEach(x => {
            const inv = S.get('inventory', x.id); if (!inv || GF.num(inv.qty) == null) return;
            const used = inv.unit === 'L' ? x.ml / 1000 : inv.unit === 'ml' ? x.ml : null;
            if (used == null) return;
            inv.qty = Math.max(0, +(inv.qty - used).toFixed(3)); S.save('inventory', inv);
          });
          render();
        });
        break;
      }
      case 'seed':
        if (!S.isEmpty() && !confirm('Add sample data alongside what you already have?')) return;
        GF.loadSample(); location.hash = '#dashboard'; render(); break;
      case 'export': {
        const blob = new Blob([S.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `gardeners-friend-backup-${U.today()}.json`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case 'clear':
        if (confirm('Delete ALL data in Gardener\'s Friend? Export a backup first if you might want it.')) { S.reset(); render(); }
        break;
    }
  });

  document.addEventListener('change', e => {
    const el = e.target, d = el.dataset;
    if (d.sched) {
      const s = S.get('schedules', d.sched); const r = s && s.rows[+d.row]; if (!r) return;
      if (d.dose) { r.doses = r.doses || {}; const v = GF.num(el.value); if (v == null) delete r.doses[d.dose]; else r.doses[d.dose] = v; }
      else r[d.field] = ['phMin', 'phMax', 'ec'].includes(d.field) ? GF.num(el.value) : el.value;
      S.save('schedules', s);
    } else if (d.calc) {
      GF.state.calc[d.calc] = d.calc === 'row' ? +el.value : el.value;
      if (d.calc === 'sched') GF.state.calc.row = 0;
      render();
      if (d.calc === 'vol') { const v = document.getElementById('cVol'); v && v.focus(); }
    } else if (d.hist) { GF.state.hist[d.hist] = el.value; render(); }
    else if (d.ui === 'showArchived') { GF.state.showArchived = el.checked; render(); }
    else if (el.id === 'importFile' && el.files[0]) {
      el.files[0].text().then(txt => {
        if (!confirm('Replace all current data with this backup?')) return;
        try { S.importJSON(txt); alert('Backup imported.'); render(); }
        catch (err) { alert('That file could not be imported: ' + err.message); }
      });
    }
  });

  render();
})();
