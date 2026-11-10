// Review of the 12x16 shed-plan listing (based on the seven screenshots shared).
import { buildShed, DEFAULTS, ftIn } from './geometry.js';
import { takeoff } from './materials.js';

export function reviewHTML() {
  // Our numbers for the same shed: 12x16, 10/12, 2x4 rafters @ 24", pre-hung doors like the listing.
  const g = buildShed({ ...DEFAULTS, siding: 't111', rafterSize: '2x4', snowLoad: 30, frontDoorType: 'prehung', sideDoorType: 'prehung' });
  const t = takeoff(g);
  const q = (id) => t.items.filter((i) => i.id === id).reduce((a, i) => a + i.qty, 0);
  const lumber = (stock) => t.items.filter((i) => i.id.startsWith(`lumber:${stock}:`)).reduce((a, i) => a + i.qty, 0);
  const dripLf = Math.round((2 * (g.L + 2 * g.R) + 4 * g.slopeLen) / 12);
  const roofSq = (g.roofArea / 144 / 100).toFixed(2);

  const rows = [
    ['Shingles', '2.6 squares', `${roofSq} squares of roof (6" eaves, 4" rakes); buy ${q('bundle')} bundles with waste, plus starter and ridge cap`, 'watch'],
    ['Roof sheathing', '9 sheets', `${q('osb716')} sheets (8% waste)`, 'watch'],
    ['Drip edge', '5 × 10 ft = 50 lf', `${dripLf} lf for eaves + rakes → ${q('dripedge')} pieces`, 'bad'],
    ['Siding', '16 sheets 4×8, 1/2"', `${q('siding49')} sheets 4×9 for the walls (they're ${ftIn(g.H - g.sidingBottom)} from rim to plate) + ${q('siding48')} 4×8 for the gables`, 'watch'],
    ['Subfloor', '6 sheets 3/4" T&G', `${q('osb34tg')} sheets`, 'good'],
    ['2x4 studs', '50 × 8 ft (+ plates, trimmers)', `${lumber('2x4')} pieces of 2x4 in all (studs, plates, gable studs, rafters, ties)`, 'good'],
    ['Rafter connectors', 'Not shown (A23 clips at floor only)', `${q('h25a')} hurricane ties, one per rafter`, 'bad'],
    ['Doors', 'Pre-hung 3068 + 6068', 'Drawings show board doors; pre-hung adds ~$1,000–1,500', 'watch'],
  ];

  return `<div class="review">
  <h1>Review of the 12' × 16' shed-plan listing</h1>
  <p class="muted">Based only on the seven screenshots you shared (feature list, line drawings, sample pages, materials list, renderings). I haven't seen the full PDF or the price.</p>

  <div class="verdict">
    <b>Verdict:</b> It looks like a real, fairly complete DIY plan set: about 20 pages covering the floor plan, foundation, floor and wall framing per wall, sheathing layouts, rafter templates, eave and rake details, and a coded materials list. If it costs about $25 or less, it's a fair buy for someone who wants paper plans.
    Expect what's in the <b>line drawings</b>, not the photos, and check the materials list before you order. The roofing and drip-edge quantities look short, and it doesn't list the rafter ties that code usually requires.
  </div>

  <h2>What's good</h2>
  <ul>
    <li><span class="tag good">Good</span>Real construction sheets: per-wall framing elevations, a roof framing plan, a full-size rafter cut template with the 10/12 birdsmouth, and sheathing layouts. Most cheap listings skip these.</li>
    <li><span class="tag good">Good</span>A coded materials list with lengths and fasteners. Simpson A23 clips at the skids and construction adhesive on the subfloor are good details.</li>
    <li><span class="tag good">Good</span>A sound basic structure: 4x6 skids, 2x6 joists at 16", 2x4 walls, and gusseted rafter pairs. That's standard for a 12' span.</li>
  </ul>

  <h2>What to watch</h2>
  <ul>
    <li><span class="tag watch">Watch</span><b>The photos aren't the plans.</b> The color renderings look AI-generated. They show 6-over-6 double-hung windows, glass-paneled doors and a deck step. The drawings show 2'×3' windows (2030), board doors and no step. The photos don't match each other either: the side-door glass and window sizes change between them.</li>
    <li><span class="tag watch">Watch</span><b>"5 floor & foundation options"</b>: the sample pages only show skids. Ask the seller what the other four are (concrete blocks, piers, slab?) before you buy if that matters to you.</li>
    <li><span class="tag watch">Watch</span><b>Doors:</b> the materials list calls for pre-hung 3068 and 6068 doors, but the drawings show site-built board doors. A pre-hung double door alone often costs $800–1,200. Decide before framing: the rough openings differ.</li>
    <li><span class="tag watch">Watch</span><b>Siding:</b> it lists 16 sheets of 4×8 textured plywood, 1/2" thick. With ~6" of rim joist plus 8'-1" walls, the walls are about 8'-7" tall, so 8 ft sheets need a flashed horizontal joint (or use 9 ft sheets). Also check the 1/2" panels are APA-rated siding for 16" O.C.; most T1-11 is 19/32".</li>
    <li><span class="tag watch">Watch</span><b>Permits & height:</b> 192 sq ft is over the 120 sq ft no-permit limit in many US towns (some allow 200). The 10/12 roof puts the ridge at about ${ftIn(g.heights.peak)}, near the 12–15 ft accessory-building limit in many zoning codes. The plans aren't stamped.</li>
    <li><span class="tag bad">Québec</span><b>Snow:</b> their 2x4 rafters at 24" with a 6 ft run are fine to about 30 psf ground snow. Québec City is about 3.6 kPa (~75 psf), so they're undersized there: use 2x6 rafters at 24" (this planner's default for you).</li>
    <li><span class="tag watch">Watch</span>Small typos like "OPTONAL" on the floor plan suggest light proofreading. Cut and test-fit one rafter pair before cutting them all.</li>
  </ul>

  <h2>Possible gaps in their materials list</h2>
  <ul>
    <li><span class="tag bad">Check</span><b>Shingles:</b> 2.6 squares is about the bare roof area with no waste, starter strip or ridge cap. Plan on about 3.1 squares (10 bundles) plus 1 bundle each of starter and ridge cap.</li>
    <li><span class="tag bad">Check</span><b>Drip edge:</b> 50 lf covers the eaves but not the eaves plus rakes (~${dripLf} lf).</li>
    <li><span class="tag bad">Check</span><b>Rafter-to-wall connectors:</b> only A23 clips (floor to skid) show up. Most codes want a hurricane tie at every rafter, and wind areas need ground anchors for a skid shed.</li>
    <li><span class="tag watch">Check</span><b>Fasteners:</b> 12d nails for wall framing work, but 16d sinkers are the norm. There are no ring-shank nails or H-clips for the roof sheathing at 24" O.C.</li>
  </ul>

  <h2>Their list vs. this planner (same 12×16, 10/12 shed)</h2>
  <table class="data"><thead><tr><th>Item</th><th>Listing</th><th>This planner</th></tr></thead><tbody>
  ${rows.map(([a, b, c, tag]) => `<tr><td><span class="tag ${tag}">${tag === 'good' ? 'OK' : tag === 'bad' ? 'Short' : 'Check'}</span>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}
  </tbody></table>
  <p class="muted" style="margin-top:10px">Overhangs aren't readable in the screenshots, so I assumed a 6" eave and a 4" rake; with smaller overhangs their roofing numbers come closer. The "Listing" column is read from the blurred materials-list preview, so a few values may be off.</p>

  <h2>Bottom line</h2>
  <p>If you like paper plans from one designer, it's a reasonable buy. Cross-check the roofing, drip edge and connectors against the <b>Materials</b> tab before ordering. This planner draws its own original plans for the same kind of shed, which you can resize and print, so you may not need theirs at all.</p>
  </div>`;
}
