# Host the web app on GitHub Pages with live data from Supabase

You will end up with three public web pages on one address, all reading the same database:

| Page | Address (after setup) | What it is |
|---|---|---|
| **Home / sign-in** | `https://<your-user>.github.io/<repository>/` | landing page: team members sign in (no registration), then open the pages below |
| **LCA comparison dashboard** | `…/dashboard.html` | the original dashboard (route comparison, BOM, design baseline, live comparison, AI prompt) |
| **Digital twin** | `.../twin.html` | the 3D factory floor, energy, carbon, walk-around worker |
| **Project page** | `.../project.html` | the stakeholder page for the project, with buttons to the other two |

```
 your browser ──▶ GitHub Pages (static files, free)  ──reads──▶  Supabase (PostgreSQL + public REST API)
                  index · dashboard · twin · project · admin          your tables stay private; only read-only
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
| 7 | `7_sensor_ingest.sql` | *optional*: lets a sensor or script send readings with a device token (see Part 3) |
| 8 | `8_users_and_roles.sql` | *optional, for the team page `admin.html`*: sign-in roles (admin, editor, viewer), **Add project** and the admin dashboard (see Part 4) |

Run `6` last of the website files (`7` and `8` are optional and come after it). Supabase may warn that the file contains `revoke` statements: that is expected, click **Run this query**.

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
1. Unzip `lca-github-site.zip` on your computer.
2. On the empty repository page click **uploading an existing file**.
3. Drag in **everything inside the unzipped folder**: `index.html`, `dashboard.html`, `twin.html`, `project.html`, `admin.html`, the other `.js` files, and the folders `assets`, `models` and `supabase`. Keep the folders as they are. The website files sit directly in the repository (not inside a `docs` folder), so `index.html` is at the top level.
4. Scroll down and click **Commit changes**.
   (About 30 files: well under GitHub's limit of 100 per upload.)

*Prefer the command line?* From inside the unzipped folder:
```bash
git init && git add . && git commit -m "LCA factory twin"
git branch -M main
git remote add origin https://github.com/<your-user>/<repository>.git
git push -u origin main
```

**3. Connect the website to your database**
1. In the repository open `config.js` → click the **pencil icon** (edit).
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
3. **Branch**: `main`, folder: **`/ (root)`** → **Save**.
4. Wait 1 to 2 minutes and refresh the page. A banner shows your address: `https://<your-user>.github.io/<repository>/`.

**5. Open and check**
- `https://<your-user>.github.io/<repository>/` → the home page with a sign-in box (no register button). Sign in with your administrator e-mail: you get tiles for every page.
- `…/dashboard.html` → the dashboard. The line under the title must say **"Live data from Supabase"**.
- `…/twin.html` → the digital twin. The top-left box must say **"● Live data from Supabase"**. Press **Play**, or click **Explore as worker**.
- `…/project.html` → the project page; its buttons open the dashboard and the twin.

**6. See the live link working**
In Supabase SQL Editor run `update lca_scenarios set electricity_factor = 0.1 where scenario_id = 1;`, reload the dashboard: the carbon figures for the vacuum infusion route drop. The twin picks up changes within 30 seconds. Put it back with `0.26155`.

---

## Part 3 — Simulate a sensor from Google Colab (optional)

A script that pretends to be the energy meters on your machines and sends readings to the database. The dashboard and the twin then show them as live data. Real meters or a gateway can use the same call later.

```
 Google Colab script ──POST──▶ Supabase function ingest_reading  ──stores──▶ table sensor_readings ──▶ dashboard + twin
   (device token)              (checks the token, nothing else can be written)
```

**1. Switch it on in Supabase**
1. SQL Editor → run `supabase/7_sensor_ingest.sql`.
2. Run `select create_ingest_token('colab-simulator');`. Copy the long text it returns **now**: only a scrambled copy is stored, so it cannot be shown again. (Lost it? Make another one.)

**2. Open the script in Colab**
1. Go to **colab.research.google.com**.
2. Either **File → Upload notebook** and choose `colab/sensor_simulator.ipynb`, or open it straight from your repository: **File → Open notebook → GitHub** tab, paste your repository address, pick `colab/sensor_simulator.ipynb`.
3. Click the **key icon** (Secrets) in the left bar and add three secrets, switching **Notebook access** on for each:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_ANON_KEY` | your public key |
| `DEVICE_TOKEN` | the text from step 1 |

**3. Run it**
**Runtime → Run all.** After a few seconds it prints one line per operation (machine, sensor, design kWh, kWh sent, difference), for example the oven about 40 % above its design value. The settings cell lets you change the route (`SCENARIO_ID`), the number of runs, the speed, the noise and how far each machine runs above design.

**4. See it on the website**
- Dashboard: reload the page. The live total and the comparison table use the new readings.
- Twin: set **Energy per operation** to **Live meter readings**. It reloads its data every 30 seconds; the pads under hot-running machines turn amber or red.

**How the numbers are used.** All readings of one run share a `run_label`, and the website uses the **latest run** of each route. A new run therefore replaces the old one instead of adding to it.

**What the token allows.** Only `ingest_reading`: add one energy reading. It cannot read tables, change or delete anything. Keep it in Colab Secrets, never in GitHub. To switch it off: `update ingest_tokens set active = false where label = 'colab-simulator';`. Anyone holding it can add false readings, so treat it like a password.

**Real sensors later.** The same web call works from a gateway, a Raspberry Pi or any device that can send an HTTPS request:
```bash
curl -X POST "https://<project-ref>.supabase.co/rest/v1/rpc/ingest_reading" \
  -H "apikey: <public key>" -H "Content-Type: application/json" \
  -d '{"p_token":"<device token>","p_scenario_id":1,"p_route_operation_id":2,"p_sensor_code":"MTR-OVN-PPSS","p_kwh":1.2,"p_machine_state":"running","p_run_label":"B-2026-0001"}'
