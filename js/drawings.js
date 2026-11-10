// Dimensioned SVG drawings generated from the framing engine.
import { ftIn } from './geometry.js';

const C = {
  ink: '#1d1d1b',
  frame: '#f2e2c0',
  frameDk: '#e2c48f',
  pt: '#cfe2c6',
  sheet: '#e9e6df',
  siding: '#fbfaf6',
  roof: '#4a4d52',
  glass: '#d4e6f1',
  door: '#34383d',
  hatch: '#bdb8ad',
};

const KIND_FILL = {
  Stud: C.frame,
  'Gable stud': C.frame,
  'King stud': C.frameDk,
  'Jack stud': C.frameDk,
  Header: '#d6ae6c',
  'Bottom plate': '#d9d2c3',
  'Top plate': '#d9d2c3',
  'Cap plate': '#cfc6b3',
  'Cripple (top)': '#efe7d6',
  'Cripple (sill)': '#efe7d6',
  'Rough sill': '#d6ae6c',
};

class Dwg {
  constructor(fs) {
    this.parts = [];
    this.b = [Infinity, Infinity, -Infinity, -Infinity];
    this.fs = fs;
  }
  ext(x, y) {
    const b = this.b;
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  poly(pts, { fill = 'none', stroke = C.ink, sw = 0.8, dash = '', close = true, op = 1 } = {}) {
    pts.forEach(([x, y]) => this.ext(x, y));
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r(x)} ${r(-y)}`).join('') + (close ? 'Z' : '');
    this.parts.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke"${dash ? ` stroke-dasharray="${dash}"` : ''}${op < 1 ? ` fill-opacity="${op}"` : ''} stroke-linejoin="round"/>`);
  }
  rect(x0, y0, x1, y1, o = {}) {
    this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], o);
  }
  line(x1, y1, x2, y2, o = {}) {
    this.poly([[x1, y1], [x2, y2]], { ...o, close: false });
  }
  raw(s) {
    this.parts.push(s);
  }
  text(x, y, str, { size = 1, anchor = 'middle', rot = 0, weight = 400, fill = C.ink, base = 'middle' } = {}) {
    const fs = this.fs * size;
    const w = String(str).length * fs * 0.5;
    const rad = (rot * Math.PI) / 180;
    const k = anchor === 'start' ? [0, 1] : anchor === 'end' ? [-1, 0] : [-0.5, 0.5];
    k.forEach((f) => this.ext(x + Math.cos(rad) * w * f, y - Math.sin(rad) * w * f));
    this.ext(x, y + fs * 0.6);
    this.ext(x, y - fs * 0.6);
    const tr = rot ? ` transform="rotate(${r(rot)} ${r(x)} ${r(-y)})"` : '';
    this.parts.push(`<text x="${r(x)}" y="${r(-y)}" font-size="${r(fs)}" text-anchor="${anchor}" dominant-baseline="${base}" font-weight="${weight}" fill="${fill}"${tr}>${esc(str)}</text>`);
  }
  arc(cx, cy, rad, a0, a1) {
    const p0 = [cx + rad * Math.cos(a0), cy + rad * Math.sin(a0)];
    const p1 = [cx + rad * Math.cos(a1), cy + rad * Math.sin(a1)];
    this.ext(...p0);
    this.ext(...p1);
    const sweep = a1 > a0 ? 0 : 1;
    this.parts.push(`<path d="M${r(p0[0])} ${r(-p0[1])}A${r(rad)} ${r(rad)} 0 0 ${sweep} ${r(p1[0])} ${r(-p1[1])}" fill="none" stroke="${C.ink}" stroke-width="0.6" vector-effect="non-scaling-stroke" stroke-dasharray="4 3"/>`);
  }
  // Aligned dimension between two points, offset along the left-hand normal.
  dim(x1, y1, x2, y2, off, label, { size = 0.9 } = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1e-6) return;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const nx = -uy;
    const ny = ux;
    const sg = Math.sign(off) || 1;
    const gap = this.fs * 0.3;
    const ex = this.fs * 0.4;
    const a = [x1 + nx * off, y1 + ny * off];
    const b = [x2 + nx * off, y2 + ny * off];
    const o = { sw: 0.5, stroke: '#333' };
    this.line(x1 + nx * gap * sg, y1 + ny * gap * sg, a[0] + nx * ex * sg, a[1] + ny * ex * sg, o);
    this.line(x2 + nx * gap * sg, y2 + ny * gap * sg, b[0] + nx * ex * sg, b[1] + ny * ex * sg, o);
    this.line(a[0] - ux * ex * 0.6, a[1] - uy * ex * 0.6, b[0] + ux * ex * 0.6, b[1] + uy * ex * 0.6, o);
    const tk = this.fs * 0.35;
    [a, b].forEach(([px, py]) => this.line(px - (ux + nx) * tk, py - (uy + ny) * tk, px + (ux + nx) * tk, py + (uy + ny) * tk, { sw: 1.1 }));
    let ang = (-Math.atan2(uy, ux) * 180) / Math.PI;
    if (ang > 89.99 || ang <= -90.01) ang += ang > 0 ? -180 : 180;
    // Put the text on the far side of the dimension line, upright.
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const up = this.fs * size * 0.62;
    const tx = mx + nx * up * sg;
    const ty = my + ny * up * sg;
    this.text(tx, ty, label, { size, rot: ang });
  }
  leader(x, y, tx, ty, label, { anchor } = {}) {
    this.line(x, y, tx, ty, { sw: 0.5 });
    this.parts.push(`<circle cx="${r(x)}" cy="${r(-y)}" r="${r(this.fs * 0.15)}" fill="${C.ink}"/>`);
    this.text(tx + (tx >= x ? 1 : -1) * this.fs * 0.3, ty, label, { size: 0.8, anchor: anchor || (tx >= x ? 'start' : 'end') });
  }
  svg(pad = 2, cls = '') {
    const [x0, y0, x1, y1] = this.b;
    const p = this.fs * pad;
    const vb = `${r(x0 - p)} ${r(-y1 - p)} ${r(x1 - x0 + 2 * p)} ${r(y1 - y0 + 2 * p)}`;
    return `<svg class="dwg ${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" font-family="'Archivo Narrow','Arial Narrow',Arial,sans-serif">${this.parts.join('')}</svg>`;
  }
}

