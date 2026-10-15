// npm run validate — runs the SQL on an in-memory PostgreSQL and checks it against the dashboard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newDb, loadCsvs, csvFiles, tableOf, readCsv, SQL_DIR, ROOT } from './lib.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { c ? passed++ : failed++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };
const near = (a, b, t = 1e-6) => Math.abs(Number(a) - Number(b)) <= t;

const db = await newDb();
const counts = await loadCsvs(db);
console.log(`schema applied; ${Object.values(counts).reduce((a, b) => a + b, 0)} CSV rows loaded into ${Object.keys(counts).length} tables`);
const rows = async (sql) => (await db.query(sql)).rows;
const cols = async (t) => (await rows(`select attname from pg_attribute where attrelid = 'public.${t}'::regclass and attnum > 0 and not attisdropped and attgenerated = '' order by attnum`)).map((r) => r.attname);
const allCols = async (t) => (await rows(`select attname from pg_attribute where attrelid = 'public.${t}'::regclass and attnum > 0 and not attisdropped`)).map((r) => r.attname);

// ---- 1. the database covers every table named in section 10 of the mock-up, and its inputs
console.log('\n[1] database covers what the dashboard needs');
const NEEDS = {
  projects: ['project_name'],
  parts: ['part_number', 'part_description', 'functional_unit', 'length_mm', 'width_mm', 'thickness_mm'],
  lca_scenarios: ['electricity_factor', 'expected_scrap_percent', 'quantity', 'alert_threshold_percent', 'route_id'],
  bom_items: ['material_id', 'stage', 'mass_kg', 'waste_percent', 'consumed_kg'],
  materials: ['material_name', 'material_type', 'cf_kgco2e_per_kg', 'ced_mj_per_kg'],
  layup_schedule: ['ply_count', 'orientation_deg', 'fabric_type', 'resin_ratio_percent', 'scrap_percent'],
  manufacturing_routes: ['route_code', 'route_name'],
  route_operations: ['op_no', 'stage', 'process_name', 'machine_id', 'hours', 'kw', 'utilisation', 'expected_kwh', 'process_cf_per_kg', 'mass_basis_kg'],
  sensor_readings: ['route_operation_id', 'sensor_code', 'kwh', 'machine_state'],
  lca_comparison: ['design_kwh', 'live_kwh', 'variance_kwh', 'variance_percent', 'status', 'design_kgco2e', 'live_kgco2e'],
  ai_recommendations: ['recommendation_text', 'action_owner', 'estimated_kwh_saving', 'estimated_co2e_saving', 'validation_status'],
  ai_prompts: ['context', 'prompt_text'], ai_prompt_templates: ['role_text', 'task_text', 'questions_text', 'constraints_text'],
  lca_snapshots: ['design_total_kgco2e', 'live_total_kgco2e', 'variance_kgco2e', 'extra_kwh'], machines: ['machine_name'], sensors: ['sensor_code'],
};
for (const [t, need] of Object.entries(NEEDS)) {
  const have = await allCols(t);
  ok(need.every((c) => have.includes(c)), `${t}: ${need.join(', ')}`);
}
const tables = (await rows(`select tablename from pg_tables where schemaname = 'public'`)).length;
console.log(`      (${tables} tables in total)`);

// ---- 2. every CSV matches its table
console.log('\n[2] CSV headers = table columns (calculated columns left out)');
for (const f of csvFiles()) ok((await cols(tableOf(f))).join(',') === readCsv(f).columns.join(','), `${f}`);

