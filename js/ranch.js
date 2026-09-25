// The Surf Ranch: a huge wave pool in open country. A long concrete basin with a machine running on a rail along the
// deep wall (it pulls the wave along the pool, so it sits right at the breaking point), light towers, palms along the
// deck, a clubhouse and a small grandstand. The water and the wave are the same as the ocean's, clipped to the pool.
import * as THREE from 'three';

// the pool, in the same world coordinates the waves use: waves run toward +z (the shallow end) and peel toward +x
export const POOL = { x0: -90, x1: 470, z0: -45, z1: 250, deck: 1.6 };   // (the machine wall is ~37 m in front of where you wait)

export function ranch(scene) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const mats = new Map(), lam = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
  const box = (w, h, d, c, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); parent.add(m); return m; };
  const P = POOL, D = P.deck, DW = 12;
  const slab = (x0, x1, z0, z1, c, top) => box(x1 - x0, 0.6, z1 - z0, c, (x0 + x1) / 2, top - 0.3, (z0 + z1) / 2);

  // the deck: a band of pale concrete all round the pool, then lawn out to the horizon, then dry grass
  const DECK = 0xd3cec4, LAWN = 0x6f9a4c, DRY = 0xa9a06a;
  slab(P.x0 - DW, P.x1 + DW, P.z0 - DW, P.z0, DECK, D); slab(P.x0 - DW, P.x1 + DW, P.z1, P.z1 + DW, DECK, D);
  slab(P.x0 - DW, P.x0, P.z0, P.z1, DECK, D); slab(P.x1, P.x1 + DW, P.z0, P.z1, DECK, D);
  const L = 160;   // lawn ring
  slab(P.x0 - DW - L, P.x1 + DW + L, P.z0 - DW - L, P.z0 - DW, LAWN, D - 0.05); slab(P.x0 - DW - L, P.x1 + DW + L, P.z1 + DW, P.z1 + DW + L, LAWN, D - 0.05);
  slab(P.x0 - DW - L, P.x0 - DW, P.z0 - DW, P.z1 + DW, LAWN, D - 0.05); slab(P.x1 + DW, P.x1 + DW + L, P.z0 - DW, P.z1 + DW, LAWN, D - 0.05);
  { const R = 1500, a = P.x0 - DW - L, b = P.x1 + DW + L, c = P.z0 - DW - L, d = P.z1 + DW + L;   // dry country beyond
    slab(-R, R, -R, c, DRY, D - 0.1); slab(-R, R, d, R, DRY, D - 0.1); slab(-R, a, c, d, DRY, D - 0.1); slab(b, R, c, d, DRY, D - 0.1); }

  // the pool walls (inside faces show above the water) with a dark waterline band
  const WALL = 0xbfb9ae, LINE = 0x5f6b6a, H = D + 4;
  const wall = (x0, x1, z0, z1) => { box(Math.max(1, x1 - x0), H, Math.max(1, z1 - z0), WALL, (x0 + x1) / 2, D - H / 2, (z0 + z1) / 2); };
  wall(P.x0 - 1, P.x1 + 1, P.z0 - 1, P.z0); wall(P.x0 - 1, P.x1 + 1, P.z1, P.z1 + 1); wall(P.x0 - 1, P.x0, P.z0, P.z1); wall(P.x1, P.x1 + 1, P.z0, P.z1);
  box(P.x1 - P.x0, 0.35, 0.05, LINE, (P.x0 + P.x1) / 2, 0.1, P.z0 + 0.03); box(P.x1 - P.x0, 0.35, 0.05, LINE, (P.x0 + P.x1) / 2, 0.1, P.z1 - 0.03);
  box(0.05, 0.35, P.z1 - P.z0, LINE, P.x0 + 0.03, 0.1, (P.z0 + P.z1) / 2); box(0.05, 0.35, P.z1 - P.z0, LINE, P.x1 - 0.03, 0.1, (P.z0 + P.z1) / 2);

  // the wave machine: a wall of generator chambers along the deep end, right in front of you while you wait. Each
  // chamber is a tall housing with a light panel facing the pool; the lights show the machine working (they pulse
  // when you order a wave, then sweep along the wall with the breaking point as it makes the wave).
  const CH = 5, NC = Math.floor((P.x1 - P.x0) / CH), cz = P.z0 - 2.2;
  const hou = new THREE.InstancedMesh(new THREE.BoxGeometry(CH - 0.35, 7, 4.2), lam(0x3c4a57), NC);
  const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(CH - 0.2, 0.5, 4.6), lam(0xe9e6de), NC);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(CH - 1.2, 1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), NC);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < NC; i++) { const x = P.x0 + CH / 2 + i * CH;
    hou.setMatrixAt(i, mm.makeTranslation(x, D + 1.5, cz)); cap.setMatrixAt(i, mm.makeTranslation(x, D + 5.25, cz));
    lights.setMatrixAt(i, mm.makeTranslation(x, D + 3.4, P.z0 - 0.02)); lights.setColorAt(i, new THREE.Color(0x1b4d5c)); }
  g.add(hou, cap, lights);
  box(P.x1 - P.x0, 1.2, 0.3, 0x2b3640, (P.x0 + P.x1) / 2, D + 1.4, P.z0 - 0.05);   // the wall face below the lights
  // big lettering on the machine roof you can read from the pool: a painted band
  box(60, 1.6, 0.2, 0xf2b705, P.x0 + 60, D + 6.3, P.z0 - 0.1);
  // the shallow end: a sandy beach the waves run up onto, so you can see which way they're going
  { const bw = 28, geo = new THREE.PlaneGeometry(P.x1 - P.x0, bw, 40, 6); geo.rotateX(-Math.PI / 2);
    const pp = geo.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++) { const t = (pp.getZ(i) + bw / 2) / bw; pp.setY(i, -0.9 + 2.6 * t); const k = 0.92 + Math.random() * 0.1, dry = Math.min(1, t * 1.6);
      c[i * 3] = (0.62 + 0.24 * dry) * k; c[i * 3 + 1] = (0.56 + 0.24 * dry) * k; c[i * 3 + 2] = (0.44 + 0.22 * dry) * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const beach = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); beach.position.set((P.x0 + P.x1) / 2, 0, P.z1 - bw / 2); g.add(beach); }

  // light towers along both long sides
  const tower = (x, z) => { box(0.7, 24, 0.7, 0x8e959a, x, D + 12, z); box(4, 1.4, 1, 0xe9e7df, x, D + 24.5, z); };
  for (let x = P.x0 + 20; x < P.x1; x += 75) { tower(x, P.z0 - DW + 2); tower(x, P.z1 + DW - 2); }

  // palms along the far deck and round the clubhouse (instanced: one trunk and one crown shape, many copies)
  {
    const trunkG = new THREE.CylinderGeometry(0.18, 0.3, 9, 6, 4); trunkG.translate(0, 4.5, 0);
    { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.012 * y * y); } }   // a gentle lean
    const crown = []; const leaf = (a) => { const c = Math.cos(a), s = Math.sin(a); const tip = [c * 3.6, -1.1, s * 3.6], sd = [-s * 0.45, 0, c * 0.45];
      crown.push(0, 0, 0, tip[0] * 0.5 + sd[0], 0.35, tip[2] * 0.5 + sd[2], ...tip, 0, 0, 0, ...tip, tip[0] * 0.5 - sd[0], 0.35, tip[2] * 0.5 - sd[2]); };
    for (let i = 0; i < 9; i++) leaf(i / 9 * Math.PI * 2 + (i % 2) * 0.2);
    const crownG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(crown), 3)); crownG.computeVertexNormals(); crownG.translate(1.0, 9, 0);
    const spots = [];
    for (let x = P.x0 + 5; x < P.x1; x += 28) spots.push([x + (Math.random() - 0.5) * 6, P.z1 + DW + 6 + Math.random() * 8]);
    for (let x = P.x0 + 30; x < P.x1; x += 55) spots.push([x + (Math.random() - 0.5) * 8, P.z0 - DW - 10 - Math.random() * 10]);
    for (let i = 0; i < 10; i++) spots.push([P.x0 - DW - 20 - Math.random() * 60, P.z0 - DW - 60 + Math.random() * 120]);
    const trunks = new THREE.InstancedMesh(trunkG, lam(0x7a6650), spots.length);
    const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshLambertMaterial({ color: 0x3f6b2e, side: THREE.DoubleSide }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    spots.forEach(([x, z], i) => { const s = 0.85 + Math.random() * 0.4; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28); sc.setScalar(s); pos.set(x, D - 0.05, z); m.compose(pos, q, sc); trunks.setMatrixAt(i, m); crowns.setMatrixAt(i, m); });
    g.add(trunks, crowns);
  }

  // the clubhouse at the start end: long, low and white with a glass front and a deep roof, and a grandstand along the
  // deep side where people watch the waves come down the pool
  { const cx = P.x0 - 45, cz = P.z0 - 45;
    box(48, 7, 18, 0xf0eee8, cx, D + 3.5, cz); box(48.2, 3.2, 0.3, 0x2c4655, cx, D + 3.6, cz + 9.05);
    box(54, 0.7, 24, 0xe2ded5, cx, D + 7.35, cz + 1.5); box(2, 7, 2, 0xf0eee8, cx - 26, D + 3.5, cz + 12); box(2, 7, 2, 0xf0eee8, cx + 26, D + 3.5, cz + 12);
    for (let i = 0; i < 6; i++) box(90, 0.8, 2.2, 0x9aa2a8, 60, D + 0.4 + i * 0.8, P.z0 - DW - 16 - i * 2.2);   // stepped seating
    box(92, 0.4, 16, 0xf3f1ec, 60, D + 9, P.z0 - DW - 21); for (const x of [16, 104]) box(0.6, 8, 0.6, 0x8e959a, x, D + 5, P.z0 - DW - 27);   // shade canopy
  }

  // a long, low mountain range far off across the flat country, hazy blue (overlapping flattened ridges, not domes)
  { const hm = [new THREE.MeshBasicMaterial({ color: 0xa9bcc6 }), new THREE.MeshBasicMaterial({ color: 0x9db2bd }), new THREE.MeshBasicMaterial({ color: 0xb7c7cd })];
    const ridge = (cx, cz, a, len, h, k) => { const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 5, 1), hm[k % 3]); m.scale.set(len, h, len * 0.35); m.position.set(cx, D - 4 + h / 2, cz); m.rotation.y = a; g.add(m); };
    for (let i = 0; i < 26; i++) { const a = -0.9 + i * 0.075 + (Math.random() - 0.5) * 0.04, r = 1250 + Math.random() * 120;   // along the north and east horizon
      ridge(190 + Math.sin(a) * r, 90 - Math.cos(a) * r, a + Math.PI / 2, 90 + Math.random() * 110, 55 + Math.random() * 75, i); } }

  // white coping round the pool edge (reads as a pool, not a lake, from down in the water)
  const COP = 0xf4f2ec, cw = 0.6;
  box(P.x1 - P.x0 + 2 * cw, 0.25, cw, COP, (P.x0 + P.x1) / 2, D + 0.12, P.z0 - cw / 2); box(P.x1 - P.x0 + 2 * cw, 0.25, cw, COP, (P.x0 + P.x1) / 2, D + 0.12, P.z1 + cw / 2);
  box(cw, 0.25, P.z1 - P.z0, COP, P.x0 - cw / 2, D + 0.12, (P.z0 + P.z1) / 2); box(cw, 0.25, P.z1 - P.z0, COP, P.x1 + cw / 2, D + 0.12, (P.z0 + P.z1) / 2);
  return { group: g, lights, NC, CH };
}
