// npm run optimise-model -- <in.glb> <out.glb> [keepRatio=0.1]
// Makes a heavy 3D model web-friendly: merges duplicate vertices, simplifies the mesh (keeps ~10 % of the triangles by default),
// removes unused data and quantises positions/normals. Output is a plain GLB (no Draco/meshopt), so the twin's loader reads it.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [inp, out, ratioArg] = process.argv.slice(2);
if (!inp || !out) { console.error('usage: npm run optimise-model -- in.glb out.glb [keepRatio]'); process.exit(1); }
const ratio = Number(ratioArg || 0.1);
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const tris = () => doc.getRoot().listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const before = tris();
await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }), dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10 }));
await io.write(out, doc);
console.log(`triangles ${Math.round(before)} -> ${Math.round(tris())}; ${(statSync(inp).size / 1e6).toFixed(1)} MB -> ${(statSync(out).size / 1e6).toFixed(2)} MB`);
