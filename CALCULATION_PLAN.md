# Calculation plan

How the carbon footprint (GWP) and energy demand (CED) of a manufacturing route are calculated, compared with live meter data, and checked.
The same rules are implemented twice and tested against each other: in SQL (`supabase/2_views_and_security.sql`) and in JavaScript (`docs/calc.js`, used by the dashboard).
The rules come from the team's dashboard mock-up (`manufacturing_lca_comparison_html_example.html`).

## 1. Scope

| Stage | Question answered | Needs |
|---|---|---|
| **Stage 1 – design baseline** | What is the carbon and energy footprint of one finished part for each manufacturing route, before any production? | Part, scenario (route), BOM, route operations, approved material factors |
| **Stage 2 – live comparison** | How does measured energy compare with the plan, per operation? | Scenario, energy-meter readings tagged to operation (batch/run label optional) |
| **Stage 3 – AI support** | Where are the hotspots and what should be investigated? | Stage 1 + 2 results; AI only interprets, never calculates |

Functional unit: **one finished part** (`parts.functional_unit`). System boundary in the sample: cradle-to-gate (materials + manufacturing + assembly + finishing). Use, maintenance and end of life exist as life-cycle stages but are not calculated yet.

## 2. Inputs

| Input (dashboard label) | Table.field | Notes |
|---|---|---|
| Mass used, Waste % | `bom_items.mass_kg`, `waste_percent` | kg per finished part; waste is % added on top |
| Material factors | `materials.cf_kgco2e_per_kg`, `ced_mj_per_kg`, `approved` | per kg; only approved rows count |
| Hours, kW, Util. | `route_operations.hours`, `kw`, `utilisation` | per part; `expected_kwh` is calculated by the database |
| Process kg CO₂e/kg × mass basis | `route_operations.process_cf_per_kg`, `mass_basis_kg` | process carbon, independent of electricity |
| Electricity factor | `lca_scenarios.electricity_factor` | kg CO₂e per kWh |
| Live variance alert % | `lca_scenarios.alert_threshold_percent` | |
| Actual sensor kWh | `sensor_readings.kwh` (+ `route_operation_id`, `sensor_code`, `machine_state`) | kWh per operation for the scenario |
| Dimensions | `parts.length_mm`, `width_mm`, `thickness_mm` | plan area and volume only |
| Expected scrap %, Quantity | `lca_scenarios.expected_scrap_percent`, `quantity` | stored, not used in totals (as in the mock-up) |

## 3. Stage 1 – design baseline (per finished part)

1. **Gross material** = `net × (1 + waste % / 100)`
2. **Material carbon** = `gross × GWP per kg`;  **material energy demand** = `gross × CED per kg`
3. **Operation energy** = `hours × kW × utilisation` (kWh per part) — stored by the database as `route_operations.expected_kwh`
4. **Operation carbon** = `kWh × electricity_factor` + `process_mass_basis × process factor`
5. **Operation energy demand** = `kWh × 3.6` (MJ per kWh of electricity; processes add no CED in this version)
6. **Grouping**
   - Materials = all BOM lines
   - Manufacturing = operations in the *Manufacturing* stage
   - Assembly + finishing = operations in every other stage
7. **Design total (kg CO₂e)** = materials + manufacturing + assembly + finishing
   **Design energy demand (MJ)** = material MJ + Σ operation MJ

Rule applied to every material lookup:
- only materials with `approved = true` are used (factors are per kg, BOM masses are in kg);
- a BOM line whose material is not approved adds **nothing** and is listed in `v_missing_factors` — the dashboard and report must show this warning next to any total.

### Worked example (sample data, vacuum infusion route, electricity factor 0.26155)

| Line | Working | kg CO₂e |
|---|---|---|
| Carbon fibre | 2.0 × 1.05 = 2.1 kg × 43.87 | 92.127 |
| Vinyl ester resin | 1.0 × 1.03 = 1.03 kg × 4.59 | 4.728 |
| Adhesive 1 | 0.05 × 1.02 = 0.051 kg × 6.20 | 0.316 |
| Peel ply | 0.08 × 1.20 = 0.096 kg × 3.00 | 0.288 |
| Vacuum bagging film | 0.12 × 1.15 = 0.138 kg × 2.50 | 0.345 |
| Paint 1 | 0.10 × 1.20 = 0.12 kg × 6.00 | 0.720 |
| Cardboard packaging | 0.20 × 1.00 = 0.20 kg × 0.90 | 0.180 |
| **Materials** | | **98.704** |
| Vacuum infusion | 2.0 h × 0.75 kW × 0.80 = 1.20 kWh × 0.26155 = 0.314; + 3.0 kg × 1.17 = 3.510 | 3.824 |
| Oven cure | 2.5 × 3.2 × 0.62 = 4.96 kWh × 0.26155 | 1.297 |
| **Manufacturing** | | **5.121** |
| CNC trimming | 0.4 × 5.0 × 0.55 = 1.10 kWh × 0.26155 | 0.288 |
| Adhesive bonding | 0.2 × 0.5 × 0.5 = 0.05 kWh × 0.26155 | 0.013 |
| Paint application | 0.5 × 4.0 × 0.75 = 1.50 kWh × 0.26155 | 0.392 |
| **Assembly + finishing** | | **0.693** |
| **Design total** | 98.704 + 5.121 + 0.693 | **104.518 kg CO₂e** |

Energy demand: materials 2245.3 MJ + electricity 8.81 kWh × 3.6 = 31.7 MJ = **2277.0 MJ**.
The dashboard prints this working live (section 9) for whichever route is selected.

## 4. Stage 2 – design vs live

