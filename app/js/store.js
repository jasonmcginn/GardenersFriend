// Storage adapter (localStorage). To move to a backend, replace this file with one that exposes
// the same methods: all, get, save, remove, exportJSON, importJSON, reset, isEmpty.
window.GF = window.GF || {};

GF.store = (() => {
  const KEY = 'gardenersFriend.v1';
  const tables = () => Object.keys(GF.schema.entities);
  const blank = () => { const o = { meta: { version: 1 } }; tables().forEach(t => (o[t] = [])); return o; };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? JSON.parse(raw) : blank();
      tables().forEach(t => { if (!Array.isArray(d[t])) d[t] = []; });
      return d;
    } catch (e) { console.warn('Could not read saved data', e); return blank(); }
  }
  let db = load();

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { alert('Could not save — browser storage may be full or disabled. Export a backup now.'); }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();

  return {
    all: t => db[t] || [],
    get: (t, id) => (db[t] || []).find(r => r.id === id) || null,
    save(t, rec) {
      const list = db[t];
      if (rec.id) {
        const i = list.findIndex(r => r.id === rec.id);
        rec.updated = now();
        if (i >= 0) list[i] = rec; else list.push(rec);
      } else {
        rec.id = uid(); rec.created = rec.updated = now(); list.push(rec);
      }
      persist(); return rec;
    },
    remove(t, id) { db[t] = db[t].filter(r => r.id !== id); persist(); },
    removeWhere(t, fn) { db[t] = db[t].filter(r => !fn(r)); persist(); },
    exportJSON: () => JSON.stringify(db, null, 2),
    importJSON(text) {
      const d = JSON.parse(text);
      if (typeof d !== 'object' || !d) throw new Error('Not a Gardener\'s Friend backup');
      tables().forEach(t => { if (!Array.isArray(d[t])) d[t] = []; });
      db = d; persist();
    },
    reset() { db = blank(); persist(); },
    isEmpty: () => tables().every(t => !db[t].length)
  };
})();