// ---- 3. the mock-up's own calculation, re-implemented literally
console.log('\n[3] database totals = the team\'s example dashboard calculation');
const GRID = 0.26155;
const EX_MAT = { carbon: [43.87, 998], vinyl: [4.59, 107.9], adh1: [6.2, 140], peel: [3.0, 70], bag: [2.5, 60], paint: [6.0, 115], pack: [0.9, 12] };
const EX_BOM = [['carbon', 2.0, 5], ['vinyl', 1.0, 3], ['adh1', 0.05, 2], ['peel', 0.08, 20], ['bag', 0.12, 15], ['paint', 0.10, 20], ['pack', 0.20, 0]];
const EX_ROUTES = [   // [stage, hours, kW, util, processCf, massBasis]
  [['M', 2.0, 0.75, 0.8, 1.17, 3], ['M', 2.5, 3.2, 0.62, 0, 0], ['A', 0.4, 5, 0.55, 0, 0], ['A', 0.2, 0.5, 0.5, 0, 0], ['F', 0.5, 4, 0.75, 0, 0]],
  [['M', 0.8, 1.5, 0.6, 1.30, 3], ['M', 1.2, 10, 0.65, 0, 0], ['A', 0.3, 5, 0.55, 0, 0], ['A', 0.2, 0.2, 0.4, 0, 0], ['F', 0.5, 4, 0.75, 0, 0]],
  [['M', 0.3, 0.2, 0.5, 0.20, 3], ['M', 0.8, 12, 0.65, 0.95, 3], ['A', 0.25, 5, 0.55, 0, 0], ['F', 0.25, 0.8, 0.5, 0, 0], ['F', 0.2, 0, 0, 0, 0]],
  [['M', 1.0, 0.75, 0.8, 0, 0], ['M', 3.0, 25, 0.55, 0, 0], ['A', 0.35, 5, 0.55, 0, 0], ['A', 0.2, 0.5, 0.5, 0, 0], ['F', 0.5, 4, 0.75, 0, 0]],
];
const exBomCf = EX_BOM.reduce((a, [k, m, w]) => a + m * (1 + w / 100) * EX_MAT[k][0], 0);
const exBomCed = EX_BOM.reduce((a, [k, m, w]) => a + m * (1 + w / 100) * EX_MAT[k][1], 0);
const summary = async () => rows('select * from v_scenario_summary order by scenario_id');
const S = await summary();
EX_ROUTES.forEach((ops, i) => {
  const kwh = (o) => o[1] * o[2] * o[3], opCf = (o) => kwh(o) * GRID + o[5] * o[4];
  const man = ops.filter((o) => o[0] === 'M').reduce((a, o) => a + opCf(o), 0), af = ops.filter((o) => o[0] !== 'M').reduce((a, o) => a + opCf(o), 0);
  const ced = exBomCed + ops.reduce((a, o) => a + kwh(o) * 3.6, 0), s = S[i];
  ok(near(s.design_total_kgco2e, exBomCf + man + af) && near(s.bom_kgco2e, exBomCf) && near(s.manufacturing_kgco2e, man) && near(s.assembly_finishing_kgco2e, af),
     `route ${i + 1}: ${Number(s.design_total_kgco2e).toFixed(3)} kg CO2e (materials ${exBomCf.toFixed(3)} + manufacturing ${man.toFixed(3)} + assembly/finishing ${af.toFixed(3)})`);
  ok(near(s.design_ced_mj, ced, 1e-5), `route ${i + 1}: energy demand ${Number(s.design_ced_mj).toFixed(1)} MJ`);
});
const exLive = [1.45, 6.90, 1.38, 0.08, 1.95];
const exLiveTotal = exBomCf + EX_ROUTES[0].reduce((a, o, i) => a + exLive[i] * GRID + o[5] * o[4], 0);
const exDesignKwh = EX_ROUTES[0].reduce((a, o) => a + o[1] * o[2] * o[3], 0);
ok(near(S[0].live_total_kgco2e, exLiveTotal) && near(S[0].extra_kwh, exLive.reduce((a, b) => a + b, 0) - exDesignKwh), `live total ${Number(S[0].live_total_kgco2e).toFixed(4)} kg CO2e, extra ${Number(S[0].extra_kwh).toFixed(3)} kWh (as the mock-up with its example readings)`);
ok(S.slice(1).every((s) => near(s.live_total_kgco2e, s.design_total_kgco2e)), 'scenarios without readings: live = design (baseline used)');
ok(near(S[0].plan_area_m2, 0.5) && near(S[0].volume_m3, 0.0015), 'plan area 0.5 m2, volume 0.0015 m3 for 1000 x 500 x 3 mm');
const stat = await rows('select op_no, status from v_route_op_calc where scenario_id = 1 order by op_no');
ok(stat.every((r) => r.status === 'high'), 'all five example readings exceed the 15 % alert (as in the mock-up)');
ok((await rows('select * from v_route_op_calc where scenario_id = 2')).every((r) => r.status === 'no_live'), 'operations without readings are "no_live"');

// ---- 4. docs/calc.js (what the page runs) = the database
console.log('\n[4] docs/calc.js agrees with the database');
globalThis.window = globalThis;
(0, eval)(readFileSync(join(ROOT, 'docs', 'calc.js'), 'utf8'));
const C = globalThis.LCA_CALC;
const N = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && v !== '' && !/code|name|stage|state|label|type|fabric/.test(k) && Number.isFinite(Number(v)) ? Number(v) : v]));
const feed = async (v) => (await rows(`select * from ${v}`)).map(N);
const dBom = await feed('v_dash_bom'), dOps = await feed('v_dash_operations'), dScen = await feed('v_dash_scenarios'), dLive = await feed('v_dash_live');
for (const s of dScen) {
  const c = C.calculateRoute({ bom: dBom.filter((b) => b.scenario_id == s.scenario_id), ops: dOps.filter((o) => o.scenario_id == s.scenario_id), readings: dLive.filter((r) => r.scenario_id == s.scenario_id), gridFactor: s.electricity_factor, thresholdPct: s.alert_threshold_percent });
  const d = S.find((x) => x.scenario_id == s.scenario_id);
  ok(near(c.designTotal, d.design_total_kgco2e) && near(c.designCed, d.design_ced_mj, 1e-5) && near(c.liveTotal, d.live_total_kgco2e) && near(c.extraKwh, d.extra_kwh) && near(c.bomMass, d.bom_mass_kg),
     `${s.scenario_name}: calc.js ${c.designTotal.toFixed(4)} / live ${c.liveTotal.toFixed(4)} = database`);
  const dbStat = await rows(`select status from v_route_op_calc where scenario_id = ${s.scenario_id} order by op_no`);
  ok(c.opRows.every((o, i) => o.status === dbStat[i].status), `${s.scenario_name}: operation statuses agree`);
}