const r = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ------------------------------------------------------------------ Floor plan
export function floorPlan(geo) {
  const { W, L, openings } = geo;
  const d = new Dwg(Math.max(W, L) / 34);
  const so = 0.75;
  d.raw(`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${C.hatch}" stroke-width="1.2"/></pattern></defs>`);
  const outer = [[-so, -so], [L + so, -so], [L + so, W + so], [-so, W + so]];
  const inner = [[3.5, 3.5], [3.5, W - 3.5], [L - 3.5, W - 3.5], [L - 3.5, 3.5]];
  const pd = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r(x)} ${r(-y)}`).join('') + 'Z';
  [...outer, ...inner].forEach(([x, y]) => d.ext(x, y));
  d.raw(`<path d="${pd(outer)}${pd(inner)}" fill="url(#hatch)" fill-rule="evenodd" stroke="${C.ink}" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`);

  const toPlan = {
    front: (x, dd) => [x, dd],
    back: (x, dd) => [L - x, W - dd],
    left: (x, dd) => [dd, x],
    right: (x, dd) => [L - dd, W - x],
  };
  Object.entries(openings).forEach(([face, ops]) => {
    ops.forEach((o) => {
      const P = toPlan[face];
      const q = [P(o.xL, -so - 0.2), P(o.xL + o.w, -so - 0.2), P(o.xL + o.w, 3.7), P(o.xL, 3.7)];
      d.poly(q, { fill: '#fff', stroke: 'none' });
      d.line(...P(o.xL, -so), ...P(o.xL, 3.5), { sw: 1.4 });
      d.line(...P(o.xL + o.w, -so), ...P(o.xL + o.w, 3.5), { sw: 1.4 });
      if (o.type === 'window') {
        [-so, 1.375, 3.5].forEach((dd) => d.line(...P(o.xL, dd), ...P(o.xL + o.w, dd), { sw: 0.7 }));
        const [tx, ty] = P(o.xL + o.w / 2, -so - d.fs * 1.4);
        d.text(tx, ty, `${geo.p.windowW}"×${geo.p.windowH}" WINDOW`, { size: 0.7, rot: face === 'left' || face === 'right' ? -90 : 0 });
      } else {
        const leaf = (o.w - 0.5) / o.leaves;
        const hinges = o.leaves === 2 ? [[o.xL, 1], [o.xL + o.w, -1]] : [[o.xL, 1]];
        hinges.forEach(([hx, dir]) => {
          const [ax, ay] = P(hx, -so);
          const [bx, by] = P(hx, -so - leaf);
          const [cx2, cy2] = P(hx + dir * leaf, -so);
          d.line(ax, ay, bx, by, { sw: 1.2 });
          const a0 = Math.atan2(cy2 - ay, cx2 - ax);
          const a1 = Math.atan2(by - ay, bx - ax);
          let s0 = a0;
          let s1 = a1;
          if (Math.abs(s1 - s0) > Math.PI) s1 += s1 < s0 ? 2 * Math.PI : -2 * Math.PI;
          d.arc(ax, ay, leaf, Math.min(s0, s1), Math.max(s0, s1));
        });
        const [tx, ty] = P(o.xL + o.w / 2, 3.5 + d.fs * 1.3);
        const lbl = `${o.leaves === 2 ? 'DBL ' : ''}DOOR ${ftIn(o.nominal)}×6'-8" ${o.build === 'prehung' ? '(PRE-HUNG)' : '(SITE-BUILT)'}`;
        d.text(tx, ty, lbl, { size: 0.7, rot: face === 'left' || face === 'right' ? -90 : 0 });
      }
    });
  });
  d.text(L / 2, W / 2 + d.fs * 0.8, 'STORAGE', { size: 1.3, weight: 700 });
  d.text(L / 2, W / 2 - d.fs * 0.8, `${ftIn(L)} × ${ftIn(W)} = ${Math.round((L * W) / 144)} SQ FT`, { size: 0.9 });
  d.text(L / 2, W / 2 - d.fs * 2.2, 'OPEN TO RAFTERS · RAFTER TIES AT PLATE', { size: 0.7, fill: '#666' });

  // dimensions
  const fo = openings.front.slice().sort((a, b) => a.xL - b.xL);
  const chain = [-so, ...fo.flatMap((o) => [o.xL, o.xL + o.w]), L + so];
  for (let i = 0; i < chain.length - 1; i++) d.dim(chain[i], -so, chain[i + 1], -so, -d.fs * 4.2, ftIn(chain[i + 1] - chain[i]), { size: 0.75 });
  d.dim(-so, -so, L + so, -so, -d.fs * 6.4, `${ftIn(L + 2 * so)} OVERALL (${ftIn(L)} FRAMING)`);
  d.dim(-so, -so, -so, W + so, d.fs * 4.5, `${ftIn(W)} FRAMING`);
  const lo = openings.left[0];
  if (lo) {
    d.dim(L + so, W + so, L + so, -so, d.fs * 0.1 - d.fs * 4.6, ftIn(W + 2 * so));
    d.dim(-so, lo.xL, -so, lo.xL + lo.w, -d.fs * 0.1 + d.fs * 2.4, `${ftIn(lo.w)} R.O.`, { size: 0.7 });
  }
  return d.svg(2.2);
}

