-- =====================================================================
-- 6_public_read_access.sql — let the hosted pages read live data
-- Run this LAST (after 1 to 5). The dashboard (index.html) and the digital twin (twin.html) on GitHub Pages
-- read the database through Supabase's public "anon" key. This file lets that key read only these
-- read-only views, nothing else: no tables, no saved prompts, no write access.
-- Anyone who opens your site can therefore read these views. Use it while the database holds example data.
-- Before real company data goes in, run the UNDO block at the bottom (or keep the pages on sample data).
-- =====================================================================
grant select on v_scenario_summary, v_dash_parts, v_dash_materials, v_dash_scenarios, v_dash_bom, v_dash_layup,
                v_dash_operations, v_dash_live, v_dash_ai_template, v_dash_recommendation_actions to anon;

-- digital twin feeds (only if 4_digital_twin.sql was installed)
do $$ begin
  if to_regclass('public.v_dash_floor_machines') is not null then
    grant select on v_dash_floor, v_dash_floor_zones, v_dash_floor_machines to anon;
  end if;
end $$;

-- UNDO (run this before real data goes in):
-- revoke select on v_scenario_summary, v_dash_parts, v_dash_materials, v_dash_scenarios, v_dash_bom, v_dash_layup,
--                  v_dash_operations, v_dash_live, v_dash_ai_template, v_dash_recommendation_actions from anon;
-- revoke select on v_dash_floor, v_dash_floor_zones, v_dash_floor_machines from anon;   -- if the twin was installed
