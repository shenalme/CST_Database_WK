-- AUTO-GENERATED from data/csv/*.csv by tools/build.mjs. SIMULATED SAMPLE DATA ONLY.
-- Run once, after 1_schema.sql and 2_views_and_security.sql.
begin;

-- 01_lifecycle_stages.csv
insert into lifecycle_stages (stage_id, stage_code, stage_name, sequence_no) values
  ('1', 'MAN', 'Manufacturing', '1'),
  ('2', 'USE', 'Use', '2'),
  ('3', 'MNT', 'Maintenance', '3'),
  ('4', 'EOL', 'End of life', '4');


-- 02_impact_categories.csv
insert into impact_categories (impact_category_id, impact_code, impact_name, unit, description) values
  ('1', 'GWP', 'Carbon footprint (GWP100)', 'kg CO2e', 'Global warming potential over 100 years');


-- 03_organisations.csv
insert into organisations (organisation_id, organisation_name, organisation_code, created_at) values
  ('1', 'SIMULATED Manufacturing Co', 'SIMCO', '2025-01-06T09:00:00+00:00');


-- 04_sources.csv
insert into sources (source_id, source_name, source_type, citation, url, publication_year, database_name, version, notes) values
  ('1', 'SIMULATED generic LCI database', 'database', 'SIMULATED - not a real database', null, '2024', 'SimLCI', '1.0', 'Placeholder for an inventory database'),
  ('2', 'SIMULATED supplier EPD (aluminium billet)', 'supplier', 'SIMULATED - not a real EPD', null, '2023', null, null, 'Placeholder supplier declaration'),
  ('3', 'SIMULATED national grid factor publication', 'standard', 'SIMULATED - not a real publication', null, '2024', null, '2024', 'Placeholder grid emission factor'),
  ('4', 'SIMULATED internal measurement campaign', 'measurement', 'SIMULATED - not real measurements', null, '2025', null, null, 'Placeholder shop-floor measurements');


-- 05_lca_items.csv
insert into lca_items (item_id, item_code, item_name, item_type, default_unit, assumptions, impact_assessment_method, iso_compliant, notes, active) values
  ('1', 'MAT-AL6082', 'Aluminium alloy 6082 billet', 'material', 'kg', 'European average supply mix', 'SIMULATED method', 'true', null, 'true'),
  ('2', 'MAT-ALSI10MG', 'Aluminium casting alloy AlSi10Mg', 'material', 'kg', 'Secondary-heavy supply mix', 'SIMULATED method', 'true', null, 'true'),
  ('3', 'MAT-PP-VIRGIN', 'Polypropylene (virgin)', 'material', 'kg', null, 'SIMULATED method', 'true', null, 'true'),
  ('4', 'MAT-PP-RECYC', 'Polypropylene (recyclate)', 'material', 'kg', 'Post-industrial recyclate', 'SIMULATED method', 'true', null, 'true'),
  ('5', 'MAT-COOLANT', 'Cutting fluid', 'material', 'kg', null, 'SIMULATED method', 'true', null, 'true'),
  ('6', 'MAT-CARDBOARD', 'Cardboard packaging', 'material', 'kg', null, 'SIMULATED method', 'true', null, 'true'),
  ('7', 'MAT-RELEASE', 'Die release agent', 'material', 'kg', null, 'SIMULATED method', 'true', 'Factor still draft (unapproved) in this sample', 'true'),
  ('8', 'PRC-CNC-MILL', 'CNC milling - non-electric inputs', 'process', 'min', 'Tooling and consumables per machine-minute', 'SIMULATED method', 'true', 'Electricity is calculated from machine power', 'true'),
  ('9', 'PRC-HPDC', 'High-pressure die casting - non-electric inputs', 'process', 'kg', 'Melting fuel', 'SIMULATED method', 'true', null, 'true'),
  ('10', 'PRC-INJ-MOULD', 'Injection moulding - non-electric inputs', 'process', 'kg', 'Ancillaries', 'SIMULATED method', 'true', null, 'true'),
  ('11', 'PRC-DEBURR', 'Deburring and washing - non-electric inputs', 'process', 'item', null, 'SIMULATED method', 'true', null, 'true'),
  ('12', 'EOL-AL-RECYCLE', 'Aluminium recycling at end of life (net credit)', 'end_of_life', 'kg', 'Net of avoided primary production', 'SIMULATED method', 'true', 'Negative factor = credit', 'true');


-- 06_item_sources.csv
insert into item_sources (item_source_id, item_id, source_id, reference_order, notes) values
  ('1', '1', '1', '1', null),
  ('2', '1', '2', '2', 'Supplier EPD cross-check'),
  ('3', '2', '1', '1', null),
  ('4', '3', '1', '1', null),
  ('5', '4', '1', '1', null),
  ('6', '5', '1', '1', null),
  ('7', '6', '1', '1', null),
  ('8', '7', '1', '1', null),
  ('9', '8', '4', '1', null),
  ('10', '9', '4', '1', null),
  ('11', '10', '4', '1', null),
  ('12', '11', '4', '1', null),
  ('13', '12', '1', '1', null);


-- 07_lca_factors.csv
insert into lca_factors (factor_id, item_id, impact_category_id, factor_value, factor_unit, basis_unit, valid_from, valid_to, data_quality, source_method, approved, created_at) values
  ('1', '1', '1', '8.2', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Good', 'Supplier EPD', 'true', '2025-01-08T10:00:00+00:00'),
  ('2', '2', '1', '7.4', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Database lookup', 'true', '2025-01-08T10:00:00+00:00'),
  ('3', '3', '1', '1.95', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Good', 'Database lookup', 'true', '2025-01-08T10:00:00+00:00'),
  ('4', '4', '1', '0.75', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Database lookup', 'true', '2025-01-08T10:00:00+00:00'),
  ('5', '5', '1', '1.1', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Database lookup', 'true', '2025-01-08T10:00:00+00:00'),
  ('6', '6', '1', '0.9', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Database lookup', 'true', '2025-01-08T10:00:00+00:00'),
  ('7', '7', '1', '2.3', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Poor', 'Estimate - awaiting review', 'false', '2025-01-08T10:00:00+00:00'),
  ('8', '8', '1', '0.012', 'kg CO2e / min', 'min', '2024-01-01', null, 'Fair', 'Internal measurement', 'true', '2025-01-08T10:00:00+00:00'),
  ('9', '9', '1', '0.55', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Internal measurement', 'true', '2025-01-08T10:00:00+00:00'),
  ('10', '10', '1', '0.05', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Internal measurement', 'true', '2025-01-08T10:00:00+00:00'),
  ('11', '11', '1', '0.02', 'kg CO2e / item', 'item', '2024-01-01', null, 'Fair', 'Internal measurement', 'true', '2025-01-08T10:00:00+00:00'),
  ('12', '12', '1', '-1.5', 'kg CO2e / kg', 'kg', '2024-01-01', null, 'Fair', 'Database lookup', 'true', '2025-01-08T10:00:00+00:00');


-- 08_material_properties.csv
insert into material_properties (material_property_id, item_id, property_name, property_value, unit, source_id, notes) values
  ('1', '1', 'density', '2700', 'kg/m3', '1', null),
  ('2', '2', 'density', '2680', 'kg/m3', '1', null),
  ('3', '3', 'density', '905', 'kg/m3', '1', null),
  ('4', '4', 'density', '910', 'kg/m3', '1', null);


-- 09_projects.csv
insert into projects (project_id, organisation_id, project_code, project_name, customer_name, start_date, end_date, status, created_at) values
  ('1', '1', 'SIM-P001', 'Bracket programme', 'SIMULATED Customer A', '2025-01-13', null, 'active', '2025-01-06T09:30:00+00:00'),
  ('2', '1', 'SIM-P002', 'Enclosure programme', 'SIMULATED Customer B', '2025-02-03', null, 'active', '2025-01-06T09:40:00+00:00');


-- 10_parts.csv
insert into parts (part_id, project_id, part_number, part_description, functional_unit, quantity, length_mm, width_mm, thickness_mm, notes) values
  ('1', '1', 'BRK-001', 'Aluminium mounting bracket', 'one finished bracket', '5000', '120', '60', '8', 'SIMULATED part'),
  ('2', '2', 'ENC-001', 'Polypropylene control-box enclosure', 'one finished enclosure', '20000', '220', '140', '60', 'SIMULATED part');


-- 11_equipment.csv
insert into equipment (equipment_id, organisation_id, equipment_code, equipment_name, equipment_type, manufacturer, model, location, rated_power_kw, used_for, assumptions, notes, active) values
  ('1', '1', 'EQ-CNC-01', '3-axis CNC machining centre', 'CNC mill', 'SIMULATED Machine Tool Co', 'MT-300', 'Hall A', '22', 'Milling of aluminium parts', null, null, 'true'),
  ('2', '1', 'EQ-HPDC-01', 'Die casting cell', 'Die caster', 'SIMULATED Foundry Systems', 'DC-800', 'Hall B', '120', 'Casting aluminium parts', 'Includes holding furnace', null, 'true'),
  ('3', '1', 'EQ-IM-01', 'Injection moulding machine 150 t', 'Injection moulder', 'SIMULATED Polymer Machines', 'IM-150', 'Hall C', '55', 'Moulding polypropylene parts', 'Two-cavity tool', null, 'true'),
  ('4', '1', 'EQ-WASH-01', 'Parts washer / deburring station', 'Washer', 'SIMULATED Cleaning Ltd', 'PW-10', 'Hall A', '6', 'Deburring and washing', null, null, 'true');


-- 12_equipment_factors.csv
insert into equipment_factors (equipment_factor_id, equipment_id, impact_category_id, factor_value, factor_unit, basis_unit, source_id, approved) values
  ('1', '1', '1', '0.35', 'kg CO2e / h', 'h', '4', 'true'),
  ('2', '2', '1', '1.8', 'kg CO2e / h', 'h', '4', 'true'),
  ('3', '3', '1', '0.5', 'kg CO2e / h', 'h', '4', 'true');


-- 13_lca_scenarios.csv
insert into lca_scenarios (scenario_id, part_id, scenario_name, goal, system_boundary, quantity, electricity_factor, data_quality_target, status, created_at, approved_at) values
  ('1', '1', 'CNC from billet', 'Baseline route for BRK-001', 'cradle-to-grave', '1', '0.207', 'Fair or better', 'approved', '2025-01-20T10:00:00+00:00', '2025-01-27T10:00:00+00:00'),
  ('2', '1', 'Die casting + finish machining', 'Lower-material route for BRK-001', 'cradle-to-grave', '1', '0.207', 'Fair or better', 'review', '2025-01-21T10:00:00+00:00', null),
  ('3', '2', 'Virgin polypropylene', 'Baseline route for ENC-001', 'cradle-to-grave', '1', '0.207', 'Fair or better', 'approved', '2025-02-04T10:00:00+00:00', '2025-02-10T10:00:00+00:00'),
  ('4', '2', '30% recycled polypropylene', 'Recycled-content option for ENC-001', 'cradle-to-grave', '1', '0.207', 'Fair or better', 'draft', '2025-02-05T10:00:00+00:00', null);


-- 14_bom_items.csv
insert into bom_items (bom_item_id, scenario_id, item_id, stage_id, net_quantity, unit, waste_percentage, sequence_no, notes) values
  ('1', '1', '1', '1', '0.45', 'kg', '75', '1', 'Machined from billet - 75% of input becomes chips'),
  ('2', '1', '5', '1', '0.02', 'kg', '0', '2', null),
  ('3', '1', '6', '1', '0.05', 'kg', '5', '3', 'Packaging'),
  ('4', '1', '12', '4', '0.45', 'kg', '0', '4', 'Recycling at end of life'),
  ('5', '2', '2', '1', '0.45', 'kg', '20', '1', 'Casting runners and flash'),
  ('6', '2', '5', '1', '0.005', 'kg', '0', '2', null),
  ('7', '2', '7', '1', '0.003', 'kg', '0', '3', 'Release agent - factor not yet approved'),
  ('8', '2', '6', '1', '0.05', 'kg', '5', '4', 'Packaging'),
  ('9', '2', '12', '4', '0.45', 'kg', '0', '5', 'Recycling at end of life'),
  ('10', '3', '3', '1', '0.32', 'kg', '3', '1', null),
  ('11', '3', '6', '1', '0.04', 'kg', '5', '2', 'Packaging'),
  ('12', '4', '3', '1', '0.224', 'kg', '3', '1', '70% virgin'),
  ('13', '4', '4', '1', '0.096', 'kg', '3', '2', '30% recyclate'),
  ('14', '4', '6', '1', '0.04', 'kg', '5', '3', 'Packaging');


-- 15_scenario_operations.csv
insert into scenario_operations (operation_id, scenario_id, operation_sequence, lifecycle_stage_id, process_item_id, equipment_id, operation_name, expected_duration_minutes, expected_power_kw, utilisation_factor, expected_energy_kwh, batch_size, process_mass_basis, notes) values
  ('1', '1', '1', '1', '8', '1', 'CNC milling', '14', '9.5', '0.65', '1.4408', '1', null, null),
  ('2', '1', '2', '1', '11', '4', 'Deburr and wash', '3', '4', '0.8', '0.16', '10', null, 'Ten parts per wash basket'),
  ('3', '2', '1', '1', '9', '2', 'Die casting', '1.2', '95', '0.7', '1.33', '1', '0.5625', null),
  ('4', '2', '2', '1', '8', '1', 'Finish machining', '4', '9.5', '0.6', '0.38', '1', null, null),
  ('5', '2', '3', '1', '11', '4', 'Deburr and wash', '3', '4', '0.8', '0.16', '10', null, null),
  ('6', '3', '1', '1', '10', '3', 'Injection moulding', '0.6', '40', '0.55', '0.22', '2', '0.33', 'Two-cavity tool - 2 parts per cycle'),
  ('7', '4', '1', '1', '10', '3', 'Injection moulding', '0.6', '40', '0.55', '0.22', '2', '0.33', 'Same cycle as baseline');


-- 16_production_batches.csv
insert into production_batches (batch_id, scenario_id, batch_code, part_id, planned_quantity, actual_quantity, scrap_quantity, rework_quantity, start_time, end_time, status) values
  ('1', '1', 'B-2025-0001', '1', '200', '196', '4', '2', '2025-03-10T08:00:00+00:00', '2025-03-10T17:30:00+00:00', 'completed'),
  ('2', '3', 'B-2025-0002', '2', '2000', '1960', '40', '0', '2025-03-12T06:00:00+00:00', '2025-03-12T14:00:00+00:00', 'completed');


-- 17_sensor_devices.csv
insert into sensor_devices (sensor_id, equipment_id, sensor_code, sensor_name, sensor_type, measurement_type, unit, sampling_interval_seconds, protocol, active, installed_at) values
  ('1', '1', 'SM-CNC-01', 'Energy meter - CNC mill', 'Smart meter', 'energy', 'kWh', '3600', 'Modbus TCP', 'true', '2025-02-01T09:00:00+00:00'),
  ('2', '3', 'SM-IM-01', 'Energy meter - injection moulder', 'Smart meter', 'energy', 'kWh', '3600', 'Modbus TCP', 'true', '2025-02-01T09:30:00+00:00'),
  ('3', '1', 'PW-CNC-01', 'Power sensor - CNC mill', 'Power transducer', 'power', 'kW', '60', 'OPC UA', 'true', '2025-02-01T09:15:00+00:00');


-- 18_sensor_readings.csv
insert into sensor_readings (sensor_id, recorded_at, batch_id, operation_id, value, unit, machine_state, quality_flag, ingestion_source, received_at) values
  ('1', '2025-03-10T09:00:00+00:00', '1', '1', '28.4', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T10:00:00+00:00', '1', '1', '29.6', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T11:00:00+00:00', '1', '1', '30.1', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T12:00:00+00:00', '1', '1', '27.9', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T13:00:00+00:00', '1', '1', '29.2', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T14:00:00+00:00', '1', '1', '28.8', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T15:00:00+00:00', '1', '1', '30.4', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T16:00:00+00:00', '1', '1', '29.9', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T17:00:00+00:00', '1', '1', '28.1', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('1', '2025-03-10T17:30:00+00:00', '1', '1', '14.7', 'kWh', 'running', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('2', '2025-03-12T07:00:00+00:00', '2', '6', '26.1', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T08:00:00+00:00', '2', '6', '27.4', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T09:00:00+00:00', '2', '6', '26.8', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T10:00:00+00:00', '2', '6', '27.9', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T11:00:00+00:00', '2', '6', '26.5', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T12:00:00+00:00', '2', '6', '27.2', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T13:00:00+00:00', '2', '6', '26.9', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('2', '2025-03-12T14:00:00+00:00', '2', '6', '27.6', 'kWh', 'running', 'good', 'csv_upload', '2025-03-13T08:00:00+00:00'),
  ('3', '2025-03-10T10:00:00+00:00', '1', '1', '9.1', 'kW', 'cutting', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('3', '2025-03-10T10:01:00+00:00', '1', '1', '9.8', 'kW', 'cutting', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('3', '2025-03-10T10:02:00+00:00', '1', '1', '0.8', 'kW', 'tool_change', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('3', '2025-03-10T10:03:00+00:00', '1', '1', '9.4', 'kW', 'cutting', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00'),
  ('3', '2025-03-10T10:04:00+00:00', '1', '1', '9.6', 'kW', 'cutting', 'good', 'csv_upload', '2025-03-11T08:00:00+00:00');


-- 19_lca_results.csv
insert into lca_results (result_id, scenario_id, batch_id, result_type, impact_category_id, lifecycle_stage_id, result_value, unit, calculation_version, calculated_at) values
  ('1', '1', null, 'design', '1', '1', '15.318926', 'kg CO2e', 'v1.0-SIMULATED', '2025-03-01T12:00:00+00:00'),
  ('2', '1', null, 'design', '1', '4', '-0.675000', 'kg CO2e', 'v1.0-SIMULATED', '2025-03-01T12:00:00+00:00'),
  ('3', '2', null, 'design', '1', '1', '4.950025', 'kg CO2e', 'v1.0-SIMULATED', '2025-03-01T12:00:00+00:00'),
  ('4', '2', null, 'design', '1', '4', '-0.675000', 'kg CO2e', 'v1.0-SIMULATED', '2025-03-01T12:00:00+00:00'),
  ('5', '3', null, 'design', '1', '1', '0.720464', 'kg CO2e', 'v1.0-SIMULATED', '2025-03-01T12:00:00+00:00'),
  ('6', '4', null, 'design', '1', '1', '0.601701', 'kg CO2e', 'v1.0-SIMULATED', '2025-03-01T12:00:00+00:00');


-- 20_operation_energy_comparison.csv
insert into operation_energy_comparison (comparison_id, batch_id, operation_id, expected_kwh, measured_kwh, expected_co2e_kg, measured_co2e_kg, calculated_at) values
  ('1', '1', '1', '282.396800', '277.100000', '58.456138', '57.359700', '2025-03-14T08:00:00+00:00'),
  ('2', '1', '2', '3.136000', null, '0.649152', null, '2025-03-14T08:00:00+00:00'),
  ('3', '2', '6', '215.600000', '216.400000', '44.629200', '44.794800', '2025-03-14T08:00:00+00:00');


-- 21_ai_recommendations.csv
insert into ai_recommendations (recommendation_id, scenario_id, batch_id, operation_id, recommendation_text, estimated_kwh_saving, estimated_co2e_saving, risk_level, requires_engineering_validation, validation_status, created_at) values
  ('1', '1', '1', '1', 'SIMULATED: Reduce CNC idle time during tool changes by batching tool changes per fixture.', '12', '2.5', 'low', 'true', 'under_review', '2025-03-14T09:00:00+00:00'),
  ('2', '3', '2', '6', 'SIMULATED: Lower barrel heater set-points by 5 C after validating melt quality.', '8', '1.7', 'medium', 'true', 'proposed', '2025-03-14T09:10:00+00:00');


-- 22_energy_actions.csv
insert into energy_actions (action_id, recommendation_id, action_description, owner_name, due_date, status, validation_outcome) values
  ('1', '1', 'SIMULATED: Trial batched tool changes on the next BRK-001 batch', 'SIMULATED Process Engineer', '2025-04-30', 'in_progress', null),
  ('2', '2', 'SIMULATED: Quality sign-off on reduced heater set-points', 'SIMULATED Quality Lead', '2025-05-15', 'open', null);

select reset_identity_sequences();
commit;
