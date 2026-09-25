// The four surf spots. Each one is the same coast builder with its own look (see coast() in wave.js), plus a few
// landmarks of its own. Distances are in the coast's own frame: the beach is ~185-225 m in from the break, and the
// whole coast is pushed back by dz (a longer run to the sand makes a longer ride).
import * as THREE from 'three';
import { coast, landMaterial } from './wave.js?v=108';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPOTS = {
  // beginners: a wide white-sand bay, low green points, calm turquoise over a pale reef, a village of beach huts
  easy: { name: 'Pantai Kuda', dz: 110, xEnd: 200, reefTint: [1.25, 1.2, 1.1], look: { sandWet: [0.62, 0.6, 0.52], sandDry: [0.33, 0.33, 0.3], land: [0.16, 0.27, 0.12], palms: 1, cliffH: 0.12, cliffGreen: 1, temple: false, mountain: [0.3, 0.38, 0.32], mountainScale: 0.55, jungle: 0.8 } },
  // the classic: limestone cliffs, the temple on the edge, golden sand (the original coast)
  medium: { name: 'Tanjung Uma', dz: 60, xEnd: 200, reefTint: [1, 1, 1], look: { rock: [0.7, 0.6, 0.46] } },   // (weathered honey limestone: the pale cream read as foam from the villa)
  // advanced: a black volcanic slab, basalt cliffs, black sand, a lighthouse on the point
  hard: { name: 'Batu Hitam', dz: 110, xEnd: 290, reefTint: [0.55, 0.62, 0.6], look: { sandWet: [0.1, 0.1, 0.11], sandDry: [0.1, 0.1, 0.1], land: [0.1, 0.16, 0.09], palms: 0.35, cliffH: 1.25, rock: [0.15, 0.15, 0.16], cliffGreen: 0.3, temple: false, mountain: [0.18, 0.2, 0.22], mountainScale: 1.15, jungle: 0.7 } },
  // experts: a giant outer reef far off a towering coast, sea stacks, a storm
  extreme: { name: 'Gunung Laut', dz: 230, xEnd: 430, reefTint: [0.6, 0.65, 0.65], look: { sandWet: [0.18, 0.17, 0.16], sandDry: [0.12, 0.12, 0.11], land: [0.09, 0.14, 0.08], palms: 0.1, cliffH: 2.6, rock: [0.36, 0.35, 0.33], cliffGreen: 0.7, temple: false, mountain: [0.2, 0.23, 0.24], mountainScale: 1.6, jungle: 0.6 } },
};

const built = {};
// build a spot the first time you go there (the others stay unbuilt until you visit them)
export function spotGroup(scene, key) {
  if (built[key]) return built[key];
  const S = SPOTS[key], g = coast(scene, Object.assign({ dz: S.dz }, S.look));
  if (key === 'easy') coralBay(g);
  if (key === 'hard') blackRock(g);
  if (key === 'extreme') theMountain(g);
  mergeProps(g);
  return (built[key] = g);
}
export const builtSpots = () => Object.values(built);

// a spot's small landmarks (huts, posts, canoes, the lighthouse...) are many little meshes: join them into one so a
// phone draws them in a single call instead of dozens
function mergeProps(g) {
  const parts = g.children.filter((m) => m.isMesh && !m.isInstancedMesh && m.userData.prop);
  if (parts.length < 2) return;
  const geos = parts.map((m) => { m.updateMatrix(); const q = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; });
  const merged = mergeGeometries(geos); if (!merged) return;
  for (const m of parts) { g.remove(m); m.geometry.dispose(); }
  g.add(new THREE.Mesh(merged, landMaterial()));
}

