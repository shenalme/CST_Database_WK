-- =====================================================================
-- 2_views_and_security.sql — design-baseline calculation views, comparison
-- function, and access control. Run after 1_schema.sql.
-- Only APPROVED factors that are in date are used in calculations.
-- =====================================================================

-- Every contribution to a scenario's impact, per part.
--   Materials / End of life : BOM gross quantity x factor (factor basis_unit must equal BOM unit)
--                             gross = net / (1 - waste%/100)
--   Electricity             : expected energy per part x scenario electricity_factor (GWP only)
--   Processes               : factor on the process item; basis unit min -> minutes per part,
--                             kg -> process_mass_basis, item -> 1
create view v_impact_lines as
select b.scenario_id,
       case i.item_type when 'end_of_life' then 'End of life' else 'Materials' end as component,
       i.item_name as label, st.stage_code, ic.impact_code, ic.unit as impact_unit,
       b.net_quantity / (1 - b.waste_percentage / 100) * f.factor_value as impact_value
from bom_items b
join lca_items i         on i.item_id = b.item_id
join lifecycle_stages st on st.stage_id = b.stage_id
join lca_factors f       on f.item_id = b.item_id and f.approved and f.basis_unit = b.unit
     and (f.valid_from is null or f.valid_from <= current_date)
     and (f.valid_to   is null or f.valid_to   >= current_date)
join impact_categories ic on ic.impact_category_id = f.impact_category_id
union all
select o.scenario_id, 'Electricity', o.operation_name, st.stage_code, ic.impact_code, ic.unit,
       o.expected_energy_kwh / coalesce(o.batch_size, 1) * s.electricity_factor
from scenario_operations o
join lca_scenarios s     on s.scenario_id = o.scenario_id
join lifecycle_stages st on st.stage_id = o.lifecycle_stage_id
join impact_categories ic on ic.impact_code = 'GWP'
where o.expected_energy_kwh is not null and s.electricity_factor is not null
union all
select o.scenario_id, 'Processes', i.item_name, st.stage_code, ic.impact_code, ic.unit,
       q.qty * f.factor_value
from scenario_operations o
join lca_items i         on i.item_id = o.process_item_id
join lifecycle_stages st on st.stage_id = o.lifecycle_stage_id
join lca_factors f       on f.item_id = o.process_item_id and f.approved
     and (f.valid_from is null or f.valid_from <= current_date)
     and (f.valid_to   is null or f.valid_to   >= current_date)
join impact_categories ic on ic.impact_category_id = f.impact_category_id
cross join lateral (select case f.basis_unit
        when 'min'  then o.expected_duration_minutes / coalesce(o.batch_size, 1)
        when 'kg'   then o.process_mass_basis
        when 'item' then 1 end as qty) q
where q.qty is not null;

-- One row per scenario and impact category: totals and the split by component.
create view v_scenario_totals as
select s.scenario_id, p.project_code, pt.part_number, s.scenario_name, s.status,
       l.impact_code, l.impact_unit,
       sum(l.impact_value)                                                   as total_impact,
       coalesce(sum(l.impact_value) filter (where l.component = 'Materials'),   0) as materials,
       coalesce(sum(l.impact_value) filter (where l.component = 'Processes'),   0) as processes,
       coalesce(sum(l.impact_value) filter (where l.component = 'Electricity'), 0) as electricity,
       coalesce(sum(l.impact_value) filter (where l.component = 'End of life'), 0) as end_of_life,
       (select sum(o.expected_energy_kwh / coalesce(o.batch_size, 1))
          from scenario_operations o where o.scenario_id = s.scenario_id)     as energy_kwh_per_part
from v_impact_lines l
join lca_scenarios s on s.scenario_id = l.scenario_id
join parts pt        on pt.part_id = s.part_id
join projects p      on p.project_id = pt.project_id
group by s.scenario_id, p.project_code, pt.part_number, s.scenario_name, s.status, l.impact_code, l.impact_unit;

-- DATA QUALITY: BOM lines with no approved, in-date, unit-matching factor.
-- Anything listed here is NOT included in the totals.
create view v_bom_missing_factors as
select b.scenario_id, s.scenario_name, i.item_code, i.item_name, b.unit as bom_unit, ic.impact_code
from bom_items b
join lca_scenarios s on s.scenario_id = b.scenario_id
join lca_items i     on i.item_id = b.item_id
cross join impact_categories ic
where not exists (
  select 1 from lca_factors f
  where f.item_id = b.item_id and f.impact_category_id = ic.impact_category_id
    and f.approved and f.basis_unit = b.unit
    and (f.valid_from is null or f.valid_from <= current_date)
    and (f.valid_to   is null or f.valid_to   >= current_date));

-- Expected vs measured energy, with names (Stage 2).
create view v_energy_comparison as
select c.comparison_id, b.batch_code, pt.part_number, o.operation_sequence, o.operation_name,
       c.expected_kwh, c.measured_kwh,
       c.measured_kwh - c.expected_kwh as variance_kwh,
       case when c.expected_kwh > 0 then (c.measured_kwh - c.expected_kwh) / c.expected_kwh * 100 end as variance_pct,
       c.expected_co2e_kg, c.measured_co2e_kg