```
(If your public key is the long `eyJ…` type, also add `-H "Authorization: Bearer <public key>"`.) It answers with the id of the stored reading.

**If it fails**
| Message | Meaning |
|---|---|
| `invalid or inactive device token` | wrong or switched-off token: create a new one |
| `permission denied for function ingest_reading` | file `7` was not run |
| `operation … is not part of the route of scenario …` | the sensor was sent for an operation of another route: check `SCENARIO_ID` |
| `sensor … belongs to another machine` | that sensor code is already registered to a different machine |
| `Invalid API key` / 401 | wrong `SUPABASE_URL` or `SUPABASE_ANON_KEY` |

Each reading is one web request (a run of the example route sends 30). That is fine for demonstrations and cycle-level data; for readings every second per machine, send them in batches (ask and I will add that).

---

## Part 4 — Team sign-in, adding projects and the admin dashboard (optional)

`index.html` is the home page: people sign in there (accounts only come from you, there is no register button) and get tiles for the dashboard, twin, project page and `admin.html`. On `admin.html` they can **add a project** (project, first part, one scenario per route with the example bill of materials), change project status, and, for administrators, an **admin dashboard** (counts, data health, carbon by scenario, users and roles, recent activity, delete a project).

1. In the SQL Editor run `8_users_and_roles.sql` (after 1 to 6; run it again after any later re-run of file 2).
2. **Authentication → Users → Add user → Create new user**: e-mail, password, tick *Auto confirm user*. Make one for yourself and one for each team member.
3. **Authentication → Sign In / Providers → turn OFF "Allow new users to sign up"** so nobody can register themselves.
4. Make yourself the first administrator (SQL Editor, replace the address):
   ```sql
   insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
   ```
5. Open the home page, sign in, and click **Admin dashboard**. On **Admin dashboard → Users and roles** give the others a role: **viewer** reads, **editor** also adds and edits projects, **admin** also manages users and deletes projects. An account with no role can sign in but sees nothing.

The rules live in the database (not in the page), so the public key still cannot read your tables or call these functions. The sign-in password is sent to Supabase only; nothing is stored on GitHub.

---

## Changing things later
- **Edit a page or setting:** open the file in GitHub → pencil → **Commit changes**. The site updates in about a minute (press Ctrl+Shift+R to bypass the cache).
- **Change the data:** edit the tables in Supabase (Table Editor or SQL). No GitHub change is needed.
- **Replace the example data with real data:** read the next section first, then run `supabase/clear_sample_data.sql` and load your data. The example data came from `supabase/3_sample_data.sql`; you do not need any CSV files for the website.

## Security: what the public can see
- **The sign-in controls the team tools (`admin.html`: projects, users, roles). It does not hide the dashboard and twin pages:** anyone who types `…/dashboard.html` or `…/twin.html` can open them and read the example data through the public key (file `6`). That is fine for example data. To make them sign-in-only, run the `UNDO` block of file `6` and ask for the pages to be switched to the signed-in token.
- The website is public and `config.js` shows the Supabase URL and public key, so **anyone can read the ten dashboard views and three twin views** that file `6` opened. They cannot read your tables, write anything, or see saved prompts.
- Keep **example data only** on a database wired to a public site. Before real company data goes in, either run the `UNDO` block at the bottom of `6_public_read_access.sql` and blank `config.js` (the pages then show built-in sample data), or keep the example data public and use Part 4 for the team's real work (roles stop signed-in strangers, but the public views in file `6` stay readable by anyone until you run its `UNDO` block).
- Never commit passwords, the service/secret key, or Excel files with real data (`.gitignore` already blocks `.env` and Excel files).

## If something does not work
| Symptom | Likely cause and fix |
|---|---|
| Pages address shows 404 | Settings → Pages not saved, folder is not `/ (root)`, repository is private, or you are inside the 2-minute wait |
| Page says "Simulated sample data" / "Built-in sample data" | `config.js` is still empty, or the edit was not committed |
| "Supabase unreachable: showing sample data" | wrong URL or key (copy again, no spaces or quotes inside), the free project is **paused** (open the Supabase dashboard and click Restore), or file `6` was not run (re-run it) |
| Dashboard works, twin has no machines | files 4 and 5 were not run, or `6` was run **before** `4` (run `6` again) |
| Twin shows a message instead of 3D | the browser has no WebGL (try current Chrome, Edge, Firefox or Safari with hardware acceleration) |
| Old numbers after a change | hard refresh (Ctrl+Shift+R); Supabase data changes show immediately, file edits after about a minute |
| Free Supabase project stops after a week of no use | Supabase pauses idle free projects: open the dashboard and click **Restore project**; or move to a paid plan for anything the team depends on |
