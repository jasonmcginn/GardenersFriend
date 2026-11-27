// Gardener's Friend desktop server: serves the app to this PC, and syncs it with paired phones and other computers.
// Node.js 20+, no add-on libraries. Nothing here talks to the internet: phones reach this PC over the local Wi-Fi.
//
//   https://localhost:4749        the app on this PC (no sign-in: only this PC counts as "local")
//   /api/sync                      every device sends its changes and gets everything that changed since its last sync
//   /api/pair/*                    a phone or another computer asks to join; it's accepted in Settings on this PC
//   /api/app/*                     the app's current version, so phones can update themselves from this PC
//   /downloads/GardenersFriend.apk the phone app, served from server\downloads (Settings shows a QR code to it)
//
// Data: server\data\db.json (written atomically), a daily copy in data\backups (last 30), certificates in data\tls.
// Design borrowed from Field Service Ops (same author): its own certificate authority, pinned keys on the phone, device tokens.
"use strict";
const http = require("http"), https = require("https"), net = require("net"), fs = require("fs"), path = require("path"), os = require("os"), crypto = require("crypto");
const { bundle } = require("./bundle");

const PORT = Number(process.env.PORT || 4749);
const APP_DIR = path.resolve(process.env.GF_APP_DIR || path.join(__dirname, "..", "app"));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const DL_DIR = path.resolve(process.env.GF_DOWNLOADS || path.join(__dirname, "downloads"));
const DB_FILE = path.join(DATA_DIR, "db.json"), BACKUP_DIR = path.join(DATA_DIR, "backups");
const KEEP_DAYS = Math.max(3, Number(process.env.GF_DAILY_KEEP || 30));
const APK = "GardenersFriend.apk";
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- the database ---------- */
// recs["table/id"] = { t, id, rec, seq, at }   rec null = deleted (kept so other devices learn about the delete)
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) { if (fs.existsSync(DB_FILE)) { console.error("db.json can't be read:", e.message); process.exit(1); } db = {}; }
db.instance = db.instance || { id: crypto.randomUUID(), name: process.env.GF_NAME || os.hostname() || "Desktop", createdAt: new Date().toISOString() };
db.seq = db.seq || 0; db.recs = db.recs || {}; db.devices = db.devices || {}; db.pairReqs = db.pairReqs || {};
let saveTimer = null;
function saveNow(){
  clearTimeout(saveTimer); saveTimer = null;
  const day = new Date().toISOString().slice(0, 10), bf = path.join(BACKUP_DIR, `db-${day}.json`);
  try { if (fs.existsSync(DB_FILE) && !fs.existsSync(bf)) { fs.mkdirSync(BACKUP_DIR, { recursive: true }); fs.copyFileSync(DB_FILE, bf);
      const old = fs.readdirSync(BACKUP_DIR).filter(f => /^db-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(0, -KEEP_DAYS); for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f)); } } catch (e) { console.error("Daily backup failed:", e.message); }
  const tmp = DB_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE);
}
const persist = () => { if (!saveTimer) saveTimer = setTimeout(saveNow, 300); };
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { try { if (saveTimer) saveNow(); } finally { process.exit(0); } });