from operation_energy_comparison c
join production_batches b on b.batch_id = c.batch_id
join scenario_operations o on o.operation_id = c.operation_id
join lca_scenarios s on s.scenario_id = b.scenario_id
join parts pt on pt.part_id = s.part_id;

-- Fill operation_energy_comparison for one batch from the sensor readings.
--   expected = per-cycle energy x (actual quantity / batch_size)
--   measured = sum of 'energy' readings (kWh) tagged with that batch and operation
create function refresh_operation_energy_comparison(p_batch_id bigint) returns integer
language plpgsql set search_path = public
as $$
declare n integer;
begin
  insert into operation_energy_comparison
    (batch_id, operation_id, expected_kwh, measured_kwh, expected_co2e_kg, measured_co2e_kg, calculated_at)
  select b.batch_id, o.operation_id,
         o.expected_energy_kwh * coalesce(b.actual_quantity, b.planned_quantity)::numeric / coalesce(o.batch_size, 1),
         m.kwh,
         o.expected_energy_kwh * coalesce(b.actual_quantity, b.planned_quantity)::numeric / coalesce(o.batch_size, 1) * s.electricity_factor,
         m.kwh * s.electricity_factor,
         now()
  from production_batches b
  join lca_scenarios s on s.scenario_id = b.scenario_id
  join scenario_operations o on o.scenario_id = b.scenario_id
  left join (
    select sr.operation_id, sum(sr.value) as kwh
    from sensor_readings sr join sensor_devices sd on sd.sensor_id = sr.sensor_id
    where sr.batch_id = p_batch_id and sd.measurement_type = 'energy' and sr.unit = 'kWh'
      and coalesce(sr.quality_flag, 'good') = 'good'
    group by sr.operation_id) m on m.operation_id = o.operation_id
  where b.batch_id = p_batch_id and o.expected_energy_kwh is not null
  on conflict (batch_id, operation_id) do update set
    expected_kwh = excluded.expected_kwh, measured_kwh = excluded.measured_kwh,
    expected_co2e_kg = excluded.expected_co2e_kg, measured_co2e_kg = excluded.measured_co2e_kg,
    calculated_at = excluded.calculated_at;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Access control: nobody without a login can read or write anything.
-- Every signed-in team member has full access (refine later if roles are needed).
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Table and field notes (visible in the Supabase table editor)
-- ---------------------------------------------------------------------
comment on table organisations is 'Company or organisation using the system.';
comment on table projects is 'Project, programme or customer-level work. Belongs to one organisation.';
comment on table parts is 'Product or component being assessed. Part number is unique within a project.';
comment on table lca_scenarios is 'A manufacturing option / assumption set for one part. BOM and operations hang off the scenario.';
comment on table lifecycle_stages is 'Agreed stages: manufacturing, use, maintenance, end of life.';
comment on table lca_items is 'Master list of materials, manufacturing processes, use-phase and end-of-life activities.';
comment on table impact_categories is 'Environmental measures reported (e.g. carbon footprint). A new measure is a new row.';
comment on table lca_factors is 'Environmental value of an item for one impact category, with unit, validity, quality and approval.';
comment on table sources is 'References, databases and supplier information behind the values.';
comment on table item_sources is 'Links an item to its sources (replaces Reference 1/2/3 spreadsheet columns).';
comment on table material_properties is 'Reusable material properties such as density.';
comment on table equipment is 'Company machines and equipment.';
comment on table equipment_factors is 'Environmental or energy values specific to a piece of equipment.';
comment on table bom_items is 'Bill of materials of a scenario: item, net quantity per part, unit, waste.';
comment on table scenario_operations is 'Ordered manufacturing steps of a scenario with expected time, power and energy.';
comment on table production_batches is 'Stage 2: real production runs.';
comment on table sensor_devices is 'Stage 2: energy meters and sensors.';
comment on table sensor_readings is 'Stage 2: timestamped measurements. energy readings = kWh in the interval ending at recorded_at.';
comment on table lca_results is 'Calculated design and measured results, with calculation version.';
comment on table operation_energy_comparison is 'Stage 2: expected vs measured energy and carbon per batch and operation.';
comment on table ai_recommendations is 'Stage 3: AI-supported suggestions; engineering validation required by default.';
comment on table energy_actions is 'Stage 3: agreed actions with owner, due date, status, validation outcome.';
comment on column bom_items.net_quantity is 'Quantity in ONE finished part. Gross input = net / (1 - waste_percentage/100).';
comment on column bom_items.waste_percentage is 'Percent of the gross input lost as scrap (0 to <100).';
comment on column lca_scenarios.electricity_factor is 'kg CO2e per kWh of grid electricity used for this scenario.';
comment on column scenario_operations.expected_energy_kwh is 'kWh per CYCLE: minutes/60 x kW x utilisation. Per part = / batch_size.';
comment on column scenario_operations.batch_size is 'Parts processed per cycle.';
comment on column lca_factors.basis_unit is 'The "per ..." unit. Used in a calculation only when it equals the BOM unit (or min/kg/item for processes).';
comment on column lca_factors.approved is 'Only approved, in-date factors are used by the views.';
