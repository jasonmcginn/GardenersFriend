// Storage on this device, ready to sync. Every device (the PC's browser, a phone, another computer) keeps its own full copy,
// so the app works with no connection. Changes wait in an outbox until GF.sync sends them to the PC.
//
//   data    the records, by table
//   base    the last copy each record had when it was synced (for the three-way merge on the PC)
//   outbox  records changed on this device since the last sync ("table/id" → change number)
//   since   the PC's change number this device has caught up to
//
// Kept in localStorage under gardenersFriend.v1. Older saves (just the tables) are moved into this shape on load,
// with every record waiting to be sent.
window.GF = window.GF || {};

GF.store = (() => {
  const KEY = 'gardenersFriend.v1';
  const tables = () => Object.keys(GF.schema.entities);
  const listeners = new Set();
  let st = load();
  let ver = 0;

  function fresh() { const d = {}; tables().forEach(t => (d[t] = [])); return { v: 2, data: d, base: {}, outbox: {}, since: 0, lastSync: null, review: [], pc: null }; }
  function load() {
    let s;
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (!d) s = fresh();
      else if (d.v === 2) s = Object.assign(fresh(), d);
      else { s = fresh(); tables().forEach(t => { if (Array.isArray(d[t])) s.data[t] = d[t]; }); tables().forEach(t => s.data[t].forEach(r => { if (r.id) s.outbox[t + '/' + r.id] = 1; })); }
    } catch (e) { console.warn('Could not read saved data', e); s = fresh(); }
    tables().forEach(t => { if (!Array.isArray(s.data[t])) s.data[t] = []; });
    return s;
  }
  let warned = false;
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); warned = false; }
    catch (e) { if (!warned) { warned = true; alert('Could not save on this device — storage may be full. Sync with the PC or export a backup now.'); } }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date(Date.now() + (GF.clockSkew || 0)).toISOString();
  const dev = () => (GF.deviceId || '');
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  function mark(t, id) { st.outbox[t + '/' + id] = ++ver + Date.now(); emit('local'); }
  function emit(kind, info) { listeners.forEach(fn => { try { fn(kind, info); } catch (e) { console.error(e); } }); }

  const api = {
    all: t => st.data[t] || [],
    get: (t, id) => (st.data[t] || []).find(r => r.id === id) || null,
    save(t, rec) {
      const list = st.data[t];
      rec._at = now(); rec._dev = dev();
      if (rec.id) {
        const i = list.findIndex(r => r.id === rec.id);
        rec.updated = rec._at;
        if (i >= 0) list[i] = rec; else list.push(rec);
      } else { rec.id = uid(); rec.created = rec.updated = rec._at; list.push(rec); }
      persist(); mark(t, rec.id); return rec;
    },
    remove(t, id) { st.data[t] = st.data[t].filter(r => r.id !== id); persist(); mark(t, id); },
    removeWhere(t, fn) { const gone = st.data[t].filter(fn); st.data[t] = st.data[t].filter(r => !fn(r)); persist(); gone.forEach(r => mark(t, r.id)); },
    exportJSON: () => { const o = { format: 'gardeners-friend', version: 2, exportedAt: new Date().toISOString() }; tables().forEach(t => (o[t] = st.data[t])); return JSON.stringify(o, null, 2); },
    importJSON(text) {
      const d = JSON.parse(text);
      if (typeof d !== 'object' || !d) throw new Error('Not a Gardener\'s Friend backup');
      const src = d.data && d.v === 2 ? d.data : d;
      tables().forEach(t => {
        const incoming = Array.isArray(src[t]) ? src[t] : [];
        const ids = new Set(incoming.map(r => r.id));
        st.data[t].forEach(r => { if (!ids.has(r.id)) st.outbox[t + '/' + r.id] = 1; });
        st.data[t] = incoming.map(r => Object.assign({}, r, { id: r.id || uid(), _at: now(), _dev: dev() }));
        st.data[t].forEach(r => { st.outbox[t + '/' + r.id] = 1; });
      });
      persist(); emit('local');
    },
    reset() { tables().forEach(t => { st.data[t].forEach(r => { st.outbox[t + '/' + r.id] = 1; }); st.data[t] = []; }); persist(); emit('local'); },
    isEmpty: () => tables().every(t => !st.data[t].length),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /* ---- for GF.sync ---- */
    syncState: () => ({ since: st.since, lastSync: st.lastSync, pending: Object.keys(st.outbox).length, review: st.review, pc: st.pc }),
    // The changes to send: the current record (null if deleted) and the copy it started from.
    outgoing() {
      return Object.entries(st.outbox).map(([k, v]) => { const [t, id] = k.split('/');
        return { key: k, v, t, id, rec: clone(api.get(t, id)), base: k in st.base ? clone(st.base[k]) : null }; }).filter(c => GF.schema.entities[c.t]);
    },
    // The PC's answer: what it now holds for each record that changed. A record edited again while the sync was on its way
    // keeps this device's edit (still in the outbox), with the PC's copy as its new base.
    applySync(sent, res, pcId) {
      const sentV = new Map(sent.map(c => [c.key, c.v]));
      if (res.reset || (st.pc && pcId && st.pc !== pcId)) { st.base = {}; Object.keys(st.data).forEach(t => st.data[t].forEach(r => { st.outbox[t + '/' + r.id] = st.outbox[t + '/' + r.id] || 1; })); }
      for (const k of sentV.keys()) if (st.outbox[k] === sentV.get(k)) delete st.outbox[k];
      const changed = [];
      for (const c of res.changes || []) {
        if (!GF.schema.entities[c.t]) continue;
        const k = c.t + '/' + c.id; st.base[k] = clone(c.rec);
        if (st.outbox[k]) continue;
        const list = st.data[c.t], i = list.findIndex(r => r.id === c.id);
        if (c.rec == null) { if (i >= 0) { list.splice(i, 1); changed.push(k); } }
        else if (i >= 0) { if (JSON.stringify(list[i]) !== JSON.stringify(c.rec)) { list[i] = clone(c.rec); changed.push(k); } }
        else { list.push(clone(c.rec)); changed.push(k); }
      }
      if (res.conflicts && res.conflicts.length) st.review = [...res.conflicts, ...st.review].slice(0, 100);
      st.since = res.seq; st.lastSync = new Date().toISOString(); if (pcId) st.pc = pcId;
      persist();
      if (changed.length) emit('remote', changed);
      return changed.length;
    },
    clearReview() { st.review = []; persist(); },
    // Unpairing: forget what was synced, keep the records (they're sent again if this device pairs with a PC later).
    forgetSync() { st.base = {}; st.since = 0; st.lastSync = null; st.pc = null; Object.keys(st.data).forEach(t => st.data[t].forEach(r => { st.outbox[t + '/' + r.id] = 1; })); persist(); }
  };
  return api;
})();
