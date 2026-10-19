-- =====================================================================
-- 8_users_and_roles.sql — sign-in, roles, "add a project" and the admin dashboard
-- Run it LAST (after files 1 to 7). Safe to run again.
--
-- WHO MAY DO WHAT (enforced here in the database, not by hiding buttons on a web page)
--   viewer : can read everything in the project
--   editor : viewer + can add projects, parts and scenarios and change a project's status
--   admin  : editor + sees the admin dashboard, manages users' roles, can delete a project
--   a signed-in account WITHOUT a role can do nothing (so switching sign-ups on by mistake does not open the data)
--
-- People sign in on admin.html with an e-mail and password (Supabase Authentication). You create the accounts yourself:
--   Supabase -> Authentication -> Users -> Add user  (and, under Authentication -> Sign In / Providers, switch OFF
--   "Allow new users to sign up" so nobody can register themselves).
-- The FIRST administrator is made here, once, by e-mail (replace the address):
--     insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
-- After that the admin page can give roles to everybody else.
-- =====================================================================

create table if not exists user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);
alter table user_roles enable row level security;          -- no policy: only the functions below can read or change it
revoke all on user_roles from anon, authenticated;

-- the role of whoever is calling (null = signed in but no role, or not signed in)
create or replace function app_role() returns text
language sql stable security definer set search_path = public, auth
as $$ select role from public.user_roles where user_id = auth.uid() $$;
revoke all on function app_role() from public, anon;
grant execute on function app_role() to authenticated;

-- internal check used by every function below; raises a readable message
create or replace function _require_role(p_roles text[]) returns text
language plpgsql stable security definer set search_path = public, auth
as $$
declare r text := public.app_role();
begin
  if r is null then raise exception 'This account has no access yet. Ask an administrator to give it a role.' using errcode = '42501'; end if;
  if not (r = any (p_roles)) then raise exception 'Your role (%) is not allowed to do this.', r using errcode = '42501'; end if;
  return r;
end $$;
revoke all on function _require_role(text[]) from public, anon, authenticated;

-- Tables: signed-in people read if they have any role and write if they are editor or admin
-- (replaces the earlier "every signed-in user" policy). The public key's read-only views are unchanged.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not in ('user_roles', 'ingest_tokens') loop
    execute format('drop policy if exists team_access on public.%I', t);
    execute format('drop policy if exists role_read on public.%I', t);
    execute format('drop policy if exists role_write on public.%I', t);
    execute format('create policy role_read on public.%I for select to authenticated using (public.app_role() is not null)', t);
    execute format('create policy role_write on public.%I for all to authenticated using (public.app_role() in (''admin'', ''editor'')) with check (public.app_role() in (''admin'', ''editor''))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- What the admin page calls (all return JSON; all check the role first)
-- ---------------------------------------------------------------------
create or replace function my_role() returns text
language sql stable security definer set search_path = public, auth
as $$ select public.app_role() $$;

-- routes and BOM templates to choose from when adding a project
create or replace function list_routes() returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform _require_role(array['admin', 'editor', 'viewer']);
  return jsonb_build_object(
    'routes', (select coalesce(jsonb_agg(jsonb_build_object('route_code', route_code, 'route_name', route_name, 'description', description) order by route_id), '[]'::jsonb) from manufacturing_routes),
    'bom_templates', (select coalesce(jsonb_agg(distinct template_code), '[]'::jsonb) from bom_template_items));
end $$;

-- every project with its parts and scenarios (and each scenario's design and live footprint)
create or replace function list_projects() returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform _require_role(array['admin', 'editor', 'viewer']);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'project_id', p.project_id, 'project_code', p.project_code, 'project_name', p.project_name, 'customer_name', p.customer_name, 'status', p.status, 'created_at', p.created_at,
      'parts', (select coalesce(jsonb_agg(jsonb_build_object('part_id', pt.part_id, 'part_number', pt.part_number, 'part_description', pt.part_description,
                  'length_mm', pt.length_mm, 'width_mm', pt.width_mm, 'thickness_mm', pt.thickness_mm) order by pt.part_id), '[]'::jsonb) from parts pt where pt.project_id = p.project_id),
      'scenarios', (select coalesce(jsonb_agg(jsonb_build_object('scenario_id', s.scenario_id, 'scenario_name', s.scenario_name, 'part_number', v.part_number, 'route_name', v.route_name,
                  'design_total_kgco2e', round(v.design_total_kgco2e, 3), 'live_total_kgco2e', round(v.live_total_kgco2e, 3), 'bom_lines_missing_factor', v.bom_lines_missing_factor, 'status', s.status) order by s.scenario_id), '[]'::jsonb)
                    from lca_scenarios s join parts pt on pt.part_id = s.part_id join v_scenario_summary v on v.scenario_id = s.scenario_id where pt.project_id = p.project_id)
    ) order by p.project_id desc), '[]'::jsonb) from projects p);
