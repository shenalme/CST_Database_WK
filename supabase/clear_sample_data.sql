-- Empties every data table (to remove the sample data before loading real data).
-- Keeps tables, views, functions and security. Cannot be undone.
truncate table
  ai_recommendations, ai_prompts, lca_comparison, lca_snapshots, sensor_readings, sensors, layup_schedule,
  bom_items, bom_template_items, lca_scenarios, route_operations, machines, manufacturing_routes,
  materials, parts, projects, ai_prompt_templates, recommendation_actions
restart identity cascade;
-- digital twin layout (only if 4_digital_twin.sql was installed)
do $$ begin
  if to_regclass('public.factory_floors') is not null then
    truncate table factory_zones, factory_floors restart identity cascade;
  end if;
end $$;