// ---- 5. the dashboard's buttons, as database functions (each test is rolled back)
console.log('\n[5] buttons');
await db.exec('begin');
const base2 = Number(S[1].design_total_kgco2e);
const added = (await rows(`select * from add_bom_item(2, 'MAT-CARBON-FIBRE', 'Final laminate', 1, 5)`))[0];
ok(near(added.consumed_kg, 1.05) && added.sequence_no === 8, 'Add BOM item: 1 kg + 5 % waste = 1.05 kg consumed, appended as line 8');
ok(near((await summary())[1].design_total_kgco2e, base2 + 1.05 * 43.87), 'Add BOM item: total rises by 1.05 x 43.87 kg CO2e');
const nBom = (await rows(`select load_bom_template(2) n`))[0].n;
ok(nBom === 7 && near((await summary())[1].design_total_kgco2e, base2), 'Load example BOM: scenario BOM replaced by the 7-line template, total back to the original');
await db.exec(`update materials set approved = false where material_code = 'MAT-PEEL-PLY'`);
const miss = await rows('select * from v_missing_factors where scenario_id = 1');
ok(miss.length === 1 && miss[0].material_code === 'MAT-PEEL-PLY' && near((await summary())[0].design_total_kgco2e, Number(S[0].design_total_kgco2e) - 0.096 * 3.0), 'unapproved material: listed in v_missing_factors and left out of the totals');
await db.exec(`update materials set approved = true where material_code = 'MAT-PEEL-PLY'`);
const nLive = (await rows(`select load_example_live_data(2) n`))[0].n;
const lv2 = await rows('select design_kwh, live_kwh from v_route_op_calc where scenario_id = 2');
ok(nLive === 5 && lv2.every((r) => near(r.live_kwh, Number(r.design_kwh) * 1.15, 1e-9)), 'Load example live data (route without recorded data): design kWh + 15 % for every operation');
const nLive1 = (await rows(`select load_example_live_data(1) n`))[0].n;
ok(nLive1 === 5 && near((await summary())[0].extra_kwh, 2.95), 'Load example live data (vacuum infusion): the mock-up\'s meter values, extra 2.95 kWh');
const rd = (await rows(`select * from add_live_reading(3, 11, 'MTR-NEW-1', 0.05, 'idle')`))[0];
ok(rd.kwh == 0.05 && (await rows(`select * from sensors where sensor_code = 'MTR-NEW-1'`)).length === 1, 'Add live reading: stored, and the new meter ID is registered');
const sc = (await rows(`select new_scenario(1, 'rtm', 'Test RTM', 'EXAMPLE_COMPOSITE') id`))[0].id;
const sNew = (await rows(`select * from v_scenario_summary where scenario_id = ${sc}`))[0];
ok(near(sNew.design_total_kgco2e, exBomCf + EX_ROUTES[1].reduce((a, o) => a + (o[1] * o[2] * o[3]) * GRID + o[5] * o[4], 0)), 'New scenario (RTM + example BOM) total = mock-up calculation');
await db.exec('rollback');

console.log('\n[6] saved comparison, AI prompt, recommendations');
await db.exec('begin');
const sid = (await rows(`select run_analysis(1, 'test') id`))[0].id;
const snap = (await rows(`select * from lca_snapshots where snapshot_id = ${sid}`))[0];
ok(near(snap.design_total_kgco2e, 104.518156, 1e-6) && near(snap.live_total_kgco2e, exLiveTotal, 1e-5) && near(snap.extra_kwh, 2.95), 'save_comparison: KPI boxes stored (design 104.518, live 105.290, extra 2.95 kWh)');
const cmpRows = await rows(`select * from lca_comparison where snapshot_id = ${sid} order by op_no`);
ok(cmpRows.length === 5 && near(cmpRows[1].variance_percent, 39.1129, 1e-3) && cmpRows[1].status === 'high', 'save_comparison: 5 operation lines, oven cure +39.1 % = high');
const prompt = (await rows(`select prompt_text, context from ai_prompts where snapshot_id = ${sid}`))[0];
ok(prompt.prompt_text.startsWith('You are an energy optimisation and composite manufacturing LCA assistant.\n\nAnalyse this composite product LCA comparison.\n\nContext:\n'), 'Generate prompt: starts with the mock-up\'s role and task wording');
ok(/9\. Prioritised action plan with owner, timescale, risk and estimated kWh \/ kg CO2e saving\./.test(prompt.prompt_text) && /Protect product quality, traceability and safety\.$/.test(prompt.prompt_text), 'Generate prompt: 9 questions and the engineering constraints');
ok(prompt.context.part_number === 'CP-LCA-001' && prompt.context.selected_route === 'Vacuum Infusion Route' && prompt.context.operation_comparison.length === 5 && near(prompt.context.design_total_kgco2e, 104.518, 1e-9), 'Generate prompt: JSON context holds part, route, totals and 5 operations');
const recs = await rows(`select * from ai_recommendations where snapshot_id = ${sid} order by recommendation_id`);
ok(recs.filter((r) => r.finding_type === 'high_variance').length === 5 && recs[0].recommendation_text.startsWith('PPSS oven / Oven cure: +1.940 kWh, 39.1% above design.') && near(recs[0].estimated_kwh_saving, 1.94), 'Generate recommendations: 5 high-variance findings, largest first (oven +1.940 kWh, 39.1 %)');
ok(recs.filter((r) => r.finding_type === 'suggested_action').length === 6 && recs.every((r) => r.validation_status === 'proposed'), 'Generate recommendations: the 6 standard suggested actions, all "proposed"');
const sid2 = (await rows(`select run_analysis(2) id`))[0].id;
const recs2 = await rows(`select * from ai_recommendations where snapshot_id = ${sid2} order by recommendation_id`);
ok(recs2[0].finding_type === 'note' && recs2.length === 7, 'scenario without live data: one note + the 6 suggested actions');
await db.exec('rollback');

// ---- 6b. digital twin: floor layout and simulation engine
console.log('\n[6b] digital twin');
const nM = (await rows('select count(*) c from machines'))[0].c;
ok((await rows('select count(*) c from v_dash_floor_machines'))[0].c === nM, `every machine (${nM}) has a place on the floor`);
ok((await rows(`select count(*) c from machine_locations l join factory_floors f on f.floor_id = l.floor_id where l.x_m < 0 or l.y_m < 0 or l.x_m + l.width_m > f.width_m or l.y_m + l.height_m > f.height_m`))[0].c == 0, 'all machines are inside the floor plan');
ok((await rows(`select count(*) c from machine_locations l join factory_zones z on z.zone_id = l.zone_id where l.x_m < z.x_m or l.y_m < z.y_m or l.x_m + l.width_m > z.x_m + z.width_m or l.y_m + l.height_m > z.y_m + z.height_m`))[0].c == 0, 'every machine is inside its own zone');
ok((await rows(`select count(*) c from machine_locations a join machine_locations b on a.machine_id < b.machine_id and a.floor_id = b.floor_id
                where a.x_m < b.x_m + b.width_m and b.x_m < a.x_m + a.width_m and a.y_m < b.y_m + b.height_m and b.y_m < a.y_m + a.height_m`))[0].c == 0, 'no two machines overlap');