end $$;

-- internal: add a part to a project and (optionally) one scenario per chosen route, each with the example BOM
create or replace function _add_part(p_project_id bigint, p_part_number text, p_part_description text, p_functional_unit text,
                                     p_length_mm numeric, p_width_mm numeric, p_thickness_mm numeric, p_route_codes text[], p_bom_template text) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare v_part bigint; v_ids bigint[] := '{}'; c text; v_name text; v_sid bigint; v_num text := btrim(coalesce(p_part_number, ''));
begin
  if v_num = '' then raise exception 'Please give the part a part number.'; end if;
  if exists (select 1 from parts where project_id = p_project_id and lower(part_number) = lower(v_num)) then raise exception 'This project already has a part numbered "%".', v_num; end if;
  insert into parts (project_id, part_number, part_description, functional_unit, length_mm, width_mm, thickness_mm)
  values (p_project_id, v_num, nullif(btrim(coalesce(p_part_description, '')), ''), nullif(btrim(coalesce(p_functional_unit, '')), ''), p_length_mm, p_width_mm, p_thickness_mm) returning part_id into v_part;
  foreach c in array coalesce(p_route_codes, '{}') loop
    select route_name into v_name from manufacturing_routes where route_code = c;
    if v_name is null then raise exception 'Unknown route "%".', c; end if;
    v_sid := new_scenario(v_part, c, v_name, nullif(btrim(coalesce(p_bom_template, '')), ''));
    v_ids := v_ids || v_sid;
  end loop;
  return jsonb_build_object('part_id', v_part, 'scenario_ids', to_jsonb(v_ids));
end $$;
revoke all on function _add_part(bigint, text, text, text, numeric, numeric, numeric, text[], text) from public, anon, authenticated;

-- "Add project": the project, its first part and a scenario for each chosen route, in one step
create or replace function create_project_setup(
  p_project_name text, p_project_code text default null, p_customer_name text default null,
  p_part_number text default null, p_part_description text default null, p_functional_unit text default null,
  p_length_mm numeric default null, p_width_mm numeric default null, p_thickness_mm numeric default null,
  p_route_codes text[] default '{}', p_bom_template text default null) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare v_pid bigint; v_name text := btrim(coalesce(p_project_name, '')); v_code text := nullif(btrim(coalesce(p_project_code, '')), ''); v_part jsonb;
begin
  perform _require_role(array['admin', 'editor']);
  if v_name = '' then raise exception 'Please give the project a name.'; end if;
  if v_code is not null and exists (select 1 from projects where lower(project_code) = lower(v_code)) then raise exception 'A project with the code "%" already exists.', v_code; end if;
  insert into projects (project_name, project_code, customer_name) values (v_name, v_code, nullif(btrim(coalesce(p_customer_name, '')), '')) returning project_id into v_pid;
  if nullif(btrim(coalesce(p_part_number, '')), '') is not null then
    v_part := _add_part(v_pid, p_part_number, p_part_description, p_functional_unit, p_length_mm, p_width_mm, p_thickness_mm, p_route_codes, p_bom_template);
  end if;
  return jsonb_build_object('project_id', v_pid) || coalesce(v_part, '{}'::jsonb);
