// Step-by-step build guide. Every number comes from the same framing model as the plans and cut list.
import { ftIn } from './geometry.js';
import { pieceSchedule } from './materials.js';

// Layer sets for the stage pictures (same layer names as the 3D viewer).
export const GUIDE_STAGES = {
  site: { site: true },
  floor: { site: true, floor: true },
  walls: { site: true, floor: true, deck: true, walls: true },
  roofFraming: { site: true, floor: true, deck: true, walls: true, roofFraming: true },
  roof: { site: true, floor: true, deck: true, walls: true, roofFraming: true, roof: true },
  siding: { site: true, floor: true, deck: true, walls: true, roofFraming: true, roof: true, siding: true, openings: true },
  finished: { site: true, floor: true, deck: true, walls: true, roofFraming: true, roof: true, siding: true, openings: true, trim: true },
};

const WALL_NAMES = { front: 'Front wall (double door)', back: 'Back wall', left: 'Left gable wall', right: 'Right gable wall' };
// Wall-local x = 0 is the corner the stud layout is measured from (the ◀ end on sheets S-2 and S-3).
const START_END = { front: 'left gable end', back: 'right gable end', left: 'front corner', right: 'back corner' };

export function guideHTML(geo, take, shots = {}) {
  const p = geo.p;
  const deg = ((geo.theta * 180) / Math.PI).toFixed(1);
  const q = (id) => take.items.filter((i) => i.id === id).reduce((a, i) => a + i.qty, 0);
  const sched = pieceSchedule(geo);
  const diag = (a, b) => ftIn(Math.hypot(a, b));
  const list = (xs) => xs.map((x) => ftIn(x)).join(' · ');
  const row = (qty, stock, kind, cut, note) =>
    `<li><b>${qty} ×</b> ${stock} ${kind.toLowerCase()} <b>${ftIn(cut)}</b>${note && note !== 'Square cut' ? ` <span class="muted">(${note})</span>` : ''}</li>`;

  // cut-list rows for a step
  const pieces = (kinds) => sched.filter((r) => kinds.includes(r.kind)).map((r) => row(r.qty, r.stock, r.kind, r.cut, r.note)).join('');
  // pieces for one wall, in assembly order
  const wallPieces = (name, skip = []) => {
    const by = {};
    geo.members
      .filter((m) => m.group === `wall:${name}` && !skip.includes(m.kind))
      .forEach((m) => {
        const k = `${m.kind}|${m.cut.toFixed(3)}|${m.note || ''}`;
        (by[k] ||= { ...m, n: 0 }).n++;
      });
    const order = ['Bottom plate', 'Top plate', 'Cap plate', 'Stud', 'King stud', 'Jack stud', 'Header', 'Cripple (top)', 'Rough sill', 'Cripple (sill)', 'Gable stud'];
    return Object.values(by)
      .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.cut - a.cut)
      .map((r) => row(r.n, r.stock, r.kind, r.cut, r.note))
      .join('');
  };
  // left edges of full-height studs, measured from the layout corner
  const studMarks = (name) =>
    [...new Set(geo.members.filter((m) => m.group === `wall:${name}` && /^(Stud|King stud)$/.test(m.kind)).map((m) => Math.min(...m.poly.map((pt) => pt[0])).toFixed(3)))]
      .map(Number)
      .sort((a, b) => a - b);

  const shot = (k, alt) => (shots[k] ? `<img class="g-shot" src="${shots[k]}" alt="${alt}"/>` : '');
  let n = 0;
  const step = (title, body, { need = '', check = '', tip = '', warn = '' } = {}) => {
    n++;
    return `<li class="g-step">
      <h3><span class="g-num">${n}</span>${title}</h3>
      <div class="g-body">${body}</div>
      ${need ? `<div class="g-need"><b>Pieces (from the cut list)</b><ul>${need}</ul></div>` : ''}
      ${warn ? `<p class="g-warn"><b>Careful:</b> ${warn}</p>` : ''}
      ${check ? `<p class="g-check"><span class="box" aria-hidden="true"></span><span><b>Check before moving on:</b> ${check}</span></p>` : ''}
      ${tip ? `<p class="g-tip"><b>Tip:</b> ${tip}</p>` : ''}
    </li>`;
  };
  const phases = [];
  const phase = (id, title, intro, img, steps) =>
    phases.push(`<section class="g-phase" id="${id}">
      <div class="g-phase-head"><div><h2>${title}</h2>${intro ? `<p>${intro}</p>` : ''}</div>${img}</div>
      <ol class="g-steps">${steps.join('')}</ol>
    </section>`);

  // ---------- numbers ----------
  const padW = Math.ceil((geo.W + 24) / 12);
  const padL = Math.ceil((geo.L + 24) / 12);
  const doors = Object.values(geo.openings).flat().filter((o) => o.type === 'door');
  const windows = Object.values(geo.openings).flat().filter((o) => o.type === 'window');
  const panel = p.siding === 't111' || p.siding === 'smartside';
  const longSidingH = geo.eaveSidingTop - geo.sidingBottom;
  const peakOverSeat = geo.yt(geo.run) - geo.H;

  // ---------- 1. before you start ----------
  phase('g-prep', 'Before you start', 'Paperwork, tools and help.', '', [
    step('Permit, setbacks and buried lines', `<p>Call your municipality before buying anything. Ask whether a ${Math.round((geo.W * geo.L) / 144)} sq ft shed needs a permit, how far it must be from property lines, and the height limit. This shed is <b>${ftIn(geo.heights.peak)}</b> to the ridge. Get buried lines marked before you dig (Info-Excavation in Québec, 811 in the US).</p>`),
    step('Tools', `<ul class="g-cols">
      <li>Circular saw and speed square</li><li>Miter saw (for the ${deg}° rafter cuts)</li><li>Jigsaw or handsaw</li>
      <li>Framing nailer or hammer</li><li>Drill/driver and bits</li><li>25 ft tape, chalk line, pencils</li>
      <li>4 ft level, string line</li><li>Framing square</li><li>2 sturdy ladders</li>
      <li>Caulk gun, utility knife, tin snips</li><li>Safety glasses, hearing protection, gloves</li><li>Shovel, rake, hand tamper</li></ul>`,
      { tip: 'Rent a framing nailer for the framing weekend. It saves hours.' }),
    step('Helpers and weather', '<p>One person can build the floor. You need <b>2 people</b> to stand the walls and <b>3</b> to set the rafters. Frame the roof on a dry, calm day, and get it covered the same week.</p>'),
    step('Order and sort the materials', '<p>Order from the <b>Materials</b> tab (Download CSV). When the lumber arrives, sight down each board. Keep the straightest ones for rafters, plates and door framing. Store everything flat, off the ground and covered.</p>',
      { tip: 'Order 2 or 3 extra studs; some will be too twisted to use.' }),
  ]);

  // ---------- 2. site ----------
  phase('g-site', 'Site and foundation', `A level gravel pad and ${geo.nSkids} pressure-treated skids. Everything after this depends on the skids being level.`, shot('site', 'Gravel pad'), [
    step('Lay out the pad', `<p>Drive 4 stakes for a <b>${padW}' × ${padL}'</b> pad, 1 ft bigger than the shed on every side. Square it by making both diagonals equal: <b>${diag(padW * 12, padL * 12)}</b>.</p>`,
      { check: 'Both diagonals within 1/2" of each other.' }),
    step('Dig and fill the pad', `<p>Remove the sod and topsoil (about 4 to 6"). Lay landscape fabric, then spread <b>${q('gravel')} cu yd</b> of 3/4" crushed stone in 2 layers, tamping each one. Rake it level with a long straight 2x4.</p>`,
      { check: 'Level within 1/2" corner to corner.' }),
    step('Set and level the skids', `<p>Lay the ${geo.nSkids} skids along the <b>length</b> of the shed, ${geo.nSkids > 2 ? 'evenly spaced, ' : ''}with the outside faces of the two outer skids <b>${ftIn(geo.W)}</b> apart. Set each one on ${q('blocks') / geo.nSkids} solid concrete blocks and shim with pressure-treated shims until every skid is level along its length and level with the others.</p>`,
      { need: pieces(['Skid']), check: `All skids level both ways, and the diagonals across the outer skids are equal: <b>${diag(geo.W, geo.L)}</b>.`, warn: 'Use solid blocks laid flat and pressure-treated shims only. Hollow blocks crack and untreated wood rots.' }),
  ]);

  // ---------- 3. floor ----------
  phase('g-floor', 'Floor', `${geo.joistX.length} joists at ${p.joistSpacing}" on center between two rim joists, covered with 3/4" tongue-and-groove OSB.`, shot('floor', 'Floor framing'), [
    step('Mark the rim joists', `<p>Lay the two rim joists side by side with the ends flush and mark both at once. From the same end, square a line across at each joist's <b>left edge</b>: <span class="g-marks">${list(geo.joistX)}</span>. Put an X on the right of each line; that's where the joist goes.</p>`,
      { need: pieces(['Rim joist']), tip: `The marks are 3/4" short of each ${p.joistSpacing}" multiple, so the subfloor sheet ends land in the middle of a joist.` }),
    step('Build the floor frame', '<p>Stand the rims on edge with the crown (the slight hump) up. Nail each joist between them on its X with three 16d nails through the rim into the joist end. Build it right on the skids.</p>',
      { need: pieces(['Floor joist']), check: `Diagonals equal: <b>${diag(geo.W, geo.L)}</b>. Push the frame until they match, then toenail it to the skids and add the ${q('a23')} A23 clips at the outer skids.` }),
    step('Subfloor', `<p>Run a bead of construction adhesive on the joists. Lay the ${q('osb34tg')} sheets of 3/4" tongue-and-groove OSB with the long side across the joists, starting at a corner. Start the next row with a half sheet so the ends don't line up. Nail or screw every 6" along the edges and every 12" in the middle.</p>`,
      { check: 'Sheet edges flush with the outside of the frame; every sheet end lands on a joist.', tip: 'Tap the tongue in with a sledge against a scrap block, never on the tongue itself.' }),
  ]);

  // ---------- 4. walls ----------
  const wallStep = (name) => {
    const w = geo.walls.find((x) => x.name === name);
    const len = w.x1 - w.x0;
    const ops = geo.openings[name];
    const opText = ops.length
      ? `<p>Openings (the rough opening is the hole in the framing): ${ops
          .map((o) => `<b>${o.name.toLowerCase()}</b> ${ftIn(o.w)} wide × ${ftIn(o.top - o.bottom)} tall${o.bottom ? `, ${ftIn(o.bottom)} above the floor` : ''}, starting <b>${ftIn(o.xL)}</b> from the ${START_END[name]}`)
          .join('; ')}. Each one gets a full-height king stud and a shorter jack stud on both sides, a doubled 2x6 header with a 1/2" plywood spacer between the two pieces, and short cripples above${ops.some((o) => o.type === 'window') ? ' (and a rough sill with cripples under each window)' : ''}.</p>`
      : '';
    return step(`Frame the ${WALL_NAMES[name].toLowerCase()}`,
      `<p>${w.gable ? `This wall fits <b>between</b> the long walls, so it's ${ftIn(len)} long.` : `This wall runs the full length of the shed, ${ftIn(len)}.`} Lay the bottom and top plates side by side and mark them together. Measure every mark from the <b>${START_END[name]}</b> (the ◀ end on sheet ${w.gable ? 'S-3' : 'S-2'}). Stud left edges: <span class="g-marks">${list(studMarks(name))}</span>.</p>${opText}
      <p>Nail the studs between the plates, two 16d nails through each plate into every stud end. The cap plate goes on after all the walls stand.</p>`,
      {
        need: wallPieces(name, ['Cap plate', 'Gable stud']),
        check: `Square the wall before you lift it: diagonals equal, <b>${diag(len, geo.H - 1.5)}</b>. Nail a diagonal brace across to hold it square.`,
        warn: ops.some((o) => o.type === 'door') ? 'Keep the bottom plate under the jack studs: the jacks are cut to stand on it. You cut the plate out of the doorway only after the wall stands.' : '',
      });
  };
  phase('g-walls', 'Walls', 'Build each wall flat on the floor, square it, stand it up, then tie the walls together with the cap plate.', shot('walls', 'Wall framing'), [
    step('Snap the wall lines', '<p>Snap chalk lines on the floor 3-1/2" in from every edge. Each wall stands inside its line, with its outside face flush with the edge of the floor.</p>'),
    wallStep('back'),
    step('Stand the back wall', '<p>With a helper, lift it upright and set the bottom plate on its chalk line. Nail it down with 16d nails into the rim joist, two per stud bay. Plumb the ends with a level and brace them to the floor.</p>',
      { check: 'Plumb at both ends; the bottom plate tight to the chalk line all along.' }),
    wallStep('front'),
    step('Stand the front wall', '<p>Same as the back wall. Then cut the bottom plate out of the doorway with a handsaw, flush with the jack studs.</p>'),
    wallStep('left'),
    wallStep('right'),
    step('Stand the gable walls and nail the corners', '<p>Stand each gable wall between the long walls. Nail its end studs to the long walls\' corner studs with 16d nails every 16".</p>'),
    step('Cap plates', '<p>Nail the cap plates on top of the top plates. At each corner the gable-wall cap runs over the long wall, which locks the walls together. Nail every 16", and twice at each corner overlap.</p>',
      { need: pieces(['Cap plate']), check: `Diagonals across the tops of the walls equal (<b>${diag(geo.W, geo.L)}</b>), every corner plumb. Leave the braces on until the roof is framed.` }),
  ]);

  // ---------- 5. roof framing ----------
  phase('g-roof-frame', 'Roof framing', `${geo.rafterX.length} rafter pairs at ${p.rafterSpacing}" on center, joined at the peak with plywood gussets and tied at the walls.`, shot('roofFraming', 'Roof framing'), [
    step('Cut one pattern rafter', `<p>Follow the template on sheet S-5. Start from a board at least <b>${ftIn(geo.rafterStock)}</b> long; because the end cuts lean, the board must be longer than the distance between the cuts.</p>
      <ol class="g-sub">
        <li><b>Ridge cut:</b> miter saw at <b>${deg}°</b> (or a speed square on the ${p.pitch} mark).</li>
        <li><b>Tail cut:</b> along the <b>top edge</b>, measure <b>${ftIn(geo.rafterCut)}</b> from the ridge cut's top corner. Cut at ${deg}°, parallel to the ridge cut.</li>
        <li><b>Birdsmouth</b> (the notch that sits on the wall): along the bottom edge, measure <b>${ftIn(geo.O / geo.c)}</b> from the tail's bottom tip. Draw a plumb line there, <b>${ftIn(geo.seat * geo.t)}</b> deep: that's the heel. From its top end, draw a level line <b>${ftIn(geo.seat)}</b> long back to the bottom edge: that's the seat.</li>
        <li>Cut the notch with a circular saw, stopping at the lines, and finish the corner with a handsaw. Don't cut past the lines.</li>
      </ol>`,
      { warn: 'Cut only this rafter and one copy until the test pair fits.' }),
    step('Test the pair on the floor', `<p>Trace the pattern onto a second board and cut it. Lay the two on the floor with the ridge cuts touching and the heel corners (the outside corners of the notches) <b>${ftIn(geo.W)}</b> apart, the outside width of the walls.</p>`,
      { check: `Both seat cuts lie on one straight line, the ridge cuts meet tight along their full depth, and the top of the peak is <b>${ftIn(peakOverSeat)}</b> above the seat line. If it fits, write PATTERN on the first rafter and trace it for every other one.` }),
    step('Cut all the rafters, ties and gussets', `<p>Trace the pattern on each board and cut. Cut the ${geo.gussets} gussets from 7/16" OSB with the gusset template on S-5.</p>`,
      { need: pieces(['Rafter', 'Fly rafter', 'Rafter tie']), tip: 'Inside pairs get a gusset on both faces. The two end pairs get one only, on the inside face.' }),
    step('Assemble the pairs on the floor', '<p>Screw 2x4 blocks to the floor around the test pair to make a jig. Assemble every pair in the jig: glue and nail a gusset on each face (8d nails about every 3"). Nail the rafter tie across the pair with its bottom edge on the seat line and its ends flush with the heel corners.</p>',
      { check: 'Every pair matches the jig exactly.' }),
    step('Mark the rafter layout', `<p>On both cap plates, mark the left edge of each rafter pair, measured from the left gable end: <span class="g-marks">${list(geo.rafterX)}</span>.</p>`),
    step('Set the rafter pairs', `<p>With 3 people, set the two end pairs first, plumb them and brace them. Stretch a string between their peaks. Set the other pairs on their marks with the peaks touching the string. Toenail each rafter to the cap plate and add a hurricane tie (H2.5A) at every rafter (${q('h25a')} in all).</p>`,
      { check: 'Every peak touches the string and every pair is plumb. Nail a temporary 1x4 across the rafters to hold the spacing.', warn: 'Set rafters only on a calm day, and brace each end pair before you let go of it.' }),
    step('Gable studs', '<p>Mark the same stud layout on each gable\'s top plate (measured from the same corner as the wall below). Cut each gable stud, test its fit under the end rafter, then toenail it to the plate and nail it to the rafter.</p>',
      { need: pieces(['Gable stud']), tip: 'Lengths are to the long point of the angled cut. The studs under the ridge gusset are cut square and stop just under it.' }),
  ]);

  // ---------- 6. roofing ----------
  phase('g-roof', 'Roofing', 'Get the roof covered as soon as the framing is done.', shot('roof', 'Roof covered'), [
    step('Gable siding and fly rafters', `<p>Put the gable siding up first, to the underside of the roof (see Siding). Then hold each fly rafter ${p.rakeOverhang}" out from the end rafter, lined up with the other rafters at the tail and the peak. Cut 2x4 spacer blocks to fit the gap, about every 24", and screw through the fly rafter and blocks into the end rafter with 4" structural screws.</p>`,
      { need: pieces(['Fly rafter']), warn: `With a rake overhang over 6", use 2x4 lookouts instead of spacer blocks.` }),
    step('Sub-fascia', '<p>Nail a 2x4 sub-fascia across the rafter tail ends along each eave, running past the fly rafters. Its top edge has to line up with the roof: check with a straight board laid across the rafters.</p>',
      { need: pieces(['Sub-fascia']) }),
    step('Roof sheathing', `<p>Start at an eave with a full sheet of 7/16" OSB, long side across the rafters, flush with the sub-fascia. Put an H-clip between rafters along every horizontal joint, leave a 1/8" gap at every edge, and start the next row with a half sheet. Nail every 6" along the edges and 12" in the middle (${q('osb716')} sheets).</p>`,
      { check: 'Every sheet end lands on a rafter; the top rows meet at the peak with no gap over 1/4".' }),
    step('Drip edge, underlayment, drip edge', '<p>Nail drip edge along both <b>eaves</b>. Roll out #15 felt from the eave up, each row overlapping the one below by 2", and lap it 6" over the peak. Then nail drip edge along the <b>rakes</b>, on top of the felt.</p>',
      { tip: 'Water must always run onto the next layer, never behind it. That\'s why the eaves and rakes go in this order.' }),
    step('Shingles', `<p>Starter strip along the eaves, then shingles from the bottom up, following the nail line and exposure printed on the bundle (${q('bundle')} bundles). Finish with ridge cap over the peak.</p>`,
      { warn: 'Nail only on the nail line, 4 nails per shingle (6 in windy areas). Nails set too high are the most common cause of shed roof leaks.' }),
  ]);

  // ---------- 7. siding, doors, windows ----------
  const sidingBody = panel
    ? `<p>Panels go on vertically, ${p.siding === 'smartside' ? 'textured side out' : 'grooves running up and down'}. Start each wall at the corner its stud layout started from (the ◀ end on S-2 and S-3), so every 4 ft joint lands on a stud. The bottom edge hangs <b>${ftIn(-geo.sidingBottom)}</b> below the floor to cover the floor framing.</p>
      <ul><li><b>Long walls:</b> cut the panels <b>${ftIn(longSidingH)}</b> tall so the tops stop just under the rafter tails.</li>
      <li><b>Gables:</b> cut the top of each panel at ${deg}° to follow the roof, 3/4" below the roof sheathing.</li>
      <li>Cut out openings after you tack the panel in place, or measure them from the panel edge.</li>
      <li>Z-flashing over every door and window${longSidingH > 108 ? ', and along any horizontal joint' : ''}.</li></ul>
      <p>Nail every 6" along the edges and 12" in the middle with galvanized siding nails.</p>`
    : `<p>Sheathe the walls with 7/16" OSB, then house wrap lapped like shingles (upper layers over lower ones), then the ${p.siding === 'vinyl' ? 'vinyl siding: follow the maker\'s instructions for the starter strip and J-channel, and nail loosely in the middle of the slots so it can move' : 'spruce boards vertically with 1/2" gaps; prime every face first'}.</p>`;
  const siteDoors = doors.filter((o) => o.build === 'site');
  const preDoors = doors.filter((o) => o.build === 'prehung');
  phase('g-siding', 'Siding, doors and windows', '', shot('siding', 'Siding on'), [
    step('Siding', sidingBody, { check: 'Every joint lands on a stud and every panel is plumb. Check each one with a level; small errors add up across a wall.' }),
    step('Windows', windows.length
      ? `<p>${windows.length} window${windows.length > 1 ? 's' : ''}, each in a ${ftIn(windows[0].w)} × ${ftIn(windows[0].top - windows[0].bottom)} rough opening. Run a bead of caulk behind the nailing flange, set the window level, and nail the flange. Put Z-flashing over the top.</p>`
      : '<p>No windows in this design.</p>'),
    ...preDoors.map((o) => step(`Pre-hung ${o.name.toLowerCase()}`, `<p>Set the door in its ${ftIn(o.w)} × ${ftIn(o.top)} rough opening on a bead of caulk. Shim the hinge side plumb first, then the latch side, keeping the gap even. Screw through the shims. Make sure it opens and latches before you add trim.</p>`)),
    ...siteDoors.map((o) => step(`Build the ${o.name.toLowerCase()}`, `<p>Build ${o.leaves === 2 ? 'each of the two doors' : 'the door'} flat on the floor: a siding panel cut to <b>${ftIn((o.w - 0.5) / o.leaves)} × ${ftIn(o.top - 1)}</b>, framed on the outside with 1x4 stiles (sides) and rails (crosspieces), glued and screwed from the back. Lay each brace diagonally between the rails, mark both ends in place, and cut.</p>
      <p>Hang with T-strap hinges on the stiles, leaving 1/2" at the bottom. Add a cane bolt and a hasp${o.leaves === 2 ? ' on the door that stays shut' : ''}.</p>`,
      { need: pieces(['Door stile', 'Door rail', 'Door brace']), check: 'Even gaps all around; the doors close without rubbing.' })),
  ]);

  // ---------- 8. trim ----------
  phase('g-trim', 'Trim and finish', 'Trim covers the panel edges and keeps water out. Paint everything that will be exposed.', shot('finished', 'Finished shed'), [
    step('Corner boards and casing', `<p>Corner boards first. On the long walls they stop under the rafter tails, ${ftIn(geo.H - geo.eaveTrimTop)} below the top of the wall. Then the casing around the doors and windows: sides first, then the head, then the window sills.</p>`,
      { need: pieces(['Corner board', 'Casing', 'Casing head', 'Casing sill']) }),
    step('Battens', p.siding === 'vinyl'
      ? '<p>Vinyl board-and-batten has the battens built in, so skip this step.</p>'
      : `<p>Nail a batten over every panel joint, then every ${p.siding === 'spruce' ? 6 : p.battenSpacing}" between, measured from the same corner as the siding. Use a spacer block so they stay parallel.</p>`,
      { need: p.siding === 'vinyl' ? '' : pieces(['Batten']) }),
    step('Fascia', `<p>Eave fascia (1x6) over the sub-fascia first. Then the rake fascia: cut the peak end at ${deg}°, hold the board in place, and mark the eave end.</p>`,
      { need: pieces(['Eave fascia', 'Rake fascia']) }),
    step('Vents, caulk and paint', '<p>Close the openings between the rafters above the long walls with screened vent blocking. Caulk the trim joints (not the bottom edges of the siding, which must drain). Prime all cut edges, then apply two coats of paint.</p>',
      { check: 'With the doors closed on a sunny day, you see no light through the walls or eaves except at the vents.' }),
  ]);

  const toc = [['g-prep', 'Before you start'], ['g-site', 'Site and foundation'], ['g-floor', 'Floor'], ['g-walls', 'Walls'], ['g-roof-frame', 'Roof framing'], ['g-roof', 'Roofing'], ['g-siding', 'Siding, doors, windows'], ['g-trim', 'Trim and finish']];
  return `<div class="guide">
    <header class="g-head">
      <h1>Build guide: ${ftIn(geo.W)} × ${ftIn(geo.L)} gable shed</h1>
      <p>${n} steps in order. Every measurement matches the plans and cut list for the options you picked; change an option and the guide updates.</p>
      <nav class="g-toc" aria-label="Guide sections">${toc.map(([id, t], i) => `<a href="#${id}">${i + 1}. ${t}</a>`).join('')}</nav>
      <p class="g-rules"><b>Three rules:</b> measure twice, cut once. Do every check before moving on. If a piece doesn't fit, stop and find out why before cutting another.</p>
    </header>
    ${phases.join('')}
    <p class="muted g-foot">This design is not engineered or stamped. Follow your local code and the manufacturers' instructions for windows, doors, siding and shingles.</p>
  </div>`;
}
