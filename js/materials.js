// Materials takeoff, stock-length cut optimisation and cost estimate.
import { ftIn } from './geometry.js';

const KERF = 0.125;
const STOCK_LENGTHS = {
  '4x6PT': [96, 120, 144, 192],
  '2x6PT': [96, 120, 144, 168, 192],
  '2x4': [96, 120, 144, 168, 192],
  '2x6': [96, 120, 144, 192],
  '1x3': [96, 120, 144, 192],
  '1x4R': [144],
  '1x4': [96, 120, 144, 192],
  '1x6': [96, 120, 144, 192],
};
const STOCK_NAMES = {
  '4x6PT': '4x6 pressure-treated (ground contact)',
  '2x6PT': '2x6 pressure-treated',
  '2x4': '2x4 SPF #2',
  '2x6': '2x6 SPF #2',
  '1x3': '1x3 primed trim (battens)',
  '1x4R': '1x4 rough spruce (battens)',
  '1x4': '1x4 primed trim',
  '1x6': '1x6 primed trim',
};
// Price regions. Every price is also editable in the app.
export const REGIONS = {
  us: {
    label: 'United States (USD)',
    currency: 'USD',
    locale: 'en-US',
    tax: 8,
    taxLabel: 'Sales tax %',
    note: 'Rough US big-box averages, late 2026.',
    perFoot: { '4x6PT': 2.3, '2x6PT': 1.2, '2x4': 0.55, '2x6': 0.9, '1x4R': 0.5, '1x3': 0.7, '1x4': 1.05, '1x6': 1.6 },
    prices: {
      'stud:92.625': 4.25, osb34tg: 32, osb716: 17, siding49: 62, siding48: 52, bundle: 42, starter: 45, ridgecap: 70, felt: 32,
      dripedge: 9, zflash: 8, 'door:prehung-double': 950, 'door:prehung-single': 330, 'door:site-hw-double': 95, 'door:site-hw-single': 55,
      window: 140, gablevent: 22, h25a: 0.95, a23: 1.9, anchor: 28, nails16d: 2.2, nails8d: 2.4, nails8dgalv: 3.2, nails6dgalv: 3.4,
      roofnails: 2.6, adhesive: 7, paint: 52, caulk: 7, gravel: 55, gravelDelivery: 95, fabric: 30, blocks: 3.5,
      smartside48: 45, smartside49: 58, housewrap: 190, spruce1x6x10: 9, vinylbox: 180, jchannel: 9, cornerpost: 28,
    },
  },
  // Québec City area (G3S), checked 2026-11-09: Canac 2x4x8 3.79, 2x4x16 9.19, 2x6x16 15.19, OSB 7/16 14.30,
  // IKO Cambridge 46.40/bundle, starter 55.99; 2x6x12 treated brown from 15.49 (batirarabais.ca);
  // RONA T1-11 19/32 4x8 119.99 (older listing). Other items are estimates.
  qc: {
    label: 'Québec (CAD, TPS + TVQ)',
    currency: 'CAD',
    locale: 'fr-CA',
    tax: 14.975,
    taxLabel: 'TPS + TVQ %',
    note: 'Québec City-area prices (Canac, Rona, BMR, Matério), checked Nov 9, 2026. Doors, windows, trim, hardware and site prep are estimates.',
    perFoot: { '4x6PT': 3.0, '2x6PT': 1.35, '2x4': 0.57, '2x6': 0.95, '1x4R': 0.18, '1x3': 0.9, '1x4': 1.3, '1x6': 2.0 },
    prices: {
      'stud:92.625': 3.79, osb34tg: 42, osb716: 14.3, siding49: 145, siding48: 120, bundle: 46.4, starter: 55.99, ridgecap: 75, felt: 45,
      dripedge: 12, zflash: 10, 'door:prehung-double': 1300, 'door:prehung-single': 450, 'door:site-hw-double': 130, 'door:site-hw-single': 75,
      window: 190, gablevent: 30, h25a: 1.4, a23: 2.6, anchor: 40, nails16d: 3.2, nails8d: 3.5, nails8dgalv: 4.5, nails6dgalv: 4.8,
      roofnails: 3.6, adhesive: 9, paint: 70, caulk: 9, gravel: 60, gravelDelivery: 130, fabric: 40, blocks: 4.5,
      // Siding options: SmartSide 4x8 64.88 (Home Depot / Kent), 4x9 est.; Canac spruce 1x6x10 3.79, rough 1x4x12 2.09;
      // vinyl B&B ~210/box of 100 sq ft (Gentek, B. Bouchard); wrap and vinyl trim estimated.
      smartside48: 64.88, smartside49: 85, housewrap: 230, spruce1x6x10: 3.79, vinylbox: 210, jchannel: 12, cornerpost: 35,
    },
  },
};
let region = REGIONS.us;
export function setRegion(key) {
  region = REGIONS[key] || REGIONS.us;
  return region;
}
export function getRegion() {
  return region;
}