ok((await rows(`select latest_state from v_dash_floor_machines where machine_name = 'PPSS oven'`))[0].latest_state === 'running', 'floor view carries the latest live machine state');

// 3D view: vendored libraries present, page wired to them, and a 3D model exists for every machine type in the data
import { existsSync } from 'node:fs';
const docs = (f) => join(ROOT, 'docs', f);
ok(['vendor/three.module.min.js', 'vendor/OrbitControls.js', 'vendor/three-LICENSE.txt', 'twin3d.js'].every((f) => existsSync(docs(f))), '3D libraries are bundled in docs/vendor (no internet needed)');
const twinHtml = readFileSync(docs('twin.html'), 'utf8'), twin3d = readFileSync(docs('twin3d.js'), 'utf8');
const bundle = readFileSync(docs('twin3d.bundle.js'), 'utf8');
ok(/<script src="twin3d\.bundle\.js"/.test(twinHtml) && !/type="module"|importmap/.test(twinHtml), 'twin.html loads the 3D engine as an ordinary script (works when the file is opened by double-click, from a server and on GitHub Pages)');
ok(bundle.length > 400000 && bundle.includes('TWIN3D') && !/^\s*(import|export)\s/m.test(bundle), 'twin3d.bundle.js is one self-contained script (three.js included, no ES module statements)');
ok(!/<table|sankey|<canvas id="chart"/i.test(twinHtml) && /id="view3d"/.test(twinHtml), 'the twin page shows only the digital twin (no dashboard tables or charts)');
const types = (await rows('select distinct machine_type from machines where machine_type is not null')).map((r) => r.machine_type);
const missing3d = types.filter((t) => !new RegExp(`case '${t}'`).test(twin3d));
ok(missing3d.length === 0, `3D model exists for all ${types.length} machine types` + (missing3d.length ? ` (missing: ${missing3d.join(', ')})` : ''));

(0, eval)(readFileSync(join(ROOT, 'docs', 'twin-sim.js'), 'utf8'));
const SIM = globalThis.TWIN_SIM;
const feed2 = async (v) => (await rows(`select * from ${v}`)).map(N);
const fm = await feed2('v_dash_floor_machines');
const rated = Object.fromEntries(fm.map((m) => [m.machine_name, m.rated_power_kw]));
const mkOps = (sid, useLive) => {
  const c = C.calculateRoute({ bom: [], ops: dOps.filter((o) => o.scenario_id == sid), readings: dLive.filter((r) => r.scenario_id == sid), gridFactor: 0.26155 });
  return { c, ops: c.opRows.map((o) => ({ operation_id: o.operation_id, op_no: o.op_no, machine_name: o.machine_name, stage: o.stage, process_name: o.process_name, hours: o.hours, kwh: useLive ? o.liveKwh : o.design.kwh, process_kgco2e: o.design.cfProcess })) };
};
const r1 = mkOps(1, false);
const one = SIM.simulate({ ops: r1.ops, parts: 1, releaseIntervalH: 0, transitH: 0.02, gridFactor: 0.26155, ratedKw: rated });
const sumHours = r1.ops.reduce((a, o) => a + o.hours, 0);
ok(near(one.makespan, sumHours + 4 * 0.02), `one part: lead time = sum of operation hours (${sumHours.toFixed(1)} h) + 4 transfers`);
ok(near(one.totalKwh, S[0].design_kwh) && near(one.carbonKg, Number(S[0].manufacturing_kgco2e) + Number(S[0].assembly_finishing_kgco2e)), `one part: energy ${one.totalKwh.toFixed(2)} kWh and carbon ${one.carbonKg.toFixed(3)} kg = LCA operations in the database`);
const six = SIM.simulate({ ops: r1.ops, parts: 6, releaseIntervalH: 1, transitH: 0.02, gridFactor: 0.26155, ratedKw: rated });
ok(near(six.totalKwh, 6 * S[0].design_kwh), 'six parts: energy = 6 x one part');
let overlap = false;
for (const name of Object.keys(six.machines)) {
  const st = six.jobs.flatMap((j) => j.steps).filter((x) => x.machine === name).sort((a, b) => a.start - b.start);
  for (let i = 1; i < st.length; i++) if (st[i].start < st[i - 1].end - 1e-9) overlap = true;
}
ok(!overlap, 'no machine ever works on two parts at once');
ok(six.bottleneck.name === 'PPSS oven' && six.makespan >= 6 * 2.5, 'bottleneck is the oven (2.5 h per part), so 6 parts take at least 15 h');
const live = SIM.simulate({ ops: mkOps(1, true).ops, parts: 6, releaseIntervalH: 1, gridFactor: 0.26155, ratedKw: rated });
ok(near(live.totalKwh, 6 * S[0].live_kwh), 'live mode: energy = 6 x the metered kWh (11.76)');
const idle = SIM.simulate({ ops: r1.ops, parts: 6, releaseIntervalH: 1, idleFraction: 0.2, gridFactor: 0.26155, ratedKw: rated });
ok(idle.idleKwh > 0 && near(idle.runKwh, six.runKwh), 'idle power adds energy without changing run energy');
const mid = SIM.stateAt(six, 6.5), end = SIM.stateAt(six, six.makespan);
ok(end.completed === 6 && near(end.cumKwh, six.totalKwh) && near(end.cumCarbonKg, six.carbonKg), 'at the end all parts are finished and cumulative energy/carbon equal the totals');
ok(mid.cumKwh > 0 && mid.cumKwh < six.totalKwh && mid.completed < 6 && Object.values(mid.machines).filter((m) => m.state === 'running').length >= 1, 'mid-run state is consistent (partial energy, parts in process)');

