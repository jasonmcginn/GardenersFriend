// Shared UI helpers: escaping, dates, generic table, generic form dialog, SVG line chart.
window.GF = window.GF || {};

GF.ui = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  const today = () => iso(new Date());
  const addDays = (ds, n) => { const d = new Date(ds + 'T00:00'); d.setDate(d.getDate() + Number(n)); return iso(d); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
  const fmtDate = ds => ds ? new Date(ds + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const refName = (t, id) => { const r = id && GF.store.get(t, id); return r ? (r.name || r.date || '') : ''; };
  const S = t => GF.schema.entities[t];

  function fmt(f, v) {
    if (v == null || v === '') return '';
    switch (f.type) {
      case 'ref': return esc(refName(f.ref, v));
      case 'date': return `<span class="nowrap">${esc(fmtDate(v))}</span>`;
      case 'checkbox': return v ? 'Yes' : '';
      case 'number': return `<span class="nowrap">${esc(v)}${f.unit ? ' ' + esc(f.unit) : ''}</span>`;
      default: return esc(v);
    }
  }

  // Generic table. opts: {hide:[keys], link: row => href, actions: true}
  function table(t, rows, opts = {}) {
    const def = S(t);
    const cols = def.fields.filter(f => f.list && !(opts.hide || []).includes(f.k));
    const comp = def.computed || [];
    if (!rows.length) return `<div class="empty">No ${esc(def.label.toLowerCase())} yet.</div>`;
    const head = cols.map(f => `<th class="${f.type === 'number' ? 'r' : ''}">${esc(f.label)}</th>`).join('') +
      comp.map(c => `<th>${esc(c.label)}</th>`).join('') + '<th class="r"><span class="sr">Actions</span></th>';
    const body = rows.map(r => {
      const cells = cols.map((f, i) => {
        let v = fmt(f, r[f.k]);
        if (i === 0 && opts.link) v = `<a href="${esc(opts.link(r))}">${v || '(unnamed)'}</a>`;
        if (f.type === 'textarea') v = `<span class="clip">${v}</span>`;
        return `<td class="${f.type === 'number' ? 'r' : ''}">${v}</td>`;
      }).join('') + comp.map(c => `<td>${c.fn(r)}</td>`).join('');
      return `<tr>${cells}<td class="r nowrap">
        <button class="btn sm ghost" data-act="edit" data-t="${t}" data-id="${esc(r.id)}">Edit</button>
        <button class="btn sm ghost danger" data-act="del" data-t="${t}" data-id="${esc(r.id)}">Delete</button></td></tr>`;
    }).join('');
    return `<div class="scroll"><table class="stack"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function fieldHTML(f, v) {
    const id = 'f_' + f.k, req = f.req ? ' required' : '';
    const lab = `<label for="${id}">${esc(f.label)}${f.unit ? ` <small>(${esc(f.unit)})</small>` : ''}${f.req ? ' <span class="req">*</span>' : ''}</label>`;
    const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
    let input;
    switch (f.type) {
      case 'textarea': return `<div class="fld wide">${lab}<textarea id="${id}" name="${f.k}" rows="3"${ph}${req}>${esc(v)}</textarea></div>`;
      case 'select':
        input = `<select id="${id}" name="${f.k}"${req}><option value=""></option>${f.options.map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
      case 'ref': {
        const opts = GF.store.all(f.ref).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
        input = `<select id="${id}" name="${f.k}"${req}><option value=""></option>${opts.map(o => `<option value="${esc(o.id)}"${o.id === v ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`; break;
      }
      case 'checkbox': return `<div class="fld check"><input type="checkbox" id="${id}" name="${f.k}"${v ? ' checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
      case 'number': input = `<input type="number" inputmode="decimal" id="${id}" name="${f.k}" step="${f.step ?? 'any'}" value="${esc(v)}"${ph}${req}>`; break;
      case 'date': input = `<input type="date" id="${id}" name="${f.k}" value="${esc(v)}"${req}>`; break;
      default: input = `<input type="text" id="${id}" name="${f.k}" value="${esc(v)}"${ph}${req}>`;
    }
    return `<div class="fld">${lab}${input}</div>`;
  }

  // Open the add/edit dialog. presets fill a new record; after(saved) runs once it is saved.
  function openForm(t, row, presets, after) {
    const def = S(t), v = Object.assign({}, presets || {}, row || {});
    const dlg = document.getElementById('dlg');
    dlg.innerHTML = `<form class="form" novalidate>
      <h2>${row ? 'Edit' : 'New'} ${esc(def.one)}</h2>
      <div class="fgrid">${def.fields.map(f => fieldHTML(f, v[f.k])).join('')}</div>
      <p class="err" id="formErr" hidden></p>
      <div class="actions"><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn primary">Save</button></div>
    </form>`;
    const form = dlg.querySelector('form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const out = Object.assign({}, presets || {}, row || {});
      const missing = [];
      def.fields.forEach(f => {
        const el = form.elements[f.k];
        let val;
        if (f.type === 'checkbox') val = el.checked;
        else if (f.type === 'number') val = GF.num(el.value);
        else val = el.value.trim();
        if (f.req && (val === '' || val == null)) missing.push(f.label);
        out[f.k] = val;
      });
      if (missing.length) { const p = form.querySelector('#formErr'); p.textContent = 'Please fill in: ' + missing.join(', '); p.hidden = false; return; }
      const saved = GF.store.save(t, out);
      dlg.close();
      after && after(saved);
    });
    dlg.showModal();
    const first = form.querySelector('input:not([type=checkbox]),select,textarea');
    first && first.focus();
  }

  // series: [{name, color, pts: [[dateStr, y], ...]}]
  function lineChart(series, opts = {}) {
    const all = series.flatMap(s => s.pts).filter(p => p[1] != null);
    if (all.length < 2) return `<div class="empty">Not enough readings to chart yet.</div>`;
    const W = 640, H = opts.h || 240, L = 46, R = 12, T = 12, B = 30;
    const xs = all.map(p => new Date(p[0] + 'T00:00').getTime());
    let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
    let y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
    const pad = (y1 - y0) * 0.15 || 0.5; y0 -= pad; y1 += pad;
    const X = d => L + (new Date(d + 'T00:00').getTime() - x0) / (x1 - x0) * (W - L - R);
    const Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = y0 + (y1 - y0) * i / 4, y = Y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" class="ax">${v.toFixed(opts.dp ?? 1)}</text>`;
    }
    const d0 = new Date(x0), d1 = new Date(x1);
    g += `<text x="${L}" y="${H - 6}" class="ax">${esc(fmtDate(iso(d0)))}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="ax">${esc(fmtDate(iso(d1)))}</text>`;
    const lines = series.map(s => {
      const pts = s.pts.filter(p => p[1] != null).sort((a, b) => a[0].localeCompare(b[0]));
      if (!pts.length) return '';
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>` +
        pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.5" fill="${s.color}"><title>${esc(s.name)} ${esc(p[1])} · ${esc(fmtDate(p[0]))}</title></circle>`).join('');
    }).join('');
    const legend = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">${g}${lines}</svg><figcaption class="legend">${legend}</figcaption></figure>`;
  }

  return { esc, iso, today, addDays, daysBetween, fmtDate, refName, fmt, table, openForm, lineChart };
})();
