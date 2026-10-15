# Digital twin of the factory floor

`docs/twin.html` is a first working **3D** twin built **only from the existing dataset** plus a layout (a flat 2D plan is one click away). Open it from the dashboard link or at `/twin.html`.

## What it does now (level 2 of 4)

| Level | What it means | Status |
|---|---|---|
| 1. Map | The floor drawn from data in 3D: zones, machine models, footprints, process flow | **Done** (`factory_floors`, `factory_zones`, `machine_locations`) |
| 2. Model + live overlay | Parts flow through the machines per route; energy and carbon accumulate; each machine shows live energy vs design (OK / Watch / High) and its latest meter state | **Done** (simulation in `docs/twin-sim.js`, status from `docs/calc.js`) |
| 3. Predictive | Forecast queues, bottlenecks, energy and carbon for tomorrow's plan; test what-ifs (batch size, release rate, idle power, route) before changing the floor | **Started**: what-ifs on parts, release interval, energy source and idle power work; needs real cycle-time spread, batching, shifts |
| 4. Closed loop | The twin recommends and the factory acts (set-points, scheduling), with engineering approval | Not started; the AI-recommendation tables already carry the approval fields |

## How the model works
- A part follows the selected route's operations in order. Each machine processes **one part at a time**, first come first served; waiting parts queue in front of it.
- A part's material carbon (the BOM, from `v_dash_bom`) is counted when it is released; operation time = `route_operations.hours`; energy = design kWh (`hours × kW × utilisation`) or the **metered kWh** when "Live meter readings" is chosen; carbon = kWh × electricity factor + process carbon (the same rules as the LCA, see `CALCULATION_PLAN.md`).
- Moving between machines takes 1.2 minutes (`transitH`); idle machines draw a chosen % of rated power (0 by default). The grey puffs, cable dots and towers are a *visual scale* of the same numbers, not extra physics.
- The page recomputes everything when you change a setting; a scrubber and play/pause move through time. All of this is tested (`npm run validate`, section 6b; includes checks that carbon sources, per-machine energy and per-part footprints add up): one part's energy and carbon equal the LCA operations in the database, no machine is double-booked, live mode equals the metered totals.

## Where it lives and how to open it
The twin is **its own page, `docs/twin.html`**, completely separate from the LCA dashboard (`docs/index.html` is unchanged and does not link to it). It shows only the 3D digital twin full-window, with a small settings panel, play controls and details of whatever you click.

Open it any of these ways:
- **Double-click `docs/twin.html`** (works offline; the 3D engine is a single ordinary script, `twin3d.bundle.js`, because browsers block ES modules on pages opened from a file).
- Locally with a server: `cd docs && python3 -m http.server 8000`, then `http://localhost:8000/twin.html`.
- On GitHub Pages: `https://<your-user>.github.io/<repository>/twin.html`.
It needs a browser with WebGL (any current Chrome, Edge, Firefox or Safari). If the engine cannot start, the page says so instead of staying blank.

## What you see (energy, carbon and LCA in 3D)
1. **Settings panel** (top right, show/hide): route, parts to run, release interval, energy source (design or live meters), idle %, **colour machines by** (running / power now / energy so far / carbon so far / live energy vs design), the **electricity factor** (try a cleaner grid), and whether **materials** count in the footprint. **Play bar** at the bottom: play / pause, restart, speed, scrub through time.
2. **The floor in 3D** with detailed built-in models of each machine type (control cabinets, door rings and bolts, hydraulic rods, light curtains, filters, pipes, conveyors) that **move while they work**, a **stack light** on every machine (green running, amber idle, red live energy far above design), building columns, a materials store and a grid transformer.
3. **Energy you can see:** the transformer feeds a cable to every machine on the route; **yellow dots flow along the cables**, more dots = more kW. In *Energy* mode machines turn from blue to red and **amber towers** grow with energy used.
4. **Carbon you can see:** **grey CO₂e puffs rise from machines** in proportion to the carbon they emit (one puff ≈ 0.03 kg CO₂e); in *Carbon* mode machines and parts darken and **dark towers** grow; a **red ring** marks the carbon hotspot. When an operation finishes, a label floats up with its kWh and kg CO₂e. When a part is released, **material crates fly in from the store**, sized by their carbon and coloured by material (carbon fibre is the big black one).
5. **Parts** fly between machines, queue in front of busy ones, and finished parts stack at the end of the route. **Hover** anything for numbers; **click a machine** (the camera flies to it and a power-over-time chart appears) or **click a part** (its journey, step by step, with a *follow this part* camera).
6. **HUD** (top left): parts finished, power now, emission rate, running energy and carbon, footprint per part (equal to the design LCA of the dashboard: 104.518 kg CO₂e for the vacuum infusion route).
7. **Explore as worker** (bottom right): a humanoid in a hard hat and hi-vis vest appears at the south edge of the floor and you walk the factory yourself.
   - **W A S D** or the arrow keys move (relative to where the camera looks), **Shift** runs, **drag** to look around, **V** switches between third and first person, **Esc** leaves.
   - The worker is solid: machines, the materials store and the transformer block the way, and the walls stop you (it slides along obstacles).
   - Walk up to a machine (within about 3 m) and a **prompt** shows what it is doing; press **E** to open its details (the worker points at it). A cyan ring marks the nearest machine.
   - A **map** (top right) shows where you are; **click the map to jump** to any spot. On touch screens an on-screen pad appears.
   - The simulation keeps running while you walk, so you can stand beside the oven and watch it work, glow and emit.
