# Manufacturing LCA Database

A PostgreSQL database (for Supabase) designed around the team's manufacturing LCA comparison dashboard, plus that dashboard driven by the database.
**All data in this repository is simulated / example data.** Do not commit real company data, passwords or Supabase keys.

## What is in this repository

| Path | Purpose |
|---|---|
| `DEPLOY.md` | **Start here to put it online**: step-by-step Supabase and GitHub Pages setup (dashboard, digital twin and project page reading the hosted database), security notes and troubleshooting |
| `DATABASE_DESIGN.md` | **Start here to understand the data.** How every part of the team's dashboard (inputs, tables, each button) maps to database tables and functions, with an ER diagram |
| `CALCULATION_PLAN.md` | The calculation plan: formulas, rules, worked example, open allocation questions, validation |
| `supabase/0_reset_database.sql` | Wipes this project's tables/views/functions (any version) so you can start again from file 1 |
| `supabase/1_schema.sql` | The 18 tables |
| `supabase/2_views_and_security.sql` | The calculations (views), the dashboard's buttons (functions), access control |
| `supabase/3_sample_data.sql` | Simulated / example rows (generated from the CSVs) |
| `supabase/4_digital_twin.sql` | Floor layout tables for the digital twin |
| `supabase/5_digital_twin_sample_data.sql` | Simulated floor layout (run after 4) |
| `supabase/6_public_read_access.sql` | **Run last.** Lets the hosted dashboard and twin read the database through the public key (read-only views only; see `DEPLOY.md`) |
| `supabase/clear_sample_data.sql` | Empties all data tables before loading real data |
| `data/csv/` | One CSV per table, same columns as the database (calculated columns left out), numbered in load order |
| `docs/project.html` | **The project page** for stakeholders (MSI LCI Optimisation Project with Far UK): challenge, approach, demonstrator screenshots and links, an interactive insight lab, roadmap, trust principles. Standalone; the dashboard and twin do not link to it. Settings in `docs/project-config.js` (contact details and logos are hidden until you fill them in); images in `docs/assets/` |
| `DIGITAL_TWIN.md` | The factory-floor 3D digital twin: what it does, assumptions, missing data, path to a live twin |
| `docs/` | The dashboard (GitHub Pages): `index.html`, `calc.js` (the calculations), `config.js`, `sample-data.js`; the 3D digital twin on its own page (`twin.html`, open it directly; the dashboard does not link to it): `twin3d.bundle.js` (the engine, one script), `twin3d.js` + `twin-walk.mjs` (its source: engine and the walkable worker), `twin-sim.js`, `twin-viz.js`, `models/` (real 3D models in GLB, with credits), `vendor/` (three.js, MIT) |
| `tools/` | Optional: automated checks (`npm run validate`, 180 checks) and regeneration (`npm run build`) |

## The design in brief

- The database is built around the team's dashboard (`manufacturing_lca_comparison_html_example.html`): its inputs, tables, KPIs and buttons each map to a table, view or function. See `DATABASE_DESIGN.md`.
- A **scenario** is one part made by one route. It owns the BOM, layup and live readings. Routes (vacuum infusion, RTM, compression moulding, prepreg + autoclave) own the process steps.
- Calculations live in the database as views and are repeated, identically, in `docs/calc.js`; the dashboard shows its own working and checks itself against the database. Details: `CALCULATION_PLAN.md`.
- The dashboard's buttons exist as functions you can call from SQL: `add_bom_item`, `load_bom_template`, `new_scenario`, `add_live_reading`, `load_example_live_data`, `save_comparison`, `generate_ai_prompt`, `generate_recommendations`, `run_analysis`. For example, `select run_analysis(1);` saves the comparison and generates the prompt and recommendations for scenario 1; then `select prompt_text from ai_prompts order by prompt_id desc limit 1;`.
- **No TimescaleDB**: live readings are small (kWh per operation). Plain PostgreSQL is sufficient until readings reach millions of rows.
- Sample data = the mock-up's example numbers (materials, routes, live readings). They are **examples to be verified**, not approved LCA data.

