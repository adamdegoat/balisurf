// The surf spots (four lefts and two rights). Each one is the same coast builder with its own look (see coast() in wave.js), plus a few
// landmarks of its own. Distances are in the coast's own frame: the beach is ~185-225 m in from the break, and the
// whole coast is pushed back by dz (a longer run to the sand makes a longer ride).
import * as THREE from 'three';
import { coast, landMaterial } from './wave.js?v=156';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SPOTS = {
  // beginners: a wide white-sand bay, low green points, calm turquoise over a pale reef, a village of beach huts
  easy: { name: 'Pantai Kuda', dz: 110, xEnd: 200, reefTint: [1.25, 1.2, 1.1], look: { sandWet: [0.62, 0.6, 0.52], sandDry: [0.33, 0.33, 0.3], land: [0.16, 0.27, 0.12], palms: 1, cliffH: 0.12, cliffGreen: 1, temple: false, mountain: [0.3, 0.38, 0.32], mountainScale: 0.55, jungle: 0.8 } },
  // the classic: limestone cliffs, the temple on the edge, golden sand (the original coast)
  medium: { name: 'Tanjung Uma', dz: 60, xEnd: 200, reefTint: [1, 1, 1], look: { rock: [0.7, 0.6, 0.46], arch: true } },   // (weathered honey limestone: the pale cream read as foam from the villa)
  // advanced: a black volcanic slab, basalt cliffs, black sand, a lighthouse on the point
  hard: { name: 'Batu Hitam', dz: 110, xEnd: 290, reefTint: [0.55, 0.62, 0.6], look: { sandWet: [0.1, 0.1, 0.11], sandDry: [0.1, 0.1, 0.1], land: [0.1, 0.16, 0.09], palms: 0.35, cliffH: 1.25, rock: [0.15, 0.15, 0.16], cliffGreen: 0.3, temple: false, mountain: [0.18, 0.2, 0.22], mountainScale: 1.15, jungle: 0.7 } },
  // the rights (mirror: the whole place is drawn the other way round, so the wave peels to your right). Watu Kanan:
  // red sandstone bluffs, golden sand, a green valley behind; a temple on the headland
  kanan: { name: 'Watu Kanan', mirror: true, dz: 80, xEnd: 220, reefTint: [1.05, 1.1, 1.0], look: { sandWet: [0.5, 0.4, 0.28], sandDry: [0.42, 0.33, 0.22], land: [0.13, 0.26, 0.1], palms: 0.9, cliffH: 0.75, rock: [0.64, 0.36, 0.24], cliffGreen: 1.2, temple: true, mountain: [0.24, 0.32, 0.26], mountainScale: 0.8, jungle: 1.1 } },
  // Karang Hiu: a shallow coral shelf off a low grey reef-rock shore, bright white sand, windswept palms
  hiu: { name: 'Karang Hiu', mirror: true, dz: 100, xEnd: 280, reefTint: [1.15, 1.3, 1.25], reefK: 0.45, look: { sandWet: [0.64, 0.62, 0.55], sandDry: [0.4, 0.39, 0.35], land: [0.14, 0.24, 0.12], palms: 0.7, cliffH: 0.45, rock: [0.5, 0.5, 0.47], cliffGreen: 0.6, temple: false, mountain: [0.28, 0.33, 0.33], mountainScale: 0.7, jungle: 0.6 } },
  // experts: a giant outer reef far off a towering coast, sea stacks, a storm
  extreme: { name: 'Gunung Laut', dz: 230, xEnd: 430, reefTint: [0.6, 0.65, 0.65], look: { stacks: false, boat: false,  sandWet: [0.18, 0.17, 0.16], sandDry: [0.12, 0.12, 0.11], land: [0.09, 0.14, 0.08], palms: 0.1, cliffH: 2.6, rock: [0.36, 0.35, 0.33], cliffGreen: 0.7, temple: false, mountain: [0.2, 0.23, 0.24], mountainScale: 1.6, jungle: 0.6 } },
};