// vertex-coloured helpers on the shared land material
const tint = (geo, rgb, jit = 0.08) => { const n = geo.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 1 + (Math.random() - 0.5) * jit; c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
const put = (g, geo, rgb, x, y, z, jit) => { const m = new THREE.Mesh(tint(geo, rgb, jit), landMaterial()); m.position.set(x, y, z); m.userData.prop = true; g.add(m); return m; };

function coralBay(g) {
  // the bay's two arms: low green headlands running out into the sea either side, sandy at the foot, palms on top
  const head = (x, z, rx, rz, h) => {
    const geo = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const X = pp.getX(i), Y = pp.getY(i), Z = pp.getZ(i), n = 1 + 0.12 * Math.sin(X * 7 + Z * 5) + 0.06 * Math.sin(X * 19 - Z * 13);
      pp.setXYZ(i, X * rx * n, Math.pow(Y, 0.8) * h * n, Z * rz * n);
      const k = 0.9 + Math.random() * 0.2, sandy = Y < 0.08 ? 1 : 0, rocky = Y < 0.25 && !sandy ? 1 : 0;
      const col = sandy ? [0.8, 0.76, 0.64] : rocky ? [0.42, 0.4, 0.34] : [0.14, 0.26, 0.11];
      c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, landMaterial()); m.position.set(x, -1, z); m.userData.prop = true; g.add(m);
  };
  head(-420, 120, 150, 110, 38); head(-560, 40, 120, 90, 55); head(560, 140, 160, 120, 32); head(700, 60, 130, 90, 46);

  // beach huts on short stilts under the palms: timber boxes with steep grass-thatch roofs
  const WOOD = [0.45, 0.33, 0.22], THATCH = [0.55, 0.45, 0.28];
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 17 + (Math.random() - 0.5) * 6, z = 224 + Math.random() * 5, s = 0.9 + Math.random() * 0.3;
    for (const dx of [-1.6, 1.6]) for (const dzz of [-1.4, 1.4]) put(g, new THREE.BoxGeometry(0.25, 1.4, 0.25), WOOD, x + dx * s, 2.5, z + dzz * s);
    put(g, new THREE.BoxGeometry(4 * s, 2.4 * s, 3.4 * s), WOOD, x, 3.2 + 1.2 * s, z, 0.12);
    const roof = new THREE.ConeGeometry(3.6 * s, 2.6 * s, 4); roof.rotateY(Math.PI / 4); put(g, roof, THATCH, x, 3.2 + 2.4 * s + 1.3 * s, z, 0.15);
  }
  // a timber jetty out over the shallows at the far end of the bay
  const jx = -40;
  put(g, new THREE.BoxGeometry(2.6, 0.3, 46), [0.5, 0.39, 0.27], jx, 1.6, 180, 0.1);
  for (let z = 160; z <= 202; z += 6) for (const dx of [-1.1, 1.1]) put(g, new THREE.CylinderGeometry(0.14, 0.14, 3.4, 5), [0.33, 0.25, 0.18], jx + dx, 0, z);
  // two outrigger canoes pulled up on the sand
  for (const [x, z, a] of [[60, 214, 0.2], [95, 216, -0.15]]) {
    const hull = put(g, new THREE.CylinderGeometry(0.35, 0.22, 6, 7), [0.9, 0.88, 0.82], x, 2.1, z); hull.rotation.set(0, a, Math.PI / 2); hull.scale.set(1, 1, 0.7);
    const fl = put(g, new THREE.CylinderGeometry(0.08, 0.08, 5, 5), [0.3, 0.24, 0.18], x - Math.sin(a) * 2, 1.95, z + Math.cos(a) * 2); fl.rotation.set(0, a, Math.PI / 2);
  }
}

function blackRock(g) {
  // a lighthouse on the headland above the cliffs: white tower with red bands, dark lantern room, red cap
  const cliffTop = (x) => 1.25 * (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35));
  const lx = -175, ly = cliffTop(lx) - 1, lz = 232;
  for (let k = 0; k < 6; k++) put(g, new THREE.CylinderGeometry(2.3 - k * 0.14, 2.4 - k * 0.14, 3.6, 16), k % 2 ? [0.72, 0.16, 0.12] : [0.92, 0.91, 0.88], lx, ly + 1.8 + k * 3.6, lz, 0.03);
  put(g, new THREE.CylinderGeometry(1.7, 1.7, 2.4, 12), [0.12, 0.14, 0.15], lx, ly + 23.2, lz, 0.02);
  put(g, new THREE.ConeGeometry(2.1, 2.2, 12), [0.62, 0.12, 0.1], lx, ly + 25.5, lz, 0.02);
  put(g, new THREE.BoxGeometry(7, 3.2, 5), [0.9, 0.89, 0.86], lx + 6, ly + 1.6, lz + 4, 0.04);   // keeper's cottage
  // black lava boulders strewn along the waterline and the foot of the cliffs
  const rock = new THREE.DodecahedronGeometry(1, 0); tint(rock, [0.16, 0.16, 0.17], 0.25);
  const N = 140, rocks = new THREE.InstancedMesh(rock, landMaterial(), N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) { const x = -260 + Math.random() * 640, z = 184 + Math.random() * 16, r = 0.8 + Math.random() * 2.6;
    q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); rocks.setMatrixAt(i, m.compose(p.set(x, 0.3 + r * 0.3, z), q, s.set(r * 1.3, r * 0.8, r))); }
  g.add(rocks);
}

function theMountain(g) {
  // sea stacks: towers of dark rock standing in the sea either side of the reef, capped with scrub
  const stack = (x, z, h, r) => {
    const geo = new THREE.CylinderGeometry(r * 0.75, r, h, 9, 8); const pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), a = Math.atan2(pp.getZ(i), pp.getX(i)), n = 1 + 0.18 * Math.sin(a * 3 + y * 0.08) + 0.1 * Math.sin(y * 0.3 + a * 7);
      pp.setX(i, pp.getX(i) * n); pp.setZ(i, pp.getZ(i) * n); }
    geo.computeVertexNormals(); put(g, geo, [0.2, 0.2, 0.21], x, h / 2 - 2, z, 0.3);
    const cap = new THREE.SphereGeometry(r * 0.8, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.35, 1); put(g, cap, [0.1, 0.17, 0.09], x, h - 2, z, 0.3);
  };
  stack(-330, -120, 95, 22); stack(-290, -40, 60, 14); stack(-380, 40, 130, 30); stack(680, -60, 110, 26); stack(620, 60, 70, 16);   // (beyond the end of the reef, clear of the waves)
}