1. **Live kWh per operation** = sum of the energy readings tagged with that operation. If there are none, use the design kWh and flag *"No live data: baseline used"*.
2. **Variance** = live − design (kWh);  **variance %** = variance ÷ design × 100.
3. **Status** (alert threshold *T*, default 15 %): variance % > *T* → **High energy**; > *T*/2 → **Watch**; otherwise **OK**.
4. **Live carbon per operation** = `live kWh × electricity_factor + process carbon` (process carbon is unchanged: it depends on material, not energy).
5. **Live total** = materials + Σ live operation carbon;  **variance (kg CO₂e)** = live total − design total;  **extra kWh** = Σ live − Σ design.
6. Materials are kept **separate** from the live energy variance unless actual material consumption is recorded.

Sample: live meter kWh 1.45 / 6.90 / 1.38 / 0.08 / 1.95 → 11.76 kWh vs 8.81 planned = +2.95 kWh; live total 105.290 vs 104.518 kg CO₂e (+0.772). Oven cure is +39.1 % → High energy.

Saved version of the same comparison: `save_comparison(scenario_id)` writes the KPI boxes to `lca_snapshots` and the table to `lca_comparison`, so the AI prompt and recommendations always refer to numbers that cannot change afterwards.

## 5. Rules still to be decided before real production data (Stage 2 allocation)

| Topic | Why it matters | Proposed rule |
|---|---|---|
| Energy per part from a batch meter | A meter reads a whole cycle or shift, the design number is per part | live kWh per part = batch operation kWh ÷ parts made in that run (a production-run table is not in the schema yet) |
| Ovens, press, freezer shared by several parts | The step-by-step process records "number of components in the oven" | energy per part = cycle kWh ÷ components in that cycle; record the load in the batch |
| Extra pump energy during oven cure | Vacuum pump runs on top of the oven | meter the pump separately; add as its own operation line against the same cycle |
| Idle, standby, fault energy | Inflates live energy without making product | keep `machine_state` on every reading; report running vs non-running separately; decide whether idle is allocated to parts |
| Scrap and rework | Scrap parts consumed energy and material | scrap energy stays in the batch total; report per good part |
| Process carbon | Currently a factor × kg basis only | confirm with the workbook whether process CED/GWP should be per kg, per minute or per part |
| Waste convention | Dashboard adds waste on top (`net × (1 + w)`) | keep; confirm against the workbook |
| Electricity CED | 3.6 MJ per kWh is final energy, not primary | decide if a primary-energy factor is wanted |

## 6. Mapping the step-by-step process to operations and meters

From `Step by stpe process (1).docx`. Each step becomes a row in `route_operations` (machine in `machines`, meter in `sensors` where there is power to measure). Real hours, utilisation and factors must be supplied by the company; the sample scenarios use the mock-up's numbers instead.

| # | Step | Equipment (note) | Capture | Meter range |
|---|---|---|---|---|
| 1 | Cutting materials | Ply cutter | cutting time, machine ID, kWh | power up to 11 kW |
| 2 | Layup and infusion preparation | none (manual) | time (labour only) | — |
| 3A | Vacuum test and resin infusion | Vacuum pump, catch pot, gauge, scales | pump ID, pressure, run time, kWh | pump up to 1 kW |
| 3B | Initial cure | Oven 1 + vacuum pump | cure programme, target/actual temperature, ramp/hold/cool times, cycle start/finish, kWh per cycle, components in oven, extra pump kWh | oven temp up to 100 °C; pump up to 1 kW |
| 4 | Demoulding | none (manual) | time | — |
| 5 | Trimming | Trimming tool, dust extraction | equipment ID, time, kWh tool + extraction, mass before/after, offcut and dust waste, rework | tool up to 0.5 kW; extractor up to 3 kW |
| 6 | Foam fitting and bonding | Glue gun / applicator | foam type/density/mass, adhesive batch, quantity used and wasted, time, kWh or air | up to 50 W |
| 7 | Finishing (to be confirmed) | Saw / sander + extraction | operation, time, kWh, blade/abrasive use, material removed | saw up to 1.5 kW |
| 8 | Post-curing | Oven 2 | programme, temperatures, times, kWh per cycle, components, energy per component | oven temp up to 300 °C; power up to 3 kW |
| 9 | Freezer (additional) | Freezer | temperature, kWh | down to −15 °C; up to 3 kW |
| 10 | Press (additional) | Press | temperature, kWh | up to 250 °C; up to 32 kW |

Database fit: operation time/kWh → `route_operations`, `sensor_readings`. Programme, temperatures, pressures, masses before/after trimming and the number of components in an oven are **not yet in the schema** (the mock-up has no fields for them): they would need extra columns or tables (for example a `production_runs` table with components per cycle, and temperature readings) once the team confirms what to capture.

## 7. Validation plan

1. **Hand check** one route end to end (section 3 table) and agree it with the engineers.
2. **Reconcile to the company workbook**: same route, same factors, totals must agree to 3 decimals.
3. **Automated tests** (`npm run validate`, 100 checks): the database totals equal a literal re-implementation of the mock-up's calculation for all four routes; `docs/calc.js` equals the SQL views; missing factors, unit mismatches, bad values and permissions are tested.
4. **Dashboard self-check**: section 5 shows the database result next to the page's own calculation and says whether they match; any difference means the BOM or electricity factor was edited on the page.
5. **Version every result**: `lca_snapshots.calculation_version` + `calculated_at`; when a material factor changes, record the change (new version) before re-running; saved snapshots keep the old numbers.
6. **Re-validate** after any change to a factor, a formula or the schema, and before any figure leaves the team.

## 8. Limits of this version
Cradle-to-gate only; one factor per material (no validity dates or versions yet); processes carry GWP only; no uncertainty ranges (the `data_quality` field is descriptive); electricity factor is one number per scenario (no time-of-day or location variation).