const built = {};
// build a spot the first time you go there (the others stay unbuilt until you visit them)
export function spotGroup(scene, key) {
  if (built[key]) return built[key];
  const S = SPOTS[key], g = coast(scene, Object.assign({ dz: S.dz }, S.look));
  if (key === 'easy') coralBay(g);
  if (key === 'medium') villaFar(g);
  if (key === 'kanan') redHead(g);
  if (key === 'hard') lighthouseHead(g);
  if (key === 'hiu') palmPoint(g);
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

// Tanjung Uma: your villa out on the rocky point at the end of the reef, seen from the water: the limestone finger, the
// house under its tall Sumba thatch tower, and the banyan beside it. A light stand-in for the real villa (the same place
// and shape, a fraction of the detail) shown while you surf; in the villa itself the real one is drawn instead
function villaFar(g) {
  const OX = 88, OZ = 31, Y = 26, tipZ = 37, EDGE = 0.8;   // (the villa's own numbers: see villa.js)
  const cliffTop = (xl) => { const x = OX - xl; return (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35)); };
  const cx = (z) => { const k = Math.min(1, Math.max(0, (z - 70) / 150)); return -93 + 4 * Math.sin((z - 37) * 0.03) - 60 * k * k * (3 - 2 * k); };
  const hw = (z) => 13.6 + 11 * Math.min(1, Math.max(0, (z - 60) / 120));
  const top = (x, z) => { const k = Math.min(1, Math.max(0, (z - 55) / 120)), s = k * k * (3 - 2 * k); return (Y - 0.25) * (1 - s) + Math.max(3, cliffTop(x) + 1) * s; };
  const noiseW = (z, a) => { const nk = z < 58 ? 0.3 : 1; return 1 + nk * (0.14 * Math.sin(z * 0.09 + 2) + 0.08 * Math.sin(z * 0.23 + 1) + 0.05 * Math.sin(z * 0.71) + 0.07 * Math.sin(a * 5) + 0.04 * Math.sin(a * 13)); };
  const geos = [];
  const add = (geo, rgb, x, y, z, jit = 0.1) => { if (!geo.attributes.color) tint(geo, rgb, jit); if (geo.attributes.uv) geo.deleteAttribute('uv'); geo.translate(x, y, z); geos.push(geo.index ? geo.toNonIndexed() : geo); return geo; };
  // the top of the point: grass and scrub, tucked in behind the cliff wall past its edge
  { const geo = new THREE.PlaneGeometry(130, 200, 44, 64); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) - 115, z = p.getZ(i) + 105, a = Math.atan2(z - tipZ, x - cx(z)), w = hw(z) * noiseW(z, a);
      const d = Math.hypot(Math.abs(x - cx(z)) / w, Math.max(0, tipZ - z) / w), t = top(x, z); let X = x, Z = z, y = t;
      if (d > EDGE) { const kk = (EDGE - 0.04) / d, oz = z < tipZ ? tipZ : z; X = cx(z) + (x - cx(z)) * kk; Z = oz + (z - oz) * kk; y = t - 12; }
      p.setXYZ(i, X, y, Z); const col = d < 0.7 ? [0.16, 0.27, 0.11] : [0.36, 0.34, 0.24], k = 0.9 + Math.random() * 0.2; c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals(); add(geo, null, 0, 0, 0); }
  // the cliff all round it: honey limestone in ledges, darker and wet at the waterline
  { const edgeAt = (z, side) => { let x = cx(z) + side * EDGE * hw(z); for (let it = 0; it < 2; it++) { const a = Math.atan2(z - tipZ, x - cx(z)); x = cx(z) + side * EDGE * hw(z) * noiseW(z, a); } return x; };
    const pts = []; for (let z = 200; z > tipZ; z -= 3) pts.push([edgeAt(z, 1), z]);
    for (let k = 0; k <= 14; k++) { const th = -k / 14 * Math.PI, r = EDGE * hw(tipZ) * noiseW(tipZ - 1, th); pts.push([cx(tipZ) + Math.cos(th) * r, tipZ + Math.sin(th) * r]); }
    for (let z = tipZ + 3; z <= 200; z += 3) pts.push([edgeAt(z, -1), z]);
    const R = 7, n = pts.length, pos = new Float32Array(n * (R + 1) * 3), col = new Float32Array(n * (R + 1) * 3), idx = [];
    for (let i = 0; i < n; i++) { const [x, z] = pts[i], [xa, za] = pts[Math.max(0, i - 1)], [xb, zb] = pts[Math.min(n - 1, i + 1)];
      let nx = -(zb - za), nz = xb - xa; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl; const t = top(x, z);
      for (let j = 0; j <= R; j++) { const v = j / R, y = (t - 0.05) * (1 - v) - 2.5 * v, o = j === 0 ? 0 : 0.95 + 0.55 * Math.sin(y * 0.85 + i * 0.15) + 4 * Math.pow(v, 2.4);
        const q = (i * (R + 1) + j) * 3; pos[q] = x + nx * o; pos[q + 1] = y; pos[q + 2] = z + nz * o;
        const band = 0.75 + 0.25 * Math.sin(y * 1.9 + i * 0.1), wet = y < 1.2 ? 0.5 : 1, cc = v > 0.9 ? [0.4, 0.37, 0.32] : [0.58, 0.51, 0.4];
        for (let e = 0; e < 3; e++) col[q + e] = cc[e] * band * wet * (0.9 + Math.random() * 0.2); } }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < R; j++) { const a0 = i * (R + 1) + j, b0 = a0 + R + 1; idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1); }
    const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.BufferAttribute(pos, 3)); wall.setAttribute('color', new THREE.BufferAttribute(col, 3)); wall.setIndex(idx);
    const flat = wall.toNonIndexed(); flat.computeVertexNormals(); geos.push(flat); }
  // the house: timber walls with a band of glass, the wraparound balcony, and the thatch tower roof with its tall peak
  add(new THREE.BoxGeometry(17.4, 0.35, 17.4), [0.34, 0.19, 0.09], -91.3, Y - 0.17, 35.3);
  add(new THREE.BoxGeometry(14, 3.2, 14), [0.58, 0.35, 0.19], -93, Y + 1.6, 37);
  add(new THREE.BoxGeometry(14.1, 1.5, 14.1), [0.1, 0.13, 0.15], -93, Y + 1.75, 37, 0.02);
  const E = 8.4, RR = 3.3, yE = Y + 2.75, yR = Y + 4.75, yP = Y + 11.5, THATCH = [0.6, 0.48, 0.3];
  const hip = (prof, y0, y1, seg) => { const geo = new THREE.CylinderGeometry(1, 1, 1, 4, seg, false); geo.rotateY(Math.PI / 4); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) + 0.5, k = prof(t) * Math.SQRT2; p.setXYZ(i, p.getX(i) * k, y0 + (y1 - y0) * t, p.getZ(i) * k); }
    geo.computeVertexNormals(); return add(geo, THATCH, -93, 0, 37, 0.12); };
  hip((t) => E + (RR - E) * t, yE, yR, 2); hip((t) => 0.28 + (RR - 0.28) * Math.pow(1 - t, 1.7), yR - 0.05, yP, 6);
  // the banyan: a thick trunk and a wide dark canopy standing over the roof
  add(new THREE.CylinderGeometry(1.0, 1.7, 12, 8), [0.33, 0.27, 0.2], -83.5, Y + 6, 48.5, 0.2);   // (a banyan's trunk is a thick knot of roots)
  for (let k = 0; k < 13; k++) { const an = k * 2.4, r = k === 0 ? 0 : 3 + (k % 4) * 1.4, sz = 3.4 - (k % 3) * 0.4;   // a wide, low, heavy dome of leaves
    add(new THREE.IcosahedronGeometry(sz, 1).scale(1, 0.7, 1), [0.12 + (k % 3) * 0.02, 0.28 + (k % 2) * 0.03, 0.1], -83.5 + Math.cos(an) * r, Y + 12.2 + (k % 2) * 1.2 - r * 0.12, 48.5 + Math.sin(an) * r, 0.3); }
  // into the coast's frame: the villa is drawn mirrored (its sea sides face back up the reef), so flip it and turn
  // every triangle back the right way round (one mesh, the same land material as the rest of the coast)
  const merged = mergeGeometries(geos); if (!merged) return;
  merged.applyMatrix4(new THREE.Matrix4().makeTranslation(OX, 0, OZ).multiply(new THREE.Matrix4().makeScale(-1, 1, 1)));
  for (const k of ['position', 'normal', 'color']) { const a = merged.attributes[k].array; for (let i = 0; i < a.length; i += 9) for (let e = 0; e < 3; e++) { const t = a[i + 3 + e]; a[i + 3 + e] = a[i + 6 + e]; a[i + 6 + e] = t; } }
  const m = new THREE.Mesh(merged, landMaterial()); g.add(m); g.userData.farVilla = m;
}

