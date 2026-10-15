// 3D view of the factory floor (three.js, vendored in ./vendor — no internet needed).
// Exposes window.TWIN3D; twin.html feeds it the floor, the machines and the simulation state.
// What the scene shows (LCA focus): detailed machines that move while they work, stack lights, power flowing in through cables,
// CO2e puffs in proportion to carbon emitted, energy/carbon towers, hotspot ring, parts coloured by embodied carbon, and
// material crates flying from the store into the line (sized by their carbon). Real CAD models (glTF/GLB) can replace the
// procedural ones: see docs/models/README.md.
// Axes: floor x (m) -> scene X, floor y (m) -> scene Z, height -> scene Y. Front of every machine faces +Z.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import * as WK from './twin-walk.mjs';

const STATUS_HEX = { ok: 0x047857, watch: 0xb45309, high: 0xdc2626, no_live: 0x9ca3af };
const IDLE = 0xcbd5e1, RUN = 0x34d399;
const PUFF_KG = 0.03;                                   // one grey puff stands for about this much CO2e
const cb = { pick: () => {}, pickPart: () => {}, move: () => {}, hover: () => {}, models: () => {}, nearby: () => {} };

let renderer, scene, camera, controls, host, editing = false, floorDef = null;
const machines = new Map(), byName = new Map(), models = new Map();
let partPool = [], sceneGroup = null, flowGroup = null, flowNames = [], cables = [], substation = null, ring = null, hiRing = null, store = null;
let puffs = [], floats = [], crates = [], follow = null, tween = null, puffTex = null;
let mode = 'state', fx = true, lastNow = 0, spec0 = null, walk = null, avatar = null, statics = [], labelsOn = true, nameLabels = [];
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const gltfLoader = new GLTFLoader();

const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2, ...extra });
const steel = () => mat(0x94a3b8, { metalness: 0.55, roughness: 0.4 }), dark = () => mat(0x475569), black = () => mat(0x1f2937), rubber = () => mat(0x111827, { roughness: 0.9, metalness: 0 });
const glass = () => mat(0x93c5fd, { transparent: true, opacity: 0.5, roughness: 0.1 }), yellow = () => mat(0xfacc15), screen = () => mat(0x0ea5e9, { emissive: 0x0369a1, emissiveIntensity: 0.6 });
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function cyl(r, len, m, axis = 'y', x = 0, y = 0, z = 0, seg = 28) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2; else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function sph(r, m, x = 0, y = 0, z = 0) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); s.position.set(x, y, z); s.castShadow = true; return s; }
function pipe(pts, r, m) { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p)), false, 'catmullrom', 0.1), 24, r, 8), m); t.castShadow = true; return t; }
// control cabinet with a screen and three indicator lamps
function cabinet(w, h, d, bodyMat) {
  const g = new THREE.Group(); g.add(box(w, h, d, bodyMat || mat(0xe2e8f0)));
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, h * 0.22), screen()); sc.position.set(0, h * 0.7, d / 2 + 0.01); g.add(sc);
  [0x22c55e, 0xf59e0b, 0xef4444].forEach((c, i) => g.add(sph(0.07, new THREE.MeshBasicMaterial({ color: c }), -w * 0.2 + i * w * 0.2, h * 0.45, d / 2 + 0.05)));
  return g;
}
const osc = (n, f, p = 0) => Math.sin(n * f + p);