/* ---------- merging: the same record changed on two devices ---------- */
// Three-way merge against the copy both started from (base). Fields changed on one side are taken from that side;
// lists of items with an id merge item by item; the same field changed on both sides: the newer edit (_at) wins and the
// other value is reported, so the person can look at it.
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const keyOf = x => isObj(x) && x.id != null ? "id:" + x.id : JSON.stringify(x);
const META = new Set(["_at", "_dev", "updated"]);
function merge3(base, local, remote, p, out, newer){
  if (eq(local, base)) return remote;
  if (eq(remote, base) || eq(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const B = new Map((Array.isArray(base) ? base : []).map(x => [keyOf(x), x])), L = new Map(local.map(x => [keyOf(x), x])), R = new Map(remote.map(x => [keyOf(x), x]));
    const res = [];
    for (const [k, r] of R) { if (B.has(k) && !L.has(k)) continue; res.push(L.has(k) ? merge3(B.get(k), L.get(k), r, [...p, k], out, newer) : r); }
    for (const [k, l] of L) if (!R.has(k) && !B.has(k)) res.push(l);
    return res;
  }
  if (isObj(local) && isObj(remote)) { const o = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) { if (META.has(k)) continue; const v = merge3(isObj(base) ? base[k] : undefined, local[k], remote[k], [...p, k], out, newer); if (v !== undefined) o[k] = v; }
    if (!p.length) { const la = local._at || "", ra = remote._at || ""; const w = la > ra ? local : remote; o._at = w._at; o._dev = w._dev; if (w.updated) o.updated = w.updated; }
    return o; }
  const keep = newer === "remote" ? remote : local, other = newer === "remote" ? local : remote;
  out.push({ path: p, kept: keep, other }); return keep;
}
const SEG = /^[A-Za-z][\w-]{0,40}$/, ID = /^[\w.:-]{1,100}$/;
function store(t, id, rec){ db.seq++; db.recs[t + "/" + id] = { t, id, rec, seq: db.seq, at: new Date().toISOString() }; }
function applyChanges(changes, who){
  const conflicts = [];
  for (const c of changes) {
    if (!c || !SEG.test(c.t) || !ID.test(String(c.id))) continue;
    const id = String(c.id), cur = db.recs[c.t + "/" + id], rec = isObj(c.rec) ? { ...c.rec, id } : null, base = c.base === undefined ? null : c.base;
    if (!cur) { if (rec) store(c.t, id, rec); continue; }
    const remote = cur.rec;
    if (eq(remote, base) || eq(remote, rec)) { if (!eq(remote, rec)) store(c.t, id, rec); continue; }
    // Changed here too since that device last synced.
    if (rec == null) { if (remote != null) conflicts.push({ t: c.t, id, kind: "kept-edit", note: "Deleted on " + who + ", but edited on another device: the edited copy was kept.", at: new Date().toISOString() }); continue; }
    if (remote == null) { store(c.t, id, rec); conflicts.push({ t: c.t, id, kind: "restored", note: "Deleted on another device, but edited on " + who + ": the edited copy was kept.", at: new Date().toISOString() }); continue; }
    const out = [], newer = (remote._at || "") > (rec._at || "") ? "remote" : "local";
    const merged = merge3(isObj(base) ? base : {}, rec, remote, [], out, newer); merged.id = id;
    for (const o of out) conflicts.push({ t: c.t, id, kind: "both", field: o.path.join("."), kept: o.kept, other: o.other, note: "Changed on two devices; the newer change was kept.", at: new Date().toISOString() });
    store(c.t, id, merged);
  }
  return conflicts;
}
function changesSince(since){ const out = []; for (const r of Object.values(db.recs)) if (r.seq > since) out.push({ t: r.t, id: r.id, rec: r.rec, seq: r.seq }); return out.sort((a, b) => a.seq - b.seq); }

/* ---------- HTTPS: a certificate authority made on this PC, and a server certificate for its names and addresses ----------
   Same approach as Field Service Ops: no dependencies, the X.509 certificates are built here (DER) and signed with Node's crypto.
   The CA lasts 10 years; the server certificate about a year, renewed by itself and when the PC's addresses change.
   The server key never changes, so phones can pin it (the "security code"). GF_TLS=0 turns HTTPS off (testing only). */