export function lumberPrice(stock, len) {
  if (len === 92.625 && stock === '2x4') return region.prices['stud:92.625'];
  return Math.round(region.perFoot[stock] * (len / 12) * 100) / 100;
}

// First-fit decreasing into the longest stock, then shrink each board to the shortest that fits.
export function packStock(pieces, stock, studLen) {
  const lengths = STOCK_LENGTHS[stock];
  const max = lengths[lengths.length - 1];
  const precut = stock === '2x4' && studLen === 92.625;
  const boards = [];
  const rest = [];
  pieces.forEach((pc) => {
    if (precut && Math.abs(pc.cut - 92.625) < 0.01) boards.push({ len: 92.625, used: 92.625, cuts: [pc], precut: true });
    else rest.push(pc);
  });
  rest.sort((a, b) => b.cut - a.cut).forEach((pc) => {
    const need = pc.cut + KERF;
    let b = boards.find((bd) => !bd.precut && bd.len - bd.used >= pc.cut - 1e-6);
    if (!b) {
      b = { len: max, used: 0, cuts: [] };
      if (pc.cut > max) b.len = pc.cut; // oversize (should not happen: pieces are pre-split)
      boards.push(b);
    }
    b.cuts.push(pc);
    b.used += need;
  });
  boards.forEach((b) => {
    if (b.precut) return;
    const used = b.used - KERF;
    b.len = lengths.find((l) => l >= used - 1e-6) || b.len;
  });
  return boards;
}