// carbon, power and energy tracking in the simulation (what the 3D view animates)
const matPer = C.calculateRoute({ bom: dBom.filter((b) => b.scenario_id == 1), ops: dOps.filter((o) => o.scenario_id == 1), readings: [], gridFactor: 0.26155 }).bomCf;
ok(near(matPer, S[0].bom_kgco2e), 'materials carbon per part from the BOM = database');
const full = SIM.simulate({ ops: r1.ops, parts: 6, releaseIntervalH: 1, transitH: 0.02, gridFactor: 0.26155, ratedKw: rated, materialsKgPerPart: matPer });
ok(near(full.carbon.total / 6, S[0].design_total_kgco2e) && near(full.carbon.materials, 6 * matPer), 'footprint per part incl. materials = the design LCA total (104.518 kg CO2e)');
ok(near(full.carbon.total, full.carbon.materials + full.carbon.electricity + full.carbon.process + full.carbon.idle) && near(full.carbon.operations, six.carbonKg), 'carbon sources add up (materials + electricity + process + idle)');
const endS = SIM.stateAt(full, full.makespan);
ok(near(endS.carbon.total, full.carbon.total) && endS.parts.every((p) => near(p.carbonKg, S[0].design_total_kgco2e)), 'at the end every part carries exactly the design footprint');
ok(near(Object.values(endS.machines).reduce((a, m) => a + m.cumKwh, 0), full.totalKwh) && near(Object.values(endS.machines).reduce((a, m) => a + m.cumCo2, 0), full.carbon.operations), 'per-machine energy and carbon add up to the totals');
const evs = SIM.eventsBetween(full, -1, full.makespan);
ok(evs.filter((e) => e.type === 'done').length === 30 && evs.filter((e) => e.type === 'release').length === 6 && near(evs.filter((e) => e.type === 'done').reduce((a, e) => a + e.kwh, 0), full.totalKwh), 'events: 30 operations finished, 6 parts released, energy adds up');
const ser = SIM.series(full, 60, 'PPSS oven');
ok(ser.kw.length === 61 && ser.electricity.every((v, i) => i === 0 || v >= ser.electricity[i - 1] - 1e-9) && near(ser.electricity[60] + ser.process[60] + ser.idle[60], full.carbon.operations), 'chart series: cumulative carbon never decreases and ends at the total');
const midS = SIM.stateAt(full, 7.5);
ok(near(midS.totalKw, Object.values(midS.machines).reduce((a, m) => a + m.kw, 0)) && midS.totalKw > 0 && midS.co2Rate > 0, 'power and emission rate now = sum over machines');
const idleSim = SIM.simulate({ ops: r1.ops, parts: 6, releaseIntervalH: 1, idleFraction: 0.2, gridFactor: 0.26155, ratedKw: rated, materialsKgPerPart: matPer });
const idleEnd = SIM.stateAt(idleSim, idleSim.makespan);
ok(near(idleEnd.carbon.idle, idleSim.carbon.idle) && idleSim.carbon.idle > 0 && near(idleEnd.cumKwh, idleSim.totalKwh), 'idle power adds carbon and energy consistently over time');
const cleaner = SIM.simulate({ ops: r1.ops, parts: 6, releaseIntervalH: 1, gridFactor: 0.05, ratedKw: rated, materialsKgPerPart: matPer });
ok(near(cleaner.carbon.materials, full.carbon.materials) && cleaner.carbon.electricity < full.carbon.electricity / 4 && near(cleaner.carbon.process, full.carbon.process), 'a cleaner grid lowers only the electricity carbon');

