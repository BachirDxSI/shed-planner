// Parametric framing engine. All dimensions are in inches.
// World axes: X runs along the eave walls (length L), Z across the gable ends (width W), Y is up.
// The front (double-door) wall is at Z = 0; the left gable end is at X = 0.

export const LUMBER = {
  '2x4': { t: 1.5, d: 3.5 },
  '2x6': { t: 1.5, d: 5.5 },
  '2x6PT': { t: 1.5, d: 5.5 },
  '4x6PT': { t: 3.5, d: 5.5 },
  '1x3': { t: 0.75, d: 2.5 },
  '1x4R': { t: 0.75, d: 3.5 },
  '1x4': { t: 0.75, d: 3.5 },
  '1x6': { t: 0.75, d: 5.5 },
};

export const MAX_STOCK = 192; // 16 ft

export const DEFAULTS = {
  width: 144, // gable-end width (rafter span)
  length: 192, // eave-wall length
  studLength: 92.625, // precut stud
  pitch: 10, // rise per 12 of run
  eaveOverhang: 6, // horizontal
  rakeOverhang: 4,
  studSpacing: 16,
  joistSpacing: 16,
  rafterSpacing: 24,
  rafterSize: '2x6', // 2x6 needed for Québec City snow (2x4 @ 24" fails above ~30 psf at a 6 ft run)
  snowLoad: 75, // ground snow, psf. Québec City Ss ≈ 3.6 kPa ≈ 75 psf (NBC 2020 Table C-2)
  frontDoorWidth: 72,
  frontDoorType: 'site', // 'site' | 'prehung'
  frontWindows: 2,
  backWindows: 0,
  sideDoor: true,
  sideDoorType: 'prehung',
  windowW: 24,
  windowH: 36,
  gableVents: true,
  battenSpacing: 16,
  siding: 'smartside', // 't111' | 'smartside' | 'spruce' | 'vinyl'
};

// Approximate allowable horizontal rafter spans (ft), SPF #2, 10 psf dead load,
// ceiling not attached. Rounded from the IRC R802.4.1 tables. Verify locally.
const RAFTER_SPANS = {
  20: { '2x4': { 16: 9.9, 24: 8.6 }, '2x6': { 16: 14.5, 24: 12.7 } },
  30: { '2x4': { 16: 8.4, 24: 7.3 }, '2x6': { 16: 12.3, 24: 10.1 } },
  50: { '2x4': { 16: 6.9, 24: 5.6 }, '2x6': { 16: 10.0, 24: 8.2 } },
  70: { '2x4': { 16: 5.9, 24: 4.8 }, '2x6': { 16: 8.7, 24: 7.1 } },
  80: { '2x4': { 16: 5.5, 24: 4.5 }, '2x6': { 16: 8.1, 24: 6.6 } },
};

export function splitLength(len, max = MAX_STOCK) {
  const n = Math.ceil(len / max - 1e-9);
  return Array.from({ length: n }, () => len / n);
}

// A plane maps local (x, y, d) -> world. o = origin, ex/ey/ez = axes.
function plane(o, ex, ez) {
  return { o, ex, ey: [0, 1, 0], ez };
}
// Split [a, b] into pieces no longer than stock, with every joint on one of `centers`
// (stud or joist centers) and at least `gap` away from the joints in `avoid`.
function splitOn(a, b, centers, avoid = [], gap = 0) {
  const out = [];
  let x = a;
  while (b - x > MAX_STOCK + 1e-9) {
    const ok = centers.filter((c) => c > x + 12 && c - x <= MAX_STOCK + 1e-9 && c < b - 12 && !avoid.some((j) => Math.abs(j - c) < gap));
    const end = ok.length ? Math.max(...ok) : x + (b - x) / Math.ceil((b - x) / MAX_STOCK);
    out.push([x, end]);
    x = end;
  }
  out.push([x, b]);
  return out;
}