end $$;

-- add another part (and its route scenarios) to an existing project
create or replace function add_part_to_project(
  p_project_id bigint, p_part_number text, p_part_description text default null, p_functional_unit text default null,
  p_length_mm numeric default null, p_width_mm numeric default null, p_thickness_mm numeric default null,
  p_route_codes text[] default '{}', p_bom_template text default null) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
begin
  perform _require_role(array['admin', 'editor']);
  if not exists (select 1 from projects where project_id = p_project_id) then raise exception 'Unknown project.'; end if;
  return _add_part(p_project_id, p_part_number, p_part_description, p_functional_unit, p_length_mm, p_width_mm, p_thickness_mm, p_route_codes, p_bom_template);
end $$;

create or replace function set_project_status(p_project_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
begin
  perform _require_role(array['admin', 'editor']);
  if p_status not in ('active', 'on_hold', 'completed', 'archived') then raise exception 'Status must be active, on_hold, completed or archived.'; end if;
  update projects set status = p_status where project_id = p_project_id;
  if not found then raise exception 'Unknown project.'; end if;
  return jsonb_build_object('project_id', p_project_id, 'status', p_status);
end $$;

-- ---------- administrators only ----------
create or replace function admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
declare v_ing jsonb := '{}'::jsonb;
begin
  perform _require_role(array['admin']);
  if to_regclass('public.ingest_tokens') is not null then
    execute 'select jsonb_build_object(''active_tokens'', count(*) filter (where active), ''last_used_at'', max(last_used_at)) from ingest_tokens' into v_ing;
  end if;
  return jsonb_build_object(
    'counts', jsonb_build_object(
      'projects', (select count(*) from projects), 'parts', (select count(*) from parts), 'scenarios', (select count(*) from lca_scenarios),
      'bom_items', (select count(*) from bom_items), 'materials', (select count(*) from materials), 'materials_unapproved', (select count(*) from materials where not approved),
      'machines', (select count(*) from machines), 'sensors', (select count(*) from sensors), 'readings', (select count(*) from sensor_readings),
      'snapshots', (select count(*) from lca_snapshots), 'recommendations', (select count(*) from ai_recommendations),
      'users', (select count(*) from auth.users), 'admins', (select count(*) from user_roles where role = 'admin'),
      'editors', (select count(*) from user_roles where role = 'editor'), 'viewers', (select count(*) from user_roles where role = 'viewer')),
    'last_reading_at', (select max(recorded_at) from sensor_readings),
    'readings_24h', (select count(*) from sensor_readings where recorded_at > now() - interval '24 hours'),
    'ingest', v_ing,
    'quality', jsonb_build_object(
      'missing_factor_lines', (select count(*) from v_missing_factors),
      'unapproved_materials', (select coalesce(jsonb_agg(material_name order by material_name), '[]'::jsonb) from materials where not approved),
      'scenarios_without_bom', (select coalesce(jsonb_agg(s.scenario_name order by s.scenario_id), '[]'::jsonb) from lca_scenarios s where not exists (select 1 from bom_items b where b.scenario_id = s.scenario_id)),
      'scenarios_without_readings', (select coalesce(jsonb_agg(s.scenario_name order by s.scenario_id), '[]'::jsonb) from lca_scenarios s where not exists (select 1 from sensor_readings r where r.scenario_id = s.scenario_id))),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('project_id', p.project_id, 'project_code', p.project_code, 'project_name', p.project_name, 'status', p.status, 'created_at', p.created_at,
        'parts', (select count(*) from parts pt where pt.project_id = p.project_id),
        'scenarios', (select count(*) from lca_scenarios s join parts pt on pt.part_id = s.part_id where pt.project_id = p.project_id)) order by p.project_id desc), '[]'::jsonb) from projects p),
    'scenarios', (select coalesce(jsonb_agg(jsonb_build_object('scenario_id', scenario_id, 'scenario_name', scenario_name, 'part_number', part_number, 'route_name', route_name,
        'design_total_kgco2e', round(design_total_kgco2e, 3), 'live_total_kgco2e', round(live_total_kgco2e, 3), 'design_kwh', round(design_kwh, 3)) order by scenario_id), '[]'::jsonb) from v_scenario_summary),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'label', label, 'at', at) order by at desc), '[]'::jsonb) from (
        select * from (
          select 'Project created' as kind, project_name as label, created_at as at from projects
          union all select 'Scenario created', scenario_name, created_at from lca_scenarios
          union all select 'Material added', material_name, created_at from materials
          union all select 'Comparison saved', 'scenario ' || scenario_id::text, calculated_at from lca_snapshots
          union all select 'Recommendation', left(recommendation_text, 70), created_at from ai_recommendations
          union all select 'Meter reading', sensor_code || ': ' || kwh::text || ' kWh', recorded_at from sensor_readings) a
        order by at desc limit 15) b));
