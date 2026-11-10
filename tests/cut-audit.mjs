// Cut audit: checks every framing member in several shed configurations.
//   node tests/cut-audit.mjs [variant-prefix]
// 1. LENGTH  the printed cut length equals the stock the piece really needs
// 2. CLASH   no two members overlap in 3D (a piece that's too long hits its neighbor)
// 3. GAP     studs, jacks, cripples, headers, sills, plates, ties and rafter seats bear on something
// 4. SPLICE  plate joints land on a stud, rim joints on a joist, cap-plate joints 4 ft from top-plate joints
// 5. SIDING  4 ft siding panel joints land on a stud (or in an opening)
// Exits 1 if anything fails.
const { buildShed, DEFAULTS, toWorld, ftIn } = await import(new URL('../js/geometry.js', import.meta.url));
const variants = [
  ['default 12x16 10/12', {}],
  ['8x10 4/12', { width: 96, length: 120, pitch: 4 }],
  ['10x12 6/12 2x4 rafters', { width: 120, length: 144, pitch: 6, rafterSize: '2x4', snowLoad: 20 }],
  ['12x20 12/12 no side door', { length: 240, pitch: 12, sideDoor: false, backWindows: 2 }],
];
const only = process.argv[2];
let failed = 0;
for (const [name, v] of variants) {
  if (only && !name.startsWith(only)) continue;
  const g = buildShed({ ...DEFAULTS, ...v });
  const issues = [];
  // 1. length check
  const solids = g.members.map((m, i) => {
    let pts3, local;
    if (m.box) {
      const [x0, y0, z0, x1, y1, z1] = m.box;
      const ext = [x1 - x0, y1 - y0, z1 - z0].sort((a, b) => b - a);
      if (m.cut && Math.abs(ext[0] - m.cut) > 0.01) issues.push(`${m.kind}: cut ${ftIn(m.cut)} but piece is ${ftIn(ext[0])}`);
      return { i, m, aabb: [x0, y0, z0, x1, y1, z1], inside: (p) => p[0] > x0 + 0.05 && p[0] < x1 - 0.05 && p[1] > y0 + 0.05 && p[1] < y1 - 0.05 && p[2] > z0 + 0.05 && p[2] < z1 - 0.05, samples: () => grid3([x0, y0, z0], [x1, y1, z1]) };
    }
    const P = m.poly;
    // stock length = extent along the longest edge direction (or extrusion depth)
    let best = 0, dir2 = [1, 0];
    for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best) { best = L; dir2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; } }
    const proj = P.map(([x, y]) => x * dir2[0] + y * dir2[1]);
    const ext = Math.max(...proj) - Math.min(...proj);
    const pr = P.map(([x, y]) => -x * dir2[1] + y * dir2[0]);
    const across = Math.max(...pr) - Math.min(...pr);
    const len = Math.max(ext, m.depth > 6 ? m.depth : 0);
    if (m.kind !== 'Gusset' && Math.abs(len - m.cut) > 0.01) issues.push(`${m.kind} (${m.group}): cut ${ftIn(m.cut)} but piece needs ${ftIn(len)} of stock`);
    const pl = m.plane;
    const w = P.flatMap(([x, y]) => [toWorld(pl, x, y, m.d0), toWorld(pl, x, y, m.d0 + m.depth)]);
    const aabb = [0, 1, 2].map((k) => Math.min(...w.map((q) => q[k]))).concat([0, 1, 2].map((k) => Math.max(...w.map((q) => q[k]))));
    const toLocal = (p) => { const d = [0, 1, 2].map((k) => p[k] - pl.o[k]); const dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2]; return [dot(pl.ex), dot(pl.ey), dot(pl.ez)]; };
    return { i, m, aabb, inside: (p) => { const [x, y, d] = toLocal(p); return d > m.d0 + 0.05 && d < m.d0 + m.depth - 0.05 && inPoly(P, x, y, 0.05); },
      samples: () => { const out = []; const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]); for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.25) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.25) if (inPoly(P, x, y, 0.05)) for (const f of [0.25, 0.5, 0.75]) out.push(toWorld(pl, x, y, m.d0 + m.depth * f)); return out; } };
  });
  // 2. clashes
  const clashes = new Map();
  for (let a = 0; a < solids.length; a++) for (let b = a + 1; b < solids.length; b++) {
    const A = solids[a].aabb, B = solids[b].aabb;
    if ([0, 1, 2].some((k) => A[k + 3] <= B[k] + 0.06 || B[k + 3] <= A[k] + 0.06)) continue;
    const S = solids[a].samples();
    const hit = S.filter((p) => solids[b].inside(p)).length;
    if (hit > 0) { const key = `${solids[a].m.kind} (${solids[a].m.group}) ✕ ${solids[b].m.kind} (${solids[b].m.group})`; clashes.set(key, Math.max(clashes.get(key) || 0, hit)); }
  }
  // 3. gaps: bearing faces must touch something
  const touches = (p, self) => solids.some((S) => S !== self && S.inside(p));
  const need = { Stud: ['b', 't'], 'King stud': ['b', 't'], 'Jack stud': ['b', 't'], 'Cripple (top)': ['b', 't'], 'Cripple (sill)': ['b', 't'], 'Gable stud': ['b', 't'], Header: ['b'], 'Rough sill': ['b'], 'Top plate': ['b'], 'Cap plate': ['b'], 'Bottom plate': ['b'], 'Rafter tie': ['b'], Rafter: ['b'] };
  for (const S of solids) {
    const m = S.m; const req = need[m.kind]; if (!req || !m.poly) continue;
    const P = m.poly, pl = m.plane;
    const ys = P.map((q) => q[1]); const yMin = Math.min(...ys);
    for (const side of req) {
      // sample along horizontal bottom edges (side b) or along upper edges (side t)
      const pts = [];
      for (let k = 0; k < P.length; k++) {
        const a = P[k], b = P[(k + 1) % P.length];
        if (Math.abs(a[0] - b[0]) < 1e-6) continue; // vertical edge
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const solidAbove = inPoly(P, mx, my + 0.2, 0.01), solidBelow = inPoly(P, mx, my - 0.2, 0.01);
        const isBottom = side === 'b' && solidAbove && Math.abs(a[1] - b[1]) < 1e-6; // level bearing faces (plates, seats)
        const isTop = side === 't' && solidBelow;
        if (!isBottom && !isTop) continue;
        const n = Math.max(2, Math.ceil(Math.abs(b[0] - a[0]) / 0.25));
        for (let j = 1; j < n; j++) { const f = j / n; pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + (side === 'b' ? -0.1 : m.kind === 'Gable stud' ? 0.3 : 0.1)]); }
      }
      const ok = pts.some(([x, y]) => [0.1, 0.5, 0.9].some((fd) => { const w = toWorld(pl, x, y, m.d0 + m.depth * fd); return (side === 'b' && Math.abs(w[1] - g.floorTop) < 0.15) || touches(w, S); }));
      if (!ok) issues.push(`GAP ${m.kind} (${m.group}) ${side === 'b' ? 'bottom' : 'top'} touches nothing at ${pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).slice(0, 2).join(' ')}`);
    }
  }
  // 4. splices: plate joints over a stud, rim joints over a joist, cap joints 4 ft from top joints
  const byWall = {};
  g.members.filter((m) => m.poly && m.group.startsWith('wall:')).forEach((m) => (byWall[m.group] ||= []).push(m));
  for (const [wname, ms] of Object.entries(byWall)) {
    const xs = (m) => [Math.min(...m.poly.map((q) => q[0])), Math.max(...m.poly.map((q) => q[0]))];
    const studs = ms.filter((m) => /Stud|King|Jack/.test(m.kind) && !/Gable/.test(m.kind)).map(xs);
    const joints = (kind) => { const ps = ms.filter((m) => m.kind === kind).map(xs).sort((a, b) => a[0] - b[0]); const out = []; for (let k = 1; k < ps.length; k++) if (Math.abs(ps[k][0] - ps[k - 1][1]) < 0.01) out.push(ps[k][0]); return out; };
    for (const kind of ['Bottom plate', 'Top plate', 'Cap plate']) for (const j of joints(kind)) if (!studs.some(([a, b]) => j > a + 0.4 && j < b - 0.4)) issues.push(`SPLICE ${kind} (${wname}) joint at ${j.toFixed(2)} is not over a stud`);
    const tj = joints('Top plate');
    for (const j of joints('Cap plate')) if (tj.some((t) => Math.abs(t - j) < 47.99)) issues.push(`SPLICE Cap plate (${wname}) joint at ${j.toFixed(1)} within 4 ft of a top-plate joint`);
  }
  // 5. siding: every 4 ft panel joint (from each wall's layout corner, x = 0) lands on a stud or inside an opening
  for (const wn of ['front', 'back', 'left', 'right']) {
    const span = wn === 'left' || wn === 'right' ? g.W : g.L;
    const st = g.members.filter((m) => m.group === `wall:${wn}` && /^(Stud|King stud|Jack stud)$/.test(m.kind)).map((m) => Math.min(...m.poly.map((q) => q[0])));
    for (let j = 48; j < span - 1; j += 48) if (!g.openings[wn].some((o) => j > o.xL && j < o.xL + o.w) && !st.some((x) => j > x + 0.25 && j < x + 1.25)) issues.push(`SIDING ${wn} wall: panel joint ${j}" from the corner has no stud behind it`);
  }
  const rims = g.members.filter((m) => m.kind === 'Rim joist'), joists = g.members.filter((m) => m.kind === 'Floor joist');
  for (const r of rims) for (const j of [r.box[0], r.box[3]]) if (j > 0.01 && j < g.L - 0.01 && !joists.some((q) => j > q.box[0] + 0.4 && j < q.box[3] - 0.4)) issues.push(`SPLICE Rim joist joint at ${j.toFixed(2)} is not over a joist`);
  console.log(`\n=== ${name}: ${g.members.length} members, ${g.trim.length} trim`);
  [...new Set(issues)].forEach((s) => console.log('  ', s));
  failed += issues.length + clashes.size;
  [...clashes].forEach(([k, n]) => console.log('  CLASH', k, `(${n} sample pts)`));
}
console.log(failed ? `\n${failed} problem(s)` : '\nAll cuts check out.');
process.exitCode = failed ? 1 : 0;

function grid3(a, b) { const out = []; for (let x = a[0] + 0.1; x < b[0]; x += Math.max(0.25, (b[0] - a[0]) / 400)) for (let y = a[1] + 0.1; y < b[1]; y += 0.5) for (let z = a[2] + 0.1; z < b[2]; z += 0.5) out.push([x, y, z]); return out; }
function inPoly(P, x, y, tol) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
  if (!c) return false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [x1, y1] = P[j], [x2, y2] = P[i]; const L = Math.hypot(x2 - x1, y2 - y1); const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (L * L))); if (Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1)) < tol) return false; }
  return true;
}
