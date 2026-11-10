import { buildShed, DEFAULTS, ftIn } from './geometry.js';
import { takeoff, pieceSchedule, costSummary, REGIONS, setRegion, getRegion, SIDING } from './materials.js';
import * as DW from './drawings.js';
import { reviewHTML } from './review.js';

const LS_PARAMS = 'shed.params.v1';
const LS_REGION = 'shed.region.v1';
let regionKey = localStorage.getItem(LS_REGION) || 'qc';
setRegion(regionKey);
const lsPrices = () => `shed.prices.v1.${regionKey}`;

const FIELDS = [
  ['Size', [
    { key: 'width', label: 'Width (gable end), ft', type: 'number', min: 6, max: 20, step: 1, ft: true },
    { key: 'length', label: 'Length (door side), ft', type: 'number', min: 6, max: 28, step: 1, ft: true },
    { key: 'studLength', label: 'Wall height', type: 'select', opts: [[80, '6\'-8" (80" studs)'], [92.625, '8 ft (92-5/8" precut)'], [104.625, '9 ft (104-5/8" precut)']] },
  ]],
  ['Roof', [
    { key: 'pitch', label: 'Pitch (rise/12)', type: 'select', opts: [4, 5, 6, 7, 8, 9, 10, 12].map((v) => [v, `${v}/12`]) },
    { key: 'eaveOverhang', label: 'Eave overhang, in', type: 'number', min: 0, max: 18, step: 1 },
    { key: 'rakeOverhang', label: 'Rake overhang, in', type: 'number', min: 0, max: 12, step: 1 },
    { key: 'rafterSize', label: 'Rafters', type: 'select', opts: [['2x4', '2x4'], ['2x6', '2x6']] },
    { key: 'rafterSpacing', label: 'Rafter spacing', type: 'select', opts: [[16, '16" O.C.'], [24, '24" O.C.']] },
    { key: 'snowLoad', label: 'Ground snow load', type: 'select', opts: [[20, 'None / light'], [30, '30 psf (1.4 kPa)'], [50, '50 psf (2.4 kPa)'], [70, '70 psf (3.4 kPa)'], [75, '75 psf (3.6 kPa, Québec City)']] },
  ]],
  ['Doors & windows', [
    { key: 'frontDoorWidth', label: 'Double door width', type: 'select', opts: [[48, '4 ft'], [60, '5 ft'], [72, '6 ft']] },
    { key: 'frontDoorType', label: 'Double door', type: 'select', opts: [['site', 'Build it'], ['prehung', 'Buy pre-hung']] },
    { key: 'frontWindows', label: 'Front windows', type: 'select', opts: [0, 1, 2].map((v) => [v, v]) },
    { key: 'backWindows', label: 'Back windows', type: 'select', opts: [0, 1, 2, 3].map((v) => [v, v]) },
    { key: 'windowSize', label: 'Window size', type: 'select', opts: [['24x36', '24" × 36"'], ['18x27', '18" × 27"'], ['30x36', '30" × 36"']] },
    { key: 'sideDoor', label: 'Side door (gable end)', type: 'checkbox' },
    { key: 'sideDoorType', label: 'Side door', type: 'select', opts: [['prehung', 'Buy pre-hung'], ['site', 'Build it']] },
  ]],
  ['Siding', [
    { key: 'siding', label: 'Siding', type: 'select', opts: [['t111', 'T1-11 plywood'], ['smartside', 'LP SmartSide'], ['spruce', 'Spruce boards'], ['vinyl', 'Vinyl B&B']] },
    { key: 'battenSpacing', label: 'Batten spacing', type: 'select', opts: [[12, '12"'], [16, '16"'], [24, '24"']] },
    { key: 'gableVents', label: 'Gable vents', type: 'checkbox' },
  ]],
];

let params = loadParams();
let priceOverrides = JSON.parse(localStorage.getItem(lsPrices()) || '{}');
let geo;
let take;
let viewer;
let currentTab = 'model';

function loadParams() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_PARAMS) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

