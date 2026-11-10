# Shed Planner

Parametric shed plans. It currently designs a board-and-batten gable shed (default 12' × 16', 10/12 pitch). **Live:** https://bachirdxsi.github.io/shed-planner/

Change the size, pitch, doors, windows, rafters or snow load, and everything regenerates from one framing model:

- **3D model**: finished, framing-only and cutaway views (three.js).
- **Plans**: 9 printable sheets: cover and notes, floor plan, foundation and floor framing, wall framing for all four walls, roof framing, pattern rafter and gusset templates, elevations and a section.
- **Build guide**: 39 numbered steps from permit to paint, with stage pictures, the pieces each step needs, exact marks and square checks. Readable on a phone.
- **Materials**: full takeoff with waste, plus CSV export.
- **Cut list**: every piece, and an optimized cutting plan from stock lengths.
- **Cost**: editable unit prices (saved in the browser), tax and contingency.
- **Listing review**: notes on the 12×16 plan listing this was compared against.

## Run

ES modules need a local web server, so opening `index.html` directly won't work:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. The 3D viewer loads three.js from unpkg, so it needs an internet connection.

## Files

- `js/geometry.js`: framing engine. Every stud, plate, header, rafter, tie and gusset gets a position and a cut length.
- `js/materials.js`: takeoff, stock-length cut optimizer, default prices, cost totals.
- `js/drawings.js`: dimensioned SVG drawings.
- `js/model3d.js`: 3D viewer.
- `js/review.js`: listing review.
- `js/app.js`: UI.

## Status & license

Working prototype. MIT licensed, see [LICENSE](LICENSE).

## Caveats

This is an original design, but it is not engineered or stamped. Rafter span checks are approximate (SPF #2, rounded from the IRC tables). Check local code, permits, setbacks and height limits before building.