// One builder per machine_type. tick(now, k): k = 0..1 "how running" — drives the motion that shows what the machine is doing.
function buildMachine(type, w, d, body) {
  const g = new THREE.Group(); let H = 1.6, tick = () => {};
  g.add(box(w + 0.2, 0.08, d + 0.2, mat(0x64748b), 0, 0, 0));                 // plinth
  switch (type) {
    case 'oven': {
      H = 2.5; const doorMat = glass(); const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, H * 0.34), new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0xff6a00, emissiveIntensity: 0 }));
      win.position.set(0, 1.35, d / 2 + 0.2); const stackLamp = pipe([[w * 0.3, H, -d * 0.2], [w * 0.3, H + 0.6, -d * 0.2], [w * 0.38, H + 0.9, -d * 0.2]], 0.1, steel());
      g.add(box(w, H, d, body, 0, 0.08, 0), box(w * 0.52, H * 0.62, 0.18, dark(), 0, 0.5, d / 2 + 0.05), win, box(0.1, 0.9, 0.1, steel(), w * 0.2, 0.9, d / 2 + 0.25), stackLamp,
        cabinet(0.9, 1.1, 0.5).translateX(-w / 2 - 0.55).translateZ(d * 0.2));
      for (let i = 0; i < 4; i++) g.add(box(w * 0.7, 0.05, 0.05, dark(), 0, 0.5 + i * 0.35, -d / 2 - 0.03));              // louvres at the back
      tick = (n, k) => { win.material.emissiveIntensity = k * (1.2 + 0.5 * osc(n, 4)); }; break; }
    case 'autoclave': {
      const r = Math.min(d / 2, 1.7), L = w - 1.6; H = r * 2 + 0.3; const shell = cyl(r, L, body, 'x', 0, r + 0.3, 0, 40), dome = sph(r, body, -L / 2, r + 0.3, 0); dome.scale.x = 0.5;
      const ring = cyl(r * 1.04, 0.45, steel(), 'x', L / 2 + 0.1, r + 0.3, 0, 40), door = cyl(r * 0.96, 0.25, dark(), 'x', L / 2 + 0.45, r + 0.3, 0, 40), bolts = new THREE.Group();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, b = cyl(0.11, 0.3, steel(), 'x', L / 2 + 0.45, r + 0.3 + Math.sin(a) * r * 0.99, Math.cos(a) * r * 0.99, 8); bolts.add(b); }
      const gaugeFace = cyl(0.42, 0.1, mat(0xf8fafc), 'z', -L * 0.25, r * 2 + 0.3, r * 0.5, 24), needle = box(0.04, 0.34, 0.04, mat(0xdc2626), 0, 0, 0); needle.position.set(-L * 0.25, r * 2 + 0.3, r * 0.5 + 0.1);
      g.add(shell, dome, ring, door, bolts, gaugeFace, needle, box(0.6, r * 0.9, d * 0.7, dark(), -L * 0.3, 0.08, 0), box(0.6, r * 0.9, d * 0.7, dark(), L * 0.3, 0.08, 0),
        pipe([[-L * 0.3, r * 2 + 0.3, 0], [-L * 0.3, r * 2 + 1.2, 0], [-L * 0.8, r * 2 + 1.2, 0.5]], 0.14, steel()), cabinet(1.1, 1.6, 0.6).translateX(L / 2 + 1.2).translateZ(d * 0.35));
      tick = (n, k) => { const s = 1 + 0.01 * k * osc(n, 7); shell.scale.set(1, s, s); bolts.rotation.x = n * 0.5 * k; needle.rotation.z = -0.9 + 1.6 * k * (0.5 + 0.5 * osc(n, 1.3)); }; break; }
    case 'press': {
      H = 3.4; const platen = box(w * 0.86, 0.5, d * 0.86, steel(), 0, 1.5, 0), rod = cyl(0.22, 1.6, mat(0xcbd5e1, { metalness: 0.8 }), 'y', 0, 2.6, 0), cylBody = cyl(0.5, 1.2, dark(), 'y', 0, 3.2, 0);
      g.add(box(w, 0.9, d, body, 0, 0.08, 0), box(w * 0.7, 0.4, d * 0.7, steel(), 0, 0.98, 0), platen, rod, cylBody, box(w, 0.55, d, dark(), 0, 2.85, 0));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.35, 2.3, 0.35, steel(), sx * w * 0.44, 0.9, sz * d * 0.44));
      for (const sx of [-1, 1]) g.add(box(0.05, 1.8, 0.05, new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.55 }), sx * w * 0.5, 0.9, d / 2 + 0.3));   // light curtain
      g.add(box(1.2, 0.9, 0.9, mat(0x1e3a8a), w / 2 + 0.9, 0.08, -d * 0.2), cabinet(0.9, 1.5, 0.5).translateX(-w / 2 - 0.8).translateZ(d * 0.3));
      tick = (n, k) => { const p = 0.5 + 0.5 * osc(n, 2.4); platen.position.y = 1.75 - 0.5 * k * p; rod.position.y = 2.6 - 0.5 * k * p; }; break; }
    case 'cnc': {
      H = 2.6; const head = box(0.7, 1.0, 0.7, steel(), 0, 1.0, 0), tool = cyl(0.07, 0.6, black(), 'y', 0, 0.9, 0, 12), tableP = box(w * 0.55, 0.15, d * 0.55, dark(), 0, 0.75, 0), spin = new THREE.Group(); spin.add(tool);
      g.add(box(w, H, d, body, 0, 0.08, 0), box(w * 0.62, H * 0.55, 0.08, glass(), -w * 0.08, 0.95, d / 2 + 0.02), box(w * 0.68, 0.1, 0.12, steel(), -w * 0.08, 0.85, d / 2 + 0.08), box(w * 0.68, 0.1, 0.12, steel(), -w * 0.08, 0.85 + H * 0.55, d / 2 + 0.08),
        tableP, head, spin, box(w * 0.25, 0.7, d * 0.5, dark(), w / 2 + 0.15, 0.08, 0), box(0.1, 1.2, 0.1, steel(), w * 0.42, 1.0, d / 2 + 0.3));
      const pend = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), screen()); pend.position.set(w * 0.42, 2.2, d / 2 + 0.55); g.add(pend);
      for (let i = 0; i < 6; i++) g.add(box(0.07, 0.07, d * 0.5, steel(), w * 0.08 + i * 0.01, H, 0));                                        // coolant lines
      tick = (n, k) => { const x = osc(n, 2.2) * w * 0.2 * k - w * 0.08; head.position.x = x; spin.position.set(x, 0, 0); tool.rotation.y = n * 30 * k; }; break; }
    case 'spray_booth': {
      H = 3.4; const nozzle = box(0.35, 0.5, 0.35, mat(0xf97316), 0, 1.5, -d * 0.1), arm = box(0.12, 1.4, 0.12, steel(), 0, 0.9, -d * 0.1), mist = box(w * 0.6, 1.8, d * 0.6, mat(0xf97316, { transparent: true, opacity: 0 }), 0, 0.5, 0);
      g.add(box(w, 0.1, d, mat(0xe2e8f0), 0, 0.08, 0), box(w, H, 0.2, body, 0, 0.08, -d / 2 + 0.1), box(0.2, H, d, body, -w / 2 + 0.1, 0.08, 0), box(0.2, H, d, body, w / 2 - 0.1, 0.08, 0), box(w, 0.25, d, body, 0, H, 0),
        box(w * 0.5, 0.06, 0.1, mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), 0, H - 0.1, d * 0.3), nozzle, arm, mist, cyl(0.5, 1.4, steel(), 'y', -w * 0.25, H + 0.9, -d * 0.2, 20), cabinet(0.8, 1.3, 0.5).translateX(w / 2 + 0.7).translateZ(d * 0.2));
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) g.add(box(w / 7, 0.06, d / 4, mat(0xcbd5e1), -w * 0.4 + i * (w * 0.16), H + 0.25, -d * 0.3 + j * (d * 0.3)));       // roof filters
      g.add(box(w * 0.4, 0.5, 0.5, steel(), 0, 0.08, -d * 0.3));
      tick = (n, k) => { const x = osc(n, 3) * w * 0.3 * k; nozzle.position.x = x; arm.position.x = x; mist.material.opacity = k * (0.13 + 0.07 * osc(n, 9)); }; break; }
    case 'vacuum_pump': {
      H = 1.4; const fly = cyl(0.42, 0.12, steel(), 'x', w * 0.32, 0.65, d * 0.5 + 0.05, 24), motor = cyl(Math.min(d, 1) * 0.32, w * 0.5, body, 'x', -w * 0.15, 0.6, 0, 20);
      g.add(box(w, 0.35, d, dark(), 0, 0.08, 0), motor, box(w * 0.3, 0.7, d * 0.7, steel(), w * 0.3, 0.4, 0), fly, cyl(0.22, 0.55, mat(0xcbd5e1), 'y', w * 0.3, 1.2, 0), pipe([[w * 0.3, 1.45, 0], [w * 0.3, 1.9, 0.3], [-w * 0.2, 1.9, 0.4]], 0.07, steel()),
        cyl(0.2, 0.08, mat(0xf8fafc), 'z', -w * 0.3, 1.05, d / 2 + 0.05, 18), cabinet(0.45, 0.8, 0.3).translateX(-w * 0.55).translateZ(-d * 0.1));
      tick = (n, k) => { fly.rotation.x = n * 14 * k; motor.position.y = 0.6 + 0.012 * k * osc(n, 40); }; break; }
    case 'injection': {
      H = 2.3; const mp = box(0.4, 1.5, d * 0.7, steel(), -w * 0.15, 0.4, 0), barrel = cyl(0.3, w * 0.5, mat(0xb45309), 'x', w * 0.22, 1.0, 0, 20), hop = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 20), dark());
      hop.position.set(w * 0.4, 1.95, 0); hop.rotation.x = Math.PI;
      g.add(box(w, 0.5, d * 0.8, body, 0, 0.08, 0), box(0.4, 1.6, d * 0.7, steel(), -w * 0.38, 0.4, 0), mp, box(0.4, 1.6, d * 0.7, steel(), w * 0.02, 0.4, 0), barrel, hop, box(w * 0.2, 0.7, d * 0.55, dark(), w * 0.4, 0.5, 0),
        cabinet(0.8, 1.5, 0.5).translateX(-w * 0.1).translateZ(d / 2 + 0.2));
      for (const tz of [-1, 1]) for (const ty of [0.8, 1.6]) g.add(cyl(0.07, w * 0.4, steel(), 'x', -w * 0.18, ty, tz * d * 0.28, 10));
      tick = (n, k) => { mp.position.x = -w * 0.15 + w * 0.12 * k * (0.5 + 0.5 * osc(n, 2.6)); hop.rotation.z = 0.08 * k * osc(n, 12); barrel.position.x = w * 0.22 + 0.15 * k * osc(n, 3); }; break; }
    case 'dispenser': {
      H = 2.0; const gantry = box(w * 0.9, 0.18, 0.18, steel(), 0, 1.7, 0), carriage = box(0.4, 0.4, 0.4, body, 0, 1.55, 0), nozzle = cyl(0.06, 0.55, black(), 'y', 0, 1.05, 0, 10), cart = cyl(0.12, 0.5, mat(0xfde68a), 'y', 0, 1.5, 0.3, 12);
      g.add(box(w, 0.95, d, mat(0x64748b), 0, 0.08, 0), box(0.18, 1.0, 0.18, steel(), -w * 0.42, 0.9, 0), box(0.18, 1.0, 0.18, steel(), w * 0.42, 0.9, 0), gantry, carriage, nozzle, cart, box(w * 0.6, 0.12, d * 0.6, dark(), 0, 1.03, 0));
      tick = (n, k) => { const x = osc(n, 3) * w * 0.3 * k, y = 0.1 * k * osc(n, 8); carriage.position.set(x, 1.55 + y, 0); nozzle.position.set(x, 1.05 + y, 0); cart.position.set(x, 1.5 + y, 0.3); }; break; }
    case 'cutting': {
      H = 1.9; const gantry = box(0.35, 0.5, d * 1.05, steel(), 0, 1.0, 0), head = box(0.5, 0.45, 0.45, body, 0, 1.0, 0), roll = cyl(0.32, d * 0.95, mat(0x111827), 'z', -w * 0.55, 0.65, 0, 20);
      g.add(box(w, 0.12, d, body, 0, 0.82, 0), box(0.15, 0.82, 0.15, dark(), -w / 2 + 0.2, 0.0, -d / 2 + 0.2), box(0.15, 0.82, 0.15, dark(), w / 2 - 0.2, 0.0, -d / 2 + 0.2), box(0.15, 0.82, 0.15, dark(), -w / 2 + 0.2, 0.0, d / 2 - 0.2), box(0.15, 0.82, 0.15, dark(), w / 2 - 0.2, 0.0, d / 2 - 0.2),
        gantry, head, roll, box(w, 0.06, 0.1, steel(), 0, 0.95, d / 2), box(w, 0.06, 0.1, steel(), 0, 0.95, -d / 2));
      for (let i = 0; i < 12; i++) g.add(box(w * 0.88, 0.02, 0.04, dark(), 0, 0.95, -d * 0.45 + i * (d * 0.9 / 11)));
      tick = (n, k) => { const gx = osc(n, 1.2) * w * 0.35 * k; gantry.position.x = gx; head.position.set(gx, 1.0, osc(n, 3.1) * d * 0.35 * k); roll.rotation.z = n * 2 * k; }; break; }
    case 'hand_tool': {
      H = 1.4; const tool = box(0.5, 0.28, 0.5, steel(), 0, 0.95, 0), disc = cyl(0.22, 0.05, mat(0xd97706), 'y', 0, 0.93, 0, 20);
      g.add(box(w, 0.1, d, body, 0, 0.8, 0), box(0.1, 0.8, 0.1, dark(), -w / 2 + 0.15, 0, -d / 2 + 0.15), box(0.1, 0.8, 0.1, dark(), w / 2 - 0.15, 0, -d / 2 + 0.15), box(0.1, 0.8, 0.1, dark(), -w / 2 + 0.15, 0, d / 2 - 0.15), box(0.1, 0.8, 0.1, dark(), w / 2 - 0.15, 0, d / 2 - 0.15),
        box(w * 0.9, 0.06, d * 0.9, steel(), 0, 0.3, 0), tool, disc, box(0.3, 0.3, 0.2, mat(0x7c3aed), w * 0.3, 0.92, -d * 0.25), box(0.15, 0.25, 0.15, dark(), -w * 0.35, 0.92, d * 0.3));
      tick = (n, k) => { tool.position.x = 0.08 * k * osc(n, 40); tool.position.z = 0.07 * k * osc(n, 33); disc.position.copy(tool.position).setY(0.93); disc.rotation.y = n * 40 * k; }; break; }
    case 'packaging': {
      H = 1.9; const belt = box(w * 0.95, 0.12, d * 0.45, rubber(), 0, 0.92, 0), cartons = [0, 1, 2].map((i) => { const c = box(0.8, 0.5, 0.6, mat(0xd6b88a), 0, 1.04, 0); c.position.x = -w * 0.3 + i * w * 0.3; return c; });
      g.add(box(w, 0.9, d, body, 0, 0.08, 0), belt, ...cartons, box(w * 0.12, 0.7, d * 0.7, mat(0xdc2626), w * 0.38, 0.95, 0), box(w * 0.5, 0.12, 0.12, steel(), 0, 1.7, -d * 0.3), cabinet(0.55, 0.9, 0.3).translateX(-w * 0.35).translateZ(d / 2 + 0.2));
      for (let i = 0; i < 9; i++) g.add(cyl(0.05, d * 0.45, steel(), 'z', -w * 0.43 + i * (w * 0.86 / 8), 0.98, 0, 8));
      tick = (n, k) => { cartons.forEach((c, i) => { c.position.x = -w * 0.4 + (((i / 3) + n * 0.12 * k) % 1) * w * 0.8; }); }; break; }
    default: H = 1.6; g.add(box(w, H, d, body, 0, 0.08, 0)); g.add(cabinet(0.6, 1, 0.3).translateX(w / 2 + 0.4));
  }
  return { group: g, height: H, tick, procedural: true };
}