// ------------------------------------------------------------ form
function renderForm() {
  const form = document.getElementById('params');
  form.innerHTML = FIELDS.map(([legend, fields]) => `<fieldset><legend>${legend}</legend>${fields.map(fieldHTML).join('')}</fieldset>`).join('') +
    '<button type="button" class="btn ghost" id="resetParams" style="color:var(--accent);font-size:13px">Reset to 12×16 defaults</button>';
  form.addEventListener('input', onFormChange);
  form.addEventListener('change', onFormChange);
  document.getElementById('resetParams').onclick = () => {
    params = { ...DEFAULTS };
    localStorage.removeItem(LS_PARAMS);
    renderForm();
    update();
  };
}
function fieldHTML(f) {
  const id = `f-${f.key}`;
  let val = f.key === 'windowSize' ? `${params.windowW}x${params.windowH}` : params[f.key];
  if (f.ft) val = val / 12;
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${f.key}">${f.opts.map(([v, l]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  else if (f.type === 'checkbox') input = `<input type="checkbox" id="${id}" name="${f.key}"${val ? ' checked' : ''}/>`;
  else input = `<input type="number" id="${id}" name="${f.key}" value="${val}" min="${f.min}" max="${f.max}" step="${f.step}" inputmode="decimal"/>`;
  return `<div class="field"><label for="${id}">${f.label}</label>${input}</div>`;
}
let debounce;
function onFormChange(e) {
  const el = e.target;
  const f = FIELDS.flatMap(([, fs]) => fs).find((x) => x.key === el.name);
  if (!f) return;
  if (f.type === 'checkbox') params[f.key] = el.checked;
  else if (f.key === 'windowSize') {
    const [w, h] = el.value.split('x').map(Number);
    params.windowW = w;
    params.windowH = h;
  } else if (f.type === 'number') {
    const v = parseFloat(el.value);
    if (!Number.isFinite(v)) return;
    const cl = Math.min(f.max, Math.max(f.min, v));
    params[f.key] = f.ft ? cl * 12 : cl;
  } else params[f.key] = isNaN(Number(el.value)) ? el.value : Number(el.value);
  localStorage.setItem(LS_PARAMS, JSON.stringify(params));
  clearTimeout(debounce);
  debounce = setTimeout(update, 120);
}

// ------------------------------------------------------------ main update
async function update() {
  geo = buildShed(params);
  take = takeoff(geo);
  document.getElementById('subtitle').textContent = `${geo.W / 12}' × ${geo.L / 12}' · ${params.pitch}/12 pitch · ${Math.round((geo.W * geo.L) / 144)} sq ft`;
  document.title = `${geo.W / 12}×${geo.L / 12} Gable Shed Planner`;
  document.getElementById('warnings').innerHTML = geo.warnings.map((w) => `<p>⚠ ${w}</p>`).join('');
  if (viewer) viewer.build(geo, { keepCamera: !!viewer.g && viewer.g.W === geo.W && viewer.g.L === geo.L });
  renderKeyFacts();
  renderPlans();
  renderMaterials();
  renderCutList();
  renderCost();
}

function money(v) {
  const r = getRegion();
  return v.toLocaleString(r.locale, { style: 'currency', currency: r.currency, maximumFractionDigits: 0 });
}

function renderKeyFacts() {
  const cs = costSummary(take.items, priceOverrides, opts());
  document.getElementById('keyfacts').innerHTML = `<dl>
    <dt>Estimated cost</dt><dd class="big">${money(cs.total)}</dd>
    <dt>Floor area</dt><dd>${Math.round((geo.W * geo.L) / 144)} sq ft</dd>
    <dt>Ridge height</dt><dd>${ftIn(geo.heights.peak)}</dd>
    <dt>Wall height (plate)</dt><dd>${ftIn(geo.heights.plate)}</dd>
    <dt>Roof area</dt><dd>${take.squares.toFixed(2)} squares</dd>
    <dt>Rafters</dt><dd>${geo.rafterX.length} pairs × ${ftIn(geo.rafterCut)}</dd>
    <dt>Studs (all walls)</dt><dd>${geo.members.filter((m) => m.group.startsWith('wall') && /stud/i.test(m.kind)).length}</dd>
  </dl>`;
}

