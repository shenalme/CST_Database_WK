-- =====================================================================
-- 2_views_and_security.sql — the dashboard's calculations as views, its buttons as
-- functions, and access control. Run after 1_schema.sql.
-- Rules (same as the dashboard, see CALCULATION_PLAN.md):
--   consumed kg   = mass x (1 + waste% / 100)
--   material      = consumed x factor per kg      (kg CO2e and MJ)
--   operation kWh = hours x kW x utilisation
--   operation CO2e= kWh x electricity factor + process mass (kg) x process factor
--   operation MJ  = kWh x 3.6
--   live kWh      = sum of readings of the operation, else the design kWh (flagged)
--   status        = high if variance% > alert%, watch if > alert%/2, ok otherwise, no_live without readings
-- Only APPROVED materials count; an unapproved one is listed in v_missing_factors.
-- =====================================================================

-- ---------- calculation views ----------
-- Section 3: the BOM table with calculated columns
create view v_bom_calc as
select b.bom_item_id, b.scenario_id, b.sequence_no, b.stage, m.material_code, m.material_name, m.material_type,
       b.mass_kg, b.waste_percent, b.consumed_kg,
       case when m.approved then b.consumed_kg * m.cf_kgco2e_per_kg end as kgco2e,
       case when m.approved then b.consumed_kg * m.ced_mj_per_kg   end as mj,
       not m.approved as factor_missing
from bom_items b
join materials m on m.material_id = b.material_id;

-- Sections 4, 5, 7: every operation of a scenario's route with design and live values
create view v_route_op_calc as
select x.*,
       case when not x.has_live_data then 'no_live'
            when x.variance_percent > x.alert_threshold_percent then 'high'
            when x.variance_percent > x.alert_threshold_percent / 2 then 'watch'
            else 'ok' end as status
from (
  select s.scenario_id, ro.route_operation_id, ro.op_no, ro.stage, ro.process_name, mc.machine_name,
         ro.hours, ro.kw, ro.utilisation, ro.process_cf_per_kg, ro.mass_basis_kg,
         s.electricity_factor, s.alert_threshold_percent,
         ro.expected_kwh                                                   as design_kwh,
         ro.expected_kwh * s.electricity_factor + ro.mass_basis_kg * ro.process_cf_per_kg as design_kgco2e,
         ro.expected_kwh * 3.6                                             as design_mj,
         coalesce(lv.kwh, ro.expected_kwh)                                 as live_kwh,
         lv.kwh is not null                                                as has_live_data,
         coalesce(lv.kwh, ro.expected_kwh) - ro.expected_kwh               as variance_kwh,
         case when ro.expected_kwh > 0 then (coalesce(lv.kwh, ro.expected_kwh) - ro.expected_kwh) / ro.expected_kwh * 100 else 0 end as variance_percent,
         coalesce(lv.kwh, ro.expected_kwh) * s.electricity_factor + ro.mass_basis_kg * ro.process_cf_per_kg as live_kgco2e
  from lca_scenarios s
  join route_operations ro on ro.route_id = s.route_id
  left join machines mc on mc.machine_id = ro.machine_id
  left join (select scenario_id, route_operation_id, sum(kwh) as kwh
             from sensor_readings group by scenario_id, route_operation_id) lv
         on lv.scenario_id = s.scenario_id and lv.route_operation_id = ro.route_operation_id
) x;

