-- =====================================================================
-- 4_dashboard_access_OPTIONAL.sql — let the public dashboard read results
-- Only needed to show LIVE Supabase data on the GitHub Pages dashboard.
-- It lets anyone with the page's (public) anon key read these three views.
-- Run it ONLY while the database holds simulated data. Before loading real
-- company data, undo it with the REVOKE block below (or keep the dashboard
-- on the built-in sample data).
-- =====================================================================
grant select on v_scenario_totals, v_bom_missing_factors, v_energy_comparison to anon;

-- UNDO (run this before real data goes in):
-- revoke select on v_scenario_totals, v_bom_missing_factors, v_energy_comparison from anon;
