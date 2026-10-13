// npm run validate — runs the SQL on an in-memory PostgreSQL and checks it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newDb, loadCsvs, csvFiles, tableOf, readCsv, SQL_DIR } from './lib.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { c ? passed++ : failed++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); };
const near = (a, b, t = 1e-6) => Math.abs(Number(a) - Number(b)) <= t;

const db = await newDb();
const counts = await loadCsvs(db);
console.log(`schema applied; ${Object.values(counts).reduce((a, b) => a + b, 0)} CSV rows loaded into ${Object.keys(counts).length} tables`);
const rows = async (sql) => (await db.query(sql)).rows;

// ---- 1. database matches the handover note, field by field (note section 3.4)
console.log('\n[1] tables and fields match the handover note');
const NOTE = {
  organisations: 'organisation_id organisation_name organisation_code created_at',
  projects: 'project_id organisation_id project_code project_name customer_name start_date end_date status created_at',
  parts: 'part_id project_id part_number part_description functional_unit quantity length_mm width_mm thickness_mm notes',
  lca_scenarios: 'scenario_id part_id scenario_name goal system_boundary quantity electricity_factor data_quality_target status created_at approved_at',
  lifecycle_stages: 'stage_id stage_code stage_name sequence_no',
  lca_items: 'item_id item_code item_name item_type default_unit assumptions impact_assessment_method iso_compliant notes active',
  impact_categories: 'impact_category_id impact_code impact_name unit description',
  lca_factors: 'factor_id item_id impact_category_id factor_value factor_unit basis_unit valid_from valid_to data_quality source_method approved created_at',
  sources: 'source_id source_name source_type citation url publication_year database_name version notes',
  item_sources: 'item_source_id item_id source_id reference_order notes',
  material_properties: 'material_property_id item_id property_name property_value unit source_id notes',
  equipment: 'equipment_id organisation_id equipment_code equipment_name equipment_type manufacturer model location rated_power_kw used_for assumptions notes active',
  equipment_factors: 'equipment_factor_id equipment_id impact_category_id factor_value factor_unit basis_unit source_id approved',
  bom_items: 'bom_item_id scenario_id item_id stage_id net_quantity unit waste_percentage sequence_no notes',
  scenario_operations: 'operation_id scenario_id operation_sequence lifecycle_stage_id process_item_id equipment_id operation_name expected_duration_minutes expected_power_kw utilisation_factor expected_energy_kwh batch_size process_mass_basis notes',
  production_batches: 'batch_id scenario_id batch_code part_id planned_quantity actual_quantity scrap_quantity rework_quantity start_time end_time status',
  sensor_devices: 'sensor_id equipment_id sensor_code sensor_name sensor_type measurement_type unit sampling_interval_seconds protocol active installed_at',
  sensor_readings: 'sensor_id recorded_at batch_id operation_id value unit machine_state quality_flag ingestion_source received_at',
  lca_results: 'result_id scenario_id batch_id result_type impact_category_id lifecycle_stage_id result_value unit calculation_version calculated_at',
  ai_recommendations: 'recommendation_id scenario_id batch_id operation_id recommendation_text estimated_kwh_saving estimated_co2e_saving risk_level requires_engineering_validation validation_status created_at',
};
const cols = async (t) => (await rows(`select attname from pg_attribute where attrelid = 'public.${t}'::regclass and attnum > 0 and not attisdropped order by attnum`)).map((r) => r.attname).join(' ');
for (const [t, c] of Object.entries(NOTE)) ok((await cols(t)) === c, `${t}: fields identical to the note`);
const allTables = (await rows(`select tablename from pg_tables where schemaname = 'public'`)).map((r) => r.tablename);
ok(allTables.length === Object.keys(NOTE).length + 2, `${allTables.length} tables = ${Object.keys(NOTE).length} from the note + operation_energy_comparison + energy_actions (named in the note, no fields given)`);

// ---- 2. every CSV matches its table
console.log('\n[2] CSV headers = table columns');
for (const f of csvFiles()) ok((await cols(tableOf(f))).split(' ').join(',') === readCsv(f).columns.join(','), `${f}`);

