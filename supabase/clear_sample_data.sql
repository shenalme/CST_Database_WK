-- Empties every data table (to remove the simulated sample data before loading real data).
-- Keeps tables, views, functions and security. Cannot be undone.
truncate table
  energy_actions, ai_recommendations, operation_energy_comparison, lca_results, sensor_readings,
  sensor_devices, production_batches, scenario_operations, bom_items, lca_scenarios,
  equipment_factors, equipment, parts, projects, organisations, material_properties,
  item_sources, lca_factors, lca_items, sources, impact_categories, lifecycle_stages
restart identity;