// beacon on top of a machine: green = running, amber = idle, red = live energy way above design
function stackLight(h) {
  const g = new THREE.Group(), mk = (c) => new THREE.MeshBasicMaterial({ color: c }), lights = { g: mk(0x14532d), a: mk(0x78350f), r: mk(0x7f1d1d) };
  g.add(cyl(0.05, 0.9, dark(), 'y', 0, 0.45, 0, 8));
  [['r', 1.05], ['a', 0.82], ['g', 0.59]].forEach(([k, y]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 14), lights[k]); m.position.set(0, y, 0); g.add(m); });
  g.position.y = h; g.userData.lights = lights; return g;
}
const LIGHT_ON = { g: 0x4ade80, a: 0xfbbf24, r: 0xf87171 }, LIGHT_OFF = { g: 0x14532d, a: 0x78350f, r: 0x7f1d1d };

function labelSprite(text, { px = 56, fg = '#111827', bg = 'rgba(255,255,255,0.85)', scale = 0.015 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `bold ${px}px Arial`; const w = Math.ceil(x.measureText(text).width) + 28; c.width = w; c.height = px + 26;
  x.font = `bold ${px}px Arial`; x.fillStyle = bg; x.beginPath(); x.roundRect ? x.roundRect(0, 0, c.width, c.height, 14) : x.rect(0, 0, c.width, c.height); x.fill();
  x.fillStyle = fg; x.textBaseline = 'middle'; x.fillText(text, 14, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(c.width * scale, c.height * scale, 1); s.renderOrder = 10; s.userData.canvas = c; s.userData.base = [c.width * scale, c.height * scale]; return s;
}
function redrawLabel(sprite, text, fg, bg, px = 64) {
  const c = sprite.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = fg; x.font = `bold ${px}px Arial`; x.textBaseline = 'middle'; x.fillText(text, 14, c.height / 2 + 2); sprite.material.map.needsUpdate = true;
}
function floorText(text, w, h) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const x = c.getContext('2d'); x.font = `bold ${c.height * 0.6}px Arial`; x.fillStyle = '#374151'; x.textBaseline = 'middle'; x.fillText(text, 8, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  m.rotation.x = -Math.PI / 2; return m;
}
function makePuffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(70,75,85,0.9)'); g.addColorStop(0.6, 'rgba(90,95,105,0.45)'); g.addColorStop(1, 'rgba(110,115,125,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* ---------- colour scales ---------- */
const lerpHex = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, k)));
const heat = (k) => (k < 0.5 ? lerpHex(0x93c5fd, 0xfbbf24, k * 2) : lerpHex(0xfbbf24, 0xdc2626, (k - 0.5) * 2));
const smoke = (k) => lerpHex(0xe5e7eb, 0x1f2937, k);
function machineColour(rec, ms, sc) {
  const idle = new THREE.Color(IDLE);
  switch (mode) {
    case 'power': return ms.kw > 0 ? heat(Math.sqrt(ms.kw / (sc.kw || 1))) : idle;
    case 'energy': return ms.cumKwh > 0 ? heat(Math.sqrt(ms.cumKwh / (sc.kwh || 1))) : idle;
    case 'carbon': return ms.cumCo2 > 0 ? smoke(Math.sqrt(ms.cumCo2 / (sc.co2 || 1))) : idle;
    case 'variance': return rec.used ? new THREE.Color(STATUS_HEX[rec.status] ?? 0x9ca3af).lerp(new THREE.Color(0xffffff), 0.35) : idle;
    default: return new THREE.Color(ms.state === 'running' ? RUN : IDLE);
  }
}
function crateColour(name) {
  const n = name.toLowerCase();
  if (n.includes('carbon')) return 0x111827; if (n.includes('glass')) return 0x93c5fd; if (/resin|epoxy|vinyl/.test(n)) return 0xf59e0b; if (n.includes('adhesive')) return 0xfde68a;
  if (/peel|bag|film/.test(n)) return 0xe5e7eb; if (n.includes('paint')) return 0xef4444; if (n.includes('card') || n.includes('pack')) return 0xd6b88a; return 0x94a3b8;
}