export function takeoff(geo) {
  const { p, W, L } = geo;
  const PRICES = region.prices;
  const items = [];
  const item = (section, id, name, qty, unit, unitPrice, note = '') => {
    if (qty > 0) items.push({ section, id, name, qty, unit, unitPrice, note });
  };

  // ---- Dimensional lumber ----
  const byStock = {};
  const push = (stock, cut, kind, where) => {
    if (!STOCK_LENGTHS[stock]) return;
    (byStock[stock] ||= []).push({ cut, kind, where });
  };
  geo.members.forEach((m) => push(m.stock, m.cut, m.kind, m.group));
  geo.trim.forEach((tr) => push(tr.stock, tr.cut, tr.kind, tr.face || 'trim'));

  const boardsByStock = {};
  Object.entries(byStock).forEach(([stock, pcs]) => {
    boardsByStock[stock] = packStock(pcs, stock, p.studLength);
  });
  const sectionOf = (stock) => (stock.endsWith('PT') ? 'Foundation & floor' : stock.startsWith('1x') ? 'Siding & trim' : 'Framing');
  Object.entries(boardsByStock).forEach(([stock, boards]) => {
    const counts = {};
    boards.forEach((b) => (counts[b.len] = (counts[b.len] || 0) + 1));
    Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((len) => {
        const label = len === 92.625 ? `${stock} × 92-5/8" precut stud` : `${stock} × ${len / 12}'`;
        item(sectionOf(stock), `lumber:${stock}:${len}`, label, counts[len], 'pc', lumberPrice(stock, len), STOCK_NAMES[stock]);
      });
  });

  // ---- Sheet goods ----
  const deckSheets = Math.ceil(W / 48) * Math.ceil(L / 96);
  item('Foundation & floor', 'osb34tg', '3/4" T&G OSB subfloor, 4×8', deckSheets, 'sheet', PRICES.osb34tg, 'Glue and screw/nail to joists');
  const sidingSheets = sidingItems(geo, item, PRICES);
  const roofSheets = Math.ceil((geo.roofArea * 1.08) / (48 * 96));
  item('Roof', 'osb716', '7/16" OSB roof sheathing, 4×8', roofSheets, 'sheet', PRICES.osb716, 'Use H-clips between rafters at 24" O.C.');
  const gussetSheets = Math.ceil((geo.gussets * geo.gussetArea * 1.4) / (48 * 96));
  item('Roof', 'osb716-g', '7/16" OSB for rafter gussets, 4×8', gussetSheets, 'sheet', PRICES.osb716, `${geo.gussets} gussets`);

  // ---- Roofing ----
  const roofSqFt = geo.roofArea / 144;
  const squares = roofSqFt / 100;
  const eaveFt = (L + 2 * geo.R) / 12;
  item('Roof', 'bundle', 'Architectural shingles (bundle, ~33 sq ft)', Math.ceil((roofSqFt * 1.1) / 33.3), 'bundle', PRICES.bundle, `${squares.toFixed(2)} squares + 10% waste`);
  item('Roof', 'starter', 'Starter strip (bundle, ~105 lf)', Math.ceil((2 * eaveFt) / 105), 'bundle', PRICES.starter);
  item('Roof', 'ridgecap', 'Hip & ridge cap (bundle, ~30 lf)', Math.ceil(eaveFt / 30), 'bundle', PRICES.ridgecap);
  item('Roof', 'felt', '#15 felt underlayment (roll, 4 squares)', Math.ceil((roofSqFt * 1.1) / 400), 'roll', PRICES.felt);
  const dripFt = 2 * eaveFt + (4 * geo.slopeLen) / 12;
  item('Roof', 'dripedge', 'Drip edge, 10 ft', Math.ceil((dripFt * 1.05) / 10), 'pc', PRICES.dripedge, `${dripFt.toFixed(0)} lf of eaves and rakes`);
  item('Roof', 'roofnails', 'Roofing nails 1-1/4" coil or hand-drive', Math.max(5, Math.ceil(squares * 2.5)), 'lb', PRICES.roofnails);

  // ---- Doors, windows, vents ----
  const allOps = Object.values(geo.openings).flat();
  allOps.filter((o) => o.type === 'door').forEach((o) => {
    const dbl = o.leaves === 2;
    const nom = `${Math.floor(o.nominal / 12)}${o.nominal % 12}68`;
    if (o.build === 'prehung') item('Doors & windows', `door:prehung-${dbl ? 'double' : 'single'}`, `Pre-hung exterior ${dbl ? 'double ' : ''}door ${nom} (${ftIn(o.nominal)} × 6'-8")`, 1, 'ea', PRICES[`door:prehung-${dbl ? 'double' : 'single'}`]);
    else item('Doors & windows', `door:site-hw-${dbl ? 'double' : 'single'}`, `Site-built ${dbl ? 'double ' : ''}door hardware: ${dbl ? 6 : 3} T-strap hinges, ${dbl ? 'cane bolts, ' : ''}hasp/handle`, 1, 'set', PRICES[`door:site-hw-${dbl ? 'double' : 'single'}`], 'Doors built from a siding panel + 1x4 frame (see plans)');
  });
  const nWin = allOps.filter((o) => o.type === 'window').length;
  item('Doors & windows', 'window', `Shed window ${p.windowW}"×${p.windowH}" (rough opening ${p.windowW + 0.5}"×${p.windowH + 0.5}")`, nWin, 'ea', PRICES.window);
  if (p.gableVents) item('Doors & windows', 'gablevent', 'Gable vent 12"×12"', 2, 'ea', PRICES.gablevent);
  const zft = allOps.reduce((a, o) => a + o.w + 8, 0) / 12;
  item('Doors & windows', 'zflash', 'Z-flashing over doors & windows, 10 ft', Math.ceil(zft / 10), 'pc', PRICES.zflash);

  // ---- Hardware & fasteners ----
  const rafters = geo.members.filter((m) => m.kind === 'Rafter').length;
  const framingPieces = geo.members.filter((m) => m.stock && STOCK_LENGTHS[m.stock] && !m.stock.startsWith('1x')).length;
  item('Hardware & fasteners', 'h25a', 'Simpson H2.5A hurricane tie (rafter to plate)', rafters, 'ea', PRICES.h25a, 'One per rafter');
  item('Hardware & fasteners', 'a23', 'Simpson A23 angle (joist to skid)', geo.joistX.length * 2, 'ea', PRICES.a23, 'At each outer skid');
  item('Hardware & fasteners', 'anchor', 'Auger ground anchor + strap (optional, wind areas)', 4, 'ea', PRICES.anchor);
  item('Hardware & fasteners', 'nails16d', '16d (3-1/4") coated sinker framing nails', Math.ceil(framingPieces * 0.12), 'lb', PRICES.nails16d);
  item('Hardware & fasteners', 'nails8d', '8d ring-shank nails (subfloor, roof sheathing, gussets)', Math.ceil((deckSheets + roofSheets) * 0.6 + geo.gussets * 0.1), 'lb', PRICES.nails8d);
  item('Hardware & fasteners', 'nails8dgalv', p.siding === 'vinyl' ? '1-1/2" galvanized roofing nails (vinyl siding) + 8d for OSB' : '8d hot-dip galvanized siding nails', Math.ceil(sidingSheets * 0.7), 'lb', PRICES.nails8dgalv);
  item('Hardware & fasteners', 'nails6dgalv', '6d galvanized trim nails (battens, trim, doors)', Math.ceil(geo.trim.length * 0.04) + 1, 'lb', PRICES.nails6dgalv);
  item('Hardware & fasteners', 'adhesive', 'Construction adhesive, 28 oz', Math.ceil(deckSheets / 2), 'tube', PRICES.adhesive);

  // ---- Finish ----
  const paintArea = (geo.wallSidingArea + geo.gableArea) / 144;
  if (p.siding === 'vinyl') item('Finish', 'paint', 'Exterior paint for trim, fascia & doors', 2, 'gal', PRICES.paint, 'Vinyl siding needs no paint');
  else item('Finish', 'paint', p.siding === 'spruce' ? 'Exterior stain/paint (2 coats, plus back-priming boards)' : 'Exterior primer + paint (2 coats)', Math.ceil((paintArea * (p.siding === 'spruce' ? 2.6 : 2)) / 350) + 1, 'gal', PRICES.paint, '+1 gal trim color');
  item('Finish', 'caulk', 'Exterior paintable caulk', 4, 'tube', PRICES.caulk);

  // ---- Site prep ----
  const padCuYd = ((W + 24) * (L + 24) * 4) / 1728 / 27;
  item('Site prep', 'gravel', 'Crushed stone 3/4" for 4" pad (1 ft past the shed)', Math.ceil(padCuYd * 2) / 2, 'cu yd', PRICES.gravel, `${((W + 24) / 12).toFixed(0)}' × ${((L + 24) / 12).toFixed(0)}' pad`);
  item('Site prep', 'gravelDelivery', 'Stone delivery', 1, 'trip', PRICES.gravelDelivery);
  item('Site prep', 'fabric', 'Landscape fabric (roll)', 1, 'roll', PRICES.fabric);
  item('Site prep', 'blocks', 'Solid concrete blocks 4×8×16 (leveling under skids)', geo.nSkids * 3, 'ea', PRICES.blocks);

  return { items, boardsByStock, squares, roofSqFt, deckSheets, roofSheets, sidingSheets };
}

