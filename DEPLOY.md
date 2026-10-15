# Host the web app on GitHub Pages with live data from Supabase

You will end up with three public web pages on one address, all reading the same database:

| Page | Address (after setup) | What it is |
|---|---|---|
| **LCA comparison dashboard** | `https://<your-user>.github.io/<repository>/` | the original dashboard (route comparison, BOM, design baseline, live comparison, AI prompt) |
| **Digital twin** | `.../twin.html` | the 3D factory floor, energy, carbon, walk-around worker |
| **Project page** | `.../project.html` | the stakeholder page for the project, with buttons to the other two |

```
 your browser ──▶ GitHub Pages (static files, free)  ──reads──▶  Supabase (PostgreSQL + public REST API)
                  index.html · twin.html · project.html          your tables stay private; only read-only
                  config.js holds the Supabase URL + public key   "views" are readable with the public key
```

Time needed: about 30 minutes, no coding. You need a free Supabase account and a free GitHub account.

---

## Part 1 — Supabase (the database)

**1. Create the project**
1. Go to **supabase.com** → sign in → **New project**.
2. Name it (for example `lca-factory`), choose a **region** your data policy allows, and set a **strong database password**. Save the password in a password manager; you will not see it again.
3. Click **Create** and wait about a minute until the project is ready.

**2. Create the tables and load the example data**
Open **SQL Editor** (left menu) → **New query**. For each file below, in this exact order: open the file from the `supabase` folder of this project, select all, copy, paste into the editor, press **Run** and wait for "Success" before the next one.

| Order | File | What it does |
|---|---|---|
| 1 | `1_schema.sql` | creates the 18 tables |
| 2 | `2_views_and_security.sql` | calculations (views), the dashboard's button functions, security |
| 3 | `3_sample_data.sql` | the example data (composite panel, four routes, live readings) |
| 4 | `4_digital_twin.sql` | the factory-floor layout tables |
| 5 | `5_digital_twin_sample_data.sql` | the example floor layout |
| 6 | `6_public_read_access.sql` | **lets the hosted pages read the dashboard and twin views** (nothing else) |

Run `6` **last**. Supabase may warn that the file contains `revoke` statements: that is expected, click **Run this query**.

If you ran older versions of these files before, run `0_reset_database.sql` first (it deletes the old tables and their data), then 1 to 6.

**3. Check it worked**
- Run `select scenario_name, design_total_kgco2e, live_total_kgco2e from v_scenario_summary;` → 4 rows; the first is about **104.518** design and **105.290** live.
- Run `select count(*) from v_dash_floor_machines;` → **13**.

**4. Copy the two values the web pages need**
1. **Project Settings → API** (in newer projects: **Project Settings → API Keys**).
2. Copy the **Project URL**, for example `https://abcdefghijkl.supabase.co`.
3. Copy the **public** key: the one called **anon / public** (long text starting `eyJ…`) or **Publishable key** (starts `sb_publishable_…`). Either works.
4. **Never** copy the **service_role** or **secret** key into the website. It gives full control of your database.

**5. Prove the security is right (optional, 1 minute)**
Open these in a browser tab (replace the two placeholders). The first must show data, the second must be refused:
```
https://<project-ref>.supabase.co/rest/v1/v_dash_scenarios?select=scenario_name&apikey=<public-key>
https://<project-ref>.supabase.co/rest/v1/materials?select=*&apikey=<public-key>
```
The first lists the four routes. The second answers `permission denied for table materials`: your tables are private; only the read-only views are public. (If your browser reports a missing key instead, skip this check; the dashboard in Part 2 proves the same thing.)

---

## Part 2 — GitHub (the website)

**1. Create the repository**
1. Go to **github.com** → **+** (top right) → **New repository**.
2. Name it, for example `lca-factory-twin`. Choose **Public** (GitHub Pages is free for public repositories; private ones need a paid plan). Click **Create repository**.

