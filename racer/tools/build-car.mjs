// Prepares assets/game3d/car_f8.glb from the "2020 Ferrari F8 Tributo" Sketchfab export
// (https://sketchfab.com/3d-models/2020-ferrari-f8-tributo-5e7daeb70ea04b43b517db885f564d76, CC-BY 4.0).
//   node tools/build-car.mjs <source.glb> assets/game3d/car_f8.glb
// Needs: @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf meshoptimizer sharp
//
// What it does (shape, UVs and materials are kept):
//   * bakes the 544 loose meshes into a few named parts, one mesh per material:
//       body      exterior (paint, carbon, lights, glass, engine, grilles, badges, callipers)
//       wheel0-3  one node per wheel, pivot on the axle, so the game can spin them
//       interior  full cabin, used by the driver's-seat (FPP) camera
//       interiorLo  the same cabin at ~30% of the triangles, used when seen from outside
//       steer     the whole steering wheel (rim, carbon, grips, buttons, badge), pivot on its hub, z = column axis
//   * metres, nose towards -z, wheels on y = 0, centred on x/z
//   * original plate and badge artwork, near-lossless WebP textures, Draco geometry
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, draco, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [, , SRC, OUT] = process.argv;
if (!SRC || !OUT) { console.error('usage: node tools/build-car.mjs <source.glb> <out.glb>'); process.exit(1); }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(SRC);
await MeshoptSimplifier.ready;
const root = doc.getRoot(), scene = root.listScenes()[0];

// ---- 1. collect every primitive in world space ----
const tris = []; // { group, mat, pos, nrm, uv, idx }
const hasAncestor = (n, re) => { for (let p = n; p; p = p.getParentNode && p.getParentNode()) if (re.test(p.getName() || '')) return true; return false; };
const visit = (node) => {
  const mesh = node.getMesh();
  if (mesh) {
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), U = prim.getAttribute('TEXCOORD_0'), I = prim.getIndices();
      const n = P.getCount(), pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), v = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        P.getElement(i, v); const [x, y, z] = v;
        pos[i * 3] = M[0] * x + M[4] * y + M[8] * z + M[12]; pos[i * 3 + 1] = M[1] * x + M[5] * y + M[9] * z + M[13]; pos[i * 3 + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
        if (N) { N.getElement(i, v); const [a, b, c] = v; let nx = M[0] * a + M[4] * b + M[8] * c, ny = M[1] * a + M[5] * b + M[9] * c, nz = M[2] * a + M[6] * b + M[10] * c; const l = Math.hypot(nx, ny, nz) || 1; nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l; }
        if (U) { U.getElement(i, v); uv[i * 2] = v[0]; uv[i * 2 + 1] = v[1]; }
      }
      const idx = I ? Uint32Array.from(I.getArray()) : Uint32Array.from({ length: n }, (_, i) => i);
      const group = hasAncestor(node, /^Wheel1A_3D/) ? 'wheel' : (hasAncestor(node, /^interior:/) ? 'interior' : 'body');
      tris.push({ group, mat: prim.getMaterial(), pos, nrm, uv, idx });
    }
  }
  node.listChildren().forEach(visit);
};
scene.listChildren().forEach(visit);

// ---- 2. metres, nose to -z, on the ground, centred ----
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const t of tris) for (let i = 0; i < t.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], t.pos[i + k]); mx[k] = Math.max(mx[k], t.pos[i + k]); }
const K = 100, cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2; // source units are 1/100 m; its nose points to +z
for (const t of tris) for (let i = 0; i < t.pos.length; i += 3) {
  t.pos[i] = -(t.pos[i] - cx) * K; t.pos[i + 1] = (t.pos[i + 1] - mn[1]) * K; t.pos[i + 2] = -(t.pos[i + 2] - cz) * K;
  t.nrm[i] = -t.nrm[i]; t.nrm[i + 2] = -t.nrm[i + 2];
}
const bbox = (pos, idx) => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; const each = (i) => { for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], pos[i * 3 + k]); b[k] = Math.max(b[k], pos[i * 3 + k]); } }; if (idx) idx.forEach(each); else for (let i = 0; i < pos.length / 3; i++) each(i); return [a, b]; };