-- Section 5 and 7 KPI boxes: one row per scenario
create view v_scenario_summary as
select s.scenario_id, s.scenario_name, p.project_name, pt.part_id, pt.part_number, r.route_code, r.route_name,
       s.electricity_factor, s.alert_threshold_percent, s.expected_scrap_percent, s.quantity,
       pt.length_mm / 1000 * pt.width_mm / 1000                                  as plan_area_m2,
       pt.length_mm / 1000 * pt.width_mm / 1000 * pt.thickness_mm / 1000         as volume_m3,
       coalesce(b.mass, 0)                                                       as bom_mass_kg,
       coalesce(b.cf, 0)                                                         as bom_kgco2e,
       coalesce(b.mj, 0)                                                         as bom_ced_mj,
       coalesce(o.manufacturing, 0)                                              as manufacturing_kgco2e,
       coalesce(o.assembly_finishing, 0)                                         as assembly_finishing_kgco2e,
       coalesce(b.cf, 0) + coalesce(o.manufacturing, 0) + coalesce(o.assembly_finishing, 0) as design_total_kgco2e,
       coalesce(b.mj, 0) + coalesce(o.mj, 0)                                     as design_ced_mj,
       coalesce(o.design_kwh, 0)                                                 as design_kwh,
       coalesce(o.live_kwh, 0)                                                   as live_kwh,
       coalesce(b.cf, 0) + coalesce(o.live_cf, 0)                                as live_total_kgco2e,
       coalesce(b.cf, 0) + coalesce(o.live_cf, 0)
         - (coalesce(b.cf, 0) + coalesce(o.manufacturing, 0) + coalesce(o.assembly_finishing, 0)) as variance_kgco2e,
       coalesce(o.live_kwh, 0) - coalesce(o.design_kwh, 0)                       as extra_kwh,
       coalesce(b.missing, 0)                                                    as bom_lines_missing_factor
from lca_scenarios s
join parts pt    on pt.part_id = s.part_id
join projects p  on p.project_id = pt.project_id
join manufacturing_routes r on r.route_id = s.route_id
left join lateral (select sum(consumed_kg) as mass, sum(kgco2e) as cf, sum(mj) as mj,
                          count(*) filter (where factor_missing) as missing
                   from v_bom_calc where scenario_id = s.scenario_id) b on true
left join lateral (select sum(design_kgco2e) filter (where stage = 'Manufacturing') as manufacturing,
                          sum(design_kgco2e) filter (where stage <> 'Manufacturing') as assembly_finishing,
                          sum(design_mj) as mj, sum(design_kwh) as design_kwh, sum(live_kwh) as live_kwh,
                          sum(live_kgco2e) as live_cf
                   from v_route_op_calc where scenario_id = s.scenario_id) o on true;

-- DATA QUALITY: BOM lines whose material has no approved factor (they are NOT in the totals)
create view v_missing_factors as
select scenario_id, bom_item_id, material_code, material_name
from v_bom_calc where factor_missing;

-- ---------- read-only feeds for the dashboard page ----------
create view v_dash_parts as
select pt.part_id, p.project_name, pt.part_number, pt.part_description, pt.functional_unit,
       pt.length_mm, pt.width_mm, pt.thickness_mm
from parts pt join projects p on p.project_id = pt.project_id;

create view v_dash_materials as
select material_id, material_code, material_name, material_type, cf_kgco2e_per_kg as cf_per_kg, ced_mj_per_kg as ced_per_kg
from materials where approved;

create view v_dash_scenarios as
select s.scenario_id, s.part_id, s.route_id, r.route_code, s.scenario_name, s.status, s.electricity_factor,
       s.expected_scrap_percent, s.quantity, s.alert_threshold_percent
from lca_scenarios s join manufacturing_routes r on r.route_id = s.route_id;

create view v_dash_bom as
select bom_item_id, scenario_id, sequence_no, stage, material_name, mass_kg, waste_percent,
       case when not factor_missing then kgco2e / nullif(consumed_kg, 0) end as cf_per_kg,
       case when not factor_missing then mj     / nullif(consumed_kg, 0) end as ced_per_kg
from v_bom_calc;

create view v_dash_layup as
select l.layup_id, l.scenario_id, l.layer_no, m.material_name, l.fabric_type, l.ply_count, l.orientation_deg,
       l.resin_ratio_percent, l.scrap_percent
from layup_schedule l left join materials m on m.material_id = l.material_id;