// ------------------------------------------------------------ plans
function sheet(num, title, cells, { cols = '1fr', rows = '1fr', extra = '' } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  return `<article class="sheet">
    <div class="area" style="grid-template-columns:${cols};grid-template-rows:${rows}">${cells.join('')}</div>
    <aside class="tblock">
      <div class="proj">${geo.W / 12}' × ${geo.L / 12}' GABLE SHED<small>${params.pitch}/12 · board & batten</small></div>
      <div><small>Sheet</small><b>${title}</b></div>
      <div class="grow">${extra || 'All dimensions to framing unless noted. Do not scale drawings; dimensions govern. Verify on site before cutting.'}</div>
      <div><small>Date</small>${date}</div>
      <div><small>Scale</small>NTS</div>
      <div style="font-size:9.5px;color:#555">Original design generated by Gable Shed Planner. Not engineered or stamped. Check local codes and permits.</div>
      <div class="num">${num}</div>
    </aside>
  </article>`;
}
const cell = (svg, cap, sub = '', style = '') => `<div class="cell" style="${style}">${svg}<div class="cap">${cap}<span>${sub}</span></div></div>`;

function generalNotes() {
  return `<div class="notes">
    <h4>General</h4><ol>
      <li>Build to local code (Québec: Code de construction / NBC 2020 Part 9; US: IRC). Get a permit from your municipality and check setbacks and height limits.</li>
      <li>Framing lumber SPF or Hem-Fir #2 or better. Anything within 6" of soil or on the skids: pressure-treated, ground-contact (UC4A) for skids.</li>
      <li>Rafters: ${params.rafterSize} @ ${params.rafterSpacing}" O.C., checked for about ${params.snowLoad} psf ground snow. Heavier snow or high wind: consult a pro.</li>
      <li>Nailing: 16d sinkers for framing, 8d ring-shank for sheathing @ 6" edges / 12" field, 8d HDG for siding.</li>
      <li>Fasten each rafter to the plate with an H2.5A tie; anchor the shed in high-wind areas.</li>
    </ol>
    <h4>Build sequence</h4><ol>
      <li>Level 4" compacted gravel pad, 1 ft larger than the shed.</li>
      <li>Set and level skids (${geo.nSkids}); build floor frame; check diagonals; glue + nail subfloor.</li>
      <li>Frame walls flat on the deck (S-2, S-3); stand, plumb, brace; lap cap plates at corners.</li>
      <li>Cut one pattern rafter (S-5), test the pair on the deck, then cut the rest; assemble pairs with gussets on the deck.</li>
      <li>Set rafter pairs ${params.rafterSpacing}" O.C., ties at plate; gable studs; fly rafters; sub-fascia.</li>
      <li>Roof sheathing with H-clips, drip edge at eaves, felt, drip edge at rakes, starter, shingles, ridge cap.</li>
      <li>Siding with Z-flashing at horizontal joints and over openings; windows; doors; trim & battens; caulk; paint.</li>
    </ol></div>`;
}