// ---- 3. wheels: one group per corner ----
for (const t of tris) if (t.group === 'wheel') { const [a, b] = bbox(t.pos); t.group = 'wheel' + ((a[0] + b[0] > 0 ? 1 : 0) + (a[2] + b[2] > 0 ? 2 : 0)); }

// ---- 4. steering wheel: every connected piece that belongs to the wheel, whatever mesh it came from ----
// The rim sits in the cabin mesh, but its carbon sections, grips, buttons, shift lights and the badge on the
// hub are spread over the exterior meshes. All of them go into one `steer` part so the whole wheel turns together.
// Box in final car coordinates (metres); the model is left-hand drive.
const STEER_BOX = { min: [-0.54, 0.59, -0.50], max: [-0.14, 0.89, -0.28] };
let STEER_HUB = [-0.34, 0.74, -0.39], STEER_TILT = 0.4; // both are measured from the rim below
const splitBy = (t, test) => { // test(positions, vertex ids of one connected piece) -> belongs to the wheel?
  const n = t.pos.length / 3, key = new Map(), canon = new Uint32Array(n);
  for (let i = 0; i < n; i++) { const k = Math.round(t.pos[i * 3] * 2000) + ',' + Math.round(t.pos[i * 3 + 1] * 2000) + ',' + Math.round(t.pos[i * 3 + 2] * 2000); if (!key.has(k)) key.set(k, i); canon[i] = key.get(k); }
  const par = Uint32Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let i = 0; i < t.idx.length; i += 3) { const a = find(canon[t.idx[i]]), b = find(canon[t.idx[i + 1]]), c = find(canon[t.idx[i + 2]]); par[b] = a; par[c] = a; }
  const comp = new Map();
  for (let i = 0; i < t.idx.length; i += 3) { const r = find(canon[t.idx[i]]); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(i); }
  const inIdx = [], outIdx = [];
  for (const list of comp.values()) {
    const ids = []; for (const i of list) ids.push(t.idx[i], t.idx[i + 1], t.idx[i + 2]);
    (test(t.pos, ids) ? inIdx : outIdx).push(...ids);
  }
  return [Uint32Array.from(inIdx), Uint32Array.from(outIdx)];
};
const inBox = (pos, ids) => { const [a, b] = bbox(pos, ids); return [0, 1, 2].every((k) => a[k] >= STEER_BOX.min[k] && b[k] <= STEER_BOX.max[k]); };
// a short cylinder around the hub, along the column: the rim, spokes, paddles and hub pad, but not the dash behind
const inWheel = (pos, ids) => {
  const c = Math.cos(-STEER_TILT), s = Math.sin(-STEER_TILT);
  for (const v of ids) {
    const x = pos[v * 3] - STEER_HUB[0], y0 = pos[v * 3 + 1] - STEER_HUB[1], z0 = pos[v * 3 + 2] - STEER_HUB[2], y = y0 * c - z0 * s, z = y0 * s + z0 * c;
    if (Math.hypot(x, y) > 0.21 || z < -0.11 || z > 0.17) return false;
  }
  return true;
};
const compact = (t, idx, group) => { // keep only the vertices an index list uses
  const map = new Map(), pos = [], nrm = [], uv = [], out = new Uint32Array(idx.length);
  idx.forEach((v, i) => { let m = map.get(v); if (m === undefined) { m = map.size; map.set(v, m); pos.push(t.pos[v * 3], t.pos[v * 3 + 1], t.pos[v * 3 + 2]); nrm.push(t.nrm[v * 3], t.nrm[v * 3 + 1], t.nrm[v * 3 + 2]); uv.push(t.uv[v * 2], t.uv[v * 2 + 1]); } out[i] = m; });
  return { group, mat: t.mat, pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), uv: Float32Array.from(uv), idx: out };
};
const parts = [];
{ // measure the wheel from its rim (cabin mesh): hub = centre of the rim, tilt = lean of the rim plane
  const cabin = tris.find((t) => t.group === 'interior'), [sIdx] = splitBy(cabin, inBox), st = compact(cabin, sIdx, 'steer');
  const [a, b] = bbox(st.pos); STEER_HUB = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  let syy = 0, szz = 0, syz = 0; const n = st.pos.length / 3;
  for (let i = 0; i < n; i++) { const y = st.pos[i * 3 + 1] - STEER_HUB[1], z = st.pos[i * 3 + 2] - STEER_HUB[2]; syy += y * y; szz += z * z; syz += y * z; }
  STEER_TILT = -0.5 * Math.atan2(2 * syz, syy - szz); // angle of the rim's long axis from +y towards +z
  console.log('steering wheel hub', STEER_HUB.map((v) => v.toFixed(3)).join(','), 'tilt', STEER_TILT.toFixed(3));
}
for (const t of tris) {
  if (/^wheel/.test(t.group)) { parts.push(t); continue; }
  const [sIdx, restIdx] = splitBy(t, t.group === 'interior' ? (p, ids) => inBox(p, ids) || inWheel(p, ids) : inWheel);
  if (sIdx.length) parts.push(compact(t, sIdx, 'steer'));
  if (!restIdx.length) continue;
  const rest = compact(t, restIdx, t.group); parts.push(rest);
  if (t.group !== 'interior') continue;
  // low-detail copy of the cabin for the outside views
  const [lo] = MeshoptSimplifier.simplify(rest.idx, rest.pos, 3, Math.floor(rest.idx.length * 0.5 / 3) * 3, 0.02);
  parts.push(compact(rest, lo, 'interiorLo'));
}