/* ---------- real CAD models (glTF / GLB) ---------- */
async function useModel(key, url, opts = {}) {
  const gltf = await gltfLoader.loadAsync(url); models.set(key, { scene: gltf.scene, opts }); cb.models(key); return true;
}
// models embedded by `npm run models` (docs/models/models-embedded.js): usable even when the page is opened by double-click
async function loadEmbedded() {
  const E = window.TWIN_MODELS; if (!E) return false;
  for (const [k, v] of Object.entries(E)) {
    try {
      const bin = Uint8Array.from(atob(v.data), (c) => c.charCodeAt(0)).buffer;
      const gltf = await new Promise((res, rej) => gltfLoader.parse(bin, '', res, rej)); models.set(k, { scene: gltf.scene, opts: v.opts || {} }); cb.models(k);
    } catch (e) { console.warn('Could not read embedded model for', k, e); }
  }
  return true;
}
async function loadManifest(url = 'models/models.json') {
  if (await loadEmbedded()) return;
  try {
    const r = await fetch(url); if (!r.ok) return; const j = await r.json(), base = url.slice(0, url.lastIndexOf('/') + 1);
    for (const [k, v] of Object.entries(j)) { if (k.startsWith('_') || !v || !v.file) continue; try { await useModel(k, base + v.file, v); } catch (e) { console.warn('Could not load model for', k, e); } }
  } catch (e) { /* no manifest: procedural models are used */ }
}
function modelFor(rec) {
  const entry = models.get(rec.name) || models.get(rec.type); if (!entry) return null;
  const o = entry.opts, obj = entry.scene.clone(true), wrap = new THREE.Group(), D2R = THREE.MathUtils.degToRad;
  // orientation: rotateX first (e.g. -90 for a Z-up CAD export), then rotateZ, then rotateY (turn the machine on the floor)
  obj.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), D2R(o.rotateY || 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), D2R(o.rotateZ || 0))).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), D2R(o.rotateX || 0)))); wrap.add(obj);
  let b = new THREE.Box3().setFromObject(wrap), size = b.getSize(V(0, 0, 0)); const s = o.height ? o.height / (size.y || 1) : Math.min(rec.w / (size.x || 1), rec.d / (size.z || 1));
  wrap.scale.setScalar(s); b = new THREE.Box3().setFromObject(wrap); const c = b.getCenter(V(0, 0, 0)); wrap.position.set(-c.x, -b.min.y, -c.z);
  const g = new THREE.Group(); g.add(wrap); size = b.getSize(V(0, 0, 0));
  return { group: g, height: size.y, tick: () => {}, procedural: false };
}