function renderPlans() {
  const el = document.getElementById('sheets');
  const legend = `<div class="legend">${DW.FRAMING_LEGEND.map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('')}</div>`;
  let snap = '';
  if (viewer) {
    viewer.setVisible(PRESETS.finished);
    snap = viewer.snapshot();
    viewer.setVisible(layerState);
  }
  const spec = [
    ['Footprint (framing)', `${ftIn(geo.W)} × ${ftIn(geo.L)}`],
    ['Floor area', `${Math.round((geo.W * geo.L) / 144)} sq ft`],
    ['Roof pitch', `${params.pitch}/12 (${((geo.theta * 180) / Math.PI).toFixed(1)}°)`],
    ['Plate height above grade', ftIn(geo.heights.plate)],
    ['Ridge height above grade', ftIn(geo.heights.peak)],
    ['Overhangs (eave / rake)', `${params.eaveOverhang}" / ${params.rakeOverhang}"`],
    ['Foundation', `${geo.nSkids} × 4x6 PT skids on gravel`],
    ['Floor', '2x6 PT joists 16" O.C., 3/4" T&G OSB'],
    ['Walls', `2x4 @ ${params.studSpacing}" O.C., ${ftIn(params.studLength)} studs`],
    ['Roof framing', `${geo.rafterX.length} gusseted ${params.rafterSize} pairs @ ${params.rafterSpacing}"`],
    ['Siding', SIDING[params.siding]?.label || ''],
  ];
  const index = [
    ['A-0', 'Cover, specs & notes'],
    ['A-1', 'Floor plan'],
    ['S-1', 'Foundation & floor framing'],
    ['S-2', 'Wall framing: front & back'],
    ['S-3', 'Wall framing: gable ends'],
    ['S-4', 'Roof framing'],
    ['S-5', 'Rafter & gusset templates'],
    ['A-2', 'Exterior elevations'],
    ['A-3', 'Building section'],
  ];
  const cover = `<div class="cell">${snap ? `<img class="cover-img" src="${snap}" alt="3D view of the shed"/>` : ''}<div class="cap">Perspective<span>from the 3D model</span></div></div>
    <div class="cell" style="overflow:hidden"><table class="spec">${spec.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
      <div style="margin-top:8px;font-size:11px;columns:2;column-gap:12px">${index.map(([a, b]) => `<div><b>${a}</b> ${b}</div>`).join('')}</div></div>
    <div class="cell" style="grid-column:1/3;overflow:hidden">${generalNotes()}</div>`;

  const ruled = `<div class="notes" style="columns:1;font-size:12px"><h4>Cutting the rafters</h4><ol>
    <li>Pick the straightest ${params.rafterSize}. Crown up.</li>
    <li>Ridge plumb cut: miter saw at <b>${((geo.theta * 180) / Math.PI).toFixed(1)}°</b> (or a speed square on the ${params.pitch} mark).</li>
    <li>Measure <b>${ftIn(geo.rafterCut)}</b> along the top edge, long point to long point; make the tail plumb cut parallel to the ridge cut.</li>
    <li>Birdsmouth: seat <b>${ftIn(geo.seat)}</b> level, heel <b>${ftIn(geo.seat * geo.t)}</b> plumb, cut into the bottom edge with the heel on the outer face of the wall. The seat's inner end is <b>${ftIn((geo.run - geo.seat) / geo.c)}</b> from the ridge along the bottom edge. Don't overcut the corner; finish with a handsaw.</li>
    <li>Test a pair on the deck at ${ftIn(geo.W)} between heel points before cutting the other ${geo.members.filter((m) => m.kind === 'Rafter' || m.kind === 'Fly rafter').length - 1}.</li>
    <li>Fly rafters have no birdsmouth.</li>
  </ol></div>`;

  el.innerHTML = [
    sheet('A-0', 'Cover, specs & notes', [cover], { cols: '1.25fr 1fr', rows: 'minmax(0,1fr) auto' }),
    sheet('A-1', 'Floor plan', [cell(DW.floorPlan(geo), 'Floor plan', 'doors swing out')]),
    sheet('S-1', 'Foundation & floor framing', [cell(DW.foundationPlan(geo), 'Foundation & floor framing plan'), cell(DW.floorSheathing(geo), 'Subfloor sheathing layout')], { cols: '1.55fr 1fr' }),
    sheet('S-2', 'Wall framing: front & back', [cell(DW.wallFraming(geo, 'front'), 'Front wall framing', 'viewed from outside'), cell(DW.wallFraming(geo, 'back'), 'Back wall framing', 'viewed from outside'), legend], { rows: '1fr 1fr auto' }),
    sheet('S-3', 'Wall framing: gable ends', [cell(DW.wallFraming(geo, 'left'), 'Left gable wall', 'viewed from outside'), cell(DW.wallFraming(geo, 'right'), 'Right gable wall', 'viewed from outside'), `<div style="grid-column:1/3">${legend}</div>`], { cols: '1fr 1fr', rows: '1fr auto' }),
    sheet('S-4', 'Roof framing', [cell(DW.roofPlan(geo), 'Roof framing plan'), cell(DW.trussElevation(geo), 'Rafter pair (typical)', 'span to outside of wall framing')], { cols: '1fr 1fr' }),
    sheet('S-5', 'Rafter & gusset templates', [cell(DW.rafterDetail(geo), 'Pattern rafter', `${params.rafterSize} · ${params.pitch}/12`, 'grid-column:1/3'), cell(DW.gussetDetail(geo), 'Gusset template'), `<div class="cell">${ruled}</div>`], { cols: '1fr 1.4fr', rows: '1.25fr 1fr' }),
    sheet('A-2', 'Exterior elevations', [cell(DW.elevation(geo, 'front'), 'Front elevation'), cell(DW.elevation(geo, 'left'), 'Left elevation'), cell(DW.elevation(geo, 'back'), 'Back elevation'), cell(DW.elevation(geo, 'right'), 'Right elevation')], { cols: '1.35fr 1fr', rows: '1fr 1fr' }),
    sheet('A-3', 'Building section', [cell(DW.section(geo), 'Section through the shed', 'looking toward the left gable')]),
  ].join('');
}