// a headland running out from the shore at the end of the reef, down the line where you look while you ride: a long
// finger of rock with sheer layered sides and a flat green top. o: x (its spine), tipZ/baseZ (sea end, shore end), w
// (half-width at the shore), h0/h1 (height at the tip / at the shore), rock, grass
function headland(g, o) {
  const U = 64, V = 22;
  const W = (u) => o.w * (0.3 + 0.7 * Math.sqrt(Math.min(1, u / 0.25))) * (1 + 0.12 * Math.sin(u * 17 + 1) + 0.07 * Math.sin(u * 41));   // a rounded nose, the sides wandering in and out
  const H = (u) => (o.h0 + (o.h1 - o.h0) * Math.min(1, u * 1.6)) * (0.55 + 0.45 * Math.sqrt(Math.min(1, u / 0.12))) + 3.5 * Math.sin(u * 11 + 2) + 1.6 * Math.sin(u * 29);   // a ragged skyline, lower at the sea end
  const pos = [], col = [], idx = [];
  // each slice across the headland, from the sea end in: the waterline, up the left cliff in ledges, across the top,
  // down the right. The walls step in and out (strata), cut by gullies, and lean back a little toward the top
  for (let i = 0; i <= U; i++) { const u = i / U, z = o.tipZ + (o.baseZ - o.tipZ) * u, w = W(u), h = H(u);
    for (let j = 0; j <= V; j++) { const v = j / V, side = v < 0.3 ? -1 : v > 0.7 ? 1 : 0; let x, y;
      if (side) { const t = side < 0 ? v / 0.3 : (1 - v) / 0.3; y = -2 + (h + 2) * t;
        const ledge = 1.6 * Math.sin(y * 0.75 + u * 3) + 0.9 * Math.sin(y * 1.9 - u * 7) + 1.4 * Math.max(0, Math.sin(z * 0.23 + y * 0.05));   // strata and gullies
        x = side * (w * (1.25 - 0.25 * t) + ledge + 5 * Math.pow(1 - t, 3) * Math.min(1, u / 0.12)); }                                // (and a rubble apron at the foot, tucked in at the nose)
      else { const t = (v - 0.3) / 0.4; x = -w + 2 * w * t; y = h + 1.2 * Math.sin(x * 0.25 + z * 0.1) - 2.5 * Math.pow(Math.abs(t - 0.5) * 2, 3); }
      const k = 0.88 + Math.random() * 0.24;
      let c;
      if (side) { const band = 0.72 + 0.28 * Math.sin(y * 1.3 + Math.sin(z * 0.07) * 2.5), wet = y < 1.2 ? 0.5 : 1, scrub = y > h - 3 && Math.random() < 0.45;
        c = scrub ? [0.16 * k, 0.26 * k, 0.1 * k] : o.rock.map((q) => q * band * wet * k); }
      else { const bare = Math.random() < 0.18; c = (bare ? o.rock.map((q) => q * 0.85) : o.grass).map((q) => q * k); }
      pos.push(o.x + x, y, z); col.push(c[0], c[1], c[2]); } }
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) { const a0 = i * (V + 1) + j, b0 = a0 + V + 1; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1); }
  // the sea end: the rounded nose closed with rock
  const c0 = pos.length / 3; pos.push(o.x, H(0) * 0.25, o.tipZ - 3); col.push(o.rock[0] * 0.75, o.rock[1] * 0.75, o.rock[2] * 0.75);
  for (let j = 0; j < V; j++) idx.push(c0, j + 1, j, c0, j, j + 1);   // (both faces: seen from either side it's solid rock, never a see-through gap)
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  const flat = geo.toNonIndexed(); flat.computeVertexNormals();   // (faceted, like broken rock)
  const m = new THREE.Mesh(flat, landMaterial()); m.userData.prop = true; g.add(m);
  // fallen blocks along its foot, and bushes along the top
  for (let k = 0; k < 26; k++) { const u = Math.random() * 0.9, side = Math.random() < 0.5 ? -1 : 1, r = 1.5 + Math.random() * 3.5, z = o.tipZ + (o.baseZ - o.tipZ) * u;
    put(g, new THREE.DodecahedronGeometry(r, 0), o.rock.map((q) => q * 0.7), o.x + side * (W(u) * 1.25 + 4 + Math.random() * 5), r * 0.25 - 0.5, z, 0.25); }
  for (let k = 0; k < 30; k++) { const u = 0.05 + Math.random() * 0.9, t = Math.random() * 2 - 1, r = 1.8 + Math.random() * 2.2, z = o.tipZ + (o.baseZ - o.tipZ) * u;
    put(g, new THREE.IcosahedronGeometry(r, 0).scale(1.3, 0.7, 1), [0.13, 0.25, 0.09], o.x + t * W(u) * 0.95, H(u) + r * 0.3, z, 0.3); }
  return (u) => ({ y: H(u), z: o.tipZ + (o.baseZ - o.tipZ) * u });
}
// a Balinese temple: a stepped stone terrace, a split gate (candi bentar) in front, and a tall meru tower of stacked
// black thatch roofs, the one shape you can pick out from far out at sea
function temple(g, x, y, z, tiers = 7) {
  const stone = [0.5, 0.44, 0.38], thatch = [0.11, 0.09, 0.08];
  put(g, new THREE.BoxGeometry(14, 1.6, 14), stone, x, y + 0.8, z, 0.1); put(g, new THREE.BoxGeometry(9, 1.4, 9), stone, x, y + 2.3, z, 0.1);
  put(g, new THREE.BoxGeometry(3.6, 3.4, 3.6), stone, x, y + 4.7, z, 0.1);
  for (let k = 0; k < tiers; k++) { const rr = 5.2 - k * (3.6 / tiers), roof = new THREE.ConeGeometry(rr, 1.3, 4); roof.rotateY(Math.PI / 4); put(g, roof, thatch, x, y + 7 + k * 1.45, z, 0.1);
    put(g, new THREE.BoxGeometry(1.2, 0.3, 1.2), [0.3, 0.24, 0.18], x, y + 7.8 + k * 1.45, z, 0.1); }
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) put(g, new THREE.BoxGeometry(2.8 - k * 0.5, 1.9, 2.8 - k * 0.5), stone, x + s * 2.6, y + 0.95 + k * 1.9, z - 11, 0.1);
}
// Watu Kanan: a red sandstone headland at the end of the reef with a temple on its tip, lit by the late sun
function redHead(g) {
  const at = headland(g, { x: 300, tipZ: 100, baseZ: 250, w: 28, h0: 26, h1: 44, rock: [0.6, 0.25, 0.14], grass: [0.16, 0.27, 0.1] });
  const t = at(0.2); temple(g, 300, t.y - 0.5, t.z);
}