const TLS_DIR = path.join(DATA_DIR, "tls");
let TLS = null;
const der = {
  len: n => { if (n < 128) return Buffer.from([n]); const b = []; while (n) { b.unshift(n & 255); n = Math.floor(n / 256); } return Buffer.from([0x80 | b.length, ...b]); },
  tlv: (tag, body) => Buffer.concat([Buffer.from([tag]), der.len(body.length), body]),
  seq: (...xs) => der.tlv(0x30, Buffer.concat(xs)), set: (...xs) => der.tlv(0x31, Buffer.concat(xs)),
  int: buf => { let b = Buffer.from(buf); while (b.length > 1 && b[0] === 0 && !(b[1] & 0x80)) b = b.subarray(1); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return der.tlv(0x02, b); },
  oid: s => { const p = s.split(".").map(Number); const out = [40 * p[0] + p[1]]; for (const v of p.slice(2)) { const st = [v & 127]; let x = Math.floor(v / 128); while (x) { st.unshift((x & 127) | 128); x = Math.floor(x / 128); } out.push(...st); } return der.tlv(0x06, Buffer.from(out)); },
  utf8: s => der.tlv(0x0c, Buffer.from(s, "utf8")), bool: v => der.tlv(0x01, Buffer.from([v ? 0xff : 0])), octet: b => der.tlv(0x04, b),
  bits: (b, unused = 0) => der.tlv(0x03, Buffer.concat([Buffer.from([unused]), b])),
  time: d => { const z = d.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z"; return d.getUTCFullYear() < 2050 ? der.tlv(0x17, Buffer.from(z.slice(2))) : der.tlv(0x18, Buffer.from(z)); },
};
const ECDSA_SHA256 = der.seq(der.oid("1.2.840.10045.4.3.2"));
const x509Name = (cn, o) => der.seq(der.set(der.seq(der.oid("2.5.4.10"), der.utf8(o))), der.set(der.seq(der.oid("2.5.4.3"), der.utf8(cn))));
const ext = (oid, critical, value) => der.seq(der.oid(oid), ...(critical ? [der.bool(true)] : []), der.octet(value));
const spkiOf = key => (key instanceof crypto.KeyObject && key.type === "public" ? key : crypto.createPublicKey(key)).export({ type: "spki", format: "der" });
const keyId = key => crypto.createHash("sha1").update(spkiOf(key)).digest();
function ipv6Bytes(a){ const [h, t = ""] = a.split("::"); const hp = h ? h.split(":") : [], tp = t ? t.split(":") : []; const all = [...hp, ...Array(8 - hp.length - tp.length).fill("0"), ...tp]; return Buffer.from(all.flatMap(x => { const v = parseInt(x || "0", 16); return [v >> 8, v & 255]; })); }
function makeCert({ subject, issuer, pub, signKey, days, ca, sans = [], issuerKeyId }){
  const now = new Date(Date.now() - 5 * 60e3), until = new Date(now.getTime() + days * 864e5);
  const serial = crypto.randomBytes(16); serial[0] &= 0x7f;
  const exts = [ext("2.5.29.19", true, ca ? der.seq(der.bool(true), der.int(Buffer.from([0]))) : der.seq()),
    ext("2.5.29.15", true, ca ? der.bits(Buffer.from([0x86]), 1) : der.bits(Buffer.from([0x80]), 7)),
    ext("2.5.29.14", false, der.octet(keyId(pub)))];
  if (issuerKeyId) exts.push(ext("2.5.29.35", false, der.seq(der.tlv(0x80, issuerKeyId))));
  if (!ca) { exts.push(ext("2.5.29.37", false, der.seq(der.oid("1.3.6.1.5.5.7.3.1"))));
    exts.push(ext("2.5.29.17", false, der.seq(...sans.map(n => net.isIP(n) ? der.tlv(0x87, net.isIPv4(n) ? Buffer.from(n.split(".").map(Number)) : ipv6Bytes(n)) : der.tlv(0x82, Buffer.from(n, "ascii")))))); }
  const tbs = der.seq(der.tlv(0xa0, der.int(Buffer.from([2]))), der.int(serial), ECDSA_SHA256, issuer, der.seq(der.time(now), der.time(until)), subject, spkiOf(pub), der.tlv(0xa3, der.seq(...exts)));
  const sig = crypto.sign("sha256", tbs, signKey);
  return { der: der.seq(tbs, ECDSA_SHA256, der.bits(sig)), notAfter: until.toISOString() };
}
const pem = (label, b) => `-----BEGIN ${label}-----\n${b.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END ${label}-----\n`;
// The issuer name is the CA certificate's subject, copied byte for byte.
function x509NameOf(caPem){ const b = new crypto.X509Certificate(caPem).raw; const rd = (buf, i) => { let l = buf[i + 1], h = 2; if (l & 0x80) { const n = l & 0x7f; l = 0; for (let k = 0; k < n; k++) l = l * 256 + buf[i + 2 + k]; h = 2 + n; } return { start: i, body: i + h, end: i + h + l }; };
  const certT = rd(b, 0), tbsT = rd(b, certT.body); let i = tbsT.body; const items = []; while (i < tbsT.end && items.length < 6) { const t = rd(b, i); items.push(t); i = t.end; }
  const subj = items[0] && b[items[0].start] === 0xa0 ? items[5] : items[4]; return b.subarray(subj.start, subj.end); }
function hostIps(){ const ips = String(process.env.GF_HOST_IPS || "").split(/[,\s]+/).filter(Boolean);
  for (const nets of Object.values(os.networkInterfaces())) for (const n of nets || []) if (n.family === "IPv4" && !n.internal && !/^169\.254\./.test(n.address) && !ips.includes(n.address)) ips.push(n.address); return ips; }
const hostName = () => (process.env.GF_HOST_NAME || os.hostname() || "localhost").slice(0, 60);
function tlsNames(){ const names = new Set(["localhost"]); const n = hostName(); if (/^[A-Za-z0-9.-]+$/.test(n)) { names.add(n.toLowerCase()); if (!n.includes(".")) names.add(n.toLowerCase() + ".local"); }
  return [...names, "127.0.0.1", ...hostIps().filter(ip => net.isIP(ip))]; }
function ensureTls(){
  fs.mkdirSync(TLS_DIR, { recursive: true }); const f = n => path.join(TLS_DIR, n); const rd = n => { try { return fs.readFileSync(f(n), "utf8"); } catch { return ""; } };
  const wr = (n, v, secret) => fs.writeFileSync(f(n), v, secret ? { mode: 0o600 } : undefined);
  let caKey = rd("ca-key.pem"), caPem = rd("ca.crt");
  if (!caKey || !caPem) { const k = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" }); caKey = k.privateKey.export({ type: "pkcs8", format: "pem" });
    const name = x509Name(`Gardener's Friend CA (${hostName().slice(0, 40)})`, "Gardener's Friend");
    const c = makeCert({ subject: name, issuer: name, pub: k.publicKey, signKey: k.privateKey, days: 3650, ca: true }); caPem = pem("CERTIFICATE", c.der); wr("ca-key.pem", caKey, true); wr("ca.crt", caPem); }
  let key = rd("server-key.pem"); if (!key) { key = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" }); wr("server-key.pem", key, true); }
  const caX = new crypto.X509Certificate(caPem); const sans = tlsNames(); let meta = {}; try { meta = JSON.parse(rd("server.json") || "{}"); } catch {}
  let cert = rd("server.crt");
  const due = !cert || !meta.notAfter || Date.parse(meta.notAfter) - Date.now() < 30 * 864e5 || sans.some(n => !(meta.sans || []).includes(n)) || meta.ca !== caX.fingerprint256;
  if (due) { const all = [...new Set([...(meta.sans || []).filter(n => !net.isIP(n) || sans.includes(n) || n === "127.0.0.1"), ...sans])];
    const c = makeCert({ subject: x509Name(hostName(), "Gardener's Friend"), issuer: x509NameOf(caPem), pub: crypto.createPublicKey(key), signKey: crypto.createPrivateKey(caKey), days: 397, sans: all, issuerKeyId: keyId(caPem) });
    cert = pem("CERTIFICATE", c.der); meta = { notAfter: c.notAfter, sans: all, ca: caX.fingerprint256, issuedAt: new Date().toISOString() }; wr("server.crt", cert); wr("server.json", JSON.stringify(meta, null, 1)); console.log(`HTTPS certificate issued for ${all.join(", ")}`); }
  const pin = crypto.createHash("sha256").update(spkiOf(key)).digest();
  TLS = { key, cert, caPem, caDer: caX.raw, sans: meta.sans, notAfter: meta.notAfter, caFp: caX.fingerprint256, pin: pin.toString("base64"), code: pin.toString("hex").toUpperCase().slice(0, 20).match(/.{4}/g).join(" ") };
  return TLS;
}
const tlsPublic = () => TLS ? { https: true, code: TLS.code, pin: TLS.pin, caFingerprint: TLS.caFp, names: TLS.sans, notAfter: TLS.notAfter } : { https: false };

/* ---------- requests ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".apk": "application/vnd.android.package-archive" };
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
function body(req, max = 20e6){ return new Promise((ok, bad) => { let b = ""; req.on("data", c => { b += c; if (b.length > max) { bad(new Error("too big")); req.destroy(); } }); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch { bad(new Error("bad json")); } }); req.on("error", bad); }); }
function send(res, code, obj){ res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
// "Local" = the browser on this PC. Everything else (phones, other computers) needs a device token from pairing.
function isLocal(req){ const a = String(req.socket.remoteAddress || ""), h = String(req.headers.host || "");
  return /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(a) && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(h); }
const deviceByToken = tok => { if (!tok) return null; const h = sha(tok); return Object.values(db.devices).find(d => d.tokenHash === h) || null; };
const devicePublic = d => ({ id: d.id, name: d.name, model: d.model, os: d.os, kind: d.kind, app: d.app, pairedAt: d.pairedAt, lastSeen: d.lastSeen || null, lastIp: d.lastIp || null, lastSync: d.lastSync || null });
const instance = () => ({ id: db.instance.id, name: db.instance.name });
let _app = null;
function appInfo(){ try { const st = fs.statSync(path.join(APP_DIR, "index.html")); const m = String(st.mtimeMs) + fs.readdirSync(path.join(APP_DIR, "js")).map(f => fs.statSync(path.join(APP_DIR, "js", f)).mtimeMs).join("|") + fs.statSync(path.join(APP_DIR, "css", "styles.css")).mtimeMs;
  if (_app && _app.m === m) return _app; const b = bundle(APP_DIR); _app = { m, ...b }; return _app; } catch (e) { console.error("App bundle:", e.message); return null; } }
function apkInfo(){ try { const st = fs.statSync(path.join(DL_DIR, APK)); return { size: st.size, at: st.mtime.toISOString(), url: "/downloads/" + APK }; } catch { return null; } }

function serveStatic(url, res){
  let rel = decodeURIComponent(url.pathname); if (rel === "/") rel = "/index.html";
  let file;
  if (rel === "/downloads/" + APK) file = path.join(DL_DIR, APK);
  else { file = path.normalize(path.join(APP_DIR, rel)); if (!file.startsWith(APP_DIR + path.sep)) file = null; }
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end(rel.endsWith(".apk") ? "The phone app isn't on this PC yet. See Settings › Phones and computers." : "Not found"); }
  const h = { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" };
  if (file.endsWith(".apk")) h["Content-Disposition"] = `attachment; filename="${APK}"`;
  res.writeHead(200, h); fs.createReadStream(file).pipe(res);
}

const handler = async (req, res) => {
  const url = new URL(req.url, "http://x"), parts = url.pathname.split("/").filter(Boolean);
  res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("X-Frame-Options", "SAMEORIGIN");
  if (req.socket.encrypted) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  try {
    if (url.pathname === "/health") return send(res, 200, { ok: true });
    if (url.pathname === "/gf-ca.crt" && TLS) { res.writeHead(200, { "Content-Type": "application/x-x509-ca-cert", "Content-Disposition": 'attachment; filename="GardenersFriend-CA.crt"' }); return res.end(TLS.caDer); }
    if (parts[0] !== "api") return serveStatic(url, res);
    // The phone app runs from its own origin (http://localhost inside the app) and signs each request with its device token.
    if (req.headers.origin) { res.setHeader("Access-Control-Allow-Origin", req.headers.origin); res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-GF-Device"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS"); res.setHeader("Access-Control-Expose-Headers", "Date"); }
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    const LOCAL = isLocal(req); let DEV = null;
    const tok = req.headers["x-gf-device"];
    if (tok) { DEV = deviceByToken(tok); if (!DEV) return send(res, 401, { error: "This device isn't paired with this PC any more. Pair it again in Settings.", unpaired: true });
      DEV.lastSeen = new Date().toISOString(); DEV.lastIp = req.socket.remoteAddress; }
    const str = (v, n) => String(v || "").trim().slice(0, n);

    if (parts[1] === "info") return send(res, 200, { instance: instance(), local: LOCAL, paired: !!DEV, tls: tlsPublic(), time: new Date().toISOString(), rev: appInfo()?.rev || null });
    if (parts[1] === "app" && req.method === "GET") { const A = appInfo(); if (!A) return send(res, 404, { error: "not found" });
      if (parts[2] === "rev") return send(res, 200, { rev: A.rev, instance: instance() });
      if (parts[2] === "phone") { if (!DEV && !LOCAL) return send(res, 401, { error: "Pair first." }); return send(res, 200, { rev: A.rev, html: A.html }); }
      return send(res, 404, { error: "not found" }); }

    /* ---- pairing: a phone or another computer asks to join; it's accepted in Settings on this PC ---- */
    if (parts[1] === "pair") {
      const now = Date.now(); for (const [k, r] of Object.entries(db.pairReqs)) if (now - Date.parse(r.at) > 30 * 60e3) delete db.pairReqs[k];
      if (parts[2] === "request" && req.method === "POST") {
        if (Object.values(db.pairReqs).filter(r => r.status === "pending").length >= 10) return send(res, 429, { error: "Too many devices waiting. Try again in a few minutes." });
        const b = await body(req, 20000); const id = crypto.randomUUID(), secret = crypto.randomBytes(24).toString("hex"), code = String(crypto.randomInt(1000, 10000));
        db.pairReqs[id] = { id, secretHash: sha(secret), deviceId: str(b.deviceId, 80), name: str(b.name, 80) || "Device", model: str(b.model, 80), os: str(b.os, 40), kind: b.kind === "computer" ? "computer" : "phone", app: str(b.app, 40), ip: req.socket.remoteAddress, at: new Date().toISOString(), status: "pending", code };
        persist(); return send(res, 200, { req: id, secret, code, instance: instance() });
      }
      if (parts[2] === "status" && req.method === "GET") { const r = db.pairReqs[url.searchParams.get("req")];
        if (!r || r.secretHash !== sha(url.searchParams.get("secret") || "")) return send(res, 200, { status: "expired" });
        if (r.status !== "accepted") return send(res, 200, { status: r.status, code: r.code });
        const out = { status: "accepted", token: r.token, device: devicePublic(db.devices[r.device]), instance: instance(), ips: hostIps() };
        delete db.pairReqs[r.id]; persist(); return send(res, 200, out); }   // the token goes to the device once
      if (parts[2] === "me" && req.method === "GET") { if (!DEV) return send(res, 401, { error: "Not paired.", unpaired: true }); persist();
        return send(res, 200, { device: devicePublic(DEV), instance: instance(), ips: hostIps(), time: new Date().toISOString() }); }
      if (!LOCAL) return send(res, 403, { error: "Only this PC can accept devices." });
      if (parts[2] === "hostinfo") return send(res, 200, { ips: hostIps(), port: Number(process.env.GF_HOST_PORT || PORT), tls: tlsPublic(), instance: instance(), apk: apkInfo() });
      if (parts[2] === "requests" && req.method === "GET") return send(res, 200, Object.values(db.pairReqs).filter(r => r.status === "pending").map(({ secretHash, token, ...r }) => r));
      const r = db.pairReqs[parts[2]]; if (!r || r.status !== "pending") return send(res, 404, { error: "That request has expired. Ask the device to try again." });
      if (parts[3] === "decline" && req.method === "POST") { r.status = "declined"; persist(); return send(res, 200, { ok: true }); }
      if (parts[3] === "accept" && req.method === "POST") {
        const token = crypto.randomBytes(32).toString("hex"); const ex = Object.values(db.devices).find(d => d.deviceId && d.deviceId === r.deviceId);
        const dev = ex || { id: crypto.randomUUID(), deviceId: r.deviceId, pairedAt: new Date().toISOString() };
        Object.assign(dev, { name: r.name, model: r.model, os: r.os, kind: r.kind, app: r.app, tokenHash: sha(token), acceptedAt: new Date().toISOString() }); db.devices[dev.id] = dev;
        r.status = "accepted"; r.token = token; r.device = dev.id; persist(); return send(res, 200, devicePublic(dev)); }
      return send(res, 404, { error: "not found" });
    }
    if (parts[1] === "devices") { if (!LOCAL) return send(res, 403, { error: "Only on this PC." });
      if (req.method === "GET") return send(res, 200, Object.values(db.devices).map(devicePublic));
      if (req.method === "DELETE" && db.devices[parts[2]]) { delete db.devices[parts[2]]; persist(); return send(res, 200, { ok: true }); }
      return send(res, 404, { error: "not found" }); }

    /* ---- sync ---- */
    if (!LOCAL && !DEV) return send(res, 401, { error: "Pair this device with the PC first (Settings).", unpaired: true });
    if (parts[1] === "sync" && req.method === "POST") {
      const b = await body(req); const since = Math.max(0, Number(b.since) || 0);
      // A device whose last sync is newer than this database (the PC's data was replaced): it starts again from scratch.
      const reset = since > db.seq;
      const conflicts = Array.isArray(b.changes) && b.changes.length ? applyChanges(b.changes.slice(0, 5000), DEV ? DEV.name : "this PC") : [];
      if (DEV) DEV.lastSync = new Date().toISOString();
      if ((b.changes || []).length || DEV) persist();
      return send(res, 200, { seq: db.seq, reset, changes: changesSince(reset ? 0 : since), conflicts, instance: instance(), time: new Date().toISOString() });
    }
    return send(res, 404, { error: "not found" });
  } catch (e) { send(res, e.message === "too big" ? 413 : 500, { error: String(e.message || e) }); }
};