// ------------------------------------------------------- Foundation + floor framing
export function foundationPlan(geo) {
  const { W, L } = geo;
  const d = new Dwg(Math.max(W, L) / 30);
  geo.members
    .filter((m) => m.kind === 'Skid')
    .forEach((m) => d.rect(m.box[0], m.box[2], m.box[3], m.box[5], { fill: C.pt, dash: '6 3', sw: 0.8 }));
  geo.members
    .filter((m) => m.kind === 'Rim joist' || m.kind === 'Floor joist')
    .forEach((m) => d.rect(m.box[0], m.box[2], m.box[3], m.box[5], { fill: m.kind === 'Rim joist' ? '#b9d4ad' : '#e3eedd', sw: 0.8 }));
  const jx = geo.joistX;
  const zs = geo.skidZ;
  d.dim(jx[1] + 0.75, 0, jx[2] + 0.75, 0, -d.fs * 1.8, `${geo.p.joistSpacing}" O.C. TYP.`, { size: 0.7 });
  d.dim(0, 0, L, 0, -d.fs * 3.8, `${ftIn(L)} (RIM JOISTS, 2x6 PT)`);
  d.dim(0, 0, 0, W, d.fs * 2.4, ftIn(W));
  for (let i = 0; i < zs.length - 1; i++) d.dim(L, zs[i] + 1.75, L, zs[i + 1] + 1.75, -d.fs * 2.2, `${ftIn(zs[i + 1] - zs[i])} C/C`, { size: 0.7 });
  d.leader(L * 0.12, W - 0.75, L * 0.02, W + d.fs * 1.8, '2x6 PT RIM JOIST, 3-16d INTO EACH JOIST END', { anchor: 'start' });
  d.leader(jx[Math.floor(jx.length / 2)] + 0.75, W * 0.8, L * 0.55, W + d.fs * 3.2, `(${jx.length}) 2x6 PT FLOOR JOISTS × ${ftIn(W - 3)} @ ${geo.p.joistSpacing}" O.C.`, { anchor: 'start' });
  d.leader(L * 0.1, zs[0] + 1.75, L * 0.3, -d.fs * 5.6, `(${zs.length}) 4x6 PT SKIDS × ${ftIn(L)}, GROUND-CONTACT RATED`, { anchor: 'start' });
  d.text(L / 2, -d.fs * 7.2, 'A23 CLIP EACH JOIST AT OUTER SKIDS · SKIDS ON 4" COMPACTED GRAVEL PAD', { size: 0.75, fill: '#555' });
  return d.svg(2);
}

