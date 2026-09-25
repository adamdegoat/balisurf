// Your villa: a small luxury Indonesian surf villa on the clifftop at Tanjung Uma, beside the temple, looking down on the
// break. A stone terrace on the cliff with a timber viewing deck and glass balustrade over the edge, an infinity pool
// along the cliff, an open-sided living bale under a steep thatched roof, a surf room with your boards in a rack, and a
// frangipani garden inside a low stone wall with a split gate. Built in the coast's own frame (same as coast() in
// wave.js), so it sits on the Tanjung Uma cliff once the group is moved back by that spot's dz.
import * as THREE from 'three';
import { makeBoard } from './board.js?v=8';

export const VILLA = { x0: -146, x1: -110, z0: 228, z1: 262, Y: 55 };   // the terrace (coast frame) and its floor height

export function villa(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  // (lit like real materials, close up: the land material's distance haze washed everything out at arm's length)
  const V = VILLA, Y = V.Y, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const tint = (geo, rgb, jit = 0.06) => { const n = geo.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 1 + (Math.random() - 0.5) * jit; c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
  const box = (w, h, d, rgb, x, y, z, jit) => { const m = new THREE.Mesh(tint(new THREE.BoxGeometry(w, h, d), rgb, jit), mat); m.position.set(x, y, z); g.add(m); return m; };
  const cyl = (r0, r1, h, rgb, x, y, z, seg = 8) => { const m = new THREE.Mesh(tint(new THREE.CylinderGeometry(r0, r1, h, seg), rgb), mat); m.position.set(x, y, z); g.add(m); return m; };
  // a steep hipped alang-alang thatch roof: thick (a darker fascia edge under the outer layer), shaded in horizontal
  // bands like layered grass bundles, with a woven bamboo underside you see from inside
  const thatch = (w, d, h, x, y, z) => {
    const mk = (sc, dy, col, band) => { const geo = new THREE.ConeGeometry(1, 1, 4, 10, true); geo.rotateY(Math.PI / 4); geo.scale(w * sc, h * sc, d * sc);
      const p = geo.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const yy = p.getY(i), b = band ? 0.82 + 0.18 * (Math.floor((yy + h) * 3.2) % 2) : 1, k = b * (0.9 + Math.random() * 0.2);
        c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k; p.setX(i, p.getX(i) * (1 + (Math.random() - 0.5) * 0.02)); }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals(); return geo; };
    const outer = new THREE.Mesh(mk(1, 0, THATCH, true), mat); outer.position.set(x, y, z); g.add(outer);
    const edge = new THREE.Mesh(mk(1.01, 0, THATCH_D, false), mat); edge.position.set(x, y - 0.28, z); g.add(edge);   // the thick cut edge of the thatch
    const under = new THREE.Mesh(mk(0.97, 0, [0.62, 0.5, 0.33], true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.BackSide })); under.position.set(x, y - 0.12, z); g.add(under);
    cyl(0.12, 0.2, 0.9, THATCH_D, x, y + h / 2 + 0.35, z, 6);   // the crown knot at the peak
  };
  // tropical planting: big glossy leaves (elephant ears, philodendron) fanned out from a clump, in a few greens
  const LEAVES = [[0.1, 0.32, 0.09], [0.14, 0.38, 0.1], [0.08, 0.25, 0.08], [0.2, 0.4, 0.12]];
  const leafGeo = (() => { const geo = new THREE.SphereGeometry(1, 8, 4); geo.scale(0.45, 0.06, 1); geo.translate(0, 0, 0.9); return geo; })();
  const plant = (x, z, s = 1, n = 9) => {
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + Math.random() * 0.4, tilt = 0.5 + Math.random() * 0.5;
      const m = new THREE.Mesh(tint(leafGeo.clone(), LEAVES[k % 4], 0.2), mat); m.position.set(x, Y + (0.4 + Math.random() * 0.5) * s, z);
      m.rotation.set(0, a, 0); m.rotateX(-tilt); m.scale.setScalar(s * (0.7 + Math.random() * 0.5)); g.add(m); }
  };
  const bougain = (x, y, z, len) => {   // bougainvillea spilling over a wall: magenta and green clumps
    for (let k = 0; k < len * 2; k++) { const m = new THREE.Mesh(tint(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.25, 0), k % 3 ? [0.78, 0.16, 0.45] : LEAVES[k % 4], 0.25), mat);
      m.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.3) * 0.6, z + k * 0.5); g.add(m); }
  };
  const colliders = [];   // rectangles you can't walk through: [x0, x1, z0, z1]
  const block = (x0, x1, z0, z1) => colliders.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);

  // colours
  const STONE = [0.64, 0.58, 0.5], STONE_D = [0.46, 0.41, 0.35], TEAK = [0.42, 0.28, 0.17], TEAK_L = [0.55, 0.39, 0.25], TERRAZZO = [0.86, 0.83, 0.77],
    THATCH = [0.5, 0.39, 0.22], THATCH_D = [0.36, 0.27, 0.15], LINEN = [0.93, 0.91, 0.86], RENDER = [0.9, 0.87, 0.8], LAWN = [0.24, 0.42, 0.16], LEAF = [0.12, 0.3, 0.1];

  // the terrace: a stone plinth down to the clifftop (the ground falls away toward the edge), a terrazzo floor, lawn
  const cx = (V.x0 + V.x1) / 2, cz = (V.z0 + V.z1) / 2, W = V.x1 - V.x0, D = V.z1 - V.z0;
  // (the plinth and floor are laid round the pool's hole, not over it)
  const PX0 = -144, PX1 = -127.5, PZ0 = V.z0 + 1, PZ1 = 234;
  const slab = (x0, x1, z0, z1, top, h, rgb, jit) => box(x1 - x0, h, z1 - z0, rgb, (x0 + x1) / 2, top - h / 2, (z0 + z1) / 2, jit);
  for (const [x0, x1, z0, z1] of [[V.x0, V.x1, PZ1, V.z1], [V.x0, PX0, V.z0, PZ1], [PX1, V.x1, V.z0, PZ1], [PX0, PX1, V.z0, PZ0]]) { slab(x0, x1, z0, z1, Y - 0.05, 14, STONE_D, 0.1); slab(x0, x1, z0, z1, Y, 0.1, TERRAZZO, 0.03); }
  slab(PX0, PX1, PZ0, PZ1, Y - 1.25, 13, STONE_D, 0.1);   // under the pool
  box(W - 2, 0.12, 12, LAWN, cx, Y - 0.02, V.z1 - 7, 0.2);               // back lawn
  box(10, 0.12, 8, LAWN, V.x0 + 6, Y - 0.02, 241, 0.2);                  // side garden

  // the viewing deck at the front-right corner, over the cliff edge: teak planks, glass balustrade on steel posts
  const dx0 = -126, dx1 = -110, dz0 = V.z0 - 3, dz1 = 234;                  // (cantilevered 3 m past the terrace)
  for (let z = dz0 + 0.1; z < dz1; z += 0.18) box(dx1 - dx0, 0.08, 0.16, (Math.round(z * 5.5) % 2) ? TEAK : TEAK_L, (dx0 + dx1) / 2, Y + 0.02, z, 0.05);
  box(dx1 - dx0, 0.6, dz1 - dz0, TEAK, (dx0 + dx1) / 2, Y - 0.35, (dz0 + dz1) / 2);   // (the deck's frame)
  for (const k of [0.2, 0.5, 0.8]) box(0.3, 8, 0.3, STONE_D, dx0 + (dx1 - dx0) * k, Y - 4.3, dz0 + 0.4);   // posts down into the cliff
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const rail = (x0, x1, z0, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.BoxGeometry(len, 1.05, 0.03), glass);
    m.position.set((x0 + x1) / 2, Y + 0.55, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(m);
    box(len, 0.05, 0.08, [0.75, 0.76, 0.78], (x0 + x1) / 2, Y + 1.1, (z0 + z1) / 2).rotation.y = -Math.atan2(z1 - z0, x1 - x0); };
  rail(dx0, dx1, dz0, dz0); rail(dx1, dx1, dz0, dz1); rail(dx0, dx0, dz0, V.z0);
  // two daybeds with white cushions and a big canvas umbrella, a low teak side table
  for (const x of [-122, -117]) { box(2.1, 0.35, 1.0, TEAK, x, Y + 0.18, dz0 + 2.3); box(2.0, 0.18, 0.95, LINEN, x, Y + 0.44, dz0 + 2.3); box(0.5, 0.25, 0.9, LINEN, x - 0.8, Y + 0.62, dz0 + 2.3); block(x - 1.1, x + 1.1, dz0 + 1.75, dz0 + 2.85); }
  cyl(0.05, 0.05, 2.6, [0.4, 0.3, 0.2], -119.5, Y + 1.3, dz0 + 3.5); { const u = new THREE.Mesh(tint(new THREE.ConeGeometry(1.8, 0.7, 8), [0.93, 0.9, 0.82]), mat); u.position.set(-119.5, Y + 2.7, dz0 + 3.5); g.add(u); }
  box(0.6, 0.4, 0.6, TEAK_L, -119.5, Y + 0.2, dz0 + 1.6);

  // the infinity pool along the cliff edge, to the left of the deck: stone rim, pale mosaic inside, water brimming over
  const px0 = PX0, px1 = PX1, pz0 = PZ0, pz1 = PZ1;
  box(px1 - px0 + 0.8, 0.12, 0.4, STONE, (px0 + px1) / 2, Y + 0.06, pz1 + 0.2); box(0.4, 0.12, pz1 - pz0, STONE, px0 - 0.2, Y + 0.06, (pz0 + pz1) / 2); box(0.4, 0.12, pz1 - pz0, STONE, px1 + 0.2, Y + 0.06, (pz0 + pz1) / 2);
  box(px1 - px0, 0.1, pz1 - pz0, [0.35, 0.7, 0.76], (px0 + px1) / 2, Y - 1.2, (pz0 + pz1) / 2);   // pool floor
  for (const [w, d, x, z] of [[px1 - px0, 0.1, (px0 + px1) / 2, pz1], [px1 - px0, 0.1, (px0 + px1) / 2, pz0], [0.1, pz1 - pz0, px0, (pz0 + pz1) / 2], [0.1, pz1 - pz0, px1, (pz0 + pz1) / 2]]) box(w, 1.15, d, [0.4, 0.72, 0.78], x, Y - 0.62, z, 0.08);   // mosaic walls
  const water = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, pz1 - pz0), new THREE.MeshStandardMaterial({ color: 0x1fb6c8, emissive: 0x0b5f6e, emissiveIntensity: 0.55, transparent: true, opacity: 0.9, roughness: 0.18, metalness: 0 }));
  water.rotation.x = -Math.PI / 2; water.position.set((px0 + px1) / 2, Y - 0.08, (pz0 + pz1) / 2); g.add(water);
  block(px0 - 0.1, px1 + 0.1, pz0 - 3, pz1 + 0.05);

  // the living bale: a raised teak platform, six posts, a steep hipped thatch roof; low sofas round a coffee table
  const bx = -133, bz = 243, bw = 12, bd = 9, bh = 0.45;
  box(bw, bh, bd, TEAK, bx, Y + bh / 2, bz, 0.05);
  box(3, 0.22, 0.8, TEAK_L, bx, Y + 0.11, bz - bd / 2 - 0.4);   // step
  for (const [ox, oz] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) { const px = bx + ox * (bw / 2 - 0.4), pz = bz + oz * (bd / 2 - 0.4); cyl(0.15, 0.17, 3.4, TEAK, px, Y + bh + 1.7, pz); block(px - 0.2, px + 0.2, pz - 0.2, pz + 0.2); }
  thatch(bw * 0.8, bd * 0.82, 4.4, bx, Y + bh + 3.4 + 2.0, bz);
  // sofas: an L of low teak frames with linen cushions and a few coloured pillows; a rug and a coffee table
  const sy = Y + bh;
  box(6, 0.4, 1.0, TEAK, bx - 1, sy + 0.2, bz + 3.2); box(5.9, 0.25, 0.95, LINEN, bx - 1, sy + 0.52, bz + 3.2); box(5.9, 0.55, 0.25, LINEN, bx - 1, sy + 0.72, bz + 3.6); block(bx - 4, bx + 2, bz + 2.6, bz + 3.8);
  box(1.0, 0.4, 3.4, TEAK, bx - 4.5, sy + 0.2, bz + 1.2); box(0.95, 0.25, 3.3, LINEN, bx - 4.5, sy + 0.52, bz + 1.2); block(bx - 5, bx - 4, bz - 0.5, bz + 3);
  for (const [x, z, c] of [[bx - 3, bz + 3.3, [0.78, 0.45, 0.25]], [bx + 0.5, bz + 3.3, [0.2, 0.45, 0.45]], [bx - 4.4, bz, [0.82, 0.7, 0.35]]]) box(0.5, 0.45, 0.2, c, x, sy + 0.8, z);
  box(4.5, 0.02, 3.2, [0.72, 0.64, 0.5], bx - 1.5, sy + 0.01, bz + 1.2, 0.15);   // woven rug
  box(1.8, 0.35, 1.0, TEAK_L, bx - 1.5, sy + 0.18, bz + 1.2); block(bx - 2.4, bx - 0.6, bz + 0.7, bz + 1.7);
  box(0.9, 0.08, 0.5, [0.25, 0.35, 0.3], bx - 1.3, sy + 0.4, bz + 1.1);   // a surf book on the table

  // the surf room: a whitewashed room open to the garden, a teak rack along the back wall with your four boards
  const rx0 = -119, rx1 = -111, rz0 = 245, rz1 = 257, rh = 3.4;
  box(0.3, rh, rz1 - rz0, RENDER, rx1, Y + rh / 2, (rz0 + rz1) / 2); block(rx1 - 0.2, rx1 + 0.3, rz0, rz1);          // back wall (east)
  box(rx1 - rx0, rh, 0.3, RENDER, (rx0 + rx1) / 2, Y + rh / 2, rz1); block(rx0, rx1, rz1 - 0.2, rz1 + 0.3);          // north wall
  box(rx1 - rx0, rh, 0.3, RENDER, (rx0 + rx1) / 2, Y + rh / 2, rz0); block(rx0, rx1, rz0 - 0.3, rz0 + 0.2);          // south wall
  box(rx1 - rx0 + 1.2, 0.35, rz1 - rz0 + 1.2, TEAK, (rx0 + rx1) / 2, Y + rh + 0.18, (rz0 + rz1) / 2);               // flat teak roof
  thatch((rx1 - rx0) * 0.85, (rz1 - rz0) * 0.78, 2.8, (rx0 + rx1) / 2, Y + rh + 1.7, (rz0 + rz1) / 2);
  box(rx1 - rx0, 0.06, rz1 - rz0, TERRAZZO, (rx0 + rx1) / 2, Y + 0.08, (rz0 + rz1) / 2, 0.03);   // the room's floor (over the lawn)
  box(0.2, 0.12, rz1 - rz0 - 1.2, TEAK_L, rx1 - 0.3, Y + 0.3, (rz0 + rz1) / 2); box(0.2, 0.12, rz1 - rz0 - 1.2, TEAK_L, rx1 - 0.3, Y + 2.2, (rz0 + rz1) / 2);   // the rack rails
  const rack = [];
  ['short', 'fish', 'long', 'gun'].forEach((type, i) => {
    const b = makeBoard(type); b.rotation.set(-Math.PI / 2 + 0.12, 0, Math.PI / 2);   // standing on its tail (fins down), deck toward the room, leaning on the wall
    const L = b.userData.length; b.position.set(rx1 - 0.55, Y + L / 2 + 0.05, rz0 + 1.8 + i * 2.7);
    b.userData.type = type; b.traverse((o) => { o.userData.type = type; }); g.add(b); rack.push(b);
  });
  block(rx1 - 1.1, rx1, rz0 + 0.6, rz1 - 0.6);
  // a wax bench and a hanging lamp
  box(1.6, 0.45, 0.5, TEAK_L, rx0 + 1.4, Y + 0.23, rz1 - 0.7); block(rx0 + 0.5, rx0 + 2.3, rz1 - 1, rz1 - 0.4);

  // garden: frangipani trees (grey forked trunks, clusters of leaves with white-and-yellow flowers), two coconut palms,
  // stepping stones, a low stone wall and a split gate (candi bentar) at the back
  const tree = (x, z, s) => {
    cyl(0.12 * s, 0.18 * s, 1.6 * s, [0.5, 0.48, 0.44], x, Y + 0.8 * s, z);
    for (let k = 0; k < 4; k++) { const a = k * 1.6 + x, r = 0.9 * s, lx = x + Math.cos(a) * r, lz = z + Math.sin(a) * r;
      const br = cyl(0.07 * s, 0.1 * s, 1.4 * s, [0.5, 0.48, 0.44], (x + lx) / 2, Y + 1.9 * s, (z + lz) / 2); br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      const leaf = new THREE.Mesh(tint(new THREE.IcosahedronGeometry(0.7 * s, 0), LEAF, 0.3), mat); leaf.position.set(lx, Y + 2.5 * s, lz); leaf.scale.set(1, 0.55, 1); g.add(leaf);
      for (let f = 0; f < 5; f++) { const fl = new THREE.Mesh(tint(new THREE.SphereGeometry(0.09 * s, 5, 3), f % 3 ? [0.98, 0.97, 0.92] : [0.98, 0.85, 0.45]), mat);
        fl.position.set(lx + (Math.random() - 0.5) * 0.9 * s, Y + 2.75 * s + Math.random() * 0.15, lz + (Math.random() - 0.5) * 0.9 * s); g.add(fl); } }
    block(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  };
  tree(-141, 239, 1.1); tree(-124, 257, 1.0); tree(-143, 257, 1.15); tree(-121, 238.5, 0.8);
  const palm = (x, z, h) => { const t = cyl(0.14, 0.22, h, [0.42, 0.36, 0.28], x, Y + h / 2, z, 6); t.rotation.z = 0.08;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, f = new THREE.Mesh(tint(new THREE.ConeGeometry(0.35, 3.2, 3), LEAF, 0.2), mat); f.position.set(x + Math.cos(a) * 1.3 + 0.3, Y + h - 0.2, z + Math.sin(a) * 1.3); f.rotation.set(Math.sin(a) * 1.6, 0, -Math.cos(a) * 1.6); g.add(f); }
    block(x - 0.3, x + 0.3, z - 0.3, z + 0.3); };
  palm(-145, 249, 9); palm(-112, 240, 10.5);
  for (let k = 0; k < 7; k++) box(0.9, 0.06, 0.6, STONE, -128 + Math.sin(k) * 0.4, Y + 0.04, 250 + k * 1.6, 0.05);   // path to the gate
  // the wall: waist-high volcanic stone round the back and sides (the front is the cliff), a split gate at the back
  const WALLC = [0.34, 0.31, 0.28];
  box(0.5, 1.2, D, WALLC, V.x0 + 0.25, Y + 0.6, cz); block(V.x0, V.x0 + 0.5, V.z0, V.z1);
  box(0.5, 1.2, D - 12, WALLC, V.x1 - 0.25, Y + 0.6, cz - 6 + 12); block(V.x1 - 0.5, V.x1, V.z0 + 6, V.z1);   // (open on the deck side)
  box(W / 2 - 2, 1.2, 0.5, WALLC, V.x0 + (W / 2 - 2) / 2, Y + 0.6, V.z1 - 0.25); box(W / 2 - 2, 1.2, 0.5, WALLC, V.x1 - (W / 2 - 2) / 2, Y + 0.6, V.z1 - 0.25); block(V.x0, V.x1, V.z1 - 0.5, V.z1);
  for (const gs of [-1, 1]) for (let k = 0; k < 4; k++) box(1.6 - k * 0.3, 1.2, 1.2 - k * 0.2, STONE, cx + gs * 1.9, Y + 0.6 + k * 1.2, V.z1 - 0.3);
  // lanterns on posts along the path (warm glow, they light up when the sun goes down)
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd28a });
  for (const [x, z] of [[-130, 251], [-126, 255], [-130, 259], [-137, 236], [-127, 236]]) { cyl(0.04, 0.04, 1.0, [0.2, 0.18, 0.16], x, Y + 0.5, z, 5); const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), glow); l.position.set(x, Y + 1.12, z); g.add(l); }

  block(V.x0, dx0 - 0.05, dz0 - 1, V.z0);   // (left of the deck the terrace ends at the cliff)
  // three white sun loungers along the pool, a stack of rolled towels
  for (let k = 0; k < 3; k++) { const x = -141 + k * 3.2, z = 236.4; box(0.8, 0.28, 2.0, TEAK, x, Y + 0.14, z); box(0.75, 0.12, 1.4, LINEN, x, Y + 0.34, z + 0.3); const back = box(0.75, 0.1, 0.7, LINEN, x, Y + 0.55, z - 0.62); back.rotation.x = 0.7; block(x - 0.45, x + 0.45, z - 1.05, z + 1.05); }
  for (let k = 0; k < 3; k++) cyl(0.12, 0.12, 0.5, [0.95, 0.94, 0.9], -131.2, Y + 0.12 + k * 0.001, 236 + k * 0.26, 8).rotation.z = Math.PI / 2;
  // stone coping round the terrace edge and a band of carved stone under it (the villa seen from the sea)
  box(W + 0.4, 0.2, 0.5, STONE, cx, Y + 0.05, V.z0 - 0.1); box(W + 0.4, 0.5, 0.2, [0.55, 0.49, 0.42], cx, Y - 0.6, V.z0 - 0.3);
  // lush planting: along the walls, in the corners, round the bale, and bougainvillea over the side walls
  for (const [x, z, sc] of [[-144.5, 244, 1.3], [-144.5, 247.5, 1.1], [-144.5, 253, 1.4], [-144, 259.5, 1.2], [-139, 260.5, 1.1], [-134, 260.8, 0.9], [-121, 260.5, 1.2],
    [-116.5, 260.5, 1.0], [-112, 236.5, 1.0], [-125.5, 237, 0.8], [-126, 248, 1.0], [-140.5, 248.5, 0.9], [-113, 243, 1.1]]) { plant(x, z, sc); block(x - 0.5 * sc, x + 0.5 * sc, z - 0.5 * sc, z + 0.5 * sc); }
  bougain(V.x0 + 0.2, Y + 1.25, 238, 10); bougain(V.x0 + 0.2, Y + 1.25, 252, 8); bougain(V.x1 - 0.2, Y + 1.25, 241, 4);
  // a big terracotta pot with a young palm by the bale steps, and lanterns hanging in the bale
  cyl(0.45, 0.32, 0.8, [0.62, 0.36, 0.24], -129, Y + 0.4, 238.2, 10); plant(-129, 238.2, 0.8, 7); block(-129.5, -128.5, 237.7, 238.7);
  for (const lx of [-136, -130]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); l.position.set(lx, Y + 2.9, 243); g.add(l); cyl(0.01, 0.01, 1.2, [0.2, 0.2, 0.2], lx, Y + 3.6, 243, 4); }

  // where you can walk: the terrace (and out onto the deck), minus everything solid
  const walk = { x0: V.x0 + 0.6, x1: V.x1 - 0.4, z0: dz0 + 0.35, z1: V.z1 - 0.8 };
  const floorAt = (x, z) => (x > bx - bw / 2 && x < bx + bw / 2 && z > bz - bd / 2 && z < bz + bd / 2) ? Y + bh : Y;   // up on the bale's platform
  return { group: g, rack, colliders, walk, floorAt, spawn: { x: -128, z: 259, yaw: -Math.PI / 2 }, deck: { x: -118, z: dz0 + 1 } };
}