create view v_dash_operations as
select s.scenario_id, ro.route_operation_id as operation_id, ro.op_no, ro.stage, ro.process_name, mc.machine_name,
       mc.machine_type, ro.hours, ro.kw, ro.utilisation, ro.process_cf_per_kg, ro.mass_basis_kg
from lca_scenarios s
join route_operations ro on ro.route_id = s.route_id
left join machines mc on mc.machine_id = ro.machine_id;

create view v_dash_live as
select scenario_id, route_operation_id as operation_id, sensor_code, machine_state, kwh, recorded_at, run_label
from sensor_readings;

create view v_dash_ai_template as
select template_code, template_name, role_text, task_text, questions_text, constraints_text
from ai_prompt_templates where active;

create view v_dash_recommendation_actions as
select action_id, sort_order, applies_to, action_text, requires_engineering_validation
from recommendation_actions where active;

-- ---------- the dashboard's buttons, as functions ----------
-- "Add BOM item"
create function add_bom_item(p_scenario_id bigint, p_material_code text, p_stage text, p_mass_kg numeric, p_waste_percent numeric default 0)
returns bom_items language plpgsql set search_path = public
as $$
declare r bom_items;
begin
  insert into bom_items (scenario_id, material_id, stage, mass_kg, waste_percent, sequence_no)
  select p_scenario_id, m.material_id, p_stage, p_mass_kg, p_waste_percent,
         coalesce((select max(sequence_no) from bom_items where scenario_id = p_scenario_id), 0) + 1
  from materials m where m.material_code = p_material_code
  returning * into r;
  if r.bom_item_id is null then raise exception 'unknown material code %', p_material_code; end if;
  return r;
end $$;

-- "Load example BOM": replaces the scenario's BOM with the template
create function load_bom_template(p_scenario_id bigint, p_template_code text default 'EXAMPLE_COMPOSITE')
returns integer language plpgsql set search_path = public
as $$
declare n integer;
begin
  delete from bom_items where scenario_id = p_scenario_id;
  insert into bom_items (scenario_id, material_id, stage, mass_kg, waste_percent, sequence_no)
  select p_scenario_id, material_id, stage, mass_kg, waste_percent, sort_order
  from bom_template_items where template_code = p_template_code order by sort_order;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'no template named %', p_template_code; end if;
  return n;
end $$;

-- Choosing a route for a part: creates the scenario (optionally with the example BOM)
create function new_scenario(p_part_id bigint, p_route_code text, p_scenario_name text, p_bom_template text default null)
returns bigint language plpgsql set search_path = public
as $$
declare v_id bigint;
begin
  insert into lca_scenarios (part_id, route_id, scenario_name)
  select p_part_id, route_id, p_scenario_name from manufacturing_routes where route_code = p_route_code
  returning scenario_id into v_id;
  if v_id is null then raise exception 'unknown route code %', p_route_code; end if;
  if p_bom_template is not null then perform load_bom_template(v_id, p_bom_template); end if;
  return v_id;
end $$;

-- "Add live reading"
create function add_live_reading(p_scenario_id bigint, p_route_operation_id bigint, p_sensor_code text, p_kwh numeric, p_machine_state text default 'running')
returns sensor_readings language plpgsql set search_path = public
as $$
declare r sensor_readings;
begin
  insert into sensors (sensor_code, machine_id)
  select p_sensor_code, ro.machine_id from route_operations ro where ro.route_operation_id = p_route_operation_id
  on conflict (sensor_code) do nothing;
  insert into sensor_readings (scenario_id, route_operation_id, sensor_code, kwh, machine_state)
  values (p_scenario_id, p_route_operation_id, p_sensor_code, p_kwh, p_machine_state)
  returning * into r;
  return r;
end $$;