/* ---------- explorer avatar: a worker you can walk around the floor ---------- */
function buildHumanoid() {
  const root = new THREE.Group(), P = {};
  const skin = mat(0xf0c8a0, { roughness: 0.85, metalness: 0 }), shirt = mat(0x475569, { roughness: 0.85 }), vest = mat(0xff7a00, { roughness: 0.7 }), strip = mat(0xe5e7eb, { emissive: 0x9ca3af, emissiveIntensity: 0.5 });
  const trousers = mat(0x1e3a8a, { roughness: 0.85 }), boot = mat(0x111827), hat = mat(0xfacc15, { roughness: 0.4 }), shade = mat(0x0f172a, { roughness: 0.2, metalness: 0.5 }), glove = mat(0x1f2937);
  const cap = (r, len, m) => { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m); c.castShadow = true; return c; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const pivot = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
  const leg = (sx) => {
    const hip = pivot(sx * 0.1, 0.93, 0), knee = pivot(0, -0.44, 0);
    hip.add(at(cap(0.075, 0.34, trousers), 0, -0.22, 0)); knee.add(at(cap(0.062, 0.34, trousers), 0, -0.22, 0), at(box(0.12, 0.1, 0.27, boot), 0, -0.5, 0.05)); hip.add(knee); return { hip, knee };
  };
  const arm = (sx) => {
    const sh = pivot(sx * 0.24, 1.4, 0), el = pivot(0, -0.3, 0);
    sh.add(at(cap(0.052, 0.24, shirt), 0, -0.15, 0)); el.add(at(cap(0.043, 0.22, skin), 0, -0.14, 0), at(sph(0.05, glove), 0, -0.3, 0)); sh.add(el); return { sh, el };
  };
  const lL = leg(-1), rL = leg(1), lA = arm(-1), rA = arm(1);
  const torso = pivot(0, 0.93, 0);
  torso.add(at(box(0.36, 0.5, 0.2, shirt), 0, 0, 0), at(box(0.385, 0.46, 0.225, vest), 0, 0.02, 0), at(box(0.39, 0.045, 0.23, strip), 0, 0.14, 0), at(box(0.39, 0.045, 0.23, strip), 0, 0.3, 0),
    at(box(0.05, 0.46, 0.232, strip), -0.1, 0.02, 0), at(box(0.05, 0.46, 0.232, strip), 0.1, 0.02, 0));
  const head = pivot(0, 1.5, 0), skull = sph(0.115, skin); skull.scale.y = 1.12;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.128, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), hat); dome.castShadow = true;
  head.add(at(cyl(0.045, 0.1, skin, 'y', 0, 0.02, 0, 12), 0, 0.02, 0), at(skull, 0, 0.14, 0), at(dome, 0, 0.16, 0), at(cyl(0.165, 0.02, hat, 'y', 0, 0, 0, 28), 0, 0.165, 0.01), at(box(0.12, 0.015, 0.1, hat), 0, 0.165, 0.15), at(box(0.17, 0.035, 0.03, shade), 0, 0.15, 0.105));
  root.add(lL.hip, rL.hip, torso, head, lA.sh, rA.sh);
  Object.assign(P, { lLeg: lL.hip, lKnee: lL.knee, rLeg: rL.hip, rKnee: rL.knee, lArm: lA.sh, lElbow: lA.el, rArm: rA.sh, rElbow: rA.el, torso, head });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  root.visible = false; scene.add(root);
  return { group: root, parts: P, phase: 0, gesture: 0 };
}
function animateAvatar(dt, now, speed, running) {
  const A = avatar, p = A.parts, s = Math.min(1, speed / 1.7), mv = speed > 0.05;
  if (mv) A.phase += dt * (3.4 + speed * 1.5);
  const sw = Math.sin(A.phase) * 0.72 * s * (running ? 1.25 : 1), bend = (ph) => Math.max(0, Math.sin(ph - 1.0)) * 1.0 * s;
  p.lLeg.rotation.x = sw; p.rLeg.rotation.x = -sw; p.lKnee.rotation.x = bend(A.phase); p.rKnee.rotation.x = bend(A.phase + Math.PI);
  p.lArm.rotation.x = -sw * 0.85; p.rArm.rotation.x = sw * 0.85; p.lElbow.rotation.x = -0.15 - 0.35 * s * (running ? 1.6 : 1); p.rElbow.rotation.x = -0.15 - 0.35 * s * (running ? 1.6 : 1);
  if (A.gesture > 0) { A.gesture = Math.max(0, A.gesture - dt); const k = Math.sin(Math.min(1, (1.2 - A.gesture) / 0.25) * Math.PI / 2) * Math.min(1, A.gesture / 0.3); p.rArm.rotation.x = p.rArm.rotation.x * (1 - k) - 1.55 * k; p.rElbow.rotation.x *= 1 - k; }
  p.torso.position.y = 0.93 + Math.abs(Math.sin(A.phase)) * 0.022 * s; p.head.position.y = 1.5 + Math.abs(Math.sin(A.phase)) * 0.022 * s;
  p.torso.rotation.x = (running ? 0.16 : 0.05) * s; p.torso.scale.set(1, 1 + 0.008 * Math.sin(now * 2.2), 1);
}
const machineRects = () => [...machines.values()].map((m) => ({ x: m.x, y: m.y, w: m.w, d: m.d }));
function updateWalk(dt, now) {
  const W = walk, bounds = { width: floorDef.width_m, height: floorDef.height_m }, rects = machineRects().concat(statics);
  const fwd = controls.target.clone().sub(camera.position); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  const k = W.keys, ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0), iz = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const dir = WK.inputDirection(ix, iz, fwd.x, fwd.z), run = k.has('shift'), top = run ? WK.WALK.runSpeed : WK.WALK.walkSpeed, a = Math.min(1, WK.WALK.accel * dt);
  W.vx += (dir.x * top - W.vx) * a; W.vz += (dir.z * top - W.vz) * a;
  const np = WK.move({ x: W.x, z: W.z }, W.vx, W.vz, dt, rects, bounds), speed = Math.hypot(np.x - W.x, np.z - W.z) / (dt || 1);
  W.x = np.x; W.z = np.z;
  if (dir.x || dir.z) W.yaw = WK.stepAngle(W.yaw, Math.atan2(dir.x, dir.z), dt * 9);
  avatar.group.position.set(W.x, 0, W.z); avatar.group.rotation.y = W.yaw; avatar.group.visible = !W.first;
  animateAvatar(dt, now, speed, run);
  const head = V(W.x, W.first ? 1.62 : 1.5, W.z), delta = head.clone().sub(controls.target); controls.target.copy(head); camera.position.add(delta);
  const ms = [...machines.values()], nn = WK.nearest(W.x, W.z, ms.map((m) => ({ x: m.x, y: m.y, w: m.w, d: m.d }))), id = nn && nn.dist < WK.WALK.nearDistance ? ms[nn.index].id : null;
  if (id !== W.near) { W.near = id; highlight(id); cb.nearby(id === null ? null : { id, name: ms[nn.index].name, dist: nn.dist }); }
}
// labels shrink when the camera is close (walking among the machines) so they never fill the screen
function scaleLabels() {
  const walking = !!(walk && walk.active), tune = (sp, wp) => { if (!sp || !sp.userData.base) return; const d = camera.position.distanceTo(wp || sp.position), k = walking ? Math.min(1, Math.max(0.28, d / 34)) : 1; sp.scale.set(sp.userData.base[0] * k, sp.userData.base[1] * k, 1); };
  for (const m of machines.values()) { tune(m.label); tune(m.tag); }
  if (substation) tune(substation.userData.label);
  for (const g of partPool) if (g && g.visible) tune(g.children[1], g.position);
}
function teleport(x, z) {
  if (!walk || !walk.active) return false;
  const bounds = { width: floorDef.width_m, height: floorDef.height_m }, rects = machineRects().concat(statics);
  for (let r = 0; r <= 6; r += 0.5) for (let a = 0; a < 8; a++) {
    const px = x + Math.cos(a * Math.PI / 4) * r, pz = z + Math.sin(a * Math.PI / 4) * r;
    if (!WK.blocked(px, pz, WK.WALK.radius, rects, bounds)) { const dx = px - walk.x, dz = pz - walk.z; walk.x = px; walk.z = pz; walk.vx = walk.vz = 0; controls.target.x += dx; controls.target.z += dz; camera.position.x += dx; camera.position.z += dz; return true; }
  }
  return false;
}
function setWalk(on) {
  if (!floorDef) return;
  if (on) {
    avatar = avatar || buildHumanoid(); follow = null; tween = null;
    const bounds = { width: floorDef.width_m, height: floorDef.height_m }, sp = WK.spawnPoint(machineRects().concat(statics), bounds);
    walk = { active: true, x: sp.x, z: sp.z, yaw: Math.PI, vx: 0, vz: 0, keys: new Set(), first: false, near: null };
    controls.minDistance = 2.5; controls.maxDistance = 16; controls.target.set(sp.x, 1.5, sp.z); camera.position.set(sp.x, 3.6, sp.z + 6.5); controls.update();
    avatar.group.position.set(sp.x, 0, sp.z); avatar.group.rotation.y = Math.PI; avatar.group.visible = true;
  } else if (walk) {
    walk.active = false; if (avatar) avatar.group.visible = false; controls.minDistance = 6; controls.maxDistance = 140; highlight(null); cb.nearby(null); resetView(false);
  }
}
function toggleFirstPerson() {
  if (!walk || !walk.active) return false; walk.first = !walk.first;
  const off = camera.position.clone().sub(controls.target).normalize().multiplyScalar(walk.first ? 0.3 : 6); controls.minDistance = walk.first ? 0.2 : 2.5;
  camera.position.copy(controls.target).add(off); return walk.first;
}
function setKey(k, down) { if (walk && walk.active) { down ? walk.keys.add(k) : walk.keys.delete(k); } }
window.addEventListener('keydown', (e) => keyEvent(e, true)); window.addEventListener('keyup', (e) => keyEvent(e, false)); window.addEventListener('blur', () => { if (walk) walk.keys.clear(); });
function keyEvent(e, down) {
  if (!walk || !walk.active || (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) || e.ctrlKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { setKey(k, down); e.preventDefault(); }
  else if (down && k === 'v') toggleFirstPerson();
}

/* ---------- init ---------- */
function init(container) {
  host = container;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'width:100%;display:block;border-radius:10px;touch-action:none';
  host.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xeef2f7);
  camera = new THREE.PerspectiveCamera(42, 1.6, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6c2d1, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(25, 60, 50); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 5, far: 160 });
  scene.add(sun, sun.target);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI / 2.05; controls.minDistance = 6; controls.maxDistance = 140;
  controls.enableZoom = false;
  renderer.domElement.addEventListener('wheel', (e) => { controls.enableZoom = e.ctrlKey || e.metaKey; }, { capture: true, passive: true });
  puffTex = makePuffTexture();
  const resize = () => { const fill = host.dataset.fill === '1', w = host.clientWidth || 800, hgt = fill ? (host.clientHeight || 600) : Math.round(Math.max(420, Math.min(700, w * 0.6))); renderer.setSize(w, hgt, false); renderer.domElement.style.height = hgt + 'px'; if (fill) renderer.domElement.style.borderRadius = '0'; camera.aspect = w / hgt; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(host); resize();
  const el = renderer.domElement; let down = null, drag = null;
  const setPtr = (e) => { const r = el.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); };
  const hit = () => {   // parts first, then machines
    const po = partPool.filter((g) => g && g.visible), ph = po.length ? ray.intersectObjects(po, true)[0] : null;
    if (ph) { let o = ph.object; while (o && o.userData.partNo === undefined) o = o.parent; if (o) return { part: o.userData.partNo }; }
    const objs = []; machines.forEach((m) => objs.push(m.group)); const h = ray.intersectObjects(objs, true)[0]; let o = h && h.object;
    while (o && o.userData.machineId === undefined) o = o.parent; return o ? { machine: o.userData.machineId } : null;
  };
  el.addEventListener('pointerdown', (e) => {
    setPtr(e); down = { x: e.clientX, y: e.clientY };
    const h = hit();
    if (editing && h && h.machine !== undefined) {
      const m = machines.get(h.machine), p = new THREE.Vector3(); ray.ray.intersectPlane(groundPlane, p);
      drag = { id: h.machine, dx: p.x - (m.x + m.w / 2), dz: p.z - (m.y + m.d / 2) }; controls.enabled = false; el.setPointerCapture(e.pointerId);
    }
  });
  el.addEventListener('pointermove', (e) => {
    setPtr(e);
    if (drag) {
      const m = machines.get(drag.id), p = new THREE.Vector3(); if (!ray.ray.intersectPlane(groundPlane, p)) return;
      const snap = (v) => Math.round(v * 2) / 2;
      const x = Math.min(Math.max(0, snap(p.x - drag.dx - m.w / 2)), floorDef.width_m - m.w), y = Math.min(Math.max(0, snap(p.z - drag.dz - m.d / 2)), floorDef.height_m - m.d);
      setMachinePos(drag.id, x, y); cb.move(drag.id, x, y); return;
    }
    const h = hit(); el.style.cursor = h ? (editing && h.machine !== undefined ? 'grab' : 'pointer') : 'default';
    cb.hover(h, e.clientX, e.clientY);
  });
  const end = (e) => {
    if (drag) { drag = null; controls.enabled = true; return; }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) { setPtr(e); const h = hit(); if (h && h.part !== undefined) cb.pickPart(h.part); else cb.pick(h ? h.machine : null); }
    down = null;
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointerleave', () => { down = null; cb.hover(null); });
  requestAnimationFrame(loop); loadManifest();
}