**2. Upload the project**
1. Unzip `lca-database.zip` on your computer.
2. On the empty repository page click **uploading an existing file**.
3. Drag in **everything inside the unzipped folder** (the folders `docs`, `supabase`, `data`, `tools` and the files `README.md`, `DEPLOY.md`, …). Keep the folders as they are. **Do not** upload a `node_modules` folder.
4. Scroll down and click **Commit changes**.
   (About 70 files: under GitHub's limit of 100 per upload. If GitHub complains, upload `docs` first, then the rest.)

*Prefer the command line?* From inside the unzipped folder:
```bash
git init && git add . && git commit -m "LCA factory twin"
git branch -M main
git remote add origin https://github.com/<your-user>/<repository>.git
git push -u origin main
```

**3. Connect the website to your database**
1. In the repository open `docs/config.js` → click the **pencil icon** (edit).
2. Paste your two values between the quotes:
   ```js
   window.DASHBOARD_CONFIG = {
     SUPABASE_URL: "https://abcdefghijkl.supabase.co",
     SUPABASE_ANON_KEY: "eyJ...your public key..."
   };
   ```
3. Click **Commit changes**.

**4. Switch on GitHub Pages**
1. Repository **Settings → Pages**.
2. Under **Build and deployment**, **Source**: **Deploy from a branch**.
3. **Branch**: `main`, folder: **`/docs`** → **Save**.
4. Wait 1 to 2 minutes and refresh the page. A banner shows your address: `https://<your-user>.github.io/<repository>/`.

**5. Open and check**
- `https://<your-user>.github.io/<repository>/` → the dashboard. The line under the title must say **"Live data from Supabase"**.
- `…/twin.html` → the digital twin. The top-left box must say **"● Live data from Supabase"**. Press **Play**, or click **Explore as worker**.
- `…/project.html` → the project page; its buttons open the dashboard and the twin.

**6. See the live link working**
In Supabase SQL Editor run `update lca_scenarios set electricity_factor = 0.1 where scenario_id = 1;`, reload the dashboard: the carbon figures for the vacuum infusion route drop. The twin picks up changes within 30 seconds. Put it back with `0.26155`.

---

## Changing things later
- **Edit a page or setting:** open the file in GitHub → pencil → **Commit changes**. The site updates in about a minute (press Ctrl+Shift+R to bypass the cache).
- **Change the data:** edit the tables in Supabase (Table Editor or SQL). No GitHub change is needed.
- **Make the project page the home page:** in `docs`, rename `index.html` to `dashboard.html` and `project.html` to `index.html`, then in `docs/project-config.js` set `dashboardUrl: "dashboard.html"`.
- **Replace the example data with real data:** read the next section first.

## Security: what the public can see
- The website is public and `config.js` shows the Supabase URL and public key, so **anyone can read the ten dashboard views and three twin views** that file `6` opened. They cannot read your tables, write anything, or see saved prompts.
- Keep **example data only** on a database wired to a public site. Before real company data goes in, either run the `UNDO` block at the bottom of `6_public_read_access.sql` and blank `config.js` (the pages then show built-in sample data), or add a login first (Supabase Auth) — ask and I will add it.
- Never commit passwords, the service/secret key, or Excel files with real data (`.gitignore` already blocks `.env` and Excel files).

## If something does not work
| Symptom | Likely cause and fix |
|---|---|
| Pages address shows 404 | Settings → Pages not saved, folder is not `/docs`, repository is private, or you are inside the 2-minute wait |
| Page says "Simulated sample data" / "Built-in sample data" | `config.js` is still empty, or the edit was not committed |
| "Supabase unreachable: showing sample data" | wrong URL or key (copy again, no spaces or quotes inside), the free project is **paused** (open the Supabase dashboard and click Restore), or file `6` was not run (re-run it) |
| Dashboard works, twin has no machines | files 4 and 5 were not run, or `6` was run **before** `4` (run `6` again) |
| Twin shows a message instead of 3D | the browser has no WebGL (try current Chrome, Edge, Firefox or Safari with hardware acceleration) |
| Old numbers after a change | hard refresh (Ctrl+Shift+R); Supabase data changes show immediately, file edits after about a minute |
| Free Supabase project stops after a week of no use | Supabase pauses idle free projects: open the dashboard and click **Restore project**; or move to a paid plan for anything the team depends on |

## Rehearse it on your own computer first (optional)
```bash
cd tools && npm install
npm run mock-supabase          # a stand-in for Supabase that answers exactly like the public key would
```
In a copy of `docs`, set `config.js` to `SUPABASE_URL: "http://localhost:54321"` and any text as the key, serve it with `cd docs && python3 -m http.server 8000`, and open `http://localhost:8000`. The pages should say "Live data from Supabase". This is how the hosted setup was tested.
