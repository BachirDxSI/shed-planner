# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Changed
- Renamed the app from Gable Shed Planner to Shed Planner, ready for other roof styles.

### Added
- Build guide tab: 39 numbered steps from permit to paint, with a 3D picture of each stage, the cut-list pieces each step needs, measured marks for joists, studs and rafters, and a check (square, level, plumb) before moving on.
- Wall framing sheets name both ends and show which corner to start the stud layout from.
- Parametric 12' × 16' gable shed: size, pitch, overhangs, doors, windows, rafters, snow load and siding are all adjustable.
- 3D model with finished, framing and cutaway views.
- Nine printable plan sheets: cover and notes, floor plan, foundation, floor framing, four wall framing elevations, roof framing, rafter and gusset templates, elevations and a section.
- Materials list with CSV export, and a cut list optimized from stock lengths.
- Cost estimate with US or Québec City (CAD, TPS+TVQ) prices, editable and saved in the browser.
- Siding comparison (T1-11, LP SmartSide, spruce board and batten, vinyl); LP SmartSide is the default.
- Review of a commercial 12×16 shed-plan listing.

### Fixed
- The 3D model was a mirror image of the paper plans (the side-door gable was on the wrong side). It now matches.
- On phones the tab bar was squeezed out of view and the options panel came first; tabs now wrap onto their own row and the content comes before the options.
- Gable-wall studs are now laid out from the shed's outside corner, so the 4 ft siding panel joints land on studs (before, the gable panel edges at 4 ft and 8 ft had nothing to nail to).
- Rafter and fly-rafter lengths in the cut list are now the blank you need (8'-10 1/8" for the default shed). The old 8'-5 1/2" was the distance between the plumb cuts, which left a board cut to that length 4 9/16" short. The rafter template shows both numbers.
- Door jack studs were 1 1/2" too long (they stand on the bottom plate); now 6'-9".
- Gable studs under the ridge gusset were too long to fit; they now get a square top just under it.
- Cap plates now lap the corners (gable-wall caps 12'-0", long-wall caps 15'-5"), and on walls over 16 ft every plate and rim-joist splice lands on a stud or joist.
- Long-wall siding, battens and corner boards stop under the rafter tails instead of running into them.
- The cut list has an "Ends" column saying how each piece is cut (square, pitch angle, blank, or scribe to fit).
- The rafter birdsmouth was drawn inside out (a bump below the board instead of a notch cut into it). The pattern rafter, 3D model, elevations and section now show a real notch, and the roof, ridge height (now 14'-6 5/8") and gable stud lengths are 2 1/4" lower to match.