/* ---------- frame loop: motion, particles, cables, crates, tweens ---------- */
function loop(nowMs) {
  requestAnimationFrame(loop);
  const now = nowMs / 1000, dt = Math.min(0.05, now - (lastNow || now)); lastNow = now;
  if (tween) {
    const k = Math.min(1, (nowMs - tween.t0) / tween.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    controls.target.lerpVectors(tween.fromT, tween.toT, e); camera.position.lerpVectors(tween.fromP, tween.toP, e); if (k >= 1) tween = null;
  }
  if (follow !== null && partPool[follow] && partPool[follow].visible) {
    const p = partPool[follow].position, delta = p.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 5)); controls.target.add(delta); camera.position.add(delta);
  }
  for (const m of machines.values()) {
    m.k += ((m.state === 'running' ? 1 : 0) - m.k) * Math.min(1, dt * 6);
    if (m.k > 0.005 || m.kWas) m.tick(now, m.k); m.kWas = m.k > 0.005;
  }
  if (walk && walk.active) updateWalk(dt, now);
  scaleLabels();
  animateCables(now); animatePuffs(dt); animateFloats(dt); animateCrates(now);
  if (ring && ring.visible) { ring.rotation.z += dt * 1.6; const s = 1 + 0.06 * Math.sin(now * 3); ring.scale.set(s, s, 1); }
  if (hiRing && hiRing.visible) { hiRing.rotation.z -= dt * 2.4; const s = 1 + 0.08 * Math.sin(now * 5); hiRing.scale.set(s, s, 1); }
  controls.update(); renderer.render(scene, camera);
}
function animateCables(now) {
  for (const c of cables) {
    const kw = c.rec.kw || 0, n = fx && kw > 0 ? Math.max(1, Math.ceil(Math.sqrt(kw / (c.scaleKw || 1)) * c.pulses.length)) : 0;
    c.pulses.forEach((p, i) => {
      p.visible = i < n; if (!p.visible) return;
      const u = ((i / c.pulses.length) + now * 5 / c.len) % 1; let d = u * c.len, k = 0;
      while (k < c.segs.length - 1 && d > c.segs[k]) { d -= c.segs[k]; k++; }
      const f = c.segs[k] ? Math.min(1, d / c.segs[k]) : 0; p.position.lerpVectors(c.pts[k], c.pts[k + 1], f);
    });
  }
}
function spawnPuff(rec, size = 1) {
  let p = puffs.find((x) => !x.sprite.visible);
  if (!p) { if (puffs.length > 600) return; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false })); scene.add(sp); p = { sprite: sp, life: 0, max: 1, v: V(0, 0, 0), s0: 1 }; puffs.push(p); }
  p.sprite.visible = true; p.life = 0; p.max = 3 + Math.random() * 1.6; p.s0 = (0.9 + Math.random() * 0.5) * size;
  p.sprite.position.set(rec.x + rec.w * (0.25 + Math.random() * 0.5), rec.height + 0.4, rec.y + rec.d * (0.25 + Math.random() * 0.5));
  p.v.set(0.5 + Math.random() * 0.4, 1.0 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4);
}
function animatePuffs(dt) {
  for (const p of puffs) {
    if (!p.sprite.visible) continue;
    p.life += dt; const k = p.life / p.max; if (k >= 1) { p.sprite.visible = false; continue; }
    p.sprite.position.addScaledVector(p.v, dt); const s = p.s0 * (1 + 2.2 * k); p.sprite.scale.set(s, s, 1); p.sprite.material.opacity = 0.85 * (1 - k) * Math.min(1, k * 8);
  }
}
function animateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.life += dt; const k = f.life / 2.4;
    if (k >= 1) { scene.remove(f.sprite); f.sprite.material.map.dispose(); f.sprite.material.dispose(); floats.splice(i, 1); continue; }
    f.sprite.position.y += dt * 1.5; f.sprite.material.opacity = Math.min(1, (1 - k) * 2.2);
  }
}
function animateCrates(now) {
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i], k = (now - c.t0) / c.dur;
    if (k < 0) { c.mesh.visible = false; continue; }
    if (k >= 1) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); crates.splice(i, 1); continue; }
    c.mesh.visible = true; const a = 1 - k, p = c.from.clone().multiplyScalar(a * a).addScaledVector(c.ctrl, 2 * a * k).addScaledVector(c.to, k * k);
    c.mesh.position.copy(p); c.mesh.rotation.y += 0.05; c.mesh.rotation.x += 0.02; c.mesh.scale.setScalar(k > 0.85 ? Math.max(0.05, (1 - k) / 0.15) : 1);
  }
}

/* ---------- camera ---------- */
function flyTo(x, z, dist) {
  const toT = V(x, 0, z), dir = camera.position.clone().sub(controls.target).normalize(); dir.y = Math.max(dir.y, 0.6); dir.normalize();
  tween = { t0: performance.now(), dur: 900, fromT: controls.target.clone(), toT, fromP: camera.position.clone(), toP: toT.clone().addScaledVector(dir, dist || 22) };
}
function zoom(factor) {
  const off = camera.position.clone().sub(controls.target), len = Math.min(140, Math.max(6, off.length() * factor));
  tween = { t0: performance.now(), dur: 250, fromT: controls.target.clone(), toT: controls.target.clone(), fromP: camera.position.clone(), toP: controls.target.clone().add(off.normalize().multiplyScalar(len)) };
}
function resetView(top = false) {
  if (!floorDef) return; follow = null;
  const cx = floorDef.width_m / 2, cz = floorDef.height_m / 2, W = floorDef.width_m, H = floorDef.height_m;
  const toP = top ? V(cx, W * 0.8, cz + 0.01) : V(cx, W * 0.52, H + W * 0.34);
  tween = { t0: performance.now(), dur: 900, fromT: controls.target.clone(), toT: V(cx, 0, cz), fromP: camera.position.clone(), toP };
}

