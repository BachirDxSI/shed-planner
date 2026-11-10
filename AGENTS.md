# AGENTS.md

Instructions for AI coding agents working in this repo. Keep it short and true.
Global standards: `~/.agents/GITHUB_STANDARDS.md` (branches, commits, PRs, docs). Not on this machine? Read the copy in [`docs/GITHUB_STANDARDS.md`](docs/GITHUB_STANDARDS.md) and run `git config core.hooksPath .githooks`.

## What this is
A browser app that generates parametric plans for a board-and-batten gable shed (default 12' × 16', 10/12 pitch): a 3D model, 9 printable plan sheets, a materials takeoff, an optimized cut list, a cost estimate (US or Québec prices) and a review of a commercial plan listing. Not engineered or stamped. Live on GitHub Pages.

## Stack
- Plain HTML/CSS + ES modules, no build step, no dependencies to install
- three.js 0.170 (OrbitControls) from unpkg via an importmap
- Hosting: GitHub Pages from `main` (root)

## Layout
```
index.html        tabs + layout, importmap
css/style.css     all styling (screen + print)
js/geometry.js    framing engine: every member as a polygon in a local plane, extruded; units are inches
js/materials.js   takeoff, stock-length cut optimizer, price regions (us, qc), cost totals
js/drawings.js    SVG plan sheets (Dwg class, dimensions, labels)
js/model3d.js     three.js viewer and layers
js/review.js      listing review text
js/app.js         form, tabs, rendering, localStorage
```

## Commands
| Task | Command |
|---|---|
| Install | none |
| Run (dev) | `python3 -m http.server 8765` then open http://localhost:8765 |
| Test | none yet; check every tab in a browser and the console for errors |
| Lint / format | none |
| Build | none (static files are served as-is) |

## Conventions
- **Docs:** keep `TODO.md` (Now ≤ 3 items) and `CHANGELOG.md` ([Unreleased]) current with every change. Update this file when the stack or commands change.
- World axes: X along the length, Z across the width (front wall at Z=0), Y up. All geometry in inches.
- Every quantity in Materials/Cost must come from `buildShed()` geometry, never hard-coded counts.
- Prices live in `REGIONS` in `materials.js`; user overrides are stored per region in localStorage (`shed.prices.v1.<region>`).

## Gotchas
- ES modules don't load from `file://`; always use a local server.
- Browsers cache the modules aggressively during dev; hard-reload or use a no-cache server.
- Rafter heights: use `geo.yb(x)` / `geo.yt(x)` for the bottom and top edges. The bottom edge meets the plate top at the inner end of the birdsmouth seat (x = `seat`), not at the wall's outer face; don't hand-roll `H - O * t`.
- `renderPlans()` must only run once `geo` exists (opening at `#plans` used to crash).
- Rafter span checks are approximate (SPF #2); snow loads above 80 psf only show a warning.
- `.nojekyll` must stay so GitHub Pages serves the files untouched.

## Workflow
- Read `TODO.md` before starting; update it as you work.
- Other agents may work here too: check `gh pr list` and recent branches first, never touch changes you didn't make, and leave status in your draft PR (not in chat).
- Branch → PR for every change; never commit to `main`.
- User-visible changes get a `CHANGELOG.md` entry under `[Unreleased]` in the same PR.