// ---- 5. merge per (group, material) and write a clean document ----
const buckets = new Map();
for (const t of parts) { const k = t.group + '|' + t.mat.getName(); if (!buckets.has(k)) buckets.set(k, { group: t.group, mat: t.mat, list: [] }); buckets.get(k).list.push(t); }
const groups = {};
const buffer = root.listBuffers()[0];
for (const b of buckets.values()) {
  let nv = 0, ni = 0; for (const t of b.list) { nv += t.pos.length / 3; ni += t.idx.length; }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  let vo = 0, io2 = 0;
  for (const t of b.list) { pos.set(t.pos, vo * 3); nrm.set(t.nrm, vo * 3); uv.set(t.uv, vo * 2); for (let i = 0; i < t.idx.length; i++) idx[io2 + i] = t.idx[i] + vo; vo += t.pos.length / 3; io2 += t.idx.length; }
  (groups[b.group] = groups[b.group] || []).push({ mat: b.mat, pos, nrm, uv, idx });
}
for (const n of scene.listChildren()) scene.removeChild(n);
const stats = {};
for (const name of Object.keys(groups).sort()) {
  const all = groups[name];
  // pivot: axle centre for wheels, hub for the steering wheel
  let pivot = [0, 0, 0];
  if (/^wheel/.test(name)) { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const g of all) { const [p, q] = bbox(g.pos); for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], p[k]); b[k] = Math.max(b[k], q[k]); } } pivot = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
  if (name === 'steer') pivot = STEER_HUB;
  const mesh = doc.createMesh(name);
  for (const g of all) {
    for (let i = 0; i < g.pos.length; i += 3) { g.pos[i] -= pivot[0]; g.pos[i + 1] -= pivot[1]; g.pos[i + 2] -= pivot[2]; }
    if (name === 'steer') { // un-tilt, so the node's local z is the column axis
      const c = Math.cos(-STEER_TILT), s = Math.sin(-STEER_TILT);
      for (const arr of [g.pos, g.nrm]) for (let i = 0; i < arr.length; i += 3) { const y = arr[i + 1], z = arr[i + 2]; arr[i + 1] = y * c - z * s; arr[i + 2] = y * s + z * c; }
    }
    const prim = doc.createPrimitive().setMaterial(g.mat)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.nrm).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(g.uv).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.idx).setBuffer(buffer));
    mesh.addPrimitive(prim);
    stats[name] = (stats[name] || 0) + g.idx.length / 3;
  }
  const node = doc.createNode(name).setMesh(mesh).setTranslation(pivot);
  if (name === 'steer') node.setRotation([Math.sin(STEER_TILT / 2), 0, 0, Math.cos(STEER_TILT / 2)]);
  scene.addChild(node);
}

// ---- 6. tidy up, compress (the manufacturer plate and badges keep their original artwork) ----
for (const m of root.listMaterials()) m.setName(m.getName().replace('Ferrari_F8TributoRewardRecycled_2020', '').replace(/_Material$/, '').replace(/^_Wheel1A_3D_3DWheel1A$/, 'Wheel'));
await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 97 }), draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }));
await io.write(OUT, doc);
console.log('car parts (triangles):', JSON.stringify(stats));