export const SIDING = {
  t111: { label: 'T1-11 plywood panels + 1x3 battens', look: 'Board & batten (16" battens), painted', upkeep: 'Repaint every 7–10 years; the panels are also the wall bracing' },
  smartside: { label: 'LP SmartSide 38 panels + 1x3 battens', look: 'Board & batten (16" battens), painted', upkeep: 'Factory-primed and treated; repaint every 10–15 years. Check LP\'s install guide for direct-to-stud use' },
  spruce: { label: 'OSB + house wrap + spruce 1x6 boards & battens', look: 'Traditional narrow board & batten (6")', upkeep: 'Most upkeep: stain/paint every 4–6 years' },
  vinyl: { label: 'OSB + house wrap + vinyl board & batten', look: 'Board & batten (7"), factory color', upkeep: 'Least upkeep: wash only, no painting' },
};

// Siding material lines. Returns the sheet count used for the fastener estimate.
function sidingItems(geo, item, P) {
  const { p, W, L } = geo;
  const S = 'Siding & trim';
  const sidingH = geo.H - geo.sidingBottom;
  const tall = sidingH <= 108;
  const wallCols = Math.ceil((2 * (W + L)) / 48);
  const gableSheets = Math.ceil((geo.gableArea * 1.2) / (48 * 96));
  const siteDoors = (p.frontDoorType === 'site' ? 1 : 0) + (p.sideDoor && p.sideDoorType === 'site' ? 1 : 0);
  const area = geo.wallSidingArea + geo.gableArea;
  if (p.siding === 't111' || p.siding === 'smartside') {
    const k = p.siding === 't111' ? 'siding' : 'smartside';
    const nm = p.siding === 't111' ? 'Textured plywood siding T1-11, 19/32"' : 'LP SmartSide 38 Series panel, 3/8", primed';
    item(S, `${k}${tall ? 49 : 48}`, `${nm}, 4×${tall ? 9 : 8}`, wallCols, 'sheet', tall ? P[`${k}49`] : P[`${k}48`], tall ? `Walls are ${ftIn(sidingH)} from rim to plate: 9 ft sheets avoid a horizontal joint` : '');
    item(S, `${k}48`, `${nm}, 4×8: gables${siteDoors ? ' & door skins' : ''}`, gableSheets + siteDoors, 'sheet', P[`${k}48`]);
    return wallCols + gableSheets + siteDoors;
  }
  const osb = Math.ceil((area * 1.1) / (48 * 96));
  item(S, 'osb716-w', '7/16" OSB wall sheathing, 4×8', osb, 'sheet', P.osb716, 'Provides the wall bracing; block the horizontal joint');
  item(S, 'housewrap', 'House wrap, 9 ft × 100 ft roll', Math.ceil(((area / 144) * 1.15) / 900), 'roll', P.housewrap);
  if (siteDoors) item(S, 'smartside48', 'LP SmartSide panel 4×8 for door skins', siteDoors, 'sheet', P.smartside48);
  if (p.siding === 'spruce') {
    const lf = ((area / 6) * 1.12) / 12;
    item(S, 'spruce1x6x10', "Spruce 1x6 × 10' boards (vertical, 1/2\" gaps under battens)", Math.ceil(lf / 10), 'pc', P.spruce1x6x10, 'Stain or prime all four sides before installing');
  } else {
    const ops = Object.values(geo.openings).flat();
    const openArea = ops.reduce((a, o) => a + o.w * (o.top - o.bottom), 0);
    const sq = (area - openArea) / 144;
    item(S, 'vinylbox', 'Vinyl board & batten siding, 7" (box of 100 sq ft)', Math.ceil((sq * 1.1) / 100), 'box', P.vinylbox, `${Math.round(sq)} sq ft net of openings`);
    const opPerim = ops.reduce((a, o) => a + 2 * (o.top - o.bottom) + 2 * o.w, 0) / 12;
    const jFt = opPerim + (4 * geo.slopeLen) / 12 + (2 * (L + W)) / 12;
    item(S, 'jchannel', "Vinyl J-channel, 12'6\"", Math.ceil((jFt * 1.1) / 12.5), 'pc', P.jchannel, 'Openings, eaves, rakes and the bottom edge');
    item(S, 'cornerpost', "Vinyl outside corner post, 10'", 4, 'pc', P.cornerpost);
  }
  return osb;
}