/* ---------- scene ---------- */
function clearScene() {
  if (sceneGroup) { scene.remove(sceneGroup); sceneGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
  machines.clear(); byName.clear(); partPool = []; cables = []; ring = null; hiRing = null; store = null; nameLabels = [];
  sceneGroup = new THREE.Group(); scene.add(sceneGroup);
}

// spec: { floor, zones, machines:[{id,name,type,x,y,w,d,status}], flow:[names], parts:n, hotspot, gridLabel }
function setScene(spec) {
  const first = !floorDef; floorDef = spec.floor; spec0 = spec;
  clearScene();
  const W = floorDef.width_m, H = floorDef.height_m;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, H + 6), mat(0xf8fafc, { roughness: 0.95, metalness: 0 })); ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, -0.02, H / 2); ground.receiveShadow = true; sceneGroup.add(ground);
  const gridPts = []; for (let x = 0; x <= W; x += 5) gridPts.push(x, 0.005, 0, x, 0.005, H); for (let z = 0; z <= H; z += 5) gridPts.push(0, 0.005, z, W, 0.005, z);
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3)); sceneGroup.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xe2e8f0 })));
  for (const z of spec.zones) {
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(z.width_m - 0.2, z.height_m - 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(z.colour || '#e5e7eb'), transparent: true, opacity: 0.75 }));
    slab.rotation.x = -Math.PI / 2; slab.position.set(z.x_m + z.width_m / 2, 0.015, z.y_m + z.height_m / 2); sceneGroup.add(slab);
    const lbl = floorText(z.zone_name, 14, 1.4); lbl.position.set(z.x_m + 0.6 + 7, 0.03, z.y_m + 1.4); sceneGroup.add(lbl);
  }
  for (const [x, z, w, d] of [[W / 2, -0.15, W + 0.3, 0.3], [W / 2, H + 0.15, W + 0.3, 0.3], [-0.15, H / 2, 0.3, H], [W + 0.15, H / 2, 0.3, H]]) sceneGroup.add(box(w, 0.7, d, mat(0x94a3b8), x, 0, z));
  for (let x = 0; x <= W; x += 15) for (const z of [0, H]) sceneGroup.add(box(0.5, 7, 0.5, mat(0xb6c2d1, { transparent: true, opacity: 0.35 }), x, 0, z));   // building columns
  // grid supply (transformer): where the electricity, and its carbon, enters the building
  const gx = W - 11, gz = H - 5; substation = new THREE.Group();
  substation.add(box(4.5, 2.6, 2.8, mat(0x64748b)), cyl(0.28, 1.1, mat(0xfde68a), 'y', -1.4, 3.1, 0), cyl(0.28, 1.1, mat(0xfde68a), 'y', 0, 3.1, 0), cyl(0.28, 1.1, mat(0xfde68a), 'y', 1.4, 3.1, 0), box(1.2, 1.6, 0.1, mat(0xfbbf24), 0, 0.5, 1.45));
  for (let i = -1; i <= 1; i++) substation.add(box(0.12, 1.6, 0.12, steel(), i * 1.2, 2.6, -0.6));
  substation.position.set(gx, 0, gz); sceneGroup.add(substation);
  const gl = labelSprite(spec.gridLabel || 'Grid supply'); gl.position.set(gx, 5.4, gz); sceneGroup.add(gl); substation.userData.label = gl; gl.visible = labelsOn; nameLabels.push(gl);
  // materials store: shelves with coloured crates; material crates fly from here into the line
  const sx = 2, sz = Math.max(8.5, H * 0.3); store = { x: sx + 2.5, z: sz + 1.2, y: 3 }; const sg = new THREE.Group();
  for (let i = 0; i < 3; i++) sg.add(box(5, 0.12, 2.4, steel(), 0, 0.2 + i * 1.1, 0));
  for (const [px, pz] of [[-2.4, -1.1], [2.4, -1.1], [-2.4, 1.1], [2.4, 1.1]]) sg.add(box(0.12, 3.5, 0.12, dark(), px, 0, pz));
  [0x111827, 0xf59e0b, 0xfde68a, 0xe5e7eb, 0xef4444, 0xd6b88a, 0x93c5fd].forEach((c, i) => sg.add(box(0.9, 0.7, 1.2, mat(c), -2 + (i % 5) * 1.0, 0.32 + Math.floor(i / 5) * 1.1, 0)));
  sg.position.set(sx + 2.5, 0, sz + 1.2); sceneGroup.add(sg);
  const sl = labelSprite('Materials store'); sl.position.set(sx + 2.5, 4.9, sz + 1.2); sceneGroup.add(sl); sl.visible = labelsOn; nameLabels.push(sl);
  const used = new Set(spec.flow);
  statics = [{ x: gx - 2.25, y: gz - 1.4, w: 4.5, d: 2.8 }, { x: store.x - 2.5, y: store.z - 1.2, w: 5, d: 2.4 }];
  for (const m of spec.machines) {
    const body = mat(IDLE), built = modelFor(m) || buildMachine(m.type, m.w, m.d, body), g = built.group;
    g.userData.machineId = m.id; g.position.set(m.x + m.w / 2, 0, m.y + m.d / 2);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(m.w + 1, m.d + 1), new THREE.MeshBasicMaterial({ color: STATUS_HEX[m.status] ?? 0xcbd5e1, transparent: true, opacity: used.has(m.name) ? 0.9 : 0.25 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(m.x + m.w / 2, 0.03, m.y + m.d / 2);
    const label = labelSprite(m.name); label.position.set(m.x + m.w / 2, built.height + 1.6, m.y + m.d / 2); label.visible = labelsOn; nameLabels.push(label);
    const tag = labelSprite('P00', { px: 64, fg: '#064e3b', bg: 'rgba(209,250,229,0.95)' }); tag.visible = false; tag.position.set(m.x + m.w / 2, built.height + 2.8, m.y + m.d / 2);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85, emissive: 0x7c4a00, emissiveIntensity: 0.4 }));
    tower.visible = false; tower.position.set(m.x + m.w + 0.9, 0.5, m.y + 0.9);
    const beacon = stackLight(built.height); beacon.position.x = m.w * 0.38; beacon.position.z = -m.d * 0.38; g.add(beacon);
    let tint = null;
    if (!built.procedural) { tint = []; g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); if (o.material.emissive) tint.push(o.material); } }); }
    if (!used.has(m.name)) g.traverse((o) => { if (o.material && !Array.isArray(o.material) && !beacon.children.includes(o)) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; } });
    const rec = { ...m, group: g, body, tint, pad, label, tag, tower, beacon, height: built.height, used: used.has(m.name), state: 'idle', partNo: null, k: 0, tick: built.tick, prevCo2: 0, puffAcc: 0, kw: 0 };
    machines.set(m.id, rec); byName.set(m.name, rec); sceneGroup.add(g, pad, label, tag, tower);
  }
  buildCables(gx, gz, used); drawFlow(spec.flow); flowGroup = sceneGroup.children[sceneGroup.children.length - 1];
  const hs = spec.hotspot && byName.get(spec.hotspot);
  ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 10, 48), new THREE.MeshBasicMaterial({ color: 0xdc2626 })); ring.visible = false; sceneGroup.add(ring);
  if (hs) { ring.geometry.dispose(); ring.geometry = new THREE.TorusGeometry(Math.max(hs.w, hs.d) * 0.85 + 0.8, 0.12, 10, 48); ring.position.set(hs.x + hs.w / 2, 0.15, hs.y + hs.d / 2); ring.rotation.x = -Math.PI / 2; ring.userData.on = true; }
  hiRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 10, 48), new THREE.MeshBasicMaterial({ color: 0x06b6d4 })); hiRing.visible = false; hiRing.rotation.x = -Math.PI / 2; sceneGroup.add(hiRing);
  for (let p = 1; p <= (spec.parts || 0); p++) {
    const g = new THREE.Group(); g.userData.partNo = p; g.add(box(1.5, 0.16, 1.0, mat(0x2563eb, { roughness: 0.4 }), 0, 0, 0));
    const s = labelSprite(String(p), { px: 54, fg: '#fff', bg: 'rgba(37,99,235,0.95)', scale: 0.012 }); s.position.set(0, 0.9, 0); g.add(s);
    g.visible = false; sceneGroup.add(g); partPool[p] = g;
  }
  if (first) { const cx = W / 2, cz = H / 2; controls.target.set(cx, 0, cz); camera.position.set(cx, W * 0.52, H + W * 0.34); camera.lookAt(cx, 0, cz); controls.update(); }
}
function buildCables(gx, gz, used) {
  for (const m of machines.values()) {
    if (!used.has(m.name)) continue;
    const mx = m.x + m.w / 2, mz = m.y + m.d / 2, y = 0.07 + (m.id % 7) * 0.003;
    const pts = [V(gx, y, gz), V(mx, y, gz), V(mx, y, mz)], segs = [pts[0].distanceTo(pts[1]), pts[1].distanceTo(pts[2])], len = segs[0] + segs[1];
    if (len < 0.1) continue;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 })); sceneGroup.add(line);
    const pulses = []; for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); p.visible = false; sceneGroup.add(p); pulses.push(p); }
    cables.push({ rec: m, pts, segs, len, pulses, scaleKw: 1, line });
  }
}
function drawFlow(names) {
  flowNames = names;
  const grp = new THREE.Group(); grp.userData.flow = true;
  for (let i = 1; i < names.length; i++) {
    const a = byName.get(names[i - 1]), b = byName.get(names[i]); if (!a || !b || a === b) continue;
    const pa = V(a.x + a.w / 2, 0.14, a.y + a.d / 2), pb = V(b.x + b.w / 2, 0.14, b.y + b.d / 2);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pa, pb]), new THREE.LineDashedMaterial({ color: 0x0f766e, dashSize: 0.9, gapSize: 0.5 })); line.computeLineDistances(); grp.add(line);
    const dir = pb.clone().sub(pa).normalize(), cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 16), new THREE.MeshBasicMaterial({ color: 0x0f766e }));
    cone.position.copy(pa.clone().lerp(pb, 0.62)); cone.quaternion.setFromUnitVectors(V(0, 1, 0), dir); cone.position.y = 0.4; grp.add(cone);
  }
  sceneGroup.add(grp);
}
function setMachinePos(id, x, y) {
  const m = machines.get(id); if (!m) return;
  m.x = x; m.y = y; const cx = x + m.w / 2, cz = y + m.d / 2;
  m.group.position.set(cx, 0, cz); m.pad.position.set(cx, 0.03, cz); m.label.position.set(cx, m.height + 1.6, cz); m.tag.position.set(cx, m.height + 2.8, cz); m.tower.position.set(x + m.w + 0.9, m.tower.position.y, y + 0.9);
  if (flowGroup && flowGroup.userData.flow) { sceneGroup.remove(flowGroup); flowGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  drawFlow(flowNames); flowGroup = sceneGroup.children[sceneGroup.children.length - 1];
  const c = cables.find((q) => q.rec === m);
  if (c) { const y0 = c.pts[0].y; c.pts[1].set(cx, y0, substation.position.z); c.pts[2].set(cx, y0, cz); c.segs = [c.pts[0].distanceTo(c.pts[1]), c.pts[1].distanceTo(c.pts[2])]; c.len = c.segs[0] + c.segs[1] || 1; c.line.geometry.setFromPoints(c.pts); }
}

/* ---------- state from the simulation ---------- */
// S = TWIN_SIM.stateAt(...); o = { mode, fx, simDt, scale:{kw,kwh,co2,partCo2,partMat}, gridLabel }
function setState(S, o = {}) {
  mode = o.mode || 'state'; fx = o.fx !== false; const sc = o.scale || {};
  const forward = o.simDt > 0 && o.simDt < 0.5;
  for (const c of cables) c.scaleKw = sc.kw || 1;
  if (o.gridLabel && substation) { const l = substation.userData.label; if (l.userData.text !== o.gridLabel) { l.userData.text = o.gridLabel; redrawLabel(l, o.gridLabel, '#111827', 'rgba(255,255,255,0.9)', 56); } }
  for (const m of machines.values()) {
    const ms = S.machines[m.name]; if (!ms) continue;
    const running = ms.state === 'running';
    m.state = running ? 'running' : 'idle'; m.kw = ms.kw;
    if (ms.part !== m.partNo || running !== m.tag.visible) { m.partNo = ms.part; m.tag.visible = running; if (running) redrawLabel(m.tag, 'P' + ms.part, '#064e3b', 'rgba(209,250,229,0.95)'); }
    const col = machineColour(m, ms, sc);
    if (m.tint) m.tint.forEach((t) => { t.emissive.copy(col); t.emissiveIntensity = mode === 'state' ? (running ? 0.6 : 0) : 0.7; });
    else { m.body.color.copy(col); m.body.emissive.setHex(mode === 'state' && running ? 0x0b7a55 : 0x000000); m.body.emissiveIntensity = mode === 'state' && running ? 0.35 : 0; }
    const L = m.beacon.userData.lights; L.g.color.setHex(running ? LIGHT_ON.g : LIGHT_OFF.g); L.a.color.setHex(!running && m.used ? LIGHT_ON.a : LIGHT_OFF.a); L.r.color.setHex(m.status === 'high' && m.used ? LIGHT_ON.r : LIGHT_OFF.r);
    const showTower = (mode === 'energy' || mode === 'carbon') && m.used;
    m.tower.visible = showTower;
    if (showTower) { const v = mode === 'energy' ? ms.cumKwh / (sc.kwh || 1) : ms.cumCo2 / (sc.co2 || 1), hgt = Math.max(0.05, v * 9); m.tower.scale.y = hgt; m.tower.position.y = hgt / 2; m.tower.material.color.setHex(mode === 'energy' ? 0xf59e0b : 0x374151); m.tower.material.emissive.setHex(mode === 'energy' ? 0x7c4a00 : 0x111827); }
    if (fx && forward && m.used) {
      const dC = ms.cumCo2 - m.prevCo2;
      if (dC > 0) { m.puffAcc += dC / PUFF_KG; let n = 0; while (m.puffAcc >= 1 && n < 4) { spawnPuff(m, 1 + Math.min(1, dC * 5)); m.puffAcc -= 1; n++; } if (m.puffAcc > 8) m.puffAcc = 8; }
    }
    m.prevCo2 = ms.cumCo2;
  }
  if (ring && ring.userData.on) ring.visible = fx && (mode === 'energy' || mode === 'carbon');
  const doneIdx = {}, queue = {}, last = byName.get(spec0 && spec0.flow[spec0.flow.length - 1]);
  for (const p of S.parts) {
    const g = partPool[p.part]; if (!g) continue;
    const mesh = g.children[0]; let col = 0x2563eb;
    if (p.status === 'processing') { const m = byName.get(p.machine); g.position.set(m.x + m.w / 2, m.height + 0.55, m.y + m.d / 2); }
    else if (p.status === 'queued') { const m = byName.get(p.machine), q = queue[p.machine] = (queue[p.machine] ?? -1) + 1; g.position.set(m.x + 1 + q * 1.8, 0.12, m.y + m.d + 1.8); col = 0xf59e0b; }
    else if (p.status === 'moving') { const a = byName.get(p.from), b = byName.get(p.to), k = p.progress; g.position.set(a.x + a.w / 2 + (b.x + b.w / 2 - a.x - a.w / 2) * k, 1.4 + Math.sin(Math.PI * k) * 1.2, a.y + a.d / 2 + (b.y + b.d / 2 - a.y - a.d / 2) * k); }
    else if (p.status === 'done' && last) { const i = (doneIdx.n = (doneIdx.n ?? -1) + 1), layer = Math.floor(i / 6), j = i % 6; g.position.set(last.x + last.w + 2 + (j % 3) * 1.8, 0.1 + layer * 0.2, last.y + 0.4 + Math.floor(j / 3) * 1.3); col = 0x16a34a; }
    else { g.visible = false; continue; }
    if (mode === 'carbon' && p.carbonKg !== undefined) col = smoke((p.carbonKg - (sc.partMat || 0)) / (((sc.partCo2 || 1) - (sc.partMat || 0)) || 1)).getHex();
    mesh.material.color.setHex(col); g.visible = true;
  }
}

function float(machineName, text, color = '#111827') {
  const m = byName.get(machineName); if (!m) return;
  const s = labelSprite(text, { px: 52, fg: color, bg: 'rgba(255,255,255,0.92)', scale: 0.014 }); s.position.set(m.x + m.w / 2 + (Math.random() - 0.5) * 2, m.height + 3.6, m.y + m.d / 2);
  s.material.transparent = true; scene.add(s); floats.push({ sprite: s, life: 0 });
}
// material crates fly from the store to a machine; size follows their carbon, colour follows the material
function materialsDrop(machineName, items) {
  const m = byName.get(machineName); if (!m || !store) return; const now = performance.now() / 1000, max = Math.max(...items.map((i) => i.kgco2e), 1e-9);
  items.slice(0, 7).forEach((it, i) => {
    const s = 0.45 + 1.0 * Math.cbrt(it.kgco2e / max), mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), new THREE.MeshStandardMaterial({ color: crateColour(it.name), roughness: 0.6 }));
    mesh.castShadow = true; mesh.visible = false; scene.add(mesh);
    const from = V(store.x, 3.2, store.z), to = V(m.x + m.w / 2, m.height + 0.8, m.y + m.d / 2), ctrl = from.clone().lerp(to, 0.5); ctrl.y = Math.max(from.y, to.y) + 6;
    crates.push({ mesh, t0: now + i * 0.16, dur: 1.5, from, ctrl, to });
  });
}
function highlight(id) {
  if (!hiRing) return; const m = id === null || id === undefined ? null : machines.get(id);
  if (!m) { hiRing.visible = false; return; }
  hiRing.geometry.dispose(); hiRing.geometry = new THREE.TorusGeometry(Math.max(m.w, m.d) * 0.75 + 1.1, 0.1, 10, 48); hiRing.position.set(m.x + m.w / 2, 0.2, m.y + m.d / 2); hiRing.visible = true;
}
function partPosition(no) { const g = partPool[no]; return g && g.visible ? { x: g.position.x, z: g.position.z } : null; }
function machinePosition(id) { const m = machines.get(id); return m ? { x: m.x + m.w / 2, z: m.y + m.d / 2 } : null; }