// interactive charts: data builders (docs/twin-viz.js) and the optional real-model loader
(0, eval)(readFileSync(join(ROOT, 'docs', 'twin-viz.js'), 'utf8'));
const VIZ = globalThis.TWIN_VIZ;
const common = { parts: 6, interval: 1, idlePct: 0, rated, includeMaterials: true, useLive: false, grid: 0.26155 };
const routeIn = (sid) => ({ scenario_id: sid, name: 'r' + sid, bom: dBom.filter((b) => b.scenario_id == sid), ops: dOps.filter((o) => o.scenario_id == sid), readings: dLive.filter((r) => r.scenario_id == sid), thresholdPct: 15 });
const built = VIZ.buildSim({ ...common, ...routeIn(1) });
ok(near(built.sim.carbon.total / 6, S[0].design_total_kgco2e), 'buildSim: footprint per part incl. materials = design LCA of the database');
const sk = VIZ.sankey(built.sim, built.calc, true);
ok(near(sk.total, built.sim.carbon.total) && near(sk.right.find((n) => n.id === 'kit').value, built.sim.carbon.materials), 'carbon flow diagram: all links add up to the run total; materials node = materials carbon');
ok(sk.left.filter((n) => n.kind === 'materials').length === 7 && Object.values(built.sim.machines).every((m) => near(sk.right.find((n) => n.id === 'm:' + m.name).value, m.totalCo2)), 'carbon flow diagram: 7 material lines, and each machine node = that machine\'s carbon');
const skOps = VIZ.sankey(built.sim, built.calc, false);
ok(near(skOps.total, built.sim.carbon.operations) && !skOps.right.some((n) => n.id === 'kit'), 'carbon flow diagram without materials = operations carbon');
const wf0 = VIZ.waterfall(built.sim, {}), E = built.sim.carbon.electricity + built.sim.carbon.idle;
ok(near(wf0.final, wf0.base) && near(VIZ.waterfall(built.sim, { materialsPct: -20 }).final, wf0.base - 0.2 * built.sim.carbon.materials), 'levers: no change = baseline; materials -20 % = -20 % of materials carbon');
ok(near(VIZ.waterfall(built.sim, { energyPct: -20 }).final, wf0.base - 0.2 * E) && near(VIZ.waterfall(built.sim, { grid: 0 }).final, wf0.base - E), 'levers: energy -20 % and a zero-carbon grid remove exactly that share of electricity carbon');
const wfc = VIZ.waterfall(built.sim, { materialsPct: -10, energyPct: -20, grid: 0.1 });
ok(near(wfc.final, wfc.steps.slice(0, 4).reduce((a, s2) => a + s2.value, 0)) && wfc.steps[4].value === wfc.final, 'levers: waterfall steps add up to the new footprint');
const rm = VIZ.routeMetrics([1, 2, 3, 4].map(routeIn), common);
ok(rm.every((r, i) => near(r.carbonPerPart, S[i].design_total_kgco2e)) && rm.every((r) => r.throughput > 0 && r.bottleneck), 'route comparison: every route\'s footprint per part = the database design LCA');
const mi = VIZ.materialItems(built.calc);
ok(mi[0].name === 'Carbon fibre' && mi.every((x, i) => i === 0 || x.kgco2e <= mi[i - 1].kgco2e) && near(mi.reduce((a, x) => a + x.kgco2e, 0), S[0].bom_kgco2e), 'material crates: largest first (carbon fibre), carbon adds up to the BOM');
ok(['vendor/loaders/GLTFLoader.js', 'vendor/utils/BufferGeometryUtils.js', 'models/models.json', 'models/example_box.gltf', 'models/README.md', 'twin-viz.js'].every((f) => existsSync(docs(f))), 'real-model loader (glTF) and models folder are bundled');
const gl = JSON.parse(readFileSync(docs('models/example_box.gltf'), 'utf8')), bin = Buffer.from(gl.buffers[0].uri.split(',')[1], 'base64');
ok(gl.asset.version === '2.0' && bin.length === gl.buffers[0].byteLength && gl.accessors[0].count === 24 && JSON.parse(readFileSync(docs('models/models.json'), 'utf8')) !== null, 'example glTF is valid (binary length matches) and models.json parses');
ok(/twin-viz\.js/.test(twinHtml) && !/twin/i.test(readFileSync(docs('index.html'), 'utf8')), 'the dashboard page is untouched by the twin (no twin link, nav or card)');

// explore-as-a-worker: walking rules (docs/twin-walk.mjs) and the avatar wiring
const WK = await import(join(ROOT, 'docs', 'twin-walk.mjs'));
const flr = { width: 60, height: 34 }, mRects = fm.map((m) => ({ x: m.x_m, y: m.y_m, w: m.width_m, d: m.height_m })), all = mRects.concat([{ x: 52.75, y: 27.6, w: 4.5, d: 2.8 }, { x: 2, y: 9.7, w: 5, d: 2.4 }]);
const sp = WK.spawnPoint(all, flr);
ok(!WK.blocked(sp.x, sp.z, WK.WALK.radius, all, flr) && sp.z > flr.height - 3, 'the worker starts on a free spot at the south edge of the floor');
const oven = mRects[fm.findIndex((m) => m.machine_name === 'PPSS oven')];
let p = { x: oven.x + oven.w / 2, z: oven.y + oven.d + 3 };
for (let i = 0; i < 200; i++) p = WK.move(p, 0, -3.6, 1 / 60, all, flr);
ok(Math.abs(p.z - (oven.y + oven.d + WK.WALK.radius)) < 0.1, 'the worker is stopped by a machine (cannot walk through the oven)');
let q = { x: oven.x - 0.2, z: oven.y + oven.d + 3 };
for (let i = 0; i < 120; i++) q = WK.move(q, 1.0, -3.0, 1 / 60, all, flr);
ok(q.z < oven.y + oven.d + 0.5 && q.x > oven.x - 0.2, 'the worker slides along a machine instead of sticking to it');
let r = { x: 1, z: 1 }; for (let i = 0; i < 100; i++) r = WK.move(r, -3, -3, 1 / 60, all, flr);
ok(r.x >= WK.WALK.radius - 1e-9 && r.z >= WK.WALK.radius - 1e-9, 'the worker cannot leave the floor');
const nr = WK.nearest(oven.x + 1, oven.y + oven.d + 1.5, mRects);
ok(Math.abs(nr.dist - 1.5) < 1e-9 && fm[nr.index].machine_name === 'PPSS oven', 'nearest machine and its distance are found');
const d1 = WK.inputDirection(0, 1, 0, -1), d2 = WK.inputDirection(1, 0, 0, -1), d3 = WK.inputDirection(1, 1, 1, 0);
ok(Math.abs(d1.z + 1) < 1e-9 && Math.abs(d2.x - 1) < 1e-9 && Math.abs(Math.hypot(d3.x, d3.z) - 1) < 1e-9 && WK.inputDirection(0, 0, 0, -1).x === 0, 'WASD moves relative to where the camera looks (W forward, D right, diagonals not faster)');
ok(Math.abs(WK.stepAngle(3.0, -3.0, 10) - (3.0 + (2 * Math.PI - 6.0))) < 1e-9 && Math.abs(WK.stepAngle(0, 1, 0.2) - 0.2) < 1e-9, 'the avatar turns the short way round, at a limited rate');
ok(/function buildHumanoid/.test(twin3d) && /id="walkBtn"/.test(twinHtml) && /id="mini"/.test(twinHtml) && bundle.includes('TWIN3D'), 'avatar, explore button and minimap are wired into the twin page');