export function floorSheathing(geo) {
  const { W, L } = geo;
  const d = new Dwg(Math.max(W, L) / 26);
  d.rect(0, 0, L, W, { sw: 1.2 });
  const rows = Math.ceil(W / 48);
  for (let i = 0; i < rows; i++) {
    const y0 = i * 48;
    const y1 = Math.min(W, y0 + 48);
    const stag = i % 2 ? 48 : 0;
    const xs = [0];
    for (let x = stag || 96; x < L; x += 96) xs.push(x);
    xs.push(L);
    for (let k = 0; k < xs.length - 1; k++) {
      d.rect(xs[k], y0, xs[k + 1], y1, { fill: k % 2 ? '#efe9dc' : '#f7f3ea', sw: 0.8 });
      d.text((xs[k] + xs[k + 1]) / 2, (y0 + y1) / 2, ftIn(xs[k + 1] - xs[k]), { size: 0.65, fill: '#666' });
    }
  }
  d.dim(0, 0, L, 0, -d.fs * 2.2, ftIn(L), { size: 0.8 });
  d.dim(0, 0, 0, W, d.fs * 2.2, ftIn(W), { size: 0.8 });
  d.text(L / 2, W + d.fs * 2.2, '3/4" T&G OSB, LONG EDGE ACROSS JOISTS, STAGGER END JOINTS', { size: 0.7 });
  d.text(L / 2, W + d.fs * 1.1, 'GLUE + 8d RING-SHANK @ 6" EDGES / 12" FIELD', { size: 0.7 });
  return d.svg(1.8);
}

// --------------------------------------------------------------- Wall framing
export function wallFraming(geo, name) {
  const wall = geo.walls.find((w) => w.name === name);
  const span = wall.gable ? geo.W : geo.L;
  const d = new Dwg(span / 30);
  const ms = geo.members.filter((m) => m.group === `wall:${name}` && !(m.kind === 'Header' && m.d0 === 2));
  if (wall.gable) {
    const ys = geo.members.filter((m) => m.kind === 'Rafter').slice(0, 2);
    ys.forEach((m) => d.poly(m.poly, { fill: '#f6efe0', dash: '5 3', sw: 0.6 }));
  }
  ms.forEach((m) => d.poly(m.poly, { fill: KIND_FILL[m.kind] || C.frame, sw: 0.7 }));
  const H = geo.H;
  const ops = geo.openings[name].slice().sort((a, b) => a.xL - b.xL);
  const chain = [wall.x0, ...ops.flatMap((o) => [o.xL, o.xL + o.w]), wall.x1];
  if (ops.length) for (let i = 0; i < chain.length - 1; i++) d.dim(chain[i], 0, chain[i + 1], 0, -d.fs * 2.4, ftIn(chain[i + 1] - chain[i]), { size: 0.7 });
  d.dim(wall.x0, 0, wall.x1, 0, -d.fs * 4.4, `${ftIn(wall.x1 - wall.x0)} ${wall.gable ? '(BETWEEN LONG WALLS)' : ''}`);
  d.dim(wall.x1, 0, wall.x1, H, -d.fs * (wall.gable ? 3.2 : 2.6), ftIn(H));
  ops.forEach((o) => {
    d.dim(o.xL, o.top, o.xL + o.w, o.top, -d.fs * 1.4, '', { size: 0.6 });
    d.text(o.xL + o.w / 2, (o.bottom + o.top) / 2 + d.fs * 0.6, `R.O. ${ftIn(o.w)}`, { size: 0.7, weight: 700 });
    d.text(o.xL + o.w / 2, (o.bottom + o.top) / 2 - d.fs * 0.6, `× ${ftIn(o.top - o.bottom)}`, { size: 0.7, weight: 700 });
    d.dim(o.xL, 0, o.xL, o.top, d.fs * 1.6, `${ftIn(o.top)}`, { size: 0.65 });
    if (o.bottom > 0) d.dim(o.xL + o.w, 0, o.xL + o.w, o.bottom, -d.fs * 1.6, ftIn(o.bottom), { size: 0.65 });
  });
  if (wall.gable) {
    const pk = geo.yb(geo.run);
    d.dim(wall.x0 - 3.5, H, wall.x0 - 3.5, pk, d.fs * 2.6, ftIn(pk - H), { size: 0.7 });
    d.text(geo.run, H + (pk - H) * 0.35, 'GABLE STUDS 16" O.C., TOPS CUT TO ROOF PITCH', { size: 0.62 });
  } else {
    const st = ms.find((m) => m.kind === 'Stud');
    if (st) d.text(span / 2, H + d.fs * 1.4, `STUDS ${geo.p.studSpacing}" O.C. · ${ftIn(geo.p.studLength)} PRECUT · DOUBLE TOP PLATE (LAP CAP PLATES AT CORNERS)`, { size: 0.68 });
  }
  return d.svg(2);
}

export const FRAMING_LEGEND = Object.entries({ 'Stud / gable stud': C.frame, 'King & jack stud': C.frameDk, 'Header (2-ply 2x6 + 1/2" spacer)': '#d6ae6c', Plates: '#d9d2c3', Cripples: '#efe7d6' });

