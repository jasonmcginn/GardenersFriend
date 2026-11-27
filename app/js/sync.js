// Connection to the Gardener's Friend PC, and syncing. Three ways the app can be running:
//
//   pc       opened in the browser on the PC that runs the server (https://localhost:4749): syncs with no pairing
//   paired   the phone app, or a browser on another computer: paired with the PC once, then signs each request with its token
//   alone    not connected to a PC (opened from the file, or not paired yet): everything still works on this device
//
// HTTPS to the PC: its certificate is its own. A browser on the PC trusts it (start-gf.bat installs it). The phone app pins the
// PC's key (the security code, which the pairing QR code carries) through its GfTls plugin. Another computer installs the
// PC's certificate from Settings first. Same approach as Field Service Ops.
window.GF = window.GF || {};

GF.sync = (() => {
  const S = GF.store;
  const NATIVE = (() => { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } })();
  const SERVED = /^https?:$/.test(location.protocol) && !NATIVE;
  const ON_PC = SERVED && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  GF.deviceId = LS.get('gf.deviceId', null) || (() => { const d = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); LS.set('gf.deviceId', d); return d; })();
  GF.clockSkew = LS.get('gf.skew', 0) || 0;
  const conn = { get: () => LS.get('gf.conn', {}), set: v => LS.set('gf.conn', v) };
  const status = { mode: 'alone', online: false, syncing: false, error: '', update: null, tlsBad: false };
  const listeners = new Set();
  const emit = () => { status.pending = S.syncState().pending; listeners.forEach(fn => { try { fn(status); } catch (e) { console.error(e); } }); };

  const mode = () => ON_PC ? 'pc' : (conn.get().token ? 'paired' : 'alone');
  const base = () => { if (ON_PC) return location.origin; const c = conn.get(); return c.host ? `https://${c.host}:${c.port || 4749}` : (SERVED ? location.origin : ''); };

  /* ---------- HTTPS through the phone's pinned connection ---------- */
  const NT = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GfTls) || null;
  const codeOf = b64 => { try { return [...atob(b64)].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 20).match(/.{4}/g).join(' '); } catch (e) { return ''; } };
  async function request(url, opts = {}, ms = 10000) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const tok = conn.get().token; if (tok && !ON_PC) headers['X-GF-Device'] = tok;
    const body = opts.body == null ? undefined : (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    let st, txt, date;
    if (NATIVE && NT() && /^https:/.test(url)) {
      let r; try { r = await NT().request({ url, method: opts.method || 'GET', headers, body, timeout: ms }); }
      catch (e) { if (e && e.code === 'TLS') { status.tlsBad = true; emit(); } throw new Error('offline'); }
      if (status.tlsBad) { status.tlsBad = false; emit(); }
      st = r.status; const bin = atob(r.data || ''); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      txt = new TextDecoder().decode(bytes); date = (r.headers || {}).Date || (r.headers || {}).date;
    } else {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
      let r; try { r = await fetch(url, { method: opts.method || 'GET', headers, body, signal: ctl.signal }); } catch (e) { throw new Error('offline'); } finally { clearTimeout(tm); }
      st = r.status; txt = await r.text(); date = r.headers.get('Date');
    }
    if (date) { const sk = Date.parse(date) - Date.now(); if (isFinite(sk) && Math.abs(sk) > 2000) { GF.clockSkew = sk; LS.set('gf.skew', sk); } }
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (st === 401 && j && j.unpaired && !ON_PC) { const c = conn.get(); delete c.token; conn.set(c); status.error = 'This device was removed on the PC. Pair it again.'; emit(); }
    if (st >= 400) { const e = new Error((j && j.error) || ('HTTP ' + st)); e.status = st; throw e; }
    return j;
  }
  const api = (p, opts, ms) => request(base() + p, opts, ms);

  /* ---------- sync ---------- */
  let timer = null, running = null;
  async function sync() {
    if (mode() === 'alone') return { ok: false, error: 'Not connected to a PC.' };
    if (running) return running;
    running = (async () => {
      status.syncing = true; status.error = ''; emit();
      try {
        const st = S.syncState(), out = S.outgoing();
        const res = await api('/api/sync', { method: 'POST', body: { since: st.since, changes: out.map(c => ({ t: c.t, id: c.id, rec: c.rec, base: c.base })) } }, 30000);
        const n = S.applySync(out, res, res.instance && res.instance.id);
        const c = conn.get(); if (!ON_PC && res.instance) conn.set(Object.assign(c, { pcName: res.instance.name }));
        status.online = true; status.syncing = false; emit();
        if (!ON_PC) checkUpdate();
        return { ok: true, sent: out.length, received: n, conflicts: (res.conflicts || []).length };
      } catch (e) {
        status.online = false; status.syncing = false;
        status.error = e.message === 'offline' ? (ON_PC ? 'The Gardener\'s Friend server isn\'t answering. Is its window still open?' : 'Can\'t reach the PC. Changes are saved here and will sync when you\'re back on its Wi-Fi.') : e.message;
        emit(); if (e.message === 'offline' && NATIVE) tryOtherAddresses();
        return { ok: false, error: status.error };
      } finally { running = null; }
    })();
    return running;
  }
  const soon = (ms = 1200) => { clearTimeout(timer); timer = setTimeout(sync, ms); };
  S.on(kind => { emit(); if (kind === 'local' && mode() !== 'alone') soon(); });

  /* ---------- the same PC on another network: try the other addresses it reported (only ones with the pinned key) ---------- */
  let altAt = 0;
  async function tryOtherAddresses() {
    const c = conn.get(); if (!c.pin || !NT() || Date.now() - altAt < 30000) return; altAt = Date.now();
    for (const ip of (c.ips || []).filter(ip => ip !== c.host)) {
      try { const pr = await NT().probe({ host: ip, port: c.port || 4749 }); if (pr.pin === c.pin) { conn.set(Object.assign(conn.get(), { host: ip })); soon(100); return; } } catch (e) {}
    }
  }

  /* ---------- pairing (phone app or another computer) ---------- */
  // Check the PC's key before trusting it: it must match the QR code, or the person compares the code shown on the PC.
  async function probe(host, port) {
    if (!NATIVE || !NT()) return { ok: true, pin: null };
    try { const pr = await NT().probe({ host, port }); return { ok: true, pin: pr.pin, code: codeOf(pr.pin) }; }
    catch (e) { return { ok: false, error: `Can't reach ${host}:${port}. Check this phone is on the same Wi-Fi as the PC and that Gardener's Friend is running there.` }; }
  }
  async function startPair(host, port, pin) {
    port = Number(port) || 4749;
    if (NATIVE && NT()) { if (!pin) throw new Error('No security code.'); await NT().pin({ pin }); }
    conn.set({ host, port, pin: pin || null, pending: null });
    const info = deviceInfo();
    const r = await request(`https://${host}:${port}/api/pair/request`, { method: 'POST', body: Object.assign({ deviceId: GF.deviceId }, info) });
    conn.set(Object.assign(conn.get(), { pending: { req: r.req, secret: r.secret, code: r.code }, pcName: r.instance && r.instance.name }));
    return r;
  }
  async function pairStatus() {
    const c = conn.get(); if (!c.pending) return { status: 'none' };
    const r = await request(`https://${c.host}:${c.port}/api/pair/status?req=${encodeURIComponent(c.pending.req)}&secret=${encodeURIComponent(c.pending.secret)}`);
    if (r.status === 'accepted') { conn.set(Object.assign(c, { token: r.token, pending: null, ips: r.ips || [], pcName: r.instance && r.instance.name, deviceName: r.device && r.device.name })); status.error = ''; S.forgetSync(); start(); }
    else if (r.status === 'declined' || r.status === 'expired') { conn.set(Object.assign(c, { pending: null })); }
    return r;
  }
  function unpair() { conn.set({}); S.forgetSync(); status.online = false; status.error = ''; status.mode = 'alone'; emit(); }
  function deviceInfo() {
    const ua = navigator.userAgent || '';
    const model = (ua.match(/Android [\d.]+; ([^;)]+)/) || [])[1] || (/Windows/.test(ua) ? 'Windows PC' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux computer' : '');
    return { name: LS.get('gf.deviceName', '') || (NATIVE ? (model || 'Phone') : 'Browser on ' + (model || 'another computer')), model, os: (ua.match(/Android [\d.]+|Windows NT [\d.]+|Mac OS X [\d_]+/) || [''])[0], kind: NATIVE ? 'phone' : 'computer', app: GF_REV() };
  }

  /* ---------- app updates from the PC (phone app only) ---------- */
  function GF_REV() { return window.GF_REV || ''; }
  let updAt = 0;
  async function checkUpdate(force) {
    if (!NATIVE || mode() !== 'paired' || (!force && Date.now() - updAt < 60000)) return status.update;
    updAt = Date.now();
    try { const j = await api('/api/app/rev', {}, 5000); status.update = j.rev && GF_REV() && j.rev !== GF_REV() ? j.rev : null; emit(); } catch (e) {}
    return status.update;
  }
  async function installUpdate() {
    if (S.syncState().pending) await sync();
    const j = await api('/api/app/phone', {}, 120000);
    if (!j || !j.html || !j.rev || j.html.indexOf(j.rev) < 0) throw new Error('The update didn\'t download completely. Try again.');
    await new Promise((res, rej) => { const q = indexedDB.open('gf-ota', 1); q.onupgradeneeded = () => q.result.createObjectStore('f'); q.onerror = () => rej(q.error);
      q.onsuccess = () => { const t = q.result.transaction('f', 'readwrite'); t.objectStore('f').put(j.html, 'html'); t.oncomplete = res; t.onerror = () => rej(t.error); }; });
    localStorage.setItem('gf.ota', JSON.stringify({ rev: j.rev, bundle: window.GF_BUNDLE_REV || GF_REV(), at: new Date().toISOString() }));
    if (/[?&]noota=1/.test(location.search)) location.replace(location.pathname + location.hash); else location.reload();
  }

  /* ---------- for Settings on the PC ---------- */
  const pc = {
    hostinfo: () => api('/api/pair/hostinfo'),
    requests: () => api('/api/pair/requests'),
    accept: id => api(`/api/pair/${encodeURIComponent(id)}/accept`, { method: 'POST', body: {} }),
    decline: id => api(`/api/pair/${encodeURIComponent(id)}/decline`, { method: 'POST', body: {} }),
    devices: () => api('/api/devices'),
    removeDevice: id => api(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' })
  };

  let started = false;
  function start() {
    status.mode = mode(); emit();
    if (status.mode === 'alone') return;
    sync();
    if (started) return; started = true;
    setInterval(() => { if (document.visibilityState === 'visible' && mode() !== 'alone') sync(); }, ON_PC ? 15000 : 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && mode() !== 'alone') soon(300); });
    window.addEventListener('online', () => soon(300));
  }

  return {
    NATIVE, ON_PC, SERVED, status, mode, conn: () => conn.get(), on: fn => (listeners.add(fn), () => listeners.delete(fn)),
    sync, start, probe, startPair, pairStatus, unpair, codeOf, checkUpdate, installUpdate, pc, rev: GF_REV,
    setName: n => LS.set('gf.deviceName', String(n || '').slice(0, 60)), deviceInfo
  };
})();