// real 3D models (GLB): present, web-sized, credited and embedded
{
  const man = JSON.parse(readFileSync(docs('models/models.json'), 'utf8')), emb = existsSync(docs('models/models-embedded.js')) ? readFileSync(docs('models/models-embedded.js'), 'utf8') : '';
  const entries = Object.entries(man).filter(([k, v2]) => !k.startsWith('_') && v2 && v2.file);
  ok(entries.length >= 1 && entries.every(([, v2]) => existsSync(docs('models/' + v2.file))), `models.json lists ${entries.length} model(s) and every file exists`);
  for (const [k, v2] of entries) {
    const buf = readFileSync(docs('models/' + v2.file));
    const jl = buf.readUInt32LE(12), gj = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8')), acc = gj.accessors;
    const tris2 = gj.meshes.reduce((a, m) => a + m.primitives.reduce((b, pr) => b + (pr.indices !== undefined ? acc[pr.indices].count : acc[pr.attributes.POSITION].count) / 3, 0), 0);
    ok(buf.subarray(0, 4).toString() === 'glTF' && buf.length < 8e6 && tris2 < 200000, `model "${k}" (${v2.file}) is a valid GLB, ${(buf.length / 1e6).toFixed(1)} MB, ${Math.round(tris2 / 1000)}k triangles (web budget: < 8 MB, < 200k)`);
    ok(!(gj.extensionsRequired || []).some((x) => /draco|meshopt/i.test(x)), `model "${k}" needs no Draco/Meshopt decoder`);
    ok(!!v2.credit && /CC BY|CC0|own|licen/i.test(v2.credit + readFileSync(docs('models/CREDITS.md'), 'utf8')), `model "${k}" has a credit (and CREDITS.md exists)`);
    ok(emb.includes(`"${k}"`) && emb.includes(buf.toString('base64').slice(0, 200)), `model "${k}" is embedded for double-click use (run npm run models after changes)`);
  }
}

// hosting on GitHub Pages with Supabase: files, order, public config
{
  const deploy = readFileSync(join(ROOT, 'DEPLOY.md'), 'utf8'), cfg = readFileSync(docs('config.js'), 'utf8');
  const order = ['1_schema.sql', '2_views_and_security.sql', '3_sample_data.sql', '4_digital_twin.sql', '5_digital_twin_sample_data.sql', '6_public_read_access.sql'];
  ok(order.every((f) => existsSync(join(SQL_DIR, f)) && deploy.includes(f)), 'DEPLOY.md lists the six SQL files, in order, and they all exist');
  ok(/SUPABASE_URL:\s*""/.test(cfg) && /SUPABASE_ANON_KEY:\s*""/.test(cfg), 'config.js ships empty (no keys are committed; the pages start on sample data)');
  ok(existsSync(docs('.nojekyll')) && ['index.html', 'twin.html', 'project.html'].every((f) => existsSync(docs(f))), 'docs/ holds the three pages (dashboard, twin, project) for GitHub Pages');
  ok(['index.html', 'twin.html'].every((f) => /startsWith\('eyJ'\)/.test(readFileSync(docs(f), 'utf8'))), 'both data pages work with the legacy anon key and the new publishable key');
  // the hosted twin needs these views through the public key; file 6 must be the last numbered SQL file
  const nums = (await import('node:fs')).readdirSync(SQL_DIR).filter((f) => /^\d+_/.test(f)).map((f) => parseInt(f, 10));
  ok(Math.max(...nums) === 6 && readFileSync(join(SQL_DIR, '6_public_read_access.sql'), 'utf8').includes('v_dash_floor_machines'), 'the public-read file runs last and covers the twin views');
}

// ---- 7. bad data is rejected
console.log('\n[7] bad data is rejected');
const rejects = async (sql, re, msg) => { try { await db.exec(sql); ok(false, `${msg} (accepted!)`); } catch (e) { ok(re.test(e.message), `${msg}`); } };
await rejects(`insert into bom_items (scenario_id,material_id,stage,mass_kg,waste_percent) values (1,1,'Final laminate',1,-5)`, /check/i, 'negative waste');
await rejects(`insert into bom_items (scenario_id,material_id,stage,mass_kg) values (1,1,'Final laminate',-1)`, /check/i, 'negative mass');
await rejects(`insert into bom_items (scenario_id,material_id,stage,mass_kg) values (1,1,'Garage',1)`, /check/i, 'unknown BOM stage');
await rejects(`insert into route_operations (route_id,op_no,stage,process_name,hours,kw,utilisation) values (1,9,'Manufacturing','x',1,1,1.5)`, /check/i, 'utilisation of 1.5');
await rejects(`insert into sensor_readings (scenario_id,route_operation_id,sensor_code,kwh,machine_state) values (1,1,'MTR-VAC-001',1,'asleep')`, /check/i, 'unknown machine state');
await rejects(`insert into sensor_readings (scenario_id,route_operation_id,sensor_code,kwh) values (1,6,'MTR-VAC-001',1)`, /not part of the route/i, 'reading for an operation of another route');
await rejects(`insert into sensor_readings (scenario_id,route_operation_id,sensor_code,kwh) values (1,1,'NO-SUCH-METER',1)`, /foreign key/i, 'reading from an unregistered meter');
await rejects(`insert into parts (project_id,part_number) values (1,'CP-LCA-001')`, /unique|duplicate/i, 'duplicate part number in a project');
await rejects(`select new_scenario(1, 'no_such_route', 'x')`, /unknown route/i, 'scenario for an unknown route');
await rejects(`select add_bom_item(1, 'NO-SUCH-MATERIAL', 'Assembly', 1, 0)`, /unknown material/i, 'BOM item with an unknown material');
const next = (await rows(`insert into projects (project_name) values ('Second') returning project_id`))[0].project_id;
ok(next == 2, 'identity counters continue after the explicit-id CSV load');
await db.exec(`delete from projects where project_id = 2`);