function start(){
  const listening = () => {
    console.log(`Gardener's Friend is running.`);
    console.log(`  On this PC:  ${TLS ? "https" : "http"}://localhost:${PORT}`);
    for (const ip of hostIps()) console.log(`  Phones:      ${TLS ? "https" : "http"}://${ip}:${PORT}`);
    if (TLS) console.log(`  Security code: ${TLS.code}`);
  };
  if (process.env.GF_TLS === "0") return http.createServer(handler).listen(PORT, "0.0.0.0", listening);
  ensureTls();
  const secure = https.createServer({ key: TLS.key, cert: TLS.cert + TLS.caPem, minVersion: "TLSv1.2" }, handler);
  // Plain http on the same port only redirects to https (and answers /health).
  const plain = http.createServer((req, res) => { if (req.url === "/health") return send(res, 200, { ok: true });
    const host = String(req.headers.host || `localhost:${PORT}`).replace(/[^\w.:\[\]-]/g, ""); res.writeHead(308, { Location: `https://${host}${req.url}`, "Cache-Control": "no-store" }); res.end(); });
  const front = net.createServer(sock => { sock.on("error", () => {}); sock.once("data", buf => { sock.pause(); sock.unshift(buf); (buf[0] === 0x16 ? secure : plain).emit("connection", sock); process.nextTick(() => sock.resume()); }); });
  front.on("error", e => { if (e.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use. Is Gardener's Friend already running? To use another port: set PORT=4750, then start again.`); else console.error(e); process.exit(1); });
  front.listen(PORT, "0.0.0.0", listening);
  // New addresses (another Wi-Fi) or a certificate near its end: issue again and swap it in without a restart.
  setInterval(() => { const before = TLS.cert; try { ensureTls(); if (TLS.cert !== before) secure.setSecureContext({ key: TLS.key, cert: TLS.cert + TLS.caPem, minVersion: "TLSv1.2" }); } catch (e) { console.error(e); } }, 10 * 60e3).unref();
}
if (require.main === module) start();
module.exports = { merge3, applyChanges, changesSince, _db: () => db };
