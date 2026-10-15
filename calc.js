// LCA calculations — the single implementation used by the dashboard AND by tools/validate.mjs.
// Mirrors the SQL views (supabase/2_views_and_security.sql) and the mock-up's formulas.
// Plain functions, no DOM. Rules (see CALCULATION_PLAN.md):
//   consumed kg   = mass x (1 + waste% / 100)
//   material      = consumed x factor per kg                        (kg CO2e and MJ)
//   operation kWh = hours x kW x utilisation
//   operation CO2e= kWh x electricity factor + process mass (kg) x process factor (kg CO2e per kg)
//   operation MJ  = kWh x 3.6
//   live kWh      = sum of meter readings of the operation, else the design kWh (flagged)
//   status        = high if variance% > alert%, watch if > alert%/2, ok otherwise, no_live without readings
(function (root) {
  const MJ_PER_KWH = 3.6;
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
  const sum = (rows, key) => rows.reduce((a, r) => a + (typeof key === 'function' ? key(r) : num(r[key])), 0);
  const fmt = (x, d = 3) => (Number.isFinite(x) ? x : 0).toFixed(d);

  function geometry(part) {
    const area = (num(part.length_mm) / 1000) * (num(part.width_mm) / 1000);
    return { area, volume: area * (num(part.thickness_mm) / 1000) };
  }

  // item: { mass_kg, waste_percent, cf_per_kg, ced_per_kg }
  function bomLine(item) {
    const consumed = num(item.mass_kg) * (1 + num(item.waste_percent) / 100);
    return { consumed, kgco2e: consumed * num(item.cf_per_kg), mj: consumed * num(item.ced_per_kg) };
  }

  // op: { hours, kw, utilisation, mass_basis_kg, process_cf_per_kg }
  function opDesign(op, gridFactor) {
    const kwh = num(op.hours) * num(op.kw) * num(op.utilisation);
    const cfElectricity = kwh * num(gridFactor);
    const cfProcess = num(op.mass_basis_kg) * num(op.process_cf_per_kg);
    return { kwh, cfElectricity, cfProcess, kgco2e: cfElectricity + cfProcess, mj: kwh * MJ_PER_KWH };
  }

  // readings: [{ operation_id, kwh }]
  function liveKwh(op, readings) {
    const mine = readings.filter((r) => r.operation_id === op.operation_id);
    return mine.length ? { kwh: sum(mine, 'kwh'), hasLive: true } : { kwh: opDesign(op, 0).kwh, hasLive: false };
  }

  // Full calculation for one scenario. input: { bom, ops, readings, gridFactor, thresholdPct }
  function calculateRoute({ bom, ops, readings = [], gridFactor, thresholdPct = 15 }) {
    const bomRows = bom.map((b) => ({ ...b, ...bomLine(b) }));
    const bomCf = sum(bomRows, 'kgco2e'), bomCed = sum(bomRows, 'mj'), bomMass = sum(bomRows, 'consumed');
    const opRows = ops.map((o) => {
      const d = opDesign(o, gridFactor);
      const l = liveKwh(o, readings);
      const liveCf = l.kwh * num(gridFactor) + d.cfProcess;
      const variance = l.kwh - d.kwh;
      const pct = d.kwh ? (variance / d.kwh) * 100 : 0;
      let status = 'ok';
      if (!l.hasLive) status = 'no_live';
      else if (pct > thresholdPct) status = 'high';
      else if (pct > thresholdPct / 2) status = 'watch';
      return { ...o, design: d, liveKwh: l.kwh, hasLive: l.hasLive, liveCf, variance, pct, status };
    });
    const isMan = (o) => o.stage === 'Manufacturing';
    const mfgCf = sum(opRows.filter(isMan), (o) => o.design.kgco2e);
    const assFinishCf = sum(opRows.filter((o) => !isMan(o)), (o) => o.design.kgco2e);
    const designTotal = bomCf + mfgCf + assFinishCf;
    const designCed = bomCed + sum(opRows, (o) => o.design.mj);
    const liveTotal = bomCf + sum(opRows, (o) => o.liveCf);
    const designKwh = sum(opRows, (o) => o.design.kwh), liveKwhTotal = sum(opRows, (o) => o.liveKwh);
    return { bomRows, opRows, bomMass, bomCf, bomCed, mfgCf, assFinishCf, designTotal, designCed,
             liveTotal, varianceCf: liveTotal - designTotal, designKwh, liveKwh: liveKwhTotal, extraKwh: liveKwhTotal - designKwh };
  }

  // Human-readable working for the "Calculations" section.
  function workings(calc, gridFactor) {
    const lines = [];
    for (const b of calc.bomRows) {
      lines.push({ group: 'Materials', text: `${b.material_name}: ${fmt(b.mass_kg)} kg × (1 + ${fmt(b.waste_percent, 1)}%) = ${fmt(b.consumed)} kg;  × ${fmt(b.cf_per_kg, 2)} kg CO₂e/kg = ${fmt(b.kgco2e)} kg CO₂e;  × ${fmt(b.ced_per_kg, 1)} MJ/kg = ${fmt(b.mj, 1)} MJ` });
    }
    for (const o of calc.opRows) {
      const d = o.design;
      let t = `${o.process_name}: ${fmt(o.hours, 2)} h × ${fmt(o.kw, 2)} kW × ${fmt(o.utilisation, 2)} = ${fmt(d.kwh)} kWh;  × ${fmt(gridFactor, 5)} = ${fmt(d.cfElectricity)} kg CO₂e`;
      if (d.cfProcess) t += `;  + ${fmt(o.mass_basis_kg, 1)} kg × ${fmt(o.process_cf_per_kg, 2)} = ${fmt(d.cfProcess)} (process)`;
      t += `;  operation total ${fmt(d.kgco2e)} kg CO₂e;  energy demand ${fmt(d.kwh)} × 3.6 = ${fmt(d.mj, 2)} MJ`;
      lines.push({ group: `Operations — ${o.stage}`, text: t });
    }
    lines.push({ group: 'Totals', text: `Design total = materials ${fmt(calc.bomCf)} + manufacturing ${fmt(calc.mfgCf)} + assembly/finishing ${fmt(calc.assFinishCf)} = ${fmt(calc.designTotal)} kg CO₂e` });
    lines.push({ group: 'Totals', text: `Energy demand = materials ${fmt(calc.bomCed, 1)} MJ + electricity ${fmt(calc.designCed - calc.bomCed, 1)} MJ = ${fmt(calc.designCed, 1)} MJ` });
    lines.push({ group: 'Live', text: `Live total = materials ${fmt(calc.bomCf)} + operations at measured kWh (design kWh where no meter data) = ${fmt(calc.liveTotal)} kg CO₂e;  variance ${fmt(calc.varianceCf)} kg CO₂e;  extra energy ${fmt(calc.extraKwh)} kWh` });
    return lines;
  }

  root.LCA_CALC = { MJ_PER_KWH, geometry, bomLine, opDesign, liveKwh, calculateRoute, workings, fmt };
})(typeof window !== 'undefined' ? window : globalThis);