## Put it online (Supabase + GitHub Pages)
The full guide is **`DEPLOY.md`**. In short: run the SQL files `1` to `6` in the Supabase SQL Editor in order (use `0_reset_database.sql` first if you ran older versions), paste the Supabase **Project URL** and **public key** into `docs/config.js`, upload the project to a public GitHub repository, and switch on **Settings → Pages → `main` / `/docs`**. The dashboard (`/`), the digital twin (`/twin.html`) and the project page (`/project.html`) then all show live data from your database. Everything before real company data is meant for **example data only**: the public key is visible on the site.

**Rehearse locally:** `cd tools && npm run mock-supabase` starts a stand-in for Supabase that answers exactly like the public key would (see the end of `DEPLOY.md`).

**Real data**
1. Run `supabase/clear_sample_data.sql`.
2. **Table Editor → pick a table → Insert → Import data from CSV**, in the order of the numbered files in `data/csv/` (parents before children). Afterwards run `select reset_identity_sequences();`.
3. Team logins: **Authentication → Users → Add user**. Any signed-in user can read and write; nobody else can.

**Load the CSVs automatically (instead of clicking through the table editor)**
With `psql` installed, set the connection string (Supabase: **Connect → Session pooler**; local Docker: `postgresql://postgres:localpass@localhost:5432/postgres`) and run:
```bash
export DATABASE_URL='postgresql://...'
tools/load_csvs.sh --replace     # empties the data tables, then loads every CSV in order, as one transaction
```
`--dry-run` only prints the steps. Edit the CSVs in `data/csv/`, re-run, done. Do not automate this from GitHub with real data in the repository.

**Connect other tools (Python, Power BI, etc.)**
Click **Connect** at the top of the Supabase dashboard and copy the PostgreSQL connection string (use the pooled one for scripts). Keep it in an environment variable or `.env` file — the `.gitignore` here already excludes `.env`.

Notes: the Free plan has size limits and can pause an idle project — use a paid plan for anything the team depends on. Supabase's Security Advisor may flag the views as "security definer"; that is intentional — the views are the only thing the public dashboard can see.

## Changing things (optional)
Edit the SQL or the CSVs, then in `tools/`: `npm install`, `npm run build` (regenerates `3_sample_data.sql`, `docs/sample-data.js`, the calculated CSVs, the 3D engine bundle `docs/twin3d.bundle.js` and the embedded models `docs/models/models-embedded.js`) and `npm run validate` (180 checks, must end "0 failed").

## The project page (`docs/project.html`)
A short stakeholder page (about 575 words, six screens) separate from the dashboard and the digital twin. It uses only what the project has built and labels every demonstrator figure as example data. Sections: hero, partners, the project, what has been built, a first finding (interactive), roadmap, **funding** and **people involved**.

Partners (Far UK, Cardiff Metropolitan University) and the four named people (Wai Keung Fung, Chaminda Hewage, Jasim Uddin, Udayanga Galappaththi) are in `docs/project-config.js`. Logos: save the official files as `docs/assets/far-uk-logo.png` and `docs/assets/cardiff-met-logo.svg` (or change the paths in the file); until a file exists the organisation name is shown instead. Roles, organisations, bios and photos, the funding section and the contact line are driven by the same file and stay hidden until you fill them in, so nothing is invented:
- `partners`: name, optional `logo` file (official logo supplied by the organisation, following its brand guidelines) and link.
- `fund`: name, funder, programme, reference, award, duration, a two-to-three sentence summary, the funder's acknowledgement wording, logo and link.
- `people`: name, role, organisation, optional bio, photo (`docs/assets/people/…`) and link; grouped by organisation in the order given.
- `contactEmail`, `contactName`, `contactNote`.

To make it the site's front page, rename `docs/index.html` (dashboard) to `dashboard.html` and `docs/project.html` to `index.html`, then set `dashboardUrl` in `project-config.js` to `dashboard.html`. Refresh the images in `docs/assets/` after the demonstrator changes.

Design approach: one type family (system / SF Pro), near-monochrome palette with a single accent used for links and actions, whitespace and short text blocks alternating with real images, no gradients, icon grids, glow, or scroll animation. A check in `npm run validate` keeps it that way.