-- "Load example live data": replaces the scenario's readings with the mock-up's examples
-- (fixed meter values for the vacuum infusion route, design kWh + 15 % for the others)
create function load_example_live_data(p_scenario_id bigint)
returns integer language plpgsql set search_path = public
as $$
declare n integer; v_route text;
begin
  select r.route_code into v_route from lca_scenarios s join manufacturing_routes r on r.route_id = s.route_id where s.scenario_id = p_scenario_id;
  if v_route is null then raise exception 'unknown scenario %', p_scenario_id; end if;
  delete from sensor_readings where scenario_id = p_scenario_id;
  insert into sensors (sensor_code, machine_id)
  select case when v_route = 'vacuum_infusion' then (array['MTR-VAC-001','MTR-OVN-PPSS','MTR-CNC-001','MTR-ADH-001','MTR-SPRAY-001'])[ro.op_no]
              else 'MTR-' || v_route || '-' || ro.op_no end, ro.machine_id
  from lca_scenarios s join route_operations ro on ro.route_id = s.route_id where s.scenario_id = p_scenario_id
  on conflict (sensor_code) do nothing;
  insert into sensor_readings (scenario_id, route_operation_id, sensor_code, kwh, machine_state)
  select p_scenario_id, ro.route_operation_id,
         case when v_route = 'vacuum_infusion' then (array['MTR-VAC-001','MTR-OVN-PPSS','MTR-CNC-001','MTR-ADH-001','MTR-SPRAY-001'])[ro.op_no]
              else 'MTR-' || v_route || '-' || ro.op_no end,
         case when v_route = 'vacuum_infusion' then (array[1.45,6.90,1.38,0.08,1.95])[ro.op_no] else ro.expected_kwh * 1.15 end,
         'running'
  from lca_scenarios s join route_operations ro on ro.route_id = s.route_id where s.scenario_id = p_scenario_id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Saves the numbers of sections 5 and 7 (KPI boxes + the comparison table). Returns the snapshot id.
create function save_comparison(p_scenario_id bigint, p_version text default 'v1.0')
returns bigint language plpgsql set search_path = public
as $$
declare v_id bigint;
begin
  insert into lca_snapshots (scenario_id, calculation_version, electricity_factor, alert_threshold_percent, bom_mass_kg, bom_kgco2e, bom_ced_mj,
                             manufacturing_kgco2e, assembly_finishing_kgco2e, design_total_kgco2e, design_ced_mj, design_kwh, live_kwh,
                             live_total_kgco2e, variance_kgco2e, extra_kwh)
  select scenario_id, p_version, electricity_factor, alert_threshold_percent, round(bom_mass_kg, 6), round(bom_kgco2e, 6), round(bom_ced_mj, 6),
         round(manufacturing_kgco2e, 6), round(assembly_finishing_kgco2e, 6), round(design_total_kgco2e, 6), round(design_ced_mj, 6),
         round(design_kwh, 6), round(live_kwh, 6), round(live_total_kgco2e, 6), round(variance_kgco2e, 6), round(extra_kwh, 6)
  from v_scenario_summary where scenario_id = p_scenario_id
  returning snapshot_id into v_id;
  if v_id is null then raise exception 'unknown scenario %', p_scenario_id; end if;
  insert into lca_comparison (snapshot_id, route_operation_id, op_no, stage, process_name, machine_name, design_kwh, live_kwh,
                              variance_kwh, variance_percent, status, has_live_data, design_kgco2e, live_kgco2e)
  select v_id, route_operation_id, op_no, stage, process_name, machine_name, round(design_kwh, 6), round(live_kwh, 6),
         round(variance_kwh, 6), round(variance_percent, 4), status, has_live_data, round(design_kgco2e, 6), round(live_kgco2e, 6)
  from v_route_op_calc where scenario_id = p_scenario_id order by op_no;
  return v_id;
end $$;