// ---------------------------------------------------------------- Roof framing
export function roofPlan(geo) {
  const { W, L, O, R } = geo;
  const d = new Dwg(Math.max(W, L) / 34);
  d.rect(-R, -O, L + R, W + O, { dash: '8 4', sw: 0.8, fill: '#fafafa' });
  d.rect(0, 0, L, W, { sw: 0.6, stroke: '#888' });
  geo.rafterX.forEach((x) => d.rect(x, -O, x + 1.5, W + O, { fill: C.frame, sw: 0.7 }));
  if (R >= 1.5) [-R, L + R - 1.5].forEach((x) => d.rect(x, -O, x + 1.5, W + O, { fill: C.frameDk, sw: 0.7 }));
  d.line(-R, W / 2, L + R, W / 2, { sw: 1.2, dash: '14 4 3 4' });
  d.text(L / 2, W / 2 + d.fs * 0.8, 'RIDGE (GUSSETED RAFTER PAIRS, NO RIDGE BOARD)', { size: 0.7 });
  const rx = geo.rafterX;
  d.dim(rx[0], W + O, rx[1] + 0.75, W + O, d.fs * 1.8, ftIn(rx[1] + 0.75), { size: 0.7 });
  d.dim(rx[1] + 0.75, W + O, rx[2] + 0.75, W + O, d.fs * 1.8, `${geo.p.rafterSpacing}" O.C.`, { size: 0.7 });
  d.dim(-R, -O, L + R, -O, -d.fs * 2.6, `${ftIn(L + 2 * R)} ROOF (${ftIn(R)} RAKE OVERHANG EACH END)`);
  d.dim(L + R, -O, L + R, W + O, -d.fs * 2.6, `${ftIn(W + 2 * O)} (${ftIn(O)} EAVE EACH SIDE)`);
  d.leader(rx[3] + 0.75, W * 0.25, L * 0.48, W * 0.25, `(${rx.length}) RAFTER PAIRS ${geo.p.rafterSize} × ${ftIn(geo.rafterCut)}`);
  if (R >= 1.5) d.leader(-R + 0.75, W * 0.75, L * 0.1, W * 0.88, `FLY RAFTER ${geo.p.rafterSize}, ${ftIn(R)} OUT`, { anchor: 'start' });
  d.text(L / 2, -O - d.fs * 4.8, `7/16" OSB SHEATHING WITH H-CLIPS · #15 FELT · ${geo.p.pitch}/12 ASPHALT SHINGLES · DRIP EDGE ALL EDGES`, { size: 0.7, fill: '#555' });
  return d.svg(2);
}

export function trussElevation(geo) {
  const { W, H } = geo;
  const d = new Dwg(W / 26);
  const tie = geo.members.find((m) => m.kind === 'Rafter tie');
  d.rect(0, H - 3, 3.5, H, { fill: '#d9d2c3', sw: 0.7 });
  d.rect(W - 3.5, H - 3, W, H, { fill: '#d9d2c3', sw: 0.7 });
  d.rect(0, H - 22, 3.5, H - 3, { fill: C.frame, sw: 0.5, dash: '4 3' });
  d.rect(W - 3.5, H - 22, W, H - 3, { fill: C.frame, sw: 0.5, dash: '4 3' });
  if (tie) d.poly(tie.poly, { fill: C.frameDk, sw: 0.7 });
  geo.members.filter((m) => m.kind === 'Rafter').slice(0, 2).forEach((m) => d.poly(m.poly, { fill: C.frame, sw: 0.9 }));
  d.poly(geo.gussetPoly, { fill: C.sheet, sw: 0.8, op: 0.9 });
  const pk = geo.peakTop;
  d.dim(0, H, W, H, -d.fs * 3.4, `${ftIn(W)} SPAN`);
  d.dim(-geo.O, geo.yt(0) - geo.O * geo.t, 0, geo.yt(0) - geo.O * geo.t, d.fs * 0.1 - d.fs * 1.6, '', { size: 0.6 });
  d.text(-geo.O / 2, H - d.fs * 2.6, `${ftIn(geo.O)} EAVE`, { size: 0.65 });
  d.dim(W + geo.O, H, W + geo.O, pk, -d.fs * 2.4, ftIn(pk - H), { size: 0.7 });
  // pitch triangle
  const px = W * 0.2;
  const py = geo.yt(px) + d.fs * 1.4;
  const k = d.fs * 2.4;
  d.poly([[px, py], [px + k, py], [px + k, py + k * geo.t]], { close: false, sw: 0.7 });
  d.text(px + k / 2, py - d.fs * 0.6, '12', { size: 0.75 });
  d.text(px + k + d.fs * 0.8, py + (k * geo.t) / 2, `${geo.p.pitch}`, { size: 0.75 });
  d.leader(geo.run, pk - 6, geo.run + W * 0.12, pk + d.fs * 1.2, 'OSB GUSSET, BOTH FACES');
  if (tie) d.leader(W * 0.6, H + 1.75, W * 0.62, H + d.fs * 3.2, '2x4 TIE EVERY PAIR');
  d.leader(geo.seat / 2, H, -geo.O, H - d.fs * 4.4, 'BIRDSMOUTH + H2.5A TIE', { anchor: 'end' });
  return d.svg(2.2);
}

