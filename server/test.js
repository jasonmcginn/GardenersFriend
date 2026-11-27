// Tests for the sync server: merging, deletes, pairing, and that only paired devices get in. Run: node server/test.js
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), { spawn } = require("child_process");

const { merge3 } = (() => { process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gf-unit-")); return require("./server.js"); })();

// merge3: fields changed on different sides both survive; the same field changed on both: newer wins and is reported.
{ const out = []; const r = merge3({ a: 1, b: 1, _at: "1" }, { a: 2, b: 1, _at: "3" }, { a: 1, b: 5, _at: "2" }, [], out, "local");
  assert.deepStrictEqual([r.a, r.b, r._at, out.length], [2, 5, "3", 0]); }
{ const out = []; const r = merge3({ v: "x" }, { v: "phone", _at: "3" }, { v: "pc", _at: "2" }, [], out, "local");
  assert.strictEqual(r.v, "phone"); assert.strictEqual(out.length, 1); assert.deepStrictEqual(out[0].path, ["v"]); }
// Lists of items with ids merge item by item (schedule steps).
{ const base = { rows: [{ id: "a", x: 1 }, { id: "b", x: 1 }] };
  const r = merge3(base, { rows: [{ id: "a", x: 2 }, { id: "b", x: 1 }, { id: "c", x: 1 }] }, { rows: [{ id: "a", x: 1 }] }, [], [], "local");
  assert.deepStrictEqual(r.rows.map(x => x.id + x.x), ["a2", "c1"]); }

// The server, end to end, over plain http (GF_TLS=0) on a spare port.
const PORT = 4799, DATA = fs.mkdtempSync(path.join(os.tmpdir(), "gf-e2e-"));
const srv = spawn(process.execPath, [path.join(__dirname, "server.js")], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, GF_TLS: "0" }, stdio: ["ignore", "pipe", "inherit"] });
function call(method, p, body, headers = {}, host = "localhost"){
  return new Promise((ok, bad) => { const data = body == null ? null : JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method, headers: { Host: `${host}:${PORT}`, "Content-Type": "application/json", ...headers } }, res => { let b = ""; res.on("data", c => b += c); res.on("end", () => ok({ status: res.statusCode, json: b ? JSON.parse(b) : null })); });
    r.on("error", bad); if (data) r.write(data); r.end(); }); }
(async () => {
  for (let i = 0; i < 50; i++) { try { await call("GET", "/health"); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  // The PC (localhost) syncs without pairing.
  let r = await call("POST", "/api/sync", { since: 0, changes: [{ t: "plants", id: "p1", rec: { name: "Tomato", stage: "Seed", _at: "2026-01-01T00:00:00Z" }, base: null }] });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.json.changes.length, 1); const seq1 = r.json.seq;
  // A request that isn't from this PC (a different Host header) and has no token is refused.
  r = await call("POST", "/api/sync", { since: 0 }, {}, "192.168.1.9"); assert.strictEqual(r.status, 401);
  r = await call("GET", "/api/pair/requests", null, {}, "192.168.1.9"); assert.strictEqual(r.status, 403);
  // Pairing: ask, accept on the PC, collect the token once.
  r = await call("POST", "/api/pair/request", { deviceId: "d1", name: "Test phone", kind: "phone" }, {}, "192.168.1.9"); const { req, secret, code } = r.json; assert.ok(code);
  r = await call("GET", `/api/pair/status?req=${req}&secret=${secret}`, null, {}, "192.168.1.9"); assert.strictEqual(r.json.status, "pending");
  r = await call("POST", `/api/pair/${req}/accept`, {}); assert.strictEqual(r.status, 200);
  r = await call("GET", `/api/pair/status?req=${req}&secret=${secret}`, null, {}, "192.168.1.9"); assert.strictEqual(r.json.status, "accepted"); const token = r.json.token;
  r = await call("GET", `/api/pair/status?req=${req}&secret=${secret}`, null, {}, "192.168.1.9"); assert.strictEqual(r.json.status, "expired");
  const dev = { "X-GF-Device": token };
  // The phone gets everything, then edits a different field than the PC: both kept.
  r = await call("POST", "/api/sync", { since: 0 }, dev, "192.168.1.9"); assert.strictEqual(r.json.changes[0].rec.name, "Tomato"); const base = r.json.changes[0].rec;
  await call("POST", "/api/sync", { since: seq1, changes: [{ t: "plants", id: "p1", rec: { ...base, name: "Tomato – San Marzano", _at: "2026-01-02T00:00:00Z" }, base }] });
  r = await call("POST", "/api/sync", { since: seq1, changes: [{ t: "plants", id: "p1", rec: { ...base, stage: "Seedling", _at: "2026-01-03T00:00:00Z" }, base }] }, dev, "192.168.1.9");
  const merged = r.json.changes.find(c => c.id === "p1").rec; assert.strictEqual(merged.name, "Tomato – San Marzano"); assert.strictEqual(merged.stage, "Seedling"); assert.strictEqual(r.json.conflicts.length, 0);
  // A delete reaches the other device as a null record.
  const s2 = r.json.seq; await call("POST", "/api/sync", { since: s2, changes: [{ t: "plants", id: "p1", rec: null, base: merged }] });
  r = await call("POST", "/api/sync", { since: s2 }, dev, "192.168.1.9"); assert.strictEqual(r.json.changes[0].rec, null);
  // Removing the device on the PC locks it out.
  r = await call("GET", "/api/devices"); assert.strictEqual(r.json.length, 1);
  await call("DELETE", "/api/devices/" + r.json[0].id);
  r = await call("POST", "/api/sync", { since: 0 }, dev, "192.168.1.9"); assert.strictEqual(r.status, 401); assert.ok(r.json.unpaired);
  // The phone update is served as one page that carries its version stamp.
  r = await call("GET", "/api/app/phone"); assert.ok(r.json.html.includes(r.json.rev));
  console.log("server tests passed");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => srv.kill());
