-- =====================================================================
-- 7_sensor_ingest.sql — let a sensor, a gateway or a test script send readings to the database
-- Optional. Run it after files 1 to 6. Safe to run once more.
--
-- The public key on the website can only READ. A device needs a way to WRITE that is as narrow as possible, so:
--   * a device token (a long random secret, stored only as a hash) proves the sender is allowed to send;
--   * the only thing a token can do is call ingest_reading(), which adds one row to sensor_readings;
--   * it cannot read, change or delete anything else.
-- Create a token (shown ONCE; copy it into the script's secrets, never into GitHub):
--     select create_ingest_token('colab-simulator');
-- Switch a token off:  update ingest_tokens set active = false where label = 'colab-simulator';
--
-- Readings belong to a RUN (run_label, for example one production cycle of one part). The dashboard and the twin use the
-- readings of the LATEST run of each scenario, so a stream of readings never adds up forever and a new run replaces the last.
-- =====================================================================
create table if not exists ingest_tokens (
  token_hash   text primary key,                -- sha256 of the token; the token itself is never stored
  label        varchar(100) not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
alter table ingest_tokens enable row level security;     -- no policy: invisible to the public key and to signed-in users
revoke all on ingest_tokens from anon, authenticated;

-- Run in the SQL editor (as the project owner). Returns the new token once.
create or replace function create_ingest_token(p_label text) returns text
language plpgsql security definer set search_path = public
as $$
declare v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into ingest_tokens (token_hash, label) values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_label);
  return v_token;
end $$;
revoke all on function create_ingest_token(text) from public, anon, authenticated;

-- What the sensor calls. Returns the id of the stored reading.
create or replace function ingest_reading(
  p_token text, p_scenario_id bigint, p_route_operation_id bigint, p_sensor_code text, p_kwh numeric,
  p_machine_state text default 'running', p_run_label text default null, p_recorded_at timestamptz default null)
returns bigint language plpgsql security definer set search_path = public
as $$
declare v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex'); v_op route_operations; v_sensor sensors; v_id bigint;
begin
  update ingest_tokens set last_used_at = now() where token_hash = v_hash and active;
  if not found then raise exception 'invalid or inactive device token' using errcode = '28000'; end if;
  if p_kwh is null or p_kwh < 0 or p_kwh > 100000 then raise exception 'kwh must be between 0 and 100000'; end if;
  select * into v_op from route_operations where route_operation_id = p_route_operation_id;
  if v_op.route_operation_id is null then raise exception 'unknown operation %', p_route_operation_id; end if;
  if not exists (select 1 from lca_scenarios where scenario_id = p_scenario_id and route_id = v_op.route_id) then
    raise exception 'operation % is not part of the route of scenario %', p_route_operation_id, p_scenario_id;
  end if;
  select * into v_sensor from sensors where sensor_code = p_sensor_code;
  if v_sensor.sensor_code is null then                                       -- first time we hear from this sensor: register it
    insert into sensors (sensor_code, machine_id) values (p_sensor_code, v_op.machine_id);
  elsif v_sensor.machine_id is not null and v_op.machine_id is not null and v_sensor.machine_id <> v_op.machine_id then
    raise exception 'sensor % belongs to another machine than operation %', p_sensor_code, p_route_operation_id;
  end if;
  insert into sensor_readings (scenario_id, route_operation_id, sensor_code, kwh, machine_state, recorded_at, run_label)
  values (p_scenario_id, p_route_operation_id, p_sensor_code, p_kwh, coalesce(p_machine_state, 'running'), coalesce(p_recorded_at, now()), p_run_label)
  returning reading_id into v_id;
  return v_id;
end $$;
revoke all on function ingest_reading(text, bigint, bigint, text, numeric, text, text, timestamptz) from public;
grant execute on function ingest_reading(text, bigint, bigint, text, numeric, text, text, timestamptz) to anon, authenticated;

-- The live numbers use the readings of the latest run of each scenario (same rule in the database calculation and in the dashboard feed).
create or replace view v_dash_live as
select r.scenario_id, r.route_operation_id as operation_id, r.sensor_code, r.machine_state, r.kwh, r.recorded_at, r.run_label
from sensor_readings r
where coalesce(r.run_label, '') = (select coalesce(l.run_label, '') from sensor_readings l
                                   where l.scenario_id = r.scenario_id order by l.recorded_at desc, l.reading_id desc limit 1);

create or replace view v_route_op_calc as
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
  left join (select scenario_id, operation_id as route_operation_id, sum(kwh) as kwh
             from v_dash_live group by scenario_id, operation_id) lv
         on lv.scenario_id = s.scenario_id and lv.route_operation_id = ro.route_operation_id
) x;

comment on table ingest_tokens is 'Device tokens (hashed) allowed to call ingest_reading(). Invisible to the public key.';
comment on function ingest_reading(text, bigint, bigint, text, numeric, text, text, timestamptz) is 'Sensor/gateway entry point: stores one energy reading when given a valid device token.';