// ---------------------------------------------------------------- Rafter detail
export function rafterDetail(geo) {
  const { O, run, t, seat, H, D, c, theta } = geo;
  const d = new Dwg((run + O) / 24);
  const m = geo.members.find((mm) => mm.kind === 'Rafter');
  const pts = m.poly.map(([x, y]) => [x, y - H]);
  d.poly(pts, { fill: C.frame, sw: 1.2 });
  const deg = ((theta * 180) / Math.PI).toFixed(1);
  const topA = [-O, -O * t + D / c];
  const topB = [run, run * t + D / c];
  d.dim(...topA, ...topB, d.fs * 2.2, `${ftIn(geo.rafterCut)} LONG POINT TO LONG POINT`, { size: 0.9 });
  d.dim(seat, seat * t, run, run * t, -d.fs * 2.4, `${ftIn((run - seat) / c)} BIRDSMOUTH HEEL TO RIDGE (BOTTOM EDGE)`, { size: 0.75 });
  d.dim(-O, -O * t, 0, 0, -d.fs * 2.4, `${ftIn(O / c)} TAIL`, { size: 0.7 });
  d.leader(seat / 2, 0, seat + d.fs * 6, -d.fs * 3.4, `SEAT CUT ${ftIn(seat)} LEVEL · HEEL ${ftIn(seat * t)} PLUMB`);
  d.leader(run, run * t + D / (2 * c), run - d.fs * 3, run * t + D / c + d.fs * 4.4, `RIDGE PLUMB CUT: MITER ${deg}°`, { anchor: 'end' });
  d.leader(-O, -O * t + D / (2 * c), -O + d.fs * 1, -O * t - d.fs * 4.6, `TAIL PLUMB CUT: MITER ${deg}°`, { anchor: 'start' });
  d.text(run * 0.45, run * 0.45 * t + D / (2 * c), `${geo.p.rafterSize} — CUT ${geo.members.filter((mm) => mm.kind === 'Rafter' || mm.kind === 'Fly rafter').length}`, { size: 0.85, weight: 700, rot: -deg });
  return d.svg(2.4);
}

export function gussetDetail(geo) {
  const pts = geo.gussetPoly.map(([x, y]) => [x - geo.run, y]);
  const minY = Math.min(...pts.map((q) => q[1]));
  const g = pts.map(([x, y]) => [x, y - minY]);
  const d = new Dwg(24 / 12);
  d.poly(g, { fill: C.sheet, sw: 1.2 });
  d.dim(g[4][0], 0, g[3][0], 0, -d.fs * 1.6, ftIn(g[3][0] - g[4][0]), { size: 0.8 });
  d.dim(g[3][0], 0, g[3][0], g[2][1], -d.fs * 1.6, ftIn(g[2][1]), { size: 0.8 });
  d.dim(g[3][0], 0, g[3][0], g[1][1], -d.fs * 4.2, ftIn(g[1][1]), { size: 0.8 });
  d.text(0, g[2][1] * 0.4, `7/16" OSB · ${geo.gussets} REQ'D`, { size: 0.75 });
  return d.svg(2);
}