// Batu Hitam: a black basalt headland at the end of the reef, down the line, with a white lighthouse on its tip
function lighthouseHead(g) {
  const at = headland(g, { x: 345, tipZ: 105, baseZ: 255, w: 30, h0: 24, h1: 42, rock: [0.14, 0.14, 0.15], grass: [0.11, 0.18, 0.08] }), t = at(0.14), ly = t.y - 0.5, lx = 345, lz = t.z;
  for (let k = 0; k < 7; k++) put(g, new THREE.CylinderGeometry(2.3 - k * 0.14, 2.4 - k * 0.14, 3.6, 16), k % 2 ? [0.72, 0.16, 0.12] : [0.92, 0.91, 0.88], lx, ly + 1.8 + k * 3.6, lz, 0.03);
  put(g, new THREE.CylinderGeometry(1.7, 1.7, 2.4, 12), [0.12, 0.14, 0.15], lx, ly + 26.8, lz, 0.02);
  put(g, new THREE.ConeGeometry(2.1, 2.2, 12), [0.62, 0.12, 0.1], lx, ly + 29.1, lz, 0.02);
  put(g, new THREE.BoxGeometry(7, 3.2, 5), [0.9, 0.89, 0.86], lx + 7, ly + 1.6, lz + 6, 0.04);   // the keeper's cottage
}
// a coconut palm leaning out over the water: a slender curving trunk and a crown of drooping fronds
function palm(g, x, y, z, h, lean, dir) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, h, 6, 8); const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const yy = (p.getY(i) + h / 2) / h; p.setX(i, p.getX(i) + lean * h * yy * yy); }
  trunk.rotateY(dir); trunk.computeVertexNormals(); put(g, trunk, [0.4, 0.34, 0.25], x, y + h / 2, z, 0.1);
  const tx = x + Math.cos(-dir) * lean * h, tz = z + Math.sin(-dir) * lean * h, ty = y + h;
  for (let k = 0; k < 8; k++) { const f = new THREE.ConeGeometry(0.55, 4.4, 4); f.scale(1, 1, 0.25); f.translate(0, -2.2, 0); f.rotateZ(1.25 + (k % 2) * 0.3); f.rotateY(k * 0.8); put(g, f, [0.16, 0.3, 0.1], tx, ty, tz, 0.2); }
}
// Karang Hiu: a low point of grey reef rock at the end of the reef, bright sand in its lee, palms leaning out over it
function palmPoint(g) {
  const at = headland(g, { x: 335, tipZ: 110, baseZ: 250, w: 26, h0: 6, h1: 12, rock: [0.42, 0.42, 0.4], grass: [0.5, 0.47, 0.38] });
  for (let k = 0; k < 13; k++) { const u = 0.06 + k * 0.07, t = at(u), side = k % 2 ? 1 : -1; palm(g, 335 + side * (8 + (k % 3) * 5), t.y - 0.5, t.z, 15 + (k % 4) * 2.5, 0.22 + (k % 3) * 0.08, side > 0 ? Math.PI : 0); }
}

function blackRock(g) {
  // (its lighthouse stands on the headland down the line: see lighthouseHead)
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
