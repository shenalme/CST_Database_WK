-- AUTO-GENERATED from data/csv/*.csv by tools/build.mjs. SIMULATED / EXAMPLE DATA ONLY.
-- Run once, after 1_schema.sql and 2_views_and_security.sql.
begin;

-- 01_projects.csv
insert into projects (project_id, project_code, project_name, customer_name, status, created_at) values
  ('1', 'CP-LCA', 'Composite Product LCA', 'SIMULATED Customer', 'active', '2025-01-06T09:30:00+00:00');


-- 02_parts.csv
insert into parts (part_id, project_id, part_number, part_description, functional_unit, length_mm, width_mm, thickness_mm, notes) values
  ('1', '1', 'CP-LCA-001', 'Composite structural cover panel', 'One finished composite part', '1000', '500', '3', null);


-- 03_materials.csv
insert into materials (material_id, material_code, material_name, material_type, cf_kgco2e_per_kg, ced_mj_per_kg, source_note, approved, created_at) values
  ('1', 'MAT-CARBON-FIBRE', 'Carbon fibre', 'Fibre', '43.87', '998', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('2', 'MAT-EGLASS-FIBRE', 'E-glass fibre', 'Fibre', '1.27', '32', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('3', 'MAT-EPOXY', 'Epoxy resin', 'Resin', '5.7', '130', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('4', 'MAT-VINYLESTER', 'Vinyl ester resin', 'Resin', '4.59', '107.9', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('5', 'MAT-ADHESIVE-1', 'Adhesive 1', 'Adhesive', '6.2', '140', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('6', 'MAT-PEEL-PLY', 'Peel ply', 'Consumable', '3.0', '70', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('7', 'MAT-VAC-BAG', 'Vacuum bagging film', 'Consumable', '2.5', '60', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('8', 'MAT-PAINT-1', 'Paint 1', 'Finishing', '6.0', '115', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00'),
  ('9', 'MAT-CARDBOARD', 'Cardboard packaging', 'Packaging', '0.9', '12', 'Example value from the team''s dashboard mock-up - to be verified and approved', 'true', '2025-01-08T10:00:00+00:00');


-- 04_machines.csv
insert into machines (machine_id, machine_name, machine_type, rated_power_kw, notes) values
  ('1', 'Vacuum pump', 'vacuum_pump', '0.75', 'SIMULATED - rated power = kW used in the mock-up'),
  ('2', 'PPSS oven', 'oven', '3.2', 'SIMULATED - rated power = kW used in the mock-up'),
  ('3', 'CNC router', 'cnc', '5.0', 'SIMULATED - rated power = kW used in the mock-up'),
  ('4', 'Adhesive dispenser', 'dispenser', '0.5', 'SIMULATED - rated power = kW used in the mock-up'),
  ('5', 'Spray booth', 'spray_booth', '4.0', 'SIMULATED - rated power = kW used in the mock-up'),
  ('6', 'RTM injection unit', 'injection', '1.5', 'SIMULATED - rated power = kW used in the mock-up'),
  ('7', 'Hydraulic press', 'press', '10.0', 'SIMULATED - rated power = kW used in the mock-up'),
  ('8', 'Rivet gun', 'hand_tool', '0.2', 'SIMULATED - rated power = kW used in the mock-up'),
  ('9', 'Cutting/kitting table', 'cutting', '0.2', 'SIMULATED - rated power = kW used in the mock-up'),
  ('10', 'Heated press', 'press', '12.0', 'SIMULATED - rated power = kW used in the mock-up'),
  ('11', 'Sander', 'hand_tool', '0.8', 'SIMULATED - rated power = kW used in the mock-up'),
  ('12', 'Packaging station', 'packaging', '0', 'SIMULATED - rated power = kW used in the mock-up'),
  ('13', 'Autoclave', 'autoclave', '25.0', 'SIMULATED - rated power = kW used in the mock-up');


-- 05_sensors.csv
insert into sensors (sensor_code, machine_id, sensor_type, unit, installed_at) values
  ('MTR-VAC-001', '1', 'energy meter', 'kWh', '2025-02-01T09:00:00+00:00'),
  ('MTR-OVN-PPSS', '2', 'energy meter', 'kWh', '2025-02-01T09:00:00+00:00'),
  ('MTR-CNC-001', '3', 'energy meter', 'kWh', '2025-02-01T09:00:00+00:00'),
  ('MTR-ADH-001', '4', 'energy meter', 'kWh', '2025-02-01T09:00:00+00:00'),
  ('MTR-SPRAY-001', '5', 'energy meter', 'kWh', '2025-02-01T09:00:00+00:00');


-- 06_manufacturing_routes.csv
insert into manufacturing_routes (route_id, route_code, route_name, description) values
  ('1', 'vacuum_infusion', 'Vacuum Infusion Route', null),
  ('2', 'rtm', 'RTM Route', null),
  ('3', 'compression', 'Compression Moulding Route', null),
  ('4', 'prepreg_autoclave', 'Prepreg + Autoclave Route', null);


-- 07_route_operations.csv
insert into route_operations (route_operation_id, route_id, op_no, stage, process_name, machine_id, hours, kw, utilisation, process_cf_per_kg, mass_basis_kg, notes) values
  ('1', '1', '1', 'Manufacturing', 'Vacuum infusion', '1', '2.0', '0.75', '0.8', '1.17', '3.0', null),
  ('2', '1', '2', 'Manufacturing', 'Oven cure', '2', '2.5', '3.2', '0.62', '0', '0', null),
  ('3', '1', '3', 'Assembly', 'CNC trimming', '3', '0.4', '5.0', '0.55', '0', '0', null),
  ('4', '1', '4', 'Assembly', 'Adhesive bonding', '4', '0.2', '0.5', '0.5', '0', '0', null),
  ('5', '1', '5', 'Finishing', 'Paint application', '5', '0.5', '4.0', '0.75', '0', '0', null),
  ('6', '2', '1', 'Manufacturing', 'RTM injection', '6', '0.8', '1.5', '0.6', '1.3', '3.0', null),
  ('7', '2', '2', 'Manufacturing', 'Heated press cure', '7', '1.2', '10.0', '0.65', '0', '0', null),
  ('8', '2', '3', 'Assembly', 'CNC trimming', '3', '0.3', '5.0', '0.55', '0', '0', null),
  ('9', '2', '4', 'Assembly', 'Mechanical fastening', '8', '0.2', '0.2', '0.4', '0', '0', null),
  ('10', '2', '5', 'Finishing', 'Paint application', '5', '0.5', '4.0', '0.75', '0', '0', null),
  ('11', '3', '1', 'Manufacturing', 'Charge preparation', '9', '0.3', '0.2', '0.5', '0.2', '3.0', null),
  ('12', '3', '2', 'Manufacturing', 'Compression moulding', '10', '0.8', '12.0', '0.65', '0.95', '3.0', null),
  ('13', '3', '3', 'Assembly', 'CNC trimming', '3', '0.25', '5.0', '0.55', '0', '0', null),
  ('14', '3', '4', 'Finishing', 'Surface sanding', '11', '0.25', '0.8', '0.5', '0', '0', null),
  ('15', '3', '5', 'Finishing', 'Packaging', '12', '0.2', '0', '0', '0', '0', null),
  ('16', '4', '1', 'Manufacturing', 'Prepreg layup/debulk', '1', '1.0', '0.75', '0.8', '0', '0', null),
  ('17', '4', '2', 'Manufacturing', 'Autoclave cure', '13', '3.0', '25.0', '0.55', '0', '0', null),
  ('18', '4', '3', 'Assembly', 'CNC trimming', '3', '0.35', '5.0', '0.55', '0', '0', null),
  ('19', '4', '4', 'Assembly', 'Adhesive bonding', '4', '0.2', '0.5', '0.5', '0', '0', null),
  ('20', '4', '5', 'Finishing', 'Paint application', '5', '0.5', '4.0', '0.75', '0', '0', null);


-- 08_lca_scenarios.csv
insert into lca_scenarios (scenario_id, part_id, route_id, scenario_name, electricity_factor, expected_scrap_percent, quantity, alert_threshold_percent, status, created_at) values
  ('1', '1', '1', 'Vacuum Infusion Route', '0.26155', '5', '1', '15', 'draft', '2025-01-20T10:00:00+00:00'),
  ('2', '1', '2', 'RTM Route', '0.26155', '5', '1', '15', 'draft', '2025-01-20T10:00:00+00:00'),
  ('3', '1', '3', 'Compression Moulding Route', '0.26155', '5', '1', '15', 'draft', '2025-01-20T10:00:00+00:00'),
  ('4', '1', '4', 'Prepreg + Autoclave Route', '0.26155', '5', '1', '15', 'draft', '2025-01-20T10:00:00+00:00');


-- 09_bom_template_items.csv
insert into bom_template_items (template_code, sort_order, material_id, stage, mass_kg, waste_percent) values
  ('EXAMPLE_COMPOSITE', '1', '1', 'Final laminate', '2.0', '5'),
  ('EXAMPLE_COMPOSITE', '2', '4', 'Final laminate', '1.0', '3'),
  ('EXAMPLE_COMPOSITE', '3', '5', 'Assembly', '0.05', '2'),
  ('EXAMPLE_COMPOSITE', '4', '6', 'Consumable', '0.08', '20'),
  ('EXAMPLE_COMPOSITE', '5', '7', 'Consumable', '0.12', '15'),
  ('EXAMPLE_COMPOSITE', '6', '8', 'Finishing', '0.1', '20'),
  ('EXAMPLE_COMPOSITE', '7', '9', 'Packaging', '0.2', '0');


-- 10_bom_items.csv
insert into bom_items (bom_item_id, scenario_id, material_id, stage, mass_kg, waste_percent, sequence_no, notes) values
  ('1', '1', '1', 'Final laminate', '2.0', '5', '1', null),
  ('2', '1', '4', 'Final laminate', '1.0', '3', '2', null),
  ('3', '1', '5', 'Assembly', '0.05', '2', '3', null),
  ('4', '1', '6', 'Consumable', '0.08', '20', '4', null),
  ('5', '1', '7', 'Consumable', '0.12', '15', '5', null),
  ('6', '1', '8', 'Finishing', '0.1', '20', '6', null),
  ('7', '1', '9', 'Packaging', '0.2', '0', '7', null),
  ('8', '2', '1', 'Final laminate', '2.0', '5', '1', null),
  ('9', '2', '4', 'Final laminate', '1.0', '3', '2', null),
  ('10', '2', '5', 'Assembly', '0.05', '2', '3', null),
  ('11', '2', '6', 'Consumable', '0.08', '20', '4', null),
  ('12', '2', '7', 'Consumable', '0.12', '15', '5', null),
  ('13', '2', '8', 'Finishing', '0.1', '20', '6', null),
  ('14', '2', '9', 'Packaging', '0.2', '0', '7', null),
  ('15', '3', '1', 'Final laminate', '2.0', '5', '1', null),
  ('16', '3', '4', 'Final laminate', '1.0', '3', '2', null),
  ('17', '3', '5', 'Assembly', '0.05', '2', '3', null),
  ('18', '3', '6', 'Consumable', '0.08', '20', '4', null),
  ('19', '3', '7', 'Consumable', '0.12', '15', '5', null),
  ('20', '3', '8', 'Finishing', '0.1', '20', '6', null),
  ('21', '3', '9', 'Packaging', '0.2', '0', '7', null),
  ('22', '4', '1', 'Final laminate', '2.0', '5', '1', null),
  ('23', '4', '4', 'Final laminate', '1.0', '3', '2', null),
  ('24', '4', '5', 'Assembly', '0.05', '2', '3', null),
  ('25', '4', '6', 'Consumable', '0.08', '20', '4', null),
  ('26', '4', '7', 'Consumable', '0.12', '15', '5', null),
  ('27', '4', '8', 'Finishing', '0.1', '20', '6', null),
  ('28', '4', '9', 'Packaging', '0.2', '0', '7', null);


-- 11_layup_schedule.csv
insert into layup_schedule (layup_id, scenario_id, layer_no, material_id, fabric_type, ply_count, orientation_deg, resin_ratio_percent, scrap_percent, notes) values
  ('1', '1', '1', '1', 'Carbon fabric (SIMULATED)', '2', '0', '35', '5', 'SIMULATED layup - replace with the real schedule'),
  ('2', '1', '2', '1', 'Carbon fabric (SIMULATED)', '2', '90', '35', '5', 'SIMULATED layup'),
  ('3', '1', '3', '1', 'Carbon fabric (SIMULATED)', '2', '45', '35', '5', 'SIMULATED layup'),
  ('4', '1', '4', '1', 'Carbon fabric (SIMULATED)', '2', '-45', '35', '5', 'SIMULATED layup');


-- 12_sensor_readings.csv
insert into sensor_readings (reading_id, scenario_id, route_operation_id, sensor_code, kwh, machine_state, recorded_at, run_label) values
  ('1', '1', '1', 'MTR-VAC-001', '1.45', 'running', '2025-03-10T10:00:00+00:00', 'B-2025-0001'),
  ('2', '1', '2', 'MTR-OVN-PPSS', '6.9', 'running', '2025-03-10T13:00:00+00:00', 'B-2025-0001'),
  ('3', '1', '3', 'MTR-CNC-001', '1.38', 'running', '2025-03-10T13:30:00+00:00', 'B-2025-0001'),
  ('4', '1', '4', 'MTR-ADH-001', '0.08', 'running', '2025-03-10T14:00:00+00:00', 'B-2025-0001'),
  ('5', '1', '5', 'MTR-SPRAY-001', '1.95', 'running', '2025-03-10T15:00:00+00:00', 'B-2025-0001');


-- 13_ai_prompt_templates.csv
insert into ai_prompt_templates (template_id, template_code, template_name, role_text, task_text, questions_text, constraints_text, active) values
  ('1', 'DEFAULT', 'Energy optimisation prompt (from the dashboard)', 'You are an energy optimisation and composite manufacturing LCA assistant.', 'Analyse this composite product LCA comparison.', '1. Executive summary.
2. Best and worst manufacturing route observations.
3. Main energy and carbon hotspots.
4. Processes where live energy is higher than design baseline.
5. Likely causes of high energy use.
6. Quick-win actions that do not affect product quality.
7. Engineering changes requiring validation.
8. Sensor/data quality issues.
9. Prioritised action plan with owner, timescale, risk and estimated kWh / kg CO2e saving.', '- Do not recommend changing cure time, cure temperature, vacuum hold, pressure or material specification unless validated by engineering qualification.
- Keep BOM/material LCA separate from live energy variance unless actual material consumption also changes.
- Protect product quality, traceability and safety.', 'true');


-- 14_recommendation_actions.csv
insert into recommendation_actions (action_id, sort_order, applies_to, action_text, requires_engineering_validation, active) values
  ('1', '1', 'general', 'Check idle energy and separate running, waiting, standby and fault states.', 'false', 'true'),
  ('2', '2', 'oven_autoclave', 'For ovens/autoclaves, check loading efficiency, heat-up time, door openings and cycle batching.', 'false', 'true'),
  ('3', '3', 'vacuum_infusion', 'For vacuum infusion, check vacuum leaks, pump sizing and unnecessary pump running time.', 'false', 'true'),
  ('4', '4', 'cnc_trimming', 'For CNC/trimming, check tool path efficiency, extraction running time and batch scheduling.', 'false', 'true'),
  ('5', '5', 'general', 'Replace assumed design energy baselines with measured averages after several production runs.', 'false', 'true'),
  ('6', '6', 'general', 'Do not change cure or pressure parameters without engineering validation.', 'true', 'true');


-- 15_lca_snapshots.csv
insert into lca_snapshots (snapshot_id, scenario_id, calculation_version, calculated_at, electricity_factor, alert_threshold_percent, bom_mass_kg, bom_kgco2e, bom_ced_mj, manufacturing_kgco2e, assembly_finishing_kgco2e, design_total_kgco2e, design_ced_mj, design_kwh, live_kwh, live_total_kgco2e, variance_kgco2e, extra_kwh) values
  ('1', '1', 'v1.0-SIMULATED', '2025-03-14T08:00:00+00:00', '0.26155', '15', '3.735000', '98.703900', '2245.277000', '5.121148', '0.693108', '104.518156', '2276.993000', '8.810000', '11.760000', '105.289728', '0.771573', '2.950000');


-- 16_lca_comparison.csv
insert into lca_comparison (comparison_id, snapshot_id, route_operation_id, op_no, stage, process_name, machine_name, design_kwh, live_kwh, variance_kwh, variance_percent, status, has_live_data, design_kgco2e, live_kgco2e) values
  ('1', '1', '1', '1', 'Manufacturing', 'Vacuum infusion', 'Vacuum pump', '1.200000', '1.450000', '0.250000', '20.8333', 'high', 'true', '3.823860', '3.889248'),
  ('2', '1', '2', '2', 'Manufacturing', 'Oven cure', 'PPSS oven', '4.960000', '6.900000', '1.940000', '39.1129', 'high', 'true', '1.297288', '1.804695'),
  ('3', '1', '3', '3', 'Assembly', 'CNC trimming', 'CNC router', '1.100000', '1.380000', '0.280000', '25.4545', 'high', 'true', '0.287705', '0.360939'),
  ('4', '1', '4', '4', 'Assembly', 'Adhesive bonding', 'Adhesive dispenser', '0.050000', '0.080000', '0.030000', '60.0000', 'high', 'true', '0.013078', '0.020924'),
  ('5', '1', '5', '5', 'Finishing', 'Paint application', 'Spray booth', '1.500000', '1.950000', '0.450000', '30.0000', 'high', 'true', '0.392325', '0.510023');


-- 17_ai_prompts.csv
insert into ai_prompts (prompt_id, snapshot_id, template_id, context, prompt_text, created_at) values
  ('1', '1', '1', '{"project": "Composite Product LCA", "extra_kwh": 2.950, "part_number": "CP-LCA-001", "selected_route": "Vacuum Infusion Route", "functional_unit": "One finished composite part", "variance_kgco2e": 0.772, "part_description": "Composite structural cover panel", "live_total_kgco2e": 105.290, "design_total_kgco2e": 104.518, "operation_comparison": [{"id": 1, "stage": "Manufacturing", "machine": "Vacuum pump", "process": "Vacuum infusion", "live_kwh": 1.450, "design_kwh": 1.200, "live_kgco2e": 3.889, "variance_kwh": 0.250, "design_kgco2e": 3.824, "has_live_reading": true, "variance_percent": 20.8}, {"id": 2, "stage": "Manufacturing", "machine": "PPSS oven", "process": "Oven cure", "live_kwh": 6.900, "design_kwh": 4.960, "live_kgco2e": 1.805, "variance_kwh": 1.940, "design_kgco2e": 1.297, "has_live_reading": true, "variance_percent": 39.1}, {"id": 3, "stage": "Assembly", "machine": "CNC router", "process": "CNC trimming", "live_kwh": 1.380, "design_kwh": 1.100, "live_kgco2e": 0.361, "variance_kwh": 0.280, "design_kgco2e": 0.288, "has_live_reading": true, "variance_percent": 25.5}, {"id": 4, "stage": "Assembly", "machine": "Adhesive dispenser", "process": "Adhesive bonding", "live_kwh": 0.080, "design_kwh": 0.050, "live_kgco2e": 0.021, "variance_kwh": 0.030, "design_kgco2e": 0.013, "has_live_reading": true, "variance_percent": 60.0}, {"id": 5, "stage": "Finishing", "machine": "Spray booth", "process": "Paint application", "live_kwh": 1.950, "design_kwh": 1.500, "live_kgco2e": 0.510, "variance_kwh": 0.450, "design_kgco2e": 0.392, "has_live_reading": true, "variance_percent": 30.0}], "electricity_factor_kgco2e_per_kwh": 0.26155}', 'You are an energy optimisation and composite manufacturing LCA assistant.

Analyse this composite product LCA comparison.

Context:
{
    "project": "Composite Product LCA",
    "extra_kwh": 2.950,
    "part_number": "CP-LCA-001",
    "selected_route": "Vacuum Infusion Route",
    "functional_unit": "One finished composite part",
    "variance_kgco2e": 0.772,
    "part_description": "Composite structural cover panel",
    "live_total_kgco2e": 105.290,
    "design_total_kgco2e": 104.518,
    "operation_comparison": [
        {
            "id": 1,
            "stage": "Manufacturing",
            "machine": "Vacuum pump",
            "process": "Vacuum infusion",
            "live_kwh": 1.450,
            "design_kwh": 1.200,
            "live_kgco2e": 3.889,
            "variance_kwh": 0.250,
            "design_kgco2e": 3.824,
            "has_live_reading": true,
            "variance_percent": 20.8
        },
        {
            "id": 2,
            "stage": "Manufacturing",
            "machine": "PPSS oven",
            "process": "Oven cure",
            "live_kwh": 6.900,
            "design_kwh": 4.960,
            "live_kgco2e": 1.805,
            "variance_kwh": 1.940,
            "design_kgco2e": 1.297,
            "has_live_reading": true,
            "variance_percent": 39.1
        },
        {
            "id": 3,
            "stage": "Assembly",
            "machine": "CNC router",
            "process": "CNC trimming",
            "live_kwh": 1.380,
            "design_kwh": 1.100,
            "live_kgco2e": 0.361,
            "variance_kwh": 0.280,
            "design_kgco2e": 0.288,
            "has_live_reading": true,
            "variance_percent": 25.5
        },
        {
            "id": 4,
            "stage": "Assembly",
            "machine": "Adhesive dispenser",
            "process": "Adhesive bonding",
            "live_kwh": 0.080,
            "design_kwh": 0.050,
            "live_kgco2e": 0.021,
            "variance_kwh": 0.030,
            "design_kgco2e": 0.013,
            "has_live_reading": true,
            "variance_percent": 60.0
        },
        {
            "id": 5,
            "stage": "Finishing",
            "machine": "Spray booth",
            "process": "Paint application",
            "live_kwh": 1.950,
            "design_kwh": 1.500,
            "live_kgco2e": 0.510,
            "variance_kwh": 0.450,
            "design_kgco2e": 0.392,
            "has_live_reading": true,
            "variance_percent": 30.0
        }
    ],
    "electricity_factor_kgco2e_per_kwh": 0.26155
}

Please provide:
1. Executive summary.
2. Best and worst manufacturing route observations.
3. Main energy and carbon hotspots.
4. Processes where live energy is higher than design baseline.
5. Likely causes of high energy use.
6. Quick-win actions that do not affect product quality.
7. Engineering changes requiring validation.
8. Sensor/data quality issues.
9. Prioritised action plan with owner, timescale, risk and estimated kWh / kg CO2e saving.

Constraints:
- Do not recommend changing cure time, cure temperature, vacuum hold, pressure or material specification unless validated by engineering qualification.
- Keep BOM/material LCA separate from live energy variance unless actual material consumption also changes.
- Protect product quality, traceability and safety.', '2025-03-14T08:00:00+00:00');


-- 18_ai_recommendations.csv
insert into ai_recommendations (recommendation_id, snapshot_id, scenario_id, route_operation_id, source, finding_type, severity, recommendation_text, estimated_kwh_saving, estimated_co2e_saving, action_owner, due_date, requires_engineering_validation, validation_status, created_at) values
  ('1', '1', '1', '2', 'rule', 'high_variance', 'high', 'PPSS oven / Oven cure: +1.940 kWh, 39.1% above design. Potential saving if returned to the design baseline.', '1.940000', '0.50740700000', null, null, 'true', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('2', '1', '1', '5', 'rule', 'high_variance', 'high', 'Spray booth / Paint application: +0.450 kWh, 30.0% above design. Potential saving if returned to the design baseline.', '0.450000', '0.11769750000', null, null, 'true', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('3', '1', '1', '3', 'rule', 'high_variance', 'high', 'CNC router / CNC trimming: +0.280 kWh, 25.5% above design. Potential saving if returned to the design baseline.', '0.280000', '0.07323400000', null, null, 'true', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('4', '1', '1', '1', 'rule', 'high_variance', 'high', 'Vacuum pump / Vacuum infusion: +0.250 kWh, 20.8% above design. Potential saving if returned to the design baseline.', '0.250000', '0.06538750000', null, null, 'true', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('5', '1', '1', '4', 'rule', 'high_variance', 'high', 'Adhesive dispenser / Adhesive bonding: +0.030 kWh, 60.0% above design. Potential saving if returned to the design baseline.', '0.030000', '0.00784650000', null, null, 'true', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('6', '1', '1', null, 'library', 'suggested_action', 'info', 'Check idle energy and separate running, waiting, standby and fault states.', null, null, null, null, 'false', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('7', '1', '1', null, 'library', 'suggested_action', 'info', 'For ovens/autoclaves, check loading efficiency, heat-up time, door openings and cycle batching.', null, null, null, null, 'false', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('8', '1', '1', null, 'library', 'suggested_action', 'info', 'For vacuum infusion, check vacuum leaks, pump sizing and unnecessary pump running time.', null, null, null, null, 'false', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('9', '1', '1', null, 'library', 'suggested_action', 'info', 'For CNC/trimming, check tool path efficiency, extraction running time and batch scheduling.', null, null, null, null, 'false', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('10', '1', '1', null, 'library', 'suggested_action', 'info', 'Replace assumed design energy baselines with measured averages after several production runs.', null, null, null, null, 'false', 'proposed', '2025-03-14T08:00:00+00:00'),
  ('11', '1', '1', null, 'library', 'suggested_action', 'info', 'Do not change cure or pressure parameters without engineering validation.', null, null, null, null, 'true', 'proposed', '2025-03-14T08:00:00+00:00');

select reset_identity_sequences();
commit;