// ---- 8. security
console.log('\n[8] security');
const asRole = async (role, sql) => { await db.exec(`set role ${role}`); try { return await db.query(sql); } finally { await db.exec('reset role'); } };
const denied = async (role, sql) => { try { await asRole(role, sql); return false; } catch { return true; } };
ok((await rows(`select count(*) c from pg_tables where schemaname = 'public' and not rowsecurity`))[0].c == 0, 'row-level security on every table');
ok(await denied('anon', 'select * from materials'), 'anonymous cannot read tables');
ok(await denied('anon', 'select * from v_dash_bom'), 'anonymous cannot read the dashboard views by default');
ok(await denied('anon', `select add_bom_item(1,'MAT-EPOXY','Assembly',1,0)`), 'anonymous cannot call the button functions');
ok((await asRole('authenticated', 'select count(*) c from materials')).rows[0].c == 9, 'a signed-in user can read tables');
await db.exec(readFileSync(join(SQL_DIR, '6_public_read_access.sql'), 'utf8'));
const FEEDS = ['v_scenario_summary', 'v_dash_parts', 'v_dash_materials', 'v_dash_scenarios', 'v_dash_bom', 'v_dash_layup', 'v_dash_operations', 'v_dash_live', 'v_dash_ai_template', 'v_dash_recommendation_actions', 'v_dash_floor', 'v_dash_floor_zones', 'v_dash_floor_machines'];
for (const v of FEEDS) ok(!(await denied('anon', `select * from ${v}`)), `after the optional file, anonymous can read ${v}`);
ok(await denied('anon', 'select * from materials') && await denied('anon', 'select * from sensor_readings'), '... but still not the tables');
ok(await denied('anon', 'select * from v_route_op_calc') && await denied('anon', 'select * from ai_prompts'), '... nor the detail views or saved prompts');
await db.exec(`revoke select on ${FEEDS.join(', ')} from anon`);
ok(await denied('anon', 'select * from v_dash_bom'), 'the REVOKE line switches public access off again');

// project page (docs/project.html): separate from the dashboard and the twin, honest, short, restrained, consistent with the project
{
  const pj = readFileSync(docs('project.html'), 'utf8'), cfg = readFileSync(docs('project-config.js'), 'utf8'), idx = readFileSync(docs('index.html'), 'utf8');
  const text = pj.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' '), words = text.split(/\s+/).filter(Boolean).length;
  ok(/MSI LCI Optimisation Project with Far UK/.test(pj) && existsSync(docs('assets/dashboard.jpg')) && existsSync(docs('assets/twin.jpg')) && /assets\/dashboard\.jpg/.test(pj) && /assets\/twin\.jpg/.test(pj), 'project page exists with its demonstrator images');
  ok(!/project\.html/.test(idx) && !/project\.html/.test(twinHtml), 'the dashboard and the twin page do not link to the project page (separate pages)');
  ok(/index\.html/.test(pj) && /twin\.html/.test(pj), 'the project page links to the dashboard and to the digital twin');
  ok(words < 1000, `the page is short (${words} words of text)`);
  ok(/id="funding"[^>]*hidden/.test(pj) && /funder:\s*""/.test(cfg) && /contactEmail:\s*""/.test(cfg), 'funding and contact stay hidden until real details are entered in project-config.js (nothing invented)');
  const names = ['Wai Keung Fung', 'Chaminda Hewage', 'Jasim Uddin', 'Udayanga Galappaththi'];
  ok(names.every((n) => cfg.includes(`name: "${n}"`)) && /name: "Far UK"/.test(cfg) && /name: "Cardiff Metropolitan University"/.test(cfg), 'the four named people and the two partners (Far UK, Cardiff Metropolitan University) are in project-config.js');
  ok(!/role:\s*"[^"]+"/.test(cfg) && !/organisation:\s*"[^"]+"/.test(cfg), 'no roles or affiliations invented for the people (only what was supplied)');
  ok(/function renderFunding/.test(pj) && /function renderPeople/.test(pj) && /function renderPartners/.test(pj), 'partners, funding and people sections are built into the page (driven by project-config.js)');
  ok(!/lorem|TBC|TODO|XXX|\[insert/i.test(pj), 'no placeholder text on the project page');
  ok(/example data/i.test(pj) && /not verified|Not a verified/i.test(pj), 'figures are labelled as example data, not verified results');
  ok(/YouniqueIdeaStudio/.test(pj) && /CC BY 4\.0/.test(pj) && /three\.js/.test(pj), 'credits for the CC BY model and three.js are on the page');
  ok(!/gradient\(/i.test(pj) && !/\p{Extended_Pictographic}/u.test(pj) && !/box-shadow/i.test(pj) && /prefers-reduced-motion/.test(pj), 'restrained design: no gradients, emoji or glow shadows; motion honours prefers-reduced-motion');
  const t21 = pj.match(/(\d+) tables/), t150 = pj.match(/more than (\d+) automated checks/);
  ok(t21 && +t21[1] === (await rows("select count(*) c from pg_tables where schemaname = 'public'"))[0].c, 'project page: number of tables = tables in the database');
  ok(/Four ways/.test(pj) && (await rows('select count(*) c from manufacturing_routes'))[0].c === 4, 'project page: "four ways" = routes in the database');
  ok(t150 && passed >= +t150[1], `project page: "more than ${t150 && t150[1]} automated checks" is true (${passed} checks so far)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