// ---- 3. calculation views vs independent JS
console.log('\n[3] views vs independent calculation');
const T = async (t) => rows(`select * from ${t}`);
const factors = (await T('lca_factors')).filter((f) => f.approved);
const bom = await T('bom_items'), ops = await T('scenario_operations'), scen = await T('lca_scenarios');
const fac = (item, basis) => factors.find((f) => f.item_id == item && f.basis_unit === basis);
const totals = await rows(`select scenario_id, total_impact, materials, processes, electricity, end_of_life from v_scenario_totals where impact_code = 'GWP'`);
for (const s of scen) {
  const part = { Materials: 0, Processes: 0, Electricity: 0, EOL: 0 };
  const items = await T('lca_items');
  for (const b of bom.filter((b) => b.scenario_id == s.scenario_id)) {
    const f = fac(b.item_id, b.unit); if (!f) continue;
    const v = Number(b.net_quantity) / (1 - Number(b.waste_percentage) / 100) * Number(f.factor_value);
    items.find((i) => i.item_id == b.item_id).item_type === 'end_of_life' ? (part.EOL += v) : (part.Materials += v);
  }
  for (const o of ops.filter((o) => o.scenario_id == s.scenario_id)) {
    part.Electricity += Number(o.expected_energy_kwh) / o.batch_size * Number(s.electricity_factor);
    for (const [basis, qty] of [['min', Number(o.expected_duration_minutes) / o.batch_size], ['kg', Number(o.process_mass_basis)], ['item', 1]]) {
      const f = fac(o.process_item_id, basis); if (f && !Number.isNaN(qty)) part.Processes += qty * Number(f.factor_value);
    }
  }
  const v = totals.find((t) => t.scenario_id == s.scenario_id);
  const sum = part.Materials + part.Processes + part.Electricity + part.EOL;
  ok(v && near(v.total_impact, sum, 1e-6) && near(v.materials, part.Materials) && near(v.processes, part.Processes) && near(v.electricity, part.Electricity) && near(v.end_of_life, part.EOL),
     `scenario ${s.scenario_id} "${s.scenario_name}": ${Number(v?.total_impact).toFixed(4)} kg CO2e (view = independent calculation, split by component too)`);
}
const bomLine = (await rows('select net_quantity / (1 - waste_percentage / 100) as g from bom_items where bom_item_id = 1'))[0];
ok(near(bomLine.g, 1.8), 'hand check: 0.45 kg part at 75% waste needs 1.8 kg of billet');
const miss = await T('v_bom_missing_factors');
ok(miss.length === 1 && miss[0].item_code === 'MAT-RELEASE', 'only the deliberate gap (unapproved release-agent factor) is flagged');
ok(near((await rows('select sum(result_value) s from lca_results where scenario_id = 1'))[0].s, totals.find((t) => t.scenario_id == 1).total_impact, 1e-5), 'stored lca_results for scenario 1 add up to the view total');

// ---- 4. Stage 2 comparison
console.log('\n[4] expected vs measured energy');
const c1 = (await rows('select * from v_energy_comparison where batch_code = \'B-2025-0001\' and operation_sequence = 1'))[0];
ok(near(c1.expected_kwh, 196 * 1.4408, 1e-3), 'expected = 196 parts x 1.4408 kWh');
ok(near(c1.measured_kwh, 277.1), 'measured = sum of the 10 meter readings (277.1 kWh)');
ok(near(c1.variance_pct, (277.1 / (196 * 1.4408) - 1) * 100, 1e-6), `variance ${Number(c1.variance_pct).toFixed(2)} %`);

// ---- 5. bad data is rejected
console.log('\n[5] bad data is rejected');
const rejects = async (sql, re, msg) => { try { await db.exec(sql); ok(false, `${msg} (accepted!)`); } catch (e) { ok(re.test(e.message), `${msg}`); } };
await rejects(`insert into bom_items (scenario_id,item_id,stage_id,net_quantity,unit,waste_percentage) values (1,1,1,1,'kg',100)`, /check/i, 'waste of 100%');
await rejects(`insert into bom_items (scenario_id,item_id,stage_id,net_quantity,unit) values (1,1,1,-1,'kg')`, /check/i, 'negative quantity');
await rejects(`insert into scenario_operations (scenario_id,operation_sequence,lifecycle_stage_id,operation_name,utilisation_factor) values (1,9,1,'x',1.5)`, /check/i, 'utilisation of 1.5');
await rejects(`insert into lca_items (item_code,item_name,item_type) values ('X','x','banana')`, /check/i, 'unknown item type');
await rejects(`insert into parts (project_id,part_number) values (1,'BRK-001')`, /unique|duplicate/i, 'duplicate part number in a project');
await rejects(`insert into sensor_readings (sensor_id,recorded_at,value) values (1,'2025-03-10T09:00:00+00:00',1)`, /unique|duplicate/i, 'duplicate sensor reading (sensor, time)');
await rejects(`insert into projects (organisation_id,project_code,project_name) values (99,'X','x')`, /foreign key/i, 'project for a missing organisation');
const next = (await rows(`insert into organisations (organisation_name, organisation_code) values ('Second','SEC') returning organisation_id`))[0].organisation_id;
ok(next == 2, 'identity counters continue after the explicit-id CSV load');
await db.exec(`delete from organisations where organisation_code = 'SEC'`);

// ---- 6. security
console.log('\n[6] security');
const asRole = async (role, sql) => { await db.exec(`set role ${role}`); try { return await db.query(sql); } finally { await db.exec('reset role'); } };
const denied = async (role, sql) => { try { await asRole(role, sql); return false; } catch { return true; } };
ok((await rows(`select count(*) c from pg_tables where schemaname = 'public' and not rowsecurity`))[0].c == 0, 'row-level security on every table');
ok(await denied('anon', 'select * from lca_factors'), 'anonymous cannot read tables');
ok(await denied('anon', 'select * from v_scenario_totals'), 'anonymous cannot read the views by default');
ok((await asRole('authenticated', 'select count(*) c from lca_factors')).rows[0].c == 12, 'a signed-in user can read tables');
await db.exec(readFileSync(join(SQL_DIR, '4_dashboard_access_OPTIONAL.sql'), 'utf8'));
ok((await asRole('anon', 'select count(*) c from v_scenario_totals')).rows[0].c == 4, 'after the optional file, anonymous can read the dashboard views');
ok(await denied('anon', 'select * from lca_factors'), '... but still not the tables');
ok(await denied('anon', 'select * from v_impact_lines'), '... nor the detail view');
await db.exec(`revoke select on v_scenario_totals, v_bom_missing_factors, v_energy_comparison from anon`);
ok(await denied('anon', 'select * from v_scenario_totals'), 'the REVOKE line switches public access off again');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