end $$;

create or replace function admin_users() returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  perform _require_role(array['admin']);
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'role', r.role) order by u.email), '[]'::jsonb)
          from auth.users u left join user_roles r on r.user_id = u.id);
end $$;

create or replace function admin_set_role(p_user_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare v_old text;
begin
  perform _require_role(array['admin']);
  if p_role not in ('admin', 'editor', 'viewer', 'none') then raise exception 'Role must be admin, editor, viewer or none.'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Unknown user.'; end if;
  select role into v_old from user_roles where user_id = p_user_id;
  if v_old = 'admin' and p_role <> 'admin' and (select count(*) from user_roles where role = 'admin') <= 1 then raise exception 'There must always be at least one administrator.'; end if;
  if p_role = 'none' then delete from user_roles where user_id = p_user_id;
  else insert into user_roles (user_id, role) values (p_user_id, p_role) on conflict (user_id) do update set role = excluded.role; end if;
  return jsonb_build_object('user_id', p_user_id, 'role', case when p_role = 'none' then null else p_role end);
end $$;

-- deletes a project and everything that hangs off it (parts, scenarios, BOM, readings, saved results). Cannot be undone.
create or replace function admin_delete_project(p_project_id bigint) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare n_s int; n_p int;
begin
  perform _require_role(array['admin']);
  if not exists (select 1 from projects where project_id = p_project_id) then raise exception 'Unknown project.'; end if;
  delete from lca_snapshots where scenario_id in (select s.scenario_id from lca_scenarios s join parts pt on pt.part_id = s.part_id where pt.project_id = p_project_id);
  delete from lca_scenarios where part_id in (select part_id from parts where project_id = p_project_id);
  get diagnostics n_s = row_count;
  delete from parts where project_id = p_project_id;
  get diagnostics n_p = row_count;
  delete from projects where project_id = p_project_id;
  return jsonb_build_object('deleted_project_id', p_project_id, 'parts', n_p, 'scenarios', n_s);
end $$;

-- who may call what: signed-in users only (each function then checks the role itself)
revoke all on function my_role(), list_routes(), list_projects(), create_project_setup(text, text, text, text, text, text, numeric, numeric, numeric, text[], text),
  add_part_to_project(bigint, text, text, text, numeric, numeric, numeric, text[], text), set_project_status(bigint, text), admin_overview(), admin_users(),
  admin_set_role(uuid, text), admin_delete_project(bigint) from public, anon;
grant execute on function my_role(), list_routes(), list_projects(), create_project_setup(text, text, text, text, text, text, numeric, numeric, numeric, text[], text),
  add_part_to_project(bigint, text, text, text, numeric, numeric, numeric, text[], text), set_project_status(bigint, text), admin_overview(), admin_users(),
  admin_set_role(uuid, text), admin_delete_project(bigint) to authenticated;

comment on table user_roles is 'Who may do what: admin, editor or viewer. Managed on admin.html (administrators) or with SQL.';
comment on function create_project_setup(text, text, text, text, text, text, numeric, numeric, numeric, text[], text) is 'admin.html "Add project": project + first part + one scenario per chosen route (with the example BOM). Editors and admins only.';
comment on function admin_overview() is 'admin.html "Admin dashboard" data. Administrators only.';