window.TWIN3D = {
  init, setScene, setState, setMachinePos, resetView, zoom, flyTo, float, materialsDrop, highlight, partPosition, machinePosition, useModel, loadManifest,
  setLabels: (on) => { labelsOn = on; nameLabels.forEach((l) => { l.visible = on; }); },
  setCamera: (px, py, pz, tx, ty, tz) => { tween = null; follow = null; camera.position.set(px, py, pz); controls.target.set(tx, ty, tz); controls.update(); },
  modelKeys: () => [...models.keys()], credits: () => [...new Set([...models.values()].map((m) => m.opts && m.opts.credit).filter(Boolean))],
  setWalk, teleport, isWalking: () => !!(walk && walk.active), toggleFirstPerson, setKey, gesture: () => { if (avatar) avatar.gesture = 1.2; },
  walkInfo: () => (walk && walk.active ? { x: walk.x, z: walk.z, yaw: walk.yaw, near: walk.near, first: walk.first } : null), onNearby: (f) => { cb.nearby = f; },
  follow: (no) => { follow = no; }, getFollow: () => follow, getCamera: () => ({ pos: camera.position.toArray(), target: controls.target.toArray(), tween: !!tween }),
  setEditing: (v) => { editing = v; renderer.domElement.style.cursor = 'default'; },
  onPick: (f) => { cb.pick = f; }, onPickPart: (f) => { cb.pickPart = f; }, onMove: (f) => { cb.move = f; }, onHover: (f) => { cb.hover = f; }, onModels: (f) => { cb.models = f; },
};
window.dispatchEvent(new Event('twin3d-ready'));
