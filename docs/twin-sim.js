// Digital twin simulation engine — pure functions, no DOM. Used by docs/twin.html and tested by tools/validate.mjs.
//
// Model (deliberately simple, every assumption is visible):
//  - a part visits the route's operations in order; every machine processes ONE part at a time (first come, first served);
//  - operation duration = route_operations.hours (design); energy of the step = design kWh, or the metered kWh when "live" is chosen;
//  - moving a part between machines takes `transitH` hours;
//  - parts are released every `releaseIntervalH` hours; the part's materials (BOM carbon) enter the footprint at release;
//  - an idle machine draws `idleFraction` of its rated power (0 by default: the dataset has no idle-power measurements);
//  - carbon of a step = kWh x electricity factor + process mass x process factor (same rule as the LCA calculation).
(function (root) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  // cfg: { ops:[{operation_id, op_no, machine_name, stage, process_name, hours, kwh, process_kgco2e}], parts, releaseIntervalH, transitH,
  //        idleFraction, gridFactor, ratedKw:{machineName: kW}, materialsKgPerPart }
  function simulate(cfg) {
    const ops = [...cfg.ops].sort((a, b) => a.op_no - b.op_no);
    const parts = Math.max(1, Math.floor(num(cfg.parts)));
    const interval = Math.max(0, num(cfg.releaseIntervalH));
    const transit = Math.max(0, cfg.transitH === undefined ? 0.02 : num(cfg.transitH));
    const grid = num(cfg.gridFactor), idleFraction = Math.max(0, num(cfg.idleFraction)), matKg = Math.max(0, num(cfg.materialsKgPerPart));
    const free = {};                       // machine -> time it becomes free
    const jobs = [];
    for (let p = 0; p < parts; p++) {
      const release = p * interval;
      let t = release, prev = null;
      const steps = [];
      for (const o of ops) {
        const ready = prev ? t + transit : t;
        const start = Math.max(ready, free[o.machine_name] ?? 0);
        const end = start + num(o.hours);
        free[o.machine_name] = end;
        const kwh = num(o.kwh), proc = num(o.process_kgco2e), dur = end - start;
        steps.push({ op_no: o.op_no, operation_id: o.operation_id, machine: o.machine_name, stage: o.stage, process: o.process_name,
                     depart: t, ready, start, end, wait: start - ready, kwh, co2Elec: kwh * grid, co2Proc: proc, kgco2e: kwh * grid + proc,
                     kw: dur > 0 ? kwh / dur : 0, procRate: dur > 0 ? proc / dur : 0 });
        t = end; prev = o;
      }
      jobs.push({ part: p + 1, release, finish: t, steps });
    }
    const makespan = Math.max(...jobs.map((j) => j.finish));
    const machines = {};
    for (const o of ops) machines[o.machine_name] ??= { name: o.machine_name, busyHours: 0, runKwh: 0, runCo2: 0, procCo2: 0, peakKw: 0, ratedKw: num(cfg.ratedKw?.[o.machine_name]) };
    for (const j of jobs) for (const s of j.steps) {
      const m = machines[s.machine]; m.busyHours += s.end - s.start; m.runKwh += s.kwh; m.runCo2 += s.co2Elec; m.procCo2 += s.co2Proc; m.peakKw = Math.max(m.peakKw, s.kw);
    }
    let runKwh = 0, idleKwh = 0, elecCo2 = 0, procCo2 = 0;
    for (const m of Object.values(machines)) {
      m.utilisation = makespan ? m.busyHours / makespan : 0;
      m.idleKw = idleFraction * m.ratedKw;
      m.idleKwh = m.idleKw * Math.max(0, makespan - m.busyHours);
      m.totalKwh = m.runKwh + m.idleKwh;
      m.totalCo2 = m.runCo2 + m.procCo2 + m.idleKwh * grid;
      runKwh += m.runKwh; idleKwh += m.idleKwh; elecCo2 += m.runCo2; procCo2 += m.procCo2;
    }
    const idleCo2 = idleKwh * grid, materialsKg = matKg * parts;
    const bottleneck = Object.values(machines).sort((a, b) => b.busyHours - a.busyHours)[0];
    const hotspot = Object.values(machines).sort((a, b) => b.totalCo2 - a.totalCo2)[0];
    return { jobs, machines, ops, parts, interval, transit, idleFraction, gridFactor: grid, materialsPerPart: matKg, makespan,
             runKwh, idleKwh, totalKwh: runKwh + idleKwh,
             carbon: { materials: materialsKg, electricity: elecCo2, process: procCo2, idle: idleCo2, operations: elecCo2 + procCo2 + idleCo2, total: materialsKg + elecCo2 + procCo2 + idleCo2 },
             carbonKg: elecCo2 + procCo2 + idleCo2,              // operations only (materials excluded), as before
             throughputPerHour: makespan ? parts / makespan : 0, leadTimeFirst: jobs[0].finish - jobs[0].release,
             waitHours: jobs.reduce((a, j) => a + j.steps.reduce((b, s) => b + s.wait, 0), 0), bottleneck, hotspot };
  }

  // The state of the factory at time t (hours since the first release).
  function stateAt(sim, t) {
    const machines = {};
    for (const [name, m] of Object.entries(sim.machines)) machines[name] = { state: 'idle', part: null, step: null, busySoFar: 0, runKwh: 0, runCo2: 0, kw: 0, co2Rate: 0, cumKwh: 0, cumCo2: 0, idleKw: m.idleKw };
    const parts = [];
    let cumKwh = 0, elec = 0, proc = 0, completed = 0, released = 0;
    for (const j of sim.jobs) {
      if (t < j.release) { parts.push({ part: j.part, status: 'not_released', carbonKg: 0 }); continue; }
      released++;
      let partCo2 = sim.materialsPerPart;
      for (const s of j.steps) {
        const frac = s.end > s.start ? Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start))) : (t >= s.end ? 1 : 0);
        cumKwh += s.kwh * frac; elec += s.co2Elec * frac; proc += s.co2Proc * frac; partCo2 += s.kgco2e * frac;
        const m = machines[s.machine];
        m.busySoFar += Math.max(0, Math.min(t, s.end) - s.start); m.runKwh += s.kwh * frac; m.runCo2 += s.kgco2e * frac;
        if (t >= s.start && t < s.end) { m.state = 'running'; m.part = j.part; m.step = s; m.kw += s.kw; m.co2Rate += s.kw * sim.gridFactor + s.procRate; }
      }
      if (t >= j.finish) { completed++; parts.push({ part: j.part, status: 'done', machine: j.steps[j.steps.length - 1].machine, carbonKg: partCo2, finish: j.finish }); continue; }
      let pos = null;
      for (let i = 0; i < j.steps.length; i++) {
        const s = j.steps[i];
        if (t >= s.start && t < s.end) { pos = { part: j.part, status: 'processing', machine: s.machine, step: s }; break; }
        if (t >= s.ready && t < s.start) { pos = { part: j.part, status: 'queued', machine: s.machine, step: s }; break; }
        if (i > 0 && t >= s.depart && t < s.ready) { pos = { part: j.part, status: 'moving', from: j.steps[i - 1].machine, to: s.machine, progress: (t - s.depart) / (s.ready - s.depart), step: s }; break; }
      }
      parts.push({ ...(pos || { part: j.part, status: 'queued', machine: j.steps[0].machine }), carbonKg: partCo2 });
    }
    let idleSoFar = 0;
    for (const [name, m] of Object.entries(machines)) {
      const idleH = Math.max(0, Math.min(t, sim.makespan) - m.busySoFar), idleK = sim.machines[name].idleKw * idleH;
      idleSoFar += idleK;
      if (m.state === 'idle') { m.kw = sim.machines[name].idleKw; m.co2Rate = m.kw * sim.gridFactor; }
      m.cumKwh = m.runKwh + idleK; m.cumCo2 = m.runCo2 + idleK * sim.gridFactor;
    }
    const materials = sim.materialsPerPart * released, idleCo2 = idleSoFar * sim.gridFactor;
    const totalKw = Object.values(machines).reduce((a, m) => a + m.kw, 0), co2Rate = Object.values(machines).reduce((a, m) => a + m.co2Rate, 0);
    return { t, machines, parts, completed, released, wip: parts.filter((p) => ['processing', 'queued', 'moving'].includes(p.status)).length,
             cumKwh: cumKwh + idleSoFar, cumCarbonKg: elec + proc + idleCo2, idleKwhSoFar: idleSoFar, totalKw, co2Rate,
             carbon: { materials, electricity: elec, process: proc, idle: idleCo2, operations: elec + proc + idleCo2, total: materials + elec + proc + idleCo2 } };
  }

  // Things that happened in (t0, t1]: operations finished (with their energy and carbon) and parts released (with material carbon).
  function eventsBetween(sim, t0, t1) {
    const ev = [];
    for (const j of sim.jobs) {
      if (j.release > t0 && j.release <= t1) ev.push({ type: 'release', part: j.part, machine: j.steps[0].machine, materialsKg: sim.materialsPerPart });
      for (const s of j.steps) if (s.end > t0 && s.end <= t1) ev.push({ type: 'done', part: j.part, machine: s.machine, process: s.process, kwh: s.kwh, kgco2e: s.kgco2e });
    }
    return ev;
  }

  // Samples for charts: time, total power, cumulative carbon by source, and optionally one machine's power.
  function series(sim, n = 240, machine = null) {
    const out = { t: [], kw: [], materials: [], electricity: [], process: [], idle: [], machineKw: [] };
    for (let i = 0; i <= n; i++) {
      const t = (sim.makespan * i) / n, S = stateAt(sim, t);
      out.t.push(t); out.kw.push(S.totalKw); out.materials.push(S.carbon.materials); out.electricity.push(S.carbon.electricity);
      out.process.push(S.carbon.process); out.idle.push(S.carbon.idle); if (machine) out.machineKw.push(S.machines[machine].kw);
    }
    return out;
  }

  root.TWIN_SIM = { simulate, stateAt, eventsBetween, series };
})(typeof window !== 'undefined' ? window : globalThis);
