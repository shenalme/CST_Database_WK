-- AUTO-GENERATED from data/csv/*.csv by tools/build.mjs. SIMULATED / EXAMPLE DATA ONLY.
-- Digital twin sample layout. Run once, after 3_sample_data.sql and 4_digital_twin.sql.
begin;

-- 31_factory_floors.csv
insert into factory_floors (floor_id, floor_name, width_m, height_m, notes) values
  ('1', 'Main hall (SIMULATED layout)', '60', '34', 'SIMULATED layout - replace with the real floor plan');


-- 32_factory_zones.csv
insert into factory_zones (zone_id, floor_id, zone_name, x_m, y_m, width_m, height_m, colour, notes) values
  ('1', '1', 'A  Preparation and infusion', '0', '0', '24', '17', '#dbeafe', 'SIMULATED layout - replace with the real floor plan'),
  ('2', '1', 'B  Curing and forming', '24', '0', '36', '17', '#fee2e2', 'SIMULATED layout - replace with the real floor plan'),
  ('3', '1', 'C  Machining and assembly', '0', '17', '30', '17', '#dcfce7', 'SIMULATED layout - replace with the real floor plan'),
  ('4', '1', 'D  Finishing and dispatch', '30', '17', '30', '17', '#fef3c7', 'SIMULATED layout - replace with the real floor plan');


-- 33_machine_locations.csv
insert into machine_locations (machine_id, floor_id, zone_id, x_m, y_m, width_m, height_m, notes) values
  ('1', '1', '1', '9', '2.5', '2.0', '1.5', 'SIMULATED layout - replace with the real floor plan'),
  ('2', '1', '2', '27', '3', '4.0', '3.0', 'SIMULATED layout - replace with the real floor plan'),
  ('3', '1', '3', '4', '21', '6.0', '3.5', 'SIMULATED layout - replace with the real floor plan'),
  ('4', '1', '3', '14', '21', '3.0', '2.0', 'SIMULATED layout - replace with the real floor plan'),
  ('5', '1', '4', '34', '21', '7.0', '5.0', 'SIMULATED layout - replace with the real floor plan'),
  ('6', '1', '1', '15', '2.5', '4.0', '3.0', 'SIMULATED layout - replace with the real floor plan'),
  ('7', '1', '2', '35', '3', '5.0', '4.0', 'SIMULATED layout - replace with the real floor plan'),
  ('8', '1', '3', '21', '21', '2.0', '1.5', 'SIMULATED layout - replace with the real floor plan'),
  ('9', '1', '1', '2.5', '2.5', '4.0', '2.5', 'SIMULATED layout - replace with the real floor plan'),
  ('10', '1', '2', '43', '3', '5.0', '4.0', 'SIMULATED layout - replace with the real floor plan'),
  ('11', '1', '4', '44', '21', '3.0', '2.0', 'SIMULATED layout - replace with the real floor plan'),
  ('12', '1', '4', '51', '21', '5.0', '3.5', 'SIMULATED layout - replace with the real floor plan'),
  ('13', '1', '2', '50', '3', '8.0', '5.0', 'SIMULATED layout - replace with the real floor plan');

select reset_identity_sequences();
commit;
