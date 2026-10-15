-- =====================================================================
-- 0_reset_database.sql — removes everything created by files 1, 2 and 3 (older versions too):
-- all tables, views and functions of this project, and all data in them.
-- Then re-run 1_schema.sql, 2_views_and_security.sql and 3_sample_data.sql in that order.
-- It only drops the objects listed here; it does not touch Supabase's own schemas.
-- =====================================================================
-- views (current and earlier versions)
drop view if exists
  v_dash_floor_machines, v_dash_floor_zones, v_dash_floor,
  v_dash_recommendation_actions, v_dash_ai_template, v_dash_live, v_dash_operations, v_dash_layup, v_dash_bom,
  v_dash_scenarios, v_dash_materials, v_dash_parts, v_missing_factors, v_scenario_summary, v_route_op_calc, v_bom_calc,
  v_energy_comparison, v_bom_missing_factors, v_scenario_totals, v_impact_lines cascade;
-- functions
drop function if exists run_analysis(bigint, text), generate_recommendations(bigint), generate_ai_prompt(bigint, text),
  save_comparison(bigint, text), load_example_live_data(bigint), add_live_reading(bigint, bigint, text, numeric, text),
  new_scenario(bigint, text, text, text), load_bom_template(bigint, text), add_bom_item(bigint, text, text, numeric, numeric),
  check_reading_operation(), refresh_operation_energy_comparison(bigint), reset_identity_sequences() cascade;
-- tables (current and earlier versions)
drop table if exists
  machine_locations, factory_zones, factory_floors,
  ai_recommendations, recommendation_actions, ai_prompts, ai_prompt_templates, lca_comparison, lca_snapshots,
  sensor_readings, sensors, route_operations, machines, layup_schedule, bom_template_items, bom_items,
  lca_scenarios, manufacturing_routes, materials, parts, projects,
  energy_actions, operation_energy_comparison, lca_results, sensor_devices, production_batches, scenario_operations,
  equipment_factors, equipment, organisations, material_properties, item_sources, lca_factors, lca_items, sources,
  impact_categories, lifecycle_stages cascade;
