# LCA factory twin — website

A static website (GitHub Pages) that shows the composite-panel LCA project on live data from a Supabase database.

| File | What it is |
|---|---|
| `index.html` | the LCA comparison dashboard |
| `twin.html` | the 3D factory digital twin |
| `project.html` | the project page for stakeholders (settings in `project-config.js`, images in `assets/`) |
| `config.js` | **the only file you must edit**: your Supabase URL and public key |
| `supabase/` | the SQL to run once in Supabase (files `1` to `6`, in order) |
| `models/` | credits and settings for the 3D machine models |
| `calc.js`, `twin-*.js`, `twin3d.bundle.js`, `sample-data.js` | the pages' code and built-in sample data (nothing to edit) |

**How to put it online: read `DEPLOY.md`.** No CSV files are needed: the data lives in the database, and the pages fall back to the built-in sample data if it cannot be reached.

All data is example data from the project's demonstrator. Do not publish real company data on this site. Third-party components: three.js (MIT, see `LICENSES/three-LICENSE.txt`) and the Laser CNC machine model by YouniqueIdeaStudio (CC BY 4.0, see `models/CREDITS.md`).