// ---------------------------------------------------------------- Exterior elevations
export function elevation(geo, face) {
  const { W, L, H, O, R, t, D, c, roofT } = geo;
  const gable = face === 'left' || face === 'right';
  const span = gable ? W : L;
  const d = new Dwg(span / 30);
  const g0 = -geo.floorTop; // ground
  const sb = geo.sidingBottom;
  d.line(-span * 0.15, g0, span * 1.15, g0, { sw: 1.6 });
  // skids / rim
  if (gable) geo.skidZ.forEach((z) => d.rect(z, g0, z + 3.5, g0 + 5.5, { fill: C.pt, sw: 0.7 }));
  else d.rect(0, g0, L, g0 + 5.5, { fill: C.pt, sw: 0.7 });
  // siding
  const tailTop = H - O * t + D / c;
  if (gable) {
    d.poly([[0, sb], [W, sb], [W, geo.yt(W)], [geo.run, geo.peakTop], [0, geo.yt(0)]], { fill: C.siding, sw: 1 });
  } else d.rect(-0.75, sb, L + 0.75, H, { fill: C.siding, sw: 1 });
  // openings
  geo.openings[face].forEach((o) => {
    if (o.type === 'window') {
      d.rect(o.xL, o.bottom, o.xL + o.w, o.top, { fill: '#fff', sw: 0.9 });
      d.rect(o.xL + 1.5, o.bottom + 1.5, o.xL + o.w - 1.5, o.top - 1.5, { fill: C.glass, sw: 0.6 });
      const mx = o.xL + o.w / 2;
      d.line(mx, o.bottom + 1.5, mx, o.top - 1.5, { sw: 0.6 });
      [1, 2].forEach((k) => {
        const y = o.bottom + 1.5 + (k * (o.top - o.bottom - 3)) / 3;
        d.line(o.xL + 1.5, y, o.xL + o.w - 1.5, y, { sw: 0.6 });
      });
    } else {
      d.rect(o.xL, 0, o.xL + o.w, o.top, { fill: o.build === 'prehung' ? C.door : '#ece6d8', sw: 0.9 });
      const lw = o.w / o.leaves;
      for (let k = 1; k < o.leaves; k++) d.line(o.xL + k * lw, 0, o.xL + k * lw, o.top, { sw: 1 });
      if (o.build === 'prehung') {
        for (let k = 0; k < o.leaves; k++) {
          const lx = o.xL + k * lw;
          d.rect(lx + 4, o.top * 0.58, lx + lw - 4, o.top - 4, { fill: C.glass, sw: 0.5 });
        }
      }
    }
  });
  // trim on this face
  geo.trim
    .filter((tr) => tr.face === face && tr.x0 !== undefined)
    .forEach((tr) => {
      if (tr.diag) d.line(tr.x0, tr.y0, tr.x1, tr.y1, { sw: 2.2, stroke: '#b9ab8c' });
      else d.rect(tr.x0, tr.y0, tr.x1, tr.y1, { fill: tr.door ? '#ddd3bd' : '#fff', sw: 0.5 });
    });
  // corner boards
  const cb = gable ? [[0, 3.5], [W - 3.5, W]] : [[-0.75, 2.75], [L - 2.75, L + 0.75]];
  cb.forEach(([a, b]) => d.rect(a, sb, b, gable ? geo.yt(a) - 0.75 : H, { fill: '#fff', sw: 0.6 }));
  // roof
  if (gable) {
    const pk = geo.peakTop + roofT / c;
    const eL = [-O, tailTop + roofT / c];
    const eR = [W + O, tailTop + roofT / c];
    d.poly([[-O - 0.75, tailTop - 5.5 + 0.75], eL, [geo.run, pk], eR, [W + O + 0.75, tailTop - 5.5 + 0.75], [geo.run, pk - 5.5 / c]], { fill: '#fff', sw: 1 });
    d.poly([eL, [geo.run, pk], eR, [W + O, eR[1] - roofT / c], [geo.run, pk - roofT / c], [-O, eL[1] - roofT / c]], { fill: C.roof, sw: 0.8 });
    if (geo.p.gableVents) {
      const vy = geo.yb(geo.run) - 20;
      d.rect(geo.run - 7, vy - 7, geo.run + 7, vy + 7, { fill: '#fff', sw: 0.8 });
      for (let k = -4; k <= 4; k += 2) d.line(geo.run - 5, vy + k, geo.run + 5, vy + k, { sw: 0.5 });
    }
  } else {
    const pk = geo.peakTop + roofT / c;
    const fasciaTop = tailTop + roofT / c;
    d.poly([[-R, fasciaTop], [L + R, fasciaTop], [L + R, pk], [-R, pk]], { fill: C.roof, sw: 0.9 });
    const step = 5 * geo.s;
    for (let y = fasciaTop + step; y < pk - 0.5; y += step) d.line(-R, y, L + R, y, { sw: 0.35, stroke: '#8a8d92' });
    d.rect(-R - 0.75, fasciaTop - 5.5, L + R + 0.75, fasciaTop, { fill: '#fff', sw: 0.9 });
  }
  // dims
  const pkY = geo.peakTop + roofT / c;
  const x = gable ? W + O : L + R;
  d.dim(x, g0, x, pkY, -d.fs * 2.2, `${ftIn(pkY - g0)} GRADE TO RIDGE`, { size: 0.75 });
  d.dim(x, g0, x, H, -d.fs * 4.6, `${ftIn(H - g0)} TO PLATE`, { size: 0.7 });
  d.dim(gable ? 0 : -0.75, g0, gable ? W : L + 0.75, g0, -d.fs * 1.8, ftIn(gable ? W : L + 1.5), { size: 0.75 });
  return d.svg(2);
}