-- "Generate prompt": builds the JSON context from a saved comparison, wraps it in the
-- template wording, stores it in ai_prompts and returns the text.
create function generate_ai_prompt(p_snapshot_id bigint, p_template_code text default 'DEFAULT')
returns text language plpgsql set search_path = public
as $$
declare t ai_prompt_templates; ctx jsonb; txt text;
begin
  select * into t from ai_prompt_templates where template_code = p_template_code and active;
  if t.template_id is null then raise exception 'no active prompt template %', p_template_code; end if;
  select jsonb_build_object(
           'project', p.project_name, 'part_number', pt.part_number, 'part_description', pt.part_description,
           'functional_unit', pt.functional_unit, 'selected_route', r.route_name,
           'electricity_factor_kgco2e_per_kwh', sn.electricity_factor,
           'design_total_kgco2e', round(sn.design_total_kgco2e, 3), 'live_total_kgco2e', round(sn.live_total_kgco2e, 3),
           'variance_kgco2e', round(sn.variance_kgco2e, 3), 'extra_kwh', round(sn.extra_kwh, 3),
           'operation_comparison', (select jsonb_agg(jsonb_build_object(
               'id', c.op_no, 'stage', c.stage, 'process', c.process_name, 'machine', c.machine_name,
               'design_kwh', round(c.design_kwh, 3), 'live_kwh', round(c.live_kwh, 3), 'variance_kwh', round(c.variance_kwh, 3),
               'variance_percent', round(c.variance_percent, 1), 'design_kgco2e', round(c.design_kgco2e, 3),
               'live_kgco2e', round(c.live_kgco2e, 3), 'has_live_reading', c.has_live_data) order by c.op_no)
             from lca_comparison c where c.snapshot_id = sn.snapshot_id))
    into ctx
  from lca_snapshots sn
  join lca_scenarios s on s.scenario_id = sn.scenario_id
  join parts pt on pt.part_id = s.part_id
  join projects p on p.project_id = pt.project_id
  join manufacturing_routes r on r.route_id = s.route_id
  where sn.snapshot_id = p_snapshot_id;
  if ctx is null then raise exception 'unknown snapshot %', p_snapshot_id; end if;
  txt := t.role_text || E'\n\n' || t.task_text || E'\n\nContext:\n' || jsonb_pretty(ctx)
         || E'\n\nPlease provide:\n' || t.questions_text || E'\n\nConstraints:\n' || t.constraints_text;
  insert into ai_prompts (snapshot_id, template_id, context, prompt_text) values (p_snapshot_id, t.template_id, ctx, txt);
  return txt;
end $$;

-- "Generate recommendations": operations above the alert threshold (largest excess first),
-- then the standard suggested actions. Returns the number of rows written.
create function generate_recommendations(p_snapshot_id bigint)
returns integer language plpgsql set search_path = public
as $$
declare sn lca_snapshots; n integer := 0; k integer;
begin
  select * into sn from lca_snapshots where snapshot_id = p_snapshot_id;
  if sn.snapshot_id is null then raise exception 'unknown snapshot %', p_snapshot_id; end if;

  insert into ai_recommendations (snapshot_id, scenario_id, route_operation_id, source, finding_type, severity, recommendation_text,
                                  estimated_kwh_saving, estimated_co2e_saving, requires_engineering_validation)
  select sn.snapshot_id, sn.scenario_id, c.route_operation_id, 'rule', 'high_variance', 'high',
         c.machine_name || ' / ' || c.process_name || ': +' || round(c.variance_kwh, 3) || ' kWh, ' || round(c.variance_percent, 1)
           || '% above design. Potential saving if returned to the design baseline.',
         c.variance_kwh, c.variance_kwh * sn.electricity_factor, true
  from lca_comparison c
  where c.snapshot_id = sn.snapshot_id and c.has_live_data and c.variance_percent > sn.alert_threshold_percent
  order by c.variance_kwh desc;
  get diagnostics k = row_count; n := n + k;

  if k = 0 then
    insert into ai_recommendations (snapshot_id, scenario_id, source, finding_type, severity, recommendation_text, requires_engineering_validation)
    select sn.snapshot_id, sn.scenario_id, 'rule', 'note', 'info',
           case when exists (select 1 from lca_comparison where snapshot_id = sn.snapshot_id and has_live_data)
                then 'No major high-energy variance above threshold.'
                else 'No live readings are recorded for this scenario yet.' end, false;
    n := n + 1;
  end if;

  insert into ai_recommendations (snapshot_id, scenario_id, source, finding_type, severity, recommendation_text, requires_engineering_validation)
  select sn.snapshot_id, sn.scenario_id, 'library', 'suggested_action', 'info', action_text, requires_engineering_validation
  from recommendation_actions where active order by sort_order;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- Everything the three analysis buttons do, in one call. Returns the snapshot id.