export function toWorld(pl, x, y, d) {
  return [0, 1, 2].map((i) => pl.o[i] + pl.ex[i] * x + pl.ey[i] * y + pl.ez[i] * d);
}

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function buildShed(input) {
  const p = { ...DEFAULTS, ...input };
  const W = p.width;
  const L = p.length;
  const t = p.pitch / 12;
  const theta = Math.atan(t);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const D = LUMBER[p.rafterSize].d;
  const H = 1.5 + p.studLength + 3; // top of the double top plate, above the subfloor
  const skidH = 5.5;
  const joistH = 5.5;
  const deckT = 0.75;
  const floorTop = skidH + joistH + deckT;
  const run = W / 2;
  const O = p.eaveOverhang;
  const R = p.rakeOverhang;
  // birdsmouth seat: notch no deeper than 1/3 of the rafter depth
  const seat = Math.min(3.5, Math.floor((D / (3 * s)) * 8) / 8);
  // rafter bottom edge line: it meets the plate top at the inner end of the seat,
  // so the birdsmouth is a notch cut into the rafter (heel plumb on the wall's outer face)
  const yb = (x) => H + (Math.min(x, W - x) - seat) * t;
  const yt = (x) => yb(x) + D / c; // rafter top edge line
  const DEG = ((theta * 180) / Math.PI).toFixed(1);
  const GUSSET_HALF = 12; // ridge gussets are 24" wide
  const gussetBottom = yb(run - GUSSET_HALF);
  const peakTop = yt(run);
  const sheathT = 7 / 16;
  const roofT = sheathT + 0.25;
  const slopeLen = (run + O) / c;
  const warnings = [];

  const planes = {
    front: plane([0, floorTop, 0], [1, 0, 0], [0, 0, 1]),
    back: plane([L, floorTop, W], [-1, 0, 0], [0, 0, -1]),
    left: plane([0, floorTop, 0], [0, 0, 1], [1, 0, 0]),
    right: plane([L, floorTop, W], [0, 0, -1], [-1, 0, 0]),
  };
  const trussPlane = (X) => plane([X, floorTop, 0], [0, 0, 1], [1, 0, 0]);

  const members = [];
  const add = (m) => (members.push(m), m);

  // ---------- Openings (rough openings, local wall coordinates) ----------
  const RO_TOP = 82.5;
  const openings = { front: [], back: [], left: [], right: [] };
  const dRO = p.frontDoorWidth + 2;
  const doorL = L / 2 - dRO / 2;
  const doorR = L / 2 + dRO / 2;
  openings.front.push({ type: 'door', name: 'Double door', xL: doorL, w: dRO, bottom: 0, top: RO_TOP, nominal: p.frontDoorWidth, leaves: 2, build: p.frontDoorType });
  const wRO = p.windowW + 0.5;
  const wH = p.windowH + 0.5;
  const winBottom = RO_TOP - wH;
  const fw = Math.min(2, p.frontWindows);
  if (fw > 0) {
    if (doorL - 12 < wRO + 6) warnings.push('Front wall is too short for windows beside the door; windows skipped.');
    else {
      const centers = fw === 1 ? [(doorR + L) / 2] : [doorL / 2, (doorR + L) / 2];
      centers.forEach((cx) => openings.front.push({ type: 'window', name: 'Window', xL: cx - wRO / 2, w: wRO, bottom: winBottom, top: RO_TOP }));
    }
  }
  for (let i = 0; i < p.backWindows; i++) {
    const cx = (L * (i + 1)) / (p.backWindows + 1);
    openings.back.push({ type: 'window', name: 'Window', xL: cx - wRO / 2, w: wRO, bottom: winBottom, top: RO_TOP });
  }
  if (p.sideDoor) {
    const sRO = 38;
    if (W - 7 < sRO + 8) warnings.push('Gable wall is too narrow for a side door; skipped.');
    else openings.left.push({ type: 'door', name: 'Side door', xL: W / 2 - sRO / 2, w: sRO, bottom: 0, top: RO_TOP, nominal: 36, leaves: 1, build: p.sideDoorType });
  }
  if (RO_TOP + 5.5 > H - 3) warnings.push('Studs are too short for a 6\'-8" door with a 2x6 header. Use longer studs.');

  // ---------- Floor ----------
  function layout(x0, x1, sp) {
    // Left edges of members on an on-center layout; first flush at x0, last flush at x1.
    const xs = [x0];
    for (let k = 1; ; k++) {
      const x = x0 + k * sp - 0.75;
      if (x > x1 - 3) break;
      xs.push(x);
    }
    xs.push(x1 - 1.5);
    return xs;
  }
  function cornerLayout(x0, x1, sp) {
    // end studs flush at x0 and x1; between them, stud centers on multiples of sp from x = 0
    const xs = [x0];
    for (let k = 1; k * sp - 0.75 < x1 - 3; k++) if (k * sp - 0.75 >= x0 + 1.5) xs.push(k * sp - 0.75);
    xs.push(x1 - 1.5);
    return xs;
  }
  const nSkids = Math.max(2, Math.ceil((W - 3.5) / 72) + 1);
  const skidZ = [];
  for (let i = 0; i < nSkids; i++) skidZ.push(((W - 3.5) * i) / (nSkids - 1));
  skidZ.forEach((z) => {
    let x = 0;
    splitLength(L).forEach((len) => {
      add({ group: 'floor', kind: 'Skid', stock: '4x6PT', cut: len, box: [x, 0, z, x + len, skidH, z + 3.5] });
      x += len;
    });
  });
  const joistX = layout(0, L, p.joistSpacing);
  // rim joist splices land on a joist center
  [0, W - 1.5].forEach((z) => {
    splitOn(0, L, joistX.map((x) => x + 0.75)).forEach(([x0, x1]) => add({ group: 'floor', kind: 'Rim joist', stock: '2x6PT', cut: x1 - x0, box: [x0, skidH, z, x1, skidH + joistH, z + 1.5] }));
  });
  joistX.forEach((x) => add({ group: 'floor', kind: 'Floor joist', stock: '2x6PT', cut: W - 3, box: [x, skidH, 1.5, x + 1.5, skidH + joistH, W - 1.5] }));
  if (W - 3 > MAX_STOCK) warnings.push('Floor joists longer than 16 ft need a splice over a skid.');

  // ---------- Walls ----------
  const walls = [
    { name: 'front', title: 'Front wall', x0: 0, x1: L, corners: true },
    { name: 'back', title: 'Back wall', x0: 0, x1: L, corners: true },
    { name: 'left', title: 'Left gable wall', x0: 3.5, x1: W - 3.5, gable: true },
    { name: 'right', title: 'Right gable wall', x0: 3.5, x1: W - 3.5, gable: true },
  ];
  walls.forEach(frameWall);

  function frameWall(w) {
    const pl = planes[w.name];
    const ops = openings[w.name];
    const m = (kind, stock, poly, cut, d0 = 0, depth = 3.5) => add({ group: `wall:${w.name}`, kind, stock, poly, cut, plane: pl, d0, depth });

    // bottom plate, cut out at door openings
    let segs = [[w.x0, w.x1]];
    ops.filter((o) => o.type === 'door').forEach((o) => {
      segs = segs.flatMap(([a, b]) => {
        const out = [];
        if (o.xL > a) out.push([a, Math.min(b, o.xL)]);
        if (o.xL + o.w < b) out.push([Math.max(a, o.xL + o.w), b]);
        return out;
      });
    });
    const studLen = H - 4.5;
    const zones = ops.map((o) => [o.xL - 3, o.xL + o.w + 3]);
    const clear = (x) => !zones.some(([a, b]) => x + 1.5 > a && x < b);
    // Stud layout is measured from the shed's outside corner (local x = 0) on every wall,
    // so 4 ft siding panel joints land on stud centers. Gable walls start 3-1/2" in, inside the long walls.
    const grid = w.gable ? cornerLayout(w.x0, w.x1, p.studSpacing) : layout(w.x0, w.x1, p.studSpacing);
    const studXs = grid.filter(clear);
    // Plate splices land on stud centers. The top plate runs the wall; the cap plate laps the corners
    // (gable-wall caps run over the long walls) and its splices stay at least 4 ft from the top plate's.
    const centers = studXs.map((sx) => sx + 0.75);
    segs.forEach(([a, b]) => splitOn(a, b, centers).forEach(([x0, x1]) => m('Bottom plate', '2x4', rect(x0, 0, x1, 1.5), x1 - x0)));
    const topParts = splitOn(w.x0, w.x1, centers);
    topParts.forEach(([x0, x1]) => m('Top plate', '2x4', rect(x0, H - 3, x1, H - 1.5), x1 - x0));
    const topJoints = topParts.slice(1).map(([x0]) => x0);
    const c0 = w.gable ? w.x0 - 3.5 : w.x0 + 3.5;
    const c1 = w.gable ? w.x1 + 3.5 : w.x1 - 3.5;
    splitOn(c0, c1, centers, topJoints, 48).forEach(([x0, x1]) => m('Cap plate', '2x4', rect(x0, H - 1.5, x1, H), x1 - x0));
    if (w.corners) {
      // backer studs the gable walls nail into
      [w.x0 + 3.5, w.x1 - 5].forEach((x) => {
        if (!studXs.some((sx) => Math.abs(sx - x) < 1.5) && clear(x)) studXs.push(x);
      });
    }
    studXs.forEach((x) => m('Stud', '2x4', rect(x, 1.5, x + 1.5, H - 3), studLen));

    ops.forEach((o) => {
      const xR = o.xL + o.w;
      const hdrTop = o.top + 5.5;
      const jackBot = 1.5; // jacks stand on the bottom plate, which is cut flush with the opening
      m('King stud', '2x4', rect(o.xL - 3, 1.5, o.xL - 1.5, H - 3), studLen);
      m('King stud', '2x4', rect(xR + 1.5, 1.5, xR + 3, H - 3), studLen);
      m('Jack stud', '2x4', rect(o.xL - 1.5, jackBot, o.xL, o.top), o.top - jackBot);
      m('Jack stud', '2x4', rect(xR, jackBot, xR + 1.5, o.top), o.top - jackBot);
      m('Header', '2x6', rect(o.xL - 1.5, o.top, xR + 1.5, hdrTop), o.w + 3, 0, 1.5);
      m('Header', '2x6', rect(o.xL - 1.5, o.top, xR + 1.5, hdrTop), o.w + 3, 2, 1.5);
      const inside = grid.filter((x) => x >= o.xL && x + 1.5 <= xR);
      const cx = inside.length ? inside : [o.xL + o.w / 2 - 0.75];
      if (H - 3 - hdrTop >= 1.5) cx.forEach((x) => m('Cripple (top)', '2x4', rect(x, hdrTop, x + 1.5, H - 3), H - 3 - hdrTop));
      if (o.type === 'window') {
        m('Rough sill', '2x4', rect(o.xL, o.bottom - 1.5, xR, o.bottom), o.w);
        cx.forEach((x) => m('Cripple (sill)', '2x4', rect(x, 1.5, x + 1.5, o.bottom - 1.5), o.bottom - 3));
      }
    });

    if (w.gable) {
      grid
        .filter((x) => x > w.x0 && x < w.x1 - 1.5)
        .forEach((a) => {
          // Top cut to the roof pitch, except studs under the end truss's ridge gusset:
          // those get a square top just under the gusset (easier to cut, nothing to fit around).
          const underGusset = a < run + GUSSET_HALF && a + 1.5 > run - GUSSET_HALF;
          const sq = Math.min(gussetBottom, yb(a), yb(a + 1.5));
          const poly = underGusset
            ? [[a, H], [a + 1.5, H], [a + 1.5, sq], [a, sq]]
            : [[a, H], [a + 1.5, H], [a + 1.5, yb(a + 1.5)], [a, yb(a)]];
          const len = (underGusset ? sq : Math.max(yb(a), yb(a + 1.5))) - H;
          if (len >= 3) m('Gable stud', '2x4', poly, len).note = underGusset ? 'Square top (fits under the ridge gusset)' : `Top cut ${DEG}° to the pitch; length is to the long point`;
        });
    }
  }

  // ---------- Roof ----------
  // Half-rafter profile in truss coords (x across the width from the front wall's outer face).
  const rafterPoly = (mirror) => {
    const pts = [
      [-O, yb(-O)],
      [0, yb(0)], // heel (plumb) from here up to the plate top
      [0, H],
      [seat, H], // seat (level) on the plate, ends on the bottom edge
      [run, yb(run)],
      [run, yt(run)],
      [-O, yt(-O)],
    ];
    return mirror ? pts.map(([x, y]) => [W - x, y]).reverse() : pts;
  };
  const flyPoly = (mirror) => {
    const pts = [[-O, yb(-O)], [run, yb(run)], [run, yt(run)], [-O, yt(-O)]];
    return mirror ? pts.map(([x, y]) => [W - x, y]).reverse() : pts;
  };
  const rafterCut = (run + O) / c; // between the parallel plumb cuts, measured along either edge
  const rafterStock = rafterCut + D * t; // tip to tip: the plumb cuts lean, so the blank must be this long
  const rafterX = [0];
  for (let k = 1; ; k++) {
    const x = k * p.rafterSpacing - 0.75;
    if (x > L - 1.5 - p.rafterSpacing / 3) break;
    rafterX.push(x);
  }
  rafterX.push(L - 1.5);

  const g = GUSSET_HALF;
  const gussetPoly = [
    [run - g, yt(run - g)],
    [run, yt(run)],
    [run + g, yt(run - g)],
    [run + g, yb(run - g)],
    [run - g, yb(run - g)],
  ];
  const gussetArea = polyArea(gussetPoly);
  const tieTop = H + 3.5;
  const tieClip = Math.max(0, (tieTop - (H + D / c)) / t + seat);
  const tiePoly = [[0, H], [W, H], [W, Math.min(tieTop, yt(0))], [W - tieClip, tieTop], [tieClip, tieTop], [0, Math.min(tieTop, yt(0))]];
  if (W > MAX_STOCK) warnings.push('Rafter ties longer than 16 ft must be spliced.');
  let gussets = 0;
  rafterX.forEach((X, i) => {
    const pl = trussPlane(X);
    const end = i === 0 || i === rafterX.length - 1;
    const base = { group: 'roof', plane: pl, d0: 0, depth: 1.5 };
    const rNote = `Blank length. Plumb cuts ${DEG}° (parallel), ${ftIn(rafterCut)} apart along the top edge; birdsmouth per sheet S-5`;
    add({ ...base, kind: 'Rafter', stock: p.rafterSize, poly: rafterPoly(false), cut: rafterStock, note: rNote });
    add({ ...base, kind: 'Rafter', stock: p.rafterSize, poly: rafterPoly(true), cut: rafterStock, note: rNote });
    const faces = end ? [i === 0 ? 1.5 : -0.5] : [-0.5, 1.5];
    faces.forEach((d0) => {
      add({ group: 'roof', plane: pl, d0, depth: 0.5, kind: 'Gusset', stock: 'gusset', poly: gussetPoly, cut: 0 });
      gussets++;
    });
    if (!end) {
      const d0 = i === rafterX.length - 2 ? -1.5 : 1.5;
      add({ group: 'roof', plane: pl, d0, depth: 1.5, kind: 'Rafter tie', stock: '2x4', poly: tiePoly, cut: W });
    }
  });
  if (R >= 1.5) {
    [-R, L + R - 1.5].forEach((X) => {
      const pl = trussPlane(X);
      const fNote = `Blank length. Plumb cuts ${DEG}° (parallel), ${ftIn(rafterCut)} apart along the top edge; no birdsmouth`;
      add({ group: 'roof', plane: pl, d0: 0, depth: 1.5, kind: 'Fly rafter', stock: p.rafterSize, poly: flyPoly(false), cut: rafterStock, note: fNote });
      add({ group: 'roof', plane: pl, d0: 0, depth: 1.5, kind: 'Fly rafter', stock: p.rafterSize, poly: flyPoly(true), cut: rafterStock, note: fNote });
    });
  }
  // sub-fascia along both eaves, nailed to the rafter tails
  const sfTop = yt(-O - 1.5);
  [false, true].forEach((mirror) => {
    let x = -R;
    splitLength(L + 2 * R).forEach((len) => {
      const pl = plane([x, floorTop, 0], [0, 0, 1], [1, 0, 0]);
      let poly = rect(-O - 1.5, sfTop - 3.5, -O, sfTop);
      if (mirror) poly = poly.map(([a, b]) => [W - a, b]).reverse();
      add({ group: 'roof', kind: 'Sub-fascia', stock: '2x4', poly, plane: pl, d0: 0, depth: len, cut: len });
      x += len;
    });
  });

  // ---------- Checks ----------
  const sp = p.rafterSpacing <= 16 ? 16 : 24;
  const snowKey = [20, 30, 50, 70, 80].find((k) => p.snowLoad <= k) || 80;
  const allow = RAFTER_SPANS[snowKey][p.rafterSize]?.[sp];
  const runFt = run / 12;
  if (allow && runFt > allow) warnings.push(`Rafter run ${runFt.toFixed(1)} ft exceeds the approx. ${allow} ft allowed for ${p.rafterSize} @ ${sp}" O.C. at ${p.snowLoad} psf snow. Use 2x6 rafters or closer spacing.`);
  if (p.snowLoad > 80) warnings.push('Snow loads over 80 psf need an engineered roof.');
  if (p.pitch < 4) warnings.push('Asphalt shingles need at least a 4/12 pitch (2/12 with double underlayment).');

  // ---------- Trim: battens, casing, site-built doors, corner boards, fascia ----------
  const trim = [];
  const sidingBottom = skidH - floorTop; // siding laps down over the rim joist
  // On the long walls the rafter tails drop below the plate, so siding and trim stop under them:
  // panels at the rafter bottom on the siding face (3/8"), battens and corner boards at the trim face (+3/4").
  const eaveSidingTop = yb(-0.375);
  const eaveTrimTop = yb(-1.125);
  const isGable = (n) => n === 'left' || n === 'right';
  const faces = [
    { name: 'front', x0: -1, x1: L + 1, topAt: () => eaveTrimTop },
    { name: 'back', x0: -1, x1: L + 1, topAt: () => eaveTrimTop },
    { name: 'left', x0: 0, x1: W, topAt: (x) => yt(x) - 0.75 },
    { name: 'right', x0: 0, x1: W, topAt: (x) => yt(x) - 0.75 },
  ];
  faces.forEach((f) => {
    const ops = openings[f.name];
    const bsp = p.siding === 'spruce' ? 6 : p.battenSpacing;
    const bStock = p.siding === 'spruce' ? '1x4R' : '1x3';
    for (let x = f.x0 + bsp; p.siding !== 'vinyl' && x < f.x1 - 4; x += bsp) {
      const hw = bStock === '1x4R' ? 1.75 : 1.25;
      const xa = x - hw;
      const xb = x + hw;
      let spans = [[sidingBottom, Math.min(f.topAt(xa), f.topAt(xb))]];
      ops.forEach((o) => {
        if (xb > o.xL - 3.5 && xa < o.xL + o.w + 3.5) {
          const lo = o.bottom === 0 ? sidingBottom : o.bottom - 4;
          const hi = o.top + 3.5;
          spans = spans.flatMap(([a, b]) => {
            const out = [];
            if (lo > a) out.push([a, Math.min(b, lo)]);
            if (hi < b) out.push([Math.max(a, hi), b]);
            return out;
          });
        }
      });
      spans
        .filter(([a, b]) => b - a > 2)
        .forEach(([a, b]) => {
          const parts = splitLength(b - a, bStock === '1x4R' ? 144 : MAX_STOCK);
          parts.forEach((len, k) => trim.push({ face: f.name, kind: 'Batten', stock: bStock, x0: xa, x1: xb, y0: a + k * len, y1: a + (k + 1) * len, cut: len }));
        });
    }
    ops.forEach((o) => {
      const xR = o.xL + o.w;
      const bot = o.bottom === 0 ? 0 : o.bottom - 0.5;
      trim.push({ face: f.name, kind: 'Casing', stock: '1x4', x0: o.xL - 3.5, x1: o.xL, y0: bot, y1: o.top + 3.5, cut: o.top + 3.5 - bot });
      trim.push({ face: f.name, kind: 'Casing', stock: '1x4', x0: xR, x1: xR + 3.5, y0: bot, y1: o.top + 3.5, cut: o.top + 3.5 - bot });
      trim.push({ face: f.name, kind: 'Casing head', stock: '1x4', x0: o.xL - 3.5, x1: xR + 3.5, y0: o.top + 3.5, y1: o.top + 7, cut: o.w + 7 });
      if (o.type === 'window') trim.push({ face: f.name, kind: 'Casing sill', stock: '1x4', x0: o.xL - 4.5, x1: xR + 4.5, y0: o.bottom - 4, y1: o.bottom - 0.5, cut: o.w + 9 });
      if (o.type === 'door' && o.build === 'site') {
        const leafW = (o.w - 0.5) / o.leaves;
        const leafH = o.top - 1;
        for (let k = 0; k < o.leaves; k++) {
          const lx = o.xL + 0.25 + k * leafW;
          const dt = { face: f.name, stock: '1x4', door: true };
          trim.push({ ...dt, kind: 'Door stile', x0: lx, x1: lx + 3.5, y0: 0.5, y1: 0.5 + leafH, cut: leafH });
          trim.push({ ...dt, kind: 'Door stile', x0: lx + leafW - 3.5, x1: lx + leafW, y0: 0.5, y1: 0.5 + leafH, cut: leafH });
          [0.5, 0.5 + leafH / 2 - 1.75, 0.5 + leafH - 3.5].forEach((y) => trim.push({ ...dt, kind: 'Door rail', x0: lx + 3.5, x1: lx + leafW - 3.5, y0: y, y1: y + 3.5, cut: leafW - 7 }));
          const diag = Math.hypot(leafW - 7, leafH / 2 - 5.25);
          trim.push({ ...dt, kind: 'Door brace', diag: true, x0: lx + 3.5, x1: lx + leafW - 3.5, y0: 4, y1: 0.5 + leafH / 2 - 1.75, cut: diag, note: 'Rough length: lay it across the rails and scribe both ends' });
          trim.push({ ...dt, kind: 'Door brace', diag: true, x0: lx + 3.5, x1: lx + leafW - 3.5, y0: 0.5 + leafH / 2 + 1.75, y1: leafH - 3, cut: diag, note: 'Rough length: lay it across the rails and scribe both ends' });
        }
      }
    });
  });
  // 8 corner boards: 4 on the long-wall faces (stop under the rafter tails), 4 on the gable faces (to the plate)
  for (let i = 0; i < 8; i++) trim.push({ kind: 'Corner board', stock: '1x4', corner: i, cut: (i < 4 ? eaveTrimTop : H) - sidingBottom });
  splitLength(L + 2 * R + 1.5).forEach((len) => trim.push({ kind: 'Eave fascia', stock: '1x6', cut: len }, { kind: 'Eave fascia', stock: '1x6', cut: len }));
  const rakeLen = slopeLen + 3;
  for (let i = 0; i < 4; i++) trim.push({ kind: 'Rake fascia', stock: '1x6', cut: rakeLen, note: `Rough length: plumb cut ${DEG}° at the peak, then mark the eave end in place` });

  return {
    p, W, L, H, t, theta, c, s, D, run, O, R, seat, floorTop, skidH, joistH, deckT,
    yb, yt, peakTop, sheathT, roofT, slopeLen, rafterCut, rafterStock, rafterX, joistX, skidZ, nSkids,
    gussetPoly, gussetArea, gussets, tiePoly, sidingBottom, eaveSidingTop, eaveTrimTop, isGable,
    roofArea: 2 * slopeLen * (L + 2 * R),
    gableArea: run * t * W + W * (D / c), // both gable triangles plus the strip at the rafter depth
    wallSidingArea: 2 * (W + L) * (H - sidingBottom),
    openings, planes, trussPlane, members, trim, warnings, walls, RO_TOP,
    heights: { floor: floorTop, plate: floorTop + H, peak: floorTop + peakTop + roofT / c },
    rafterSpanAllowFt: allow,
  };
}

export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// Feet-inches to 1/8": 97.125 -> 8'-1 1/8"
export function ftIn(inches, { feet = true } = {}) {
  const neg = inches < 0;
  const v = Math.round(Math.abs(inches) * 8) / 8;
  const ft = feet ? Math.floor(v / 12 + 1e-9) : 0;
  const inch = v - ft * 12;
  const whole = Math.floor(inch + 1e-9);
  let n = Math.round((inch - whole) * 8);
  let d = 8;
  while (n && n % 2 === 0) {
    n /= 2;
    d /= 2;
  }
  const f = n ? `${n}/${d}` : '';
  const inStr = f ? (whole ? `${whole} ${f}` : f) : `${whole}`;
  const out = ft ? `${ft}'-${inStr}"` : `${inStr}"`;
  return neg ? `-${out}` : out;
}