8. **Edit layout** (bottom right): drag machines on the floor; the page shows the SQL that saves the new positions.

(The extra analysis charts built earlier — carbon-flow diagram, what-if levers, route comparison, Gantt and tables — are no longer on the page. Their data builders remain in `docs/twin-viz.js`, are tested, and can be turned into a separate page if you want them back.)

**What the model says about this sample:** materials are about 94 % of a part's footprint; electricity and process inputs about 6 %. Cutting all machine energy by 20 % would lower the total by well under 1 %, while a cleaner electricity factor or lower-carbon materials move it more. That is the kind of insight the twin is for. (The numbers are the mock-up's example factors, still to be verified.)

## Real machine models (GLB)
Third-party or CAD models are supported as **GLB** files in `docs/models/`, listed in `docs/models/models.json` by machine type or machine name, with optional rotation, height and a **credit**. They are scaled to the footprint in the database, stand on the floor and take the same state / energy / carbon colouring. Currently mapped: **`cnc` → `laser_cnc_machine.glb`** (a gantry CNC from Sketchfab, CC BY 4.0, simplified from 720k to 136k triangles; credit shown on the page and in `docs/models/CREDITS.md`). All other machines use the built-in procedural models. How to add more, optimise heavy files and embed them: `docs/models/README.md`.

## Run it
- Controls: drag = rotate, right-drag = pan, **Ctrl + scroll (or pinch) = zoom**, or use the ＋/− buttons.
- The 3D engine (three.js, MIT licence) is bundled, so it works offline and on GitHub Pages. If you edit `docs/twin3d.js`, rebuild the bundle with `cd tools && npm install && npm run bundle`.
- Locally: `cd docs && python3 -m http.server 8000`, then open `http://localhost:8000/twin.html`.
- Database: run `supabase/4_digital_twin.sql` after files 1–3, then `supabase/5_digital_twin_sample_data.sql` (sample layout). For the public page to read them, re-run `6_public_read_access.sql`. With Supabase configured in `config.js`, the twin refreshes its data every 30 seconds.

## What the dataset cannot tell a twin yet
The **layout is a simulated placeholder** (the sample hall, zones and machine sizes are invented). The dataset also has no information on:

| Missing | Why a twin needs it | How to capture it |
|---|---|---|
| Real floor plan, machine footprints, walking/transport paths | Distances, congestion, safety zones | CAD drawing or measured sketch → `factory_zones`, `machine_locations` (drag-and-save works today) |
| Real-time power curves (kW every few seconds) | Today there is one kWh per operation; a twin shows power rising and falling, idle and standby | Energy meters / gateways writing time-stamped rows to `sensor_readings` (a `power_kw` reading per machine) |
| Machine state from the machine itself (running, setup, fault) | The model assumes machines are either busy or idle | PLC / OPC UA / MQTT state → readings with `machine_state` |
| Batch behaviour of ovens, autoclave, presses | These process several parts per cycle, not one | Cycle logs: components per load, programme, start/finish → a `production_runs` table |
| Real cycle-time spread, setup and changeover times, scrap and rework | Queues and throughput depend on variation, not averages | Production records (MES or logbook) |
| Shifts, breaks, operators, maintenance windows | Machines are not available 24 h | Shift calendar table |
| Buffers and transport (trolleys, forklifts, conveyors) | Waiting and moving time | Floor survey |
| Temperatures, pressures, vacuum levels | Cure quality and energy drivers | Additional sensors; temperature/pressure readings |

## Path to a live twin
1. **Replace the placeholder layout** with the real plan (drag machines on the page, save the SQL).
2. **Install meters on the machines named in the process document** (ply cutter, vacuum pump, ovens, trimming and extraction, press, freezer) and write readings into `sensor_readings` (a gateway or a small script posting to Supabase).
3. **Let the twin read time-stamped readings** (instead of the per-operation sums) so machines glow with their real state and power.
4. **Calibrate**: compare the model's schedule and energy with what actually happened, correct hours and utilisation, and keep the comparison in `lca_comparison` so the baseline improves with every production run.
5. **Add batch ovens, shifts and variation**, then use the twin to test scheduling (for example loading the oven fully, batching trimming, switching off idle extraction) before changing the real floor.
6. **Governance**: any recommendation that could change quality (cure time, temperature, pressure) stays behind engineering approval, as in the AI recommendation tables.

## Decisions for the team
1. The 3D models are simple stand-ins per machine type. Do you want real CAD models of the machines (importable as glTF) and the building? They would attach to the same `machine_locations` rows.
2. How often will machines report (seconds, minutes, per cycle)? That sets whether Supabase alone is enough or a time-series database becomes worthwhile.
3. Who owns the layout and keeps it current?
4. Should the twin stay read-only, or later send instructions to machines? (We recommend read-only until the model has been calibrated.)