create function run_analysis(p_scenario_id bigint, p_version text default 'v1.0')
returns bigint language plpgsql set search_path = public
as $$
declare v_id bigint;
begin
  v_id := save_comparison(p_scenario_id, p_version);
  perform generate_ai_prompt(v_id);
  perform generate_recommendations(v_id);
  return v_id;
end $$;

-- ---------- access control ----------
-- Nobody without a login can read or write anything. Every signed-in team member has full access.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy team_access on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from public, anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------- notes shown in the Supabase table editor ----------
comment on table projects is 'Dashboard section 2: project.';
comment on table parts is 'Dashboard section 2: part number, description, functional unit, dimensions.';
comment on table materials is 'Dashboard section 3: material drop-down with carbon (kg CO2e/kg) and energy (MJ/kg) factors. Only approved rows are used.';
comment on table bom_items is 'Dashboard section 3: BOM of a scenario. "Add BOM item" = add_bom_item(); "Load example BOM" = load_bom_template(); "Remove" = delete.';
comment on table bom_template_items is 'Dashboard section 3: the example BOM that "Load example BOM" copies.';
comment on table layup_schedule is 'Dashboard section 3: layup definition (ply count, orientation, fabric type, resin ratio, scrap).';
comment on table manufacturing_routes is 'Dashboard section 4: route drop-down (vacuum infusion, RTM, compression moulding, prepreg + autoclave).';
comment on table route_operations is 'Dashboard section 4: process steps of a route with hours, kW, utilisation, expected kWh and process factor.';
comment on table machines is 'Machines named in the route table.';
comment on table lca_scenarios is 'Dashboard sections 2/4: one part made by one route, with electricity factor, expected scrap %, quantity and alert %.';
comment on table sensors is 'Dashboard section 6: meter IDs.';
comment on table sensor_readings is 'Dashboard section 6: live kWh per operation. "Add live reading" = add_live_reading(); "Load example live data" = load_example_live_data().';
comment on table lca_snapshots is 'Dashboard sections 5 and 7: saved KPI numbers (save_comparison()).';
comment on table lca_comparison is 'Dashboard section 7: saved design vs live table, one row per operation.';
comment on table ai_prompt_templates is 'Dashboard section 8: the wording of the AI improvement prompt (role, task, questions, constraints).';
comment on table ai_prompts is 'Dashboard section 8: every prompt generated by generate_ai_prompt(), with its JSON context.';
comment on table recommendation_actions is 'Dashboard section 9: the standard suggested-actions list.';
comment on table ai_recommendations is 'Dashboard section 9: findings and actions from generate_recommendations(), with owner, saving and validation status.';
comment on column bom_items.consumed_kg is 'GENERATED: mass x (1 + waste %/100).';
comment on column route_operations.expected_kwh is 'GENERATED: hours x kW x utilisation (design energy per part).';
comment on column route_operations.process_cf_per_kg is 'kg CO2e per kg of material processed; applied to mass_basis_kg.';
comment on column lca_scenarios.electricity_factor is 'kg CO2e per kWh of electricity.';
comment on column lca_scenarios.expected_scrap_percent is 'Stored as in the mock-up; not used in the totals.';
comment on column lca_scenarios.quantity is 'Stored as in the mock-up; totals are per finished part.';
comment on column lca_scenarios.alert_threshold_percent is 'Live energy above design by more than this = High energy; above half of it = Watch.';