// ------------------------------------------------------------ materials
function groupBy(items, k) {
  const out = {};
  items.forEach((it) => (out[it[k]] ||= []).push(it));
  return out;
}
function renderMaterials() {
  const groups = groupBy(take.items, 'section');
  document.getElementById('materials').innerHTML = `<table class="data"><thead><tr><th style="width:70px">Qty</th><th style="width:60px">Unit</th><th>Item</th></tr></thead><tbody>${Object.entries(groups)
    .map(([sec, its]) => `<tr class="sec"><td colspan="3">${sec}</td></tr>${its.map((it) => `<tr><td class="n">${it.qty}</td><td>${it.unit}</td><td>${it.name}${it.note ? `<span class="note">${it.note}</span>` : ''}</td></tr>`).join('')}`)
    .join('')}</tbody></table>`;
}

function csv() {
  const rows = [['Section', 'Item', 'Qty', 'Unit', 'Unit price', 'Total', 'Note']];
  take.items.forEach((it) => {
    const pr = priceOverrides[it.id] ?? it.unitPrice;
    rows.push([it.section, it.name, it.qty, it.unit, pr.toFixed(2), (pr * it.qty).toFixed(2), it.note]);
  });
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ------------------------------------------------------------ cut list
function renderCutList() {
  const sched = pieceSchedule(geo);
  const stockGroups = groupBy(sched, 'stock');
  const table = `<table class="data"><thead><tr><th>Stock</th><th>Part</th><th class="n">Length</th><th class="n">Qty</th><th>Where</th></tr></thead><tbody>${Object.entries(stockGroups)
    .map(([st, rows]) => `<tr class="sec"><td colspan="5">${st}</td></tr>${rows.map((r) => `<tr><td>${r.stock}</td><td>${r.kind}</td><td class="n">${ftIn(r.cut)}</td><td class="n">${r.qty}</td><td>${[...r.where].join(', ')}</td></tr>`).join('')}`)
    .join('')}</tbody></table>`;
  const bars = Object.entries(take.boardsByStock)
    .map(([st, boards]) => {
      const max = Math.max(...boards.map((b) => b.len));
      const cls = st.endsWith('PT') ? 'pt' : st.startsWith('1x') ? 'trim' : '';
      const sorted = boards.slice().sort((a, b) => b.len - a.len || b.used - a.used);
      // collapse identical boards
      const sig = (b) => `${b.len}|${b.cuts.map((c) => `${c.kind}:${c.cut.toFixed(2)}`).join(',')}`;
      const uniq = [];
      sorted.forEach((b) => {
        const u = uniq.find((x) => x.sig === sig(b));
        if (u) u.n++;
        else uniq.push({ sig: sig(b), b, n: 1 });
      });
      const waste = boards.reduce((a, b) => a + b.len - Math.min(b.len, b.used), 0);
      const total = boards.reduce((a, b) => a + b.len, 0);
      return `<div class="stock-group"><h3>${st} — ${boards.length} boards · ${Math.round((waste / total) * 100)}% offcut</h3>${uniq
        .map(({ b, n }) => `<div class="board"><span class="lbl">${n} × ${b.precut ? '92-5/8" stud' : `${b.len / 12}' board`}</span><div class="bar" style="width:${(b.len / max) * 100}%">${b.cuts
          .map((c) => `<span class="${cls}" style="width:${(c.cut / b.len) * 100}%" title="${c.kind} ${ftIn(c.cut)}">${c.cut / b.len > 0.09 ? `${c.kind} ${ftIn(c.cut)}` : ftIn(c.cut)}</span>`)
          .join('')}</div></div>`)
        .join('')}</div>`;
    })
    .join('');
  document.getElementById('cutlist').innerHTML = `<h2>Cutting plan</h2>${bars}<h2>Piece schedule</h2>${table}`;
}

// ------------------------------------------------------------ cost
function opts() {
  return { tax: parseFloat(document.getElementById('tax').value) || 0, contingency: parseFloat(document.getElementById('cont').value) || 0 };
}
function renderCost() {
  const cs = costSummary(take.items, priceOverrides, opts());
  const groups = groupBy(take.items, 'section');
  const sum = `<div class="summary">${Object.entries(cs.sections).map(([k, v]) => `<div><small>${k}</small><b>${money(v)}</b></div>`).join('')}
    <div><small>Subtotal</small><b>${money(cs.subtotal)}</b></div>
    <div><small>Tax + contingency</small><b>${money(cs.taxAmt + cs.cont)}</b></div>
    <div class="total"><small>Estimated total</small><b>${money(cs.total)}</b></div></div>`;
  const tbl = `<table class="data"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Total</th></tr></thead><tbody>${Object.entries(groups)
    .map(([sec, its]) => `<tr class="sec"><td colspan="4">${sec}</td></tr>${its.map((it) => {
      const pr = priceOverrides[it.id] ?? it.unitPrice;
      return `<tr><td>${it.name}</td><td class="n">${it.qty} ${it.unit}</td><td class="n">$<input type="number" step="0.01" min="0" data-id="${it.id}" value="${pr.toFixed(2)}" class="${priceOverrides[it.id] !== undefined ? 'changed' : ''}" aria-label="Unit price for ${it.name}"/></td><td class="n">${money(pr * it.qty)}</td></tr>`;
    }).join('')}`)
    .join('')}</tbody></table>
    <p class="note" style="margin-top:10px;color:var(--muted)">${getRegion().note} Not included: tools, permit fees, lumber delivery, electrical, shelving, labor. Lumber prices swing ±20% by store and season.</p>`;
  document.getElementById('cost').innerHTML = sum + sidingCompare() + tbl;
}

function sidingCompare() {
  const rows = Object.entries(SIDING).map(([k, info]) => {
    const g = buildShed({ ...params, siding: k });
    const t = takeoff(g);
    const cs = costSummary(t.items, priceOverrides, opts());
    const sid = t.items.filter((i) => i.section === 'Siding & trim' || i.id === 'paint' || i.id === 'nails8dgalv').reduce((a, i) => a + (priceOverrides[i.id] ?? i.unitPrice) * i.qty, 0);
    return { k, info, sid, total: cs.total };
  });
  const cur = rows.find((r) => r.k === params.siding) || rows[0];
  return `<h2>Siding options</h2>
  <table class="data" style="margin-bottom:22px"><thead><tr><th>Option</th><th>Look</th><th>Upkeep</th><th class="n">Siding, trim & paint</th><th class="n">Project total</th><th></th></tr></thead><tbody>
  ${rows.map((r) => `<tr${r.k === cur.k ? ' style="background:#f4f8fb"' : ''}><td><b>${r.info.label}</b></td><td>${r.info.look}</td><td>${r.info.upkeep}</td><td class="n">${money(r.sid)}</td><td class="n"><b>${money(r.total)}</b>${r.k === cur.k ? '' : `<span class="note">${r.total < cur.total ? '−' : '+'}${money(Math.abs(r.total - cur.total))}</span>`}</td><td>${r.k === cur.k ? 'Selected' : `<button class="btn ghost" style="color:var(--accent);padding:3px 10px;font-size:12px" data-siding="${r.k}">Use</button>`}</td></tr>`).join('')}
  </tbody></table>`;
}

// ------------------------------------------------------------ wiring
function initTabs() {
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      currentTab = b.dataset.tab;
      document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
      document.querySelectorAll('.tab').forEach((t) => (t.hidden = t.id !== `tab-${currentTab}`));
      if (currentTab === 'model' && viewer) viewer.resize();
      if (currentTab === 'plans' && geo) renderPlans();
      history.replaceState(null, '', `#${currentTab}`);
    })
  );
  const h = location.hash.slice(1);
  if (h) document.querySelector(`.tabs button[data-tab="${h}"]`)?.click();
}