// ---------------------------------------------------------------- Building section
export function section(geo) {
  const { W, H, O, t, D, c, roofT, floorTop } = geo;
  const d = new Dwg(W / 26);
  const up = (pts) => pts.map(([x, y]) => [x, y + floorTop]);
  d.line(-O - 12, 0, W + O + 12, 0, { sw: 1.6 });
  d.rect(-O - 6, -4, W + O + 6, 0, { fill: '#e7e4dc', sw: 0.4 });
  geo.skidZ.forEach((z) => d.rect(z, 0, z + 3.5, 5.5, { fill: C.pt, sw: 0.8 }));
  d.rect(1.5, 5.5, W - 1.5, 11, { fill: '#e3eedd', sw: 0.8 });
  d.rect(0, 5.5, 1.5, 11, { fill: C.pt, sw: 0.8 });
  d.rect(W - 1.5, 5.5, W, 11, { fill: C.pt, sw: 0.8 });
  d.rect(0, 11, W, floorTop, { fill: C.sheet, sw: 0.6 });
  // walls in section
  [[0, 3.5], [W - 3.5, W]].forEach(([a, b]) => {
    d.rect(a, floorTop, b, floorTop + 1.5, { fill: '#d9d2c3', sw: 0.6 });
    d.rect(a, floorTop + 1.5, b, floorTop + H - 3, { fill: C.frame, sw: 0.6 });
    d.rect(a, floorTop + H - 3, b, floorTop + H, { fill: '#d9d2c3', sw: 0.6 });
  });
  const sb = geo.sidingBottom + floorTop;
  d.rect(-0.75, sb, 0, floorTop + H, { fill: '#fff', sw: 0.6 });
  d.rect(W, sb, W + 0.75, floorTop + H, { fill: '#fff', sw: 0.6 });
  const tie = geo.members.find((m) => m.kind === 'Rafter tie');
  if (tie) d.poly(up(tie.poly), { fill: C.frameDk, sw: 0.7 });
  geo.members.filter((m) => m.kind === 'Rafter').slice(0, 2).forEach((m) => d.poly(up(m.poly), { fill: C.frame, sw: 0.9 }));
  d.poly(up(geo.gussetPoly), { fill: C.sheet, sw: 0.7 });
  geo.members.filter((m) => m.kind === 'Sub-fascia').slice(0, 1).forEach((m) => d.poly(up(m.poly), { fill: C.frameDk, sw: 0.7 }));
  geo.members.filter((m) => m.kind === 'Sub-fascia').slice(-1).forEach((m) => d.poly(up(m.poly), { fill: C.frameDk, sw: 0.7 }));
  // roof layers
  const tailTop = H - O * t + D / c;
  [false, true].forEach((mir) => {
    const a = [-O, tailTop];
    const b = [geo.run, geo.peakTop];
    const n = roofT / c;
    let poly = [a, b, [b[0], b[1] + n], [a[0], a[1] + n]];
    if (mir) poly = poly.map(([x, y]) => [W - x, y]);
    d.poly(up(poly), { fill: C.roof, sw: 0.8 });
  });
  // dims
  const pk = geo.heights.peak;
  d.dim(W + O + 6, 0, W + O + 6, floorTop, -d.fs * 1.6, ftIn(floorTop), { size: 0.7 });
  d.dim(W + O + 6, floorTop, W + O + 6, floorTop + H, -d.fs * 1.6, ftIn(H), { size: 0.7 });
  d.dim(W + O + 6, floorTop + H, W + O + 6, pk, -d.fs * 1.6, ftIn(pk - floorTop - H), { size: 0.7 });
  d.dim(W + O + 6, 0, W + O + 6, pk, -d.fs * 4.2, `${ftIn(pk)} OVERALL`, { size: 0.8 });
  d.dim(0, 0, W, 0, -d.fs * 2.6, ftIn(W), { size: 0.8 });
  const L1 = (x, y, tx, ty, s) => d.leader(x, y, tx, ty, s);
  L1(geo.run * 0.45, floorTop + geo.yt(geo.run * 0.45) + 0.3, -O - d.fs * 2, floorTop + geo.peakTop + d.fs * 1, 'ASPHALT SHINGLES, #15 FELT, 7/16" OSB, DRIP EDGE');
  L1(W - 1.75, floorTop + H * 0.55, W + O + d.fs * 6, floorTop + H * 0.7, `2x4 STUDS ${geo.p.studSpacing}" O.C.`);
  L1(W + 0.4, floorTop + H * 0.3, W + O + d.fs * 6, floorTop + H * 0.45, { t111: 'T1-11 SIDING + 1x3 BATTENS', smartside: 'LP SMARTSIDE + 1x3 BATTENS', spruce: 'OSB, WRAP, SPRUCE 1x6 + 1x4 BATTENS', vinyl: 'OSB, WRAP, VINYL BOARD & BATTEN' }[geo.p.siding] || 'SIDING');
  L1(W * 0.5, floorTop - 0.4, W * 0.6, floorTop + d.fs * 3.5, '3/4" T&G OSB ON 2x6 PT JOISTS 16" O.C.');
  L1(geo.skidZ[1] + 1.75 || 1.75, 2.75, W * 0.32, -d.fs * 2.4, '4x6 PT SKIDS ON 4" GRAVEL');
  return d.svg(2.2);
}
