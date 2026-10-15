// Data builders for the twin's interactive charts — pure functions, no DOM. Tested by tools/validate.mjs.
//  buildSim      : one call that turns a route's database rows + the page settings into { calc, sim }
//  sankey        : where the carbon of a run comes from (inputs) and where it lands (materials in the parts, machines)
//  waterfall     : what-if levers (materials, machine energy, electricity factor) as a baseline -> new footprint waterfall
//  routeMetrics  : the same simulation for every route, for side-by-side comparison
//  materialItems : the bill of materials as carbon-sized items (used for the crates flying into the line)
(function (root) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  // o: { bom, ops, readings, grid, thresholdPct, parts, interval, idlePct, rated, includeMaterials, useLive, transitH }
  function buildSim(o) {
    const C = root.LCA_CALC, SIM = root.TWIN_SIM;
    const calc = C.calculateRoute({ bom: o.bom || [], ops: o.ops, readings: o.readings || [], gridFactor: o.grid, thresholdPct: o.thresholdPct ?? 15 });
    const sim = SIM.simulate({
      ops: calc.opRows.map((r) => ({ operation_id: r.operation_id, op_no: r.op_no, machine_name: r.machine_name, stage: r.stage, process_name: r.process_name,
        hours: r.hours, kwh: o.useLive ? r.liveKwh : r.design.kwh, process_kgco2e: r.design.cfProcess })),
      parts: o.parts, releaseIntervalH: o.interval, idleFraction: num(o.idlePct) / 100, transitH: o.transitH, gridFactor: o.grid,
      ratedKw: o.rated || {}, materialsKgPerPart: o.includeMaterials ? calc.bomCf : 0 });
    return { calc, sim };
  }

  function sankey(sim, calc, includeMaterials = true) {
    const left = [], right = [], links = [], grid = sim.gridFactor;
    const addRight = (id, label, kind) => { let n = right.find((x) => x.id === id); if (!n) right.push(n = { id, label, kind, value: 0 }); return n; };
    const addLeft = (id, label, kind) => { let n = left.find((x) => x.id === id); if (!n) left.push(n = { id, label, kind, value: 0 }); return n; };
    const link = (s, t, value) => { if (value > 1e-9) { links.push({ source: s.id, target: t.id, value }); s.value += value; t.value += value; } };
    if (includeMaterials) {
      const kit = addRight('kit', 'Materials in the parts', 'materials');
      for (const b of calc.bomRows) link(addLeft('mat:' + b.material_name, b.material_name, 'materials'), kit, b.kgco2e * sim.parts);
    }
    const gridN = addLeft('grid', 'Grid electricity', 'electricity'), procN = addLeft('proc', 'Process inputs', 'process'), idleN = addLeft('idle', 'Idle power', 'idle');
    for (const m of Object.values(sim.machines)) {
      const mn = addRight('m:' + m.name, m.name, 'machine');
      link(gridN, mn, m.runCo2); link(procN, mn, m.procCo2); link(idleN, mn, m.idleKwh * grid);
    }
    const total = links.reduce((a, l) => a + l.value, 0);
    return { left: left.filter((n) => n.value > 0), right: right.filter((n) => n.value > 0), links, total };
  }

  // levers: { materialsPct, energyPct, grid }   (percent changes; grid = new electricity factor)
  function waterfall(sim, levers = {}) {
    const mat = sim.carbon.materials, elec = sim.carbon.electricity + sim.carbon.idle, proc = sim.carbon.process, base = sim.carbon.total;
    const mp = num(levers.materialsPct) / 100, ep = num(levers.energyPct) / 100;
    const grid2 = levers.grid === undefined || levers.grid === null ? sim.gridFactor : num(levers.grid);
    const dMat = mat * mp, dEnergy = elec * ep, elecAfterEnergy = elec * (1 + ep);
    const dGrid = sim.gridFactor > 0 ? elecAfterEnergy * (grid2 / sim.gridFactor - 1) : 0;
    const final = base + dMat + dEnergy + dGrid;
    return { base, final, parts: sim.parts, perPartBase: base / sim.parts, perPartFinal: final / sim.parts, changePct: base ? (final / base - 1) * 100 : 0, process: proc,
             steps: [{ label: 'Baseline', value: base, type: 'total' }, { label: 'Materials', value: dMat, type: 'delta' }, { label: 'Machine energy', value: dEnergy, type: 'delta' },
                     { label: 'Electricity factor', value: dGrid, type: 'delta' }, { label: 'New footprint', value: final, type: 'total' }] };
  }

  // routes: [{ scenario_id, name, bom, ops, readings, grid, thresholdPct }]; common: { parts, interval, idlePct, rated, includeMaterials, useLive }
  function routeMetrics(routes, common) {
    return routes.map((r) => {
      const { calc, sim } = buildSim({ ...common, bom: r.bom, ops: r.ops, readings: r.readings, grid: common.grid ?? r.grid, thresholdPct: r.thresholdPct });
      return { scenario_id: r.scenario_id, name: r.name, carbonPerPart: sim.carbon.total / sim.parts, opsCarbonPerPart: sim.carbon.operations / sim.parts, kwhPerPart: sim.totalKwh / sim.parts,
               throughput: sim.throughputPerHour, leadTime: sim.leadTimeFirst, makespan: sim.makespan, bottleneck: sim.bottleneck.name, designTotal: calc.designTotal };
    });
  }

  // BOM lines as carbon-sized items for the crates flying into the line (largest first)
  function materialItems(calc) {
    return calc.bomRows.map((b) => ({ name: b.material_name, kgco2e: b.kgco2e, kg: b.consumed })).filter((b) => b.kgco2e > 0).sort((a, b) => b.kgco2e - a.kgco2e);
  }

  root.TWIN_VIZ = { buildSim, sankey, waterfall, routeMetrics, materialItems };
})(typeof window !== 'undefined' ? window : globalThis);