const PRESETS = {
  finished: { site: true, floor: true, deck: true, walls: true, roofFraming: true, siding: true, trim: true, openings: true, roof: true },
  framing: { site: true, floor: true, deck: true, walls: true, roofFraming: true, siding: false, trim: false, openings: false, roof: false },
  cutaway: { site: true, floor: true, deck: true, walls: true, roofFraming: true, siding: true, trim: true, openings: true, roof: false },
};
const LAYER_NAMES = { floor: 'Skids & floor framing', deck: 'Subfloor', walls: 'Wall framing', roofFraming: 'Roof framing', siding: 'Siding', trim: 'Trim & battens', openings: 'Doors & windows', roof: 'Roofing' };
let layerState = { ...PRESETS.finished };

function initViewerUI() {
  const lt = document.getElementById('layerToggles');
  const draw = () => {
    lt.innerHTML = Object.entries(LAYER_NAMES).map(([k, n]) => `<label><input type="checkbox" data-layer="${k}"${layerState[k] ? ' checked' : ''}/> ${n}</label>`).join('');
  };
  draw();
  lt.addEventListener('change', (e) => {
    layerState[e.target.dataset.layer] = e.target.checked;
    viewer.setVisible(layerState);
  });
  document.querySelectorAll('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('on', x === b));
      layerState = { ...PRESETS[b.dataset.preset] };
      viewer.setVisible(layerState);
      draw();
    })
  );
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewer.view(b.dataset.view)));
}

