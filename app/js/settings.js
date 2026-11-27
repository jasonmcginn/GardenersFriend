// Settings: sync, phones and other computers (install, pair, remove), app updates, backup.
window.GF = window.GF || {};

(() => {
  const U = GF.ui, esc = U.esc, Y = GF.sync, S = GF.store;
  let poll = null;
  GF.leaveSettings = () => { clearInterval(poll); poll = null; };

  const ago = iso => { if (!iso) return 'never'; const s = Math.round((Date.now() - Date.parse(iso)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return U.fmtDate(iso.slice(0, 10)); };
  function qrSvg(text, px = 220) {
    try { const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), c = px / (n + 8); let d = '';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) d += `M${((k + 4) * c).toFixed(2)} ${((r + 4) * c).toFixed(2)}h${c.toFixed(2)}v${c.toFixed(2)}h-${c.toFixed(2)}z`;
      return `<svg class="qr" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" role="img" aria-label="QR code"><rect width="${px}" height="${px}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`; }
    catch (e) { return '<p class="muted">QR code unavailable.</p>'; }
  }
  GF.qrSvg = qrSvg;

  function syncCard() {
    const st = S.syncState(), s = Y.status, c = Y.conn(), m = Y.mode();
    const head = m === 'pc' ? 'This is the PC that holds your garden data.' :
      m === 'paired' ? `Paired with <b>${esc(c.pcName || c.host)}</b>.` :
      'This device isn\'t connected to a PC. Everything is saved on this device only.';
    const review = st.review || [];
    return `<section class="card" id="syncCard"><div class="cardhead"><h2>Sync</h2>${m !== 'alone' ? `<button class="btn primary" data-act="syncnow"${s.syncing ? ' disabled' : ''}>${s.syncing ? 'Syncing…' : 'Sync now'}</button>` : ''}</div>
      <p>${head}</p>
      ${m !== 'alone' ? `<dl class="facts">
        <div><dt>Last sync</dt><dd>${esc(ago(st.lastSync))}</dd></div>
        <div><dt>Waiting to send</dt><dd>${st.pending}</dd></div>
        <div><dt>Connection</dt><dd class="${s.online ? '' : 'bad'}">${s.online ? 'Connected' : (s.syncing ? 'Connecting…' : 'Not connected')}</dd></div>
      </dl>` : ''}
      ${s.error ? `<p class="warnbox card">${esc(s.error)}</p>` : ''}
      ${s.tlsBad ? '<p class="warnbox card">The PC\'s security code has changed. Don\'t sync until you\'ve checked it: unpair and pair again with its QR code.</p>' : ''}
      ${review.length ? `<h3>Changed on two devices (${review.length})</h3><ul class="plain">${review.slice(0, 20).map(r => `<li><span class="muted nowrap">${esc(U.fmtDate((r.at || '').slice(0, 10)))}</span> · ${esc(GF.schema.entities[r.t] ? GF.schema.entities[r.t].one : r.t)} “${esc(U.refName(r.t, r.id) || r.id)}”${r.field ? ` · ${esc(r.field)}: kept <b>${esc(JSON.stringify(r.kept))}</b>, other was <b>${esc(JSON.stringify(r.other))}</b>` : ''} — ${esc(r.note)}</li>`).join('')}</ul>
        <button class="btn sm" data-act="clearreview">Clear this list</button>` : ''}
    </section>`;
  }

  // On the PC: get the phone app, pair phones and other computers, see and remove them.
  function pcCard() {
    return `<section class="card" id="pcCard"><h2>Phones and computers</h2><p class="muted">Loading…</p></section>`;
  }
  async function fillPc() {
    const el = document.getElementById('pcCard'); if (!el) return;
    let h, reqs, devs;
    try { [h, reqs, devs] = await Promise.all([Y.pc.hostinfo(), Y.pc.requests(), Y.pc.devices()]); }
    catch (e) { el.innerHTML = `<h2>Phones and computers</h2><p class="warnbox card">${esc(e.message === 'offline' ? 'The Gardener\'s Friend server isn\'t answering. Start it with start-gf.bat.' : e.message)}</p>`; return; }
    const ip = h.ips[0] || location.hostname, port = h.port;
    const pairUri = `gardenersfriend:pair?h=${encodeURIComponent(h.ips.join(','))}&p=${port}&k=${encodeURIComponent(h.tls.pin || '')}&n=${encodeURIComponent(h.instance.name)}`;
    const apkUrl = `https://${ip}:${port}/downloads/GardenersFriend.apk`;
    el.innerHTML = `<h2>Phones and computers</h2>
      <div class="pairgrid">
        <div><h3>1. Get the phone app</h3>
          ${h.apk ? `${qrSvg(apkUrl, 180)}<p class="small">Scan with the phone's camera, on the same Wi-Fi as this PC. The phone warns about the certificate the first time: tap <b>Advanced › Proceed</b>, then open the download and allow installing.</p><p class="small muted">${esc(apkUrl)}</p>`
            : `<p class="small">The phone app isn't on this PC yet. Run <b>server\\get-phone-app.bat</b> once (it downloads <code>GardenersFriend.apk</code> from GitHub into <code>server\\downloads</code>), then come back here for its QR code.</p>`}
        </div>
        <div><h3>2. Pair it</h3>${h.ips.length ? qrSvg(pairUri, 180) : '<p class="warnbox card">This PC has no network address. Connect it to Wi-Fi first.</p>'}
          <p class="small">In the phone app: <b>Settings › Pair with a PC › Scan the PC's QR code</b>. Or type <b class="nowrap">${esc(h.ips.join(' or ') || '—')}</b>, port <b>${port}</b>.</p>
          <p class="small">Security code <b class="nowrap code">${esc(h.tls.code || '—')}</b></p></div>
        <div><h3>Another computer</h3><p class="small">On it, open <b class="nowrap">https://${esc(ip)}:${port}</b>. First install this PC's certificate so the browser trusts it: <a href="/gf-ca.crt">download it here</a>, open it and choose <b>Install › Current user › Trusted Root Certification Authorities</b>. Then pair from Settings there.</p></div>
      </div>
      <h3>Waiting to join</h3>
      ${reqs.length ? `<ul class="devlist">${reqs.map(r => `<li><div><b>${esc(r.name)}</b> <span class="muted">${esc([r.model, r.os].filter(Boolean).join(' · '))}</span><br><span class="small">Shows the code <b class="code">${esc(r.code)}</b> — check it matches on the device.</span></div>
          <div class="row"><button class="btn primary sm" data-act="pairaccept" data-id="${esc(r.id)}">Accept</button><button class="btn sm ghost danger" data-act="pairdecline" data-id="${esc(r.id)}">Decline</button></div></li>`).join('')}</ul>`
        : '<p class="muted small">No one is asking to join. Requests show here as soon as a device asks.</p>'}
      <h3>Paired devices</h3>
      ${devs.length ? `<ul class="devlist">${devs.map(d => `<li><div><b>${esc(d.name)}</b> <span class="muted">${esc([d.model, d.os].filter(Boolean).join(' · '))}</span><br><span class="small muted">Last sync ${esc(ago(d.lastSync))}${d.lastIp ? ' · ' + esc(String(d.lastIp).replace('::ffff:', '')) : ''}</span></div>
          <button class="btn sm ghost danger" data-act="devremove" data-id="${esc(d.id)}" data-name="${esc(d.name)}">Remove</button></li>`).join('')}</ul>`
        : '<p class="muted small">None yet.</p>'}`;
  }

  // On a phone or another computer: pair with the PC, or show the pairing.
  function deviceCard() {
    const c = Y.conn(), m = Y.mode();
    if (m === 'paired') return `<section class="card"><h2>PC connection</h2>
      <dl class="facts"><div><dt>PC</dt><dd>${esc(c.pcName || '')}</dd></div><div><dt>Address</dt><dd>${esc(c.host)}:${esc(c.port)}</dd></div>
      ${c.pin ? `<div><dt>Security code</dt><dd class="code">${esc(Y.codeOf(c.pin))}</dd></div>` : ''}<div><dt>This device</dt><dd>${esc(c.deviceName || Y.deviceInfo().name)}</dd></div></dl>
      <div class="row" style="margin-top:14px"><button class="btn" data-act="changeaddr">PC has a new address</button><button class="btn ghost danger" data-act="unpair">Unpair</button></div></section>`;
    if (c.pending) return `<section class="card"><h2>Pair with a PC</h2>
      <p class="big-code">${esc(c.pending.code)}</p><p>On the PC, open <b>Settings</b> and accept <b>${esc(Y.deviceInfo().name)}</b>. Check it shows this same code.</p>
      <p class="muted small" id="pairWait">Waiting for the PC…</p><button class="btn ghost" data-act="paircancel">Cancel</button></section>`;
    const guessHost = Y.SERVED ? location.hostname : (c.host || '');
    return `<section class="card"><h2>Pair with a PC</h2>
      <p>Pairing lets this ${Y.NATIVE ? 'phone' : 'computer'} sync with the PC that runs Gardener's Friend, over your own Wi-Fi. No internet needed.</p>
      ${Y.NATIVE ? '<button class="btn primary" data-act="scanqr">Scan the PC\'s QR code</button><p class="muted small">On the PC: Settings › Phones and computers.</p><h3>Or type its address</h3>' : ''}
      <form class="row" id="pairForm" style="align-items:flex-end">
        <div class="fld" style="width:220px"><label for="pHost">PC address</label><input id="pHost" required value="${esc(guessHost)}" placeholder="192.168.1.20"></div>
        <div class="fld" style="width:110px"><label for="pPort">Port</label><input id="pPort" type="number" value="${esc(c.port || (Y.SERVED && location.port) || 4749)}"></div>
        <div class="fld" style="width:220px"><label for="pName">Name for this device</label><input id="pName" value="${esc(Y.deviceInfo().name)}"></div>
        <button class="btn primary" type="submit">Pair</button></form>
      <p class="err" id="pairErr" hidden></p><div id="pairConfirm"></div></section>`;
  }

  function updateCard() {
    if (!Y.NATIVE) return '';
    const u = Y.status.update;
    return `<section class="card"><h2>App version</h2><p>This phone runs version <b class="code">${esc(Y.rev() || 'unknown')}</b>.</p>
      ${u ? `<p>The PC has a newer version (<b class="code">${esc(u)}</b>).</p><button class="btn primary" data-act="installupdate">Install and restart</button>` : '<button class="btn" data-act="checkupdate">Check the PC for an update</button>'}
      <p class="err" id="updErr" hidden></p></section>`;
  }

  function backupCard() {
    const counts = Object.entries(GF.schema.entities).map(([t, d]) => `<li><span>${esc(d.label)}</span><b>${S.all(t).length}</b></li>`).join('');
    return `<div class="cols"><section class="card"><h2>Backup</h2>
        ${Y.NATIVE ? '<p class="small muted">Export backups from the PC.</p>' : '<div class="row"><button class="btn primary" data-act="export">Export backup (.json)</button>'}
        ${Y.NATIVE ? '<div class="row">' : ''}<label class="btn" for="importFile">Import backup…</label><input type="file" id="importFile" accept=".json,application/json" hidden></div>
        <p class="muted small">Importing replaces everything${Y.mode() !== 'alone' ? ', on every synced device' : ''}.${Y.ON_PC ? ' The PC also keeps a daily copy of everything in server\\data\\backups.' : ''}</p>
        <h2>Start fresh</h2>
        <div class="row"><button class="btn" data-act="seed">Load sample data</button><button class="btn danger" data-act="clear">Delete all data</button></div>
      </section><section class="card"><h2>What's stored</h2><ul class="counts">${counts}</ul></section></div>`;
  }

  // Keep the Sync card current while Settings is open.
  Y.on(() => { const el = document.getElementById('syncCard'); if (el) el.outerHTML = syncCard(); });
  S.on(k => { if (k === 'remote') { const el = document.getElementById('syncCard'); if (el) el.outerHTML = syncCard(); } });

  GF.views.settings = root => {
    GF.leaveSettings();
    const m = Y.mode();
    root.innerHTML = `<header class="vhead"><div><h1>Settings</h1><p class="lede">${Y.ON_PC ? 'Your data lives on this PC. Phones and other computers keep their own copy and sync with it over your Wi-Fi.' : 'Sync, the PC connection, and backups.'}</p></div></header>` +
      syncCard() + (Y.ON_PC ? pcCard() : deviceCard()) + updateCard() + backupCard();
    if (Y.ON_PC) { fillPc(); poll = setInterval(() => { if (!document.getElementById('pcCard')) return GF.leaveSettings(); if (!document.querySelector('#pcCard :focus')) fillPc(); }, 4000); }
    const c = Y.conn();
    if (!Y.ON_PC && c.pending) { const check = async () => { try { const r = await Y.pairStatus(); if (r.status !== 'pending') { GF.leaveSettings(); GF.render(); if (r.status === 'declined') alert('The PC declined this device.'); } } catch (e) { const w = document.getElementById('pairWait'); if (w) w.textContent = 'Can\'t reach the PC right now — still trying…'; } }; check(); poll = setInterval(check, 2500); }
    const form = document.getElementById('pairForm');
    if (form) form.addEventListener('submit', async e => { e.preventDefault();
      const host = document.getElementById('pHost').value.trim().replace(/^https?:\/\//, '').replace(/[:/].*$/, ''), port = +document.getElementById('pPort').value || 4749;
      Y.setName(document.getElementById('pName').value.trim());
      await pairTyped(host, port); });
    if (m === 'paired') Y.checkUpdate();
  };

  const err = (id, msg) => { const p = document.getElementById(id); if (p) { p.textContent = msg; p.hidden = !msg; } };
  async function pairTyped(host, port) {
    err('pairErr', '');
    if (!host) return err('pairErr', 'Type the PC\'s address.');
    const pr = await Y.probe(host, port); if (!pr.ok) return err('pairErr', pr.error);
    if (!pr.pin) return go(host, port, null);   // a browser on another computer: the browser checks the certificate
    // Typed address: compare the code with the one on the PC before trusting it.
    document.getElementById('pairConfirm').innerHTML = `<div class="card warnbox"><p>The PC at ${esc(host)} shows this security code:</p><p class="big-code">${esc(pr.code)}</p>
      <p>Does it match the code under the QR code in Settings on the PC?</p><div class="row"><button class="btn primary" id="pcYes">Yes, it matches</button><button class="btn ghost" id="pcNo">No</button></div></div>`;
    document.getElementById('pcYes').onclick = () => go(host, port, pr.pin);
    document.getElementById('pcNo').onclick = () => { document.getElementById('pairConfirm').innerHTML = ''; err('pairErr', 'Don\'t pair: something on this network may be pretending to be your PC. Check the address on the PC.'); };
  }
  async function go(host, port, pin) {
    try { await Y.startPair(host, port, pin); GF.render(); }
    catch (e) { err('pairErr', e.message === 'offline' ? `Can't reach ${host}:${port}. ${Y.NATIVE ? '' : 'If this browser doesn\'t trust the PC\'s certificate yet, open https://' + host + ':' + port + ' once and install the certificate (see Settings on the PC). '}Check you're on the same Wi-Fi and Gardener's Friend is running on the PC.` : e.message); }
  }
  // The pairing QR code: gardenersfriend:pair?h=<addresses>&p=<port>&k=<key>&n=<name>. Uses the address whose key matches.
  async function pairFromQr(text) {
    const m = String(text || '').match(/^gardenersfriend:pair\?(.*)$/); if (!m) return err('pairErr', 'That isn\'t a Gardener\'s Friend pairing code.');
    const q = new URLSearchParams(m[1]), port = +q.get('p') || 4749, pin = q.get('k'), hosts = (q.get('h') || '').split(',').filter(Boolean);
    for (const host of hosts) { const pr = await Y.probe(host, port); if (!pr.ok) continue;
      if (pr.pin !== pin) return err('pairErr', 'The PC\'s security code doesn\'t match its QR code. Don\'t pair: something on this network may be in the way.');
      return go(host, port, pin); }
    err('pairErr', `Can't reach the PC at ${hosts.join(' or ')}. Check this phone is on the same Wi-Fi.`);
  }

  // Settings actions (called from app.js click handling)
  GF.settingsAct = async (act, b) => {
    switch (act) {
      case 'syncnow': { const r = await Y.sync(); GF.render(); if (!r.ok && r.error) {} break; }
      case 'clearreview': S.clearReview(); GF.render(); break;
      case 'pairaccept': try { await Y.pc.accept(b.dataset.id); } catch (e) { alert(e.message); } fillPc(); break;
      case 'pairdecline': try { await Y.pc.decline(b.dataset.id); } catch (e) {} fillPc(); break;
      case 'devremove': if (confirm(`Remove “${b.dataset.name}”? It stops syncing; its own copy of the data stays on it.`)) { try { await Y.pc.removeDevice(b.dataset.id); } catch (e) { alert(e.message); } fillPc(); } break;
      case 'unpair': if (confirm('Unpair from the PC? This device keeps its copy of the data, but stops syncing.')) { Y.unpair(); GF.render(); } break;
      case 'paircancel': { const c = Y.conn(); delete c.pending; localStorage.setItem('gf.conn', JSON.stringify(c)); GF.render(); break; }
      case 'changeaddr': { const c = Y.conn(); const h = prompt('The PC\'s new address (Settings on the PC shows it):', c.host || ''); if (!h) break;
        const pr = await Y.probe(h.trim(), c.port || 4749);
        if (!pr.ok) { alert(pr.error); break; }
        if (pr.pin && c.pin && pr.pin !== c.pin) { alert('That address answers with a different security code. It isn\'t your PC, so nothing was changed.'); break; }
        localStorage.setItem('gf.conn', JSON.stringify(Object.assign(c, { host: h.trim() }))); Y.sync().then(GF.render); break; }
      case 'scanqr': {
        const BS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BarcodeScanner;
        if (!BS) return err('pairErr', 'The scanner isn\'t available. Type the address instead.');
        try {
          try { const a = await BS.isGoogleBarcodeScannerModuleAvailable(); if (a && a.available === false) await BS.installGoogleBarcodeScannerModule(); } catch (e) {}
          const r = await BS.scan({ formats: ['QR_CODE'] }); const v = r && r.barcodes && r.barcodes[0] && r.barcodes[0].rawValue;
          if (v) await pairFromQr(v);
        } catch (e) { err('pairErr', 'Couldn\'t scan: ' + (e.message || e) + '. Type the address instead.'); }
        break; }
      case 'checkupdate': { const u = await Y.checkUpdate(true); GF.render(); if (!u) err('updErr', Y.status.online ? 'You have the same version as the PC.' : 'Can\'t reach the PC.'); break; }
      case 'installupdate': try { b.disabled = true; b.textContent = 'Installing…'; await Y.installUpdate(); } catch (e) { err('updErr', e.message); b.disabled = false; b.textContent = 'Install and restart'; } break;
    }
  };
})();