// Grouped piece schedule: same stock + kind + length -> one row.
export function pieceSchedule(geo) {
  const rows = {};
  const add = (stock, kind, cut, where, note = 'Square cut') => {
    if (!STOCK_LENGTHS[stock]) return;
    const key = `${stock}|${kind}|${cut.toFixed(3)}|${note}`;
    rows[key] ||= { stock, kind, cut, note, qty: 0, where: new Set() };
    rows[key].qty++;
    rows[key].where.add(where);
  };
  geo.members.forEach((m) => add(m.stock, m.kind, m.cut, prettyGroup(m.group), m.note));
  geo.trim.forEach((t) => add(t.stock, t.kind, t.cut, t.face ? `${t.face} face` : 'trim', t.note));
  return Object.values(rows).sort((a, b) => a.stock.localeCompare(b.stock) || a.kind.localeCompare(b.kind) || b.cut - a.cut);
}

export function prettyGroup(g) {
  return { floor: 'Floor', roof: 'Roof', 'wall:front': 'Front wall', 'wall:back': 'Back wall', 'wall:left': 'Left gable', 'wall:right': 'Right gable' }[g] || g;
}

export function costSummary(items, overrides, { tax = 8, contingency = 10 } = {}) {
  const sections = {};
  let subtotal = 0;
  items.forEach((it) => {
    const price = overrides[it.id] ?? it.unitPrice;
    const total = price * it.qty;
    sections[it.section] = (sections[it.section] || 0) + total;
    subtotal += total;
  });
  const taxAmt = subtotal * (tax / 100);
  const cont = (subtotal + taxAmt) * (contingency / 100);
  return { sections, subtotal, taxAmt, cont, total: subtotal + taxAmt + cont };
}