async function init() {
  renderForm();
  initTabs();
  document.getElementById('review').innerHTML = reviewHTML();
  document.getElementById('printBtn').onclick = () => window.print();
  document.getElementById('csvBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' }));
    a.download = `shed-${geo.W / 12}x${geo.L / 12}-materials.csv`;
    a.click();
  };
  document.getElementById('cost').addEventListener('click', (e) => {
    const k = e.target.dataset?.siding;
    if (!k) return;
    params.siding = k;
    localStorage.setItem(LS_PARAMS, JSON.stringify(params));
    document.getElementById('f-siding').value = k;
    update();
  });
  document.getElementById('cost').addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) priceOverrides[id] = v;
    localStorage.setItem(lsPrices(), JSON.stringify(priceOverrides));
    renderCost();
    renderKeyFacts();
  });
  const regionSel = document.getElementById('region');
  regionSel.innerHTML = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}"${k === regionKey ? ' selected' : ''}>${r.label}</option>`).join('');
  const applyRegion = () => {
    setRegion(regionKey);
    document.getElementById('tax').value = getRegion().tax;
    document.getElementById('taxLabel').textContent = getRegion().taxLabel;
    priceOverrides = JSON.parse(localStorage.getItem(lsPrices()) || '{}');
  };
  applyRegion();
  regionSel.addEventListener('change', () => {
    regionKey = regionSel.value;
    localStorage.setItem(LS_REGION, regionKey);
    applyRegion();
    update();
  });
  ['tax', 'cont'].forEach((id) => document.getElementById(id).addEventListener('input', () => (renderCost(), renderKeyFacts())));
  document.getElementById('resetPrices').onclick = () => {
    priceOverrides = {};
    localStorage.removeItem(lsPrices());
    renderCost();
    renderKeyFacts();
  };
  try {
    const { ShedViewer } = await import('./model3d.js');
    viewer = new ShedViewer(document.getElementById('viewer'));
    initViewerUI();
  } catch (err) {
    console.error(err);
    document.getElementById('viewer').innerHTML = `<p style="padding:20px">The 3D viewer needs an internet connection to load three.js. Plans, materials and costs still work.</p>`;
  }
  update();
  if (viewer) viewer.setVisible(layerState);
}

init();
