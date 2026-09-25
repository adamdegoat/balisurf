// Your villa: a small wooden cliff house out on the rocky point at the far end of the Tanjung Uma reef, looking back up
// the line at the waves as they come: from down the line you see into the barrels, not the back of the lip. Inside it's all warm timber: plank walls,
// wide floorboards, a pitched boarded ceiling on dark beams. A living room with glass on the two sea sides opens onto
// a wraparound balcony; through a doorway, the board room, with your four boards standing in a rack on the wall.
// Built in the coast's own frame (same as coast() in wave.js), so it sits right once the group is moved back by the
// spot's dz. The waves break at x 0 (coast z about -60) and peel off toward +x, toward the point. A banyan beside the
// house carries a spiral stair up to a deck in its canopy, the highest seat on the point.
import * as THREE from 'three';
import { makeBoard } from './board.js?v=10';
import { landMaterial } from './wave.js?v=95';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const VILLA = { x0: -100, x1: -86, z0: 30, z1: 44, Y: 26 };   // the house and its floor height (in the point's own frame, below)
// where the point is: the whole house and point are drawn around (-93, 37) and moved by this much, which puts the
// balcony about 75 m from the takeoff and 50-100 m from the rides, as close as it can be without the broken wave's
// whitewater (up to ~60 m behind the peak) ever reaching the rock
const OX = 88, OZ = 31;

export function villa(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const g = new THREE.Group(); g.position.set(OX, 0, OZ); g.scale.x = -1; root.add(g);   // (mirrored: the house's sea sides face back up the reef, west)
  const V = VILLA, Y = V.Y;
  // (lit like real materials, close up: the land material's distance haze washes things out at arm's length)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  const tint = (geo, rgb, jit = 0.06) => { const n = geo.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 1 + (Math.random() - 0.5) * jit; c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
  const box = (w, h, d, rgb, x, y, z, jit) => { const m = new THREE.Mesh(tint(new THREE.BoxGeometry(w, h, d), rgb, jit), mat); m.position.set(x, y, z); g.add(m); return m; };
  const cyl = (r0, r1, h, rgb, x, y, z, seg = 10) => { const m = new THREE.Mesh(tint(new THREE.CylinderGeometry(r0, r1, h, seg), rgb), mat); m.position.set(x, y, z); g.add(m); return m; };
  const colliders = [];   // rectangles you can't walk through: [x0, x1, z0, z1]
  const block = (x0, x1, z0, z1) => colliders.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);

  // warm honey planks, darker posts and beams, linen, rattan
  const PLANK = [0.62, 0.43, 0.26], PLANK_L = [0.7, 0.5, 0.31], PLANK_D = [0.46, 0.3, 0.17], POST = [0.3, 0.19, 0.11], FLOOR = [0.5, 0.33, 0.19], FLOOR_L = [0.57, 0.38, 0.22],
    LINEN = [0.92, 0.89, 0.83], RATTAN = [0.72, 0.56, 0.34], TEAL = [0.2, 0.44, 0.44], LEAF = [0.13, 0.33, 0.1];
  const H = 3.2, RIDGE = 5.4, xm = (V.x0 + V.x1) / 2, zm = (V.z0 + V.z1) / 2;
  const xL = -95;                                  // the wall between the board room (west) and the living room (east)
  const B = { x0: V.x0, x1: V.x1 + 3.4, z0: V.z0 - 3.4, z1: V.z1 };   // the balcony wraps the two sea sides (south and east)
  const LZ = 46.6;                                                   // ...and runs on past the house to the tree
  const TX = -83.5, TZ = 48.5, R0 = 1.05, R1 = 2.1, RD = 3.6, DH = 8, TURN = 3 * Math.PI, A0 = -Math.PI / 2;   // the banyan: trunk, stair ring, deck radius and height, stair turns and start angle

  // ---- the rocky point: a long finger of limestone running out from the cliffs, scrub on top, sheer sides into the sea
  {
    const cliffTop = (xl) => { const x = OX - xl; return (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35)); };   // (the coast's own cliff height, before its fade)
    const cx = (z) => { const k = Math.min(1, Math.max(0, (z - 70) / 150)); return -93 + 4 * Math.sin((z - 37) * 0.03) - 60 * k * k * (3 - 2 * k); }, hw = (z) => 13.5 + 12 * Math.min(1, Math.max(0, (z - 60) / 120)), tipZ = 37;   // (the ridge curves back west into the cliffs)
    const top = (x, z) => { const k = Math.min(1, Math.max(0, (z - 55) / 120)), s = k * k * (3 - 2 * k), far = cliffTop(x) + 1;
      return (Y - 0.25) * (1 - s) + Math.max(3, far) * s + (z > 55 ? Math.sin(x * 0.3) * Math.cos(z * 0.2) * 0.6 : 0); };
    const geo = new THREE.PlaneGeometry(130, 200, 130, 160); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - 115, z = p.getZ(i) + 105, a = Math.atan2(z - tipZ, x - cx(z));
      const w = hw(z) * (1 + 0.14 * Math.sin(z * 0.09 + 2) + 0.08 * Math.sin(z * 0.23 + 1) + 0.05 * Math.sin(z * 0.71) + 0.07 * Math.sin(a * 5) + 0.04 * Math.sin(a * 13)), dx = Math.abs(x - cx(z)) / w, dz = Math.max(0, tipZ - z) / w;
      const d = Math.hypot(dx, dz), t = top(x, z);
      let y, col, X = x, Z = z;
      if (d < 0.78) { y = t; col = d < 0.7 ? [0.16, 0.27, 0.11] : [0.4, 0.37, 0.28]; }
      else { const f = Math.min(1, (d - 0.78) / 0.22); y = t - (t + 1.5) * Math.pow(f, 0.6);
        // a rugged face: rock strata stepping in and out with height, buttresses and gullies along it
        const out = 1.4 * Math.sin(y * 0.55 + z * 0.13) + 0.7 * Math.sin(y * 1.6 - z * 0.4 + x * 0.3) + 1.1 * Math.sin(z * 0.37 + a * 3) * (y / Math.max(t, 1));
        const nx = x - cx(z), nz = Math.min(0, z - tipZ), nl = Math.hypot(nx, nz) || 1; const fo = Math.min(1, f * 4) * Math.min(1, Math.max(0, (y + 0.5) / 3)); X = x + nx / nl * out * fo; Z = z + nz / nl * out * fo;   // (settling to a clean waterline)
        const band = 0.8 + 0.2 * Math.sin(y * 2.1 + Math.sin(z * 0.2)), streak = 0.88 + 0.12 * Math.sin(x * 1.7 + z * 0.9), wet = y < 1.5 ? 0.45 : 1, moss = Math.sin(y * 0.55 + z * 0.13) > 0.8 && y > 4 ? 1 : 0;
        const k2 = band * streak * wet; col = moss ? [0.22 * k2, 0.3 * k2, 0.15 * k2] : [0.76 * k2, 0.69 * k2, 0.55 * k2]; }
      if (d > 1) y = -1.5;
      p.setXYZ(i, X, y, Z); const k = 0.9 + Math.random() * 0.2; c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, landMaterial()));
    // boulders at the foot, where the sea breaks on the rock
    for (let k = 0; k < 16; k++) { const z = 22 + k * 7 + Math.random() * 4, side = k % 2 ? 1 : -1, r = 1.2 + Math.random() * 2;
      const rock = new THREE.Mesh(tint(new THREE.DodecahedronGeometry(r, 0), [0.42, 0.39, 0.33], 0.2), landMaterial()); rock.position.set(cx(z) + side * hw(z) * 1.02, 0, z); rock.rotation.set(k, k * 2, 0); g.add(rock); }
  }

  // ---- the house: stone footing, floorboards, plank walls between dark posts
  box(V.x1 - V.x0 + 0.4, 1.2, V.z1 - V.z0 + 0.4, [0.45, 0.42, 0.37], xm, Y - 0.7, zm, 0.12);
  for (let x = V.x0 + 0.15; x < V.x1; x += 0.3) box(0.29, 0.1, V.z1 - V.z0, (Math.round(x * 3.33) % 2) ? FLOOR : FLOOR_L, x, Y - 0.05, zm, 0.04);
  const planksX = (x, z0, z1, y0 = 0, y1 = H) => { for (let y = y0 + 0.1; y < y1; y += 0.22) box(0.12, 0.235, z1 - z0, (Math.round(y * 4.5) % 3) ? PLANK : PLANK_L, x, Y + y, (z0 + z1) / 2, 0.05); if (y0 < 1) block(x - 0.12, x + 0.12, z0, z1); };
  const planksZ = (z, x0, x1, y0 = 0, y1 = H) => { for (let y = y0 + 0.1; y < y1; y += 0.22) box(x1 - x0, 0.235, 0.12, (Math.round(y * 4.5) % 3) ? PLANK : PLANK_L, (x0 + x1) / 2, Y + y, z, 0.05); if (y0 < 1) block(x0, x1, z - 0.12, z + 0.12); };
  planksX(V.x0, V.z0, V.z1);                                     // west wall (the board rack)
  planksZ(V.z1, V.x0, V.x1);                                     // back wall, to the land
  planksX(xL, V.z0, 35.4); planksX(xL, 37.6, V.z1); planksX(xL, 35.4, 37.6, 2.3, H);   // board room | living room, a doorway between
  planksZ(V.z0, V.x0, xL, 0, 0.9); planksZ(V.z0, V.x0, xL, 2.5, H);                    // board room's window to the sea
  planksZ(V.z0, xL, V.x1, 2.6, H); planksX(V.x1, V.z0, V.z1, 2.6, H);                  // over the glass
  for (const [x, z] of [[V.x0, V.z0], [V.x1, V.z0], [V.x0, V.z1], [V.x1, V.z1], [xL, V.z0], [xL, V.z1]]) box(0.26, H + 0.2, 0.26, POST, x, Y + (H + 0.2) / 2, z);
  // glass: tall sliding doors on both sea sides, slid open in the middle; the board room window
  const glass = new THREE.MeshStandardMaterial({ color: 0xd9ecf0, transparent: true, opacity: 0.14, roughness: 0.05, depthWrite: false });
  const pane = (w, h, x, y, z, alongZ) => { const m = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.03 : w, h, alongZ ? w : 0.03), glass); m.position.set(x, y, z); g.add(m);
    const bx = (ww, hh, xx, yy, zz) => box(alongZ ? 0.07 : ww, hh, alongZ ? ww : 0.07, POST, xx, yy, zz);
    bx(w, 0.07, x, y + h / 2, z); bx(w, 0.07, x, y - h / 2, z);
    if (alongZ) { bx(0.07, h, x, y, z - w / 2); bx(0.07, h, x, y, z + w / 2); } else { bx(0.07, h, x - w / 2, y, z); bx(0.07, h, x + w / 2, y, z); } };
  const GH = 2.5;
  pane(2.2, GH, -93.8, Y + GH / 2, V.z0 + 0.06); pane(2.2, GH, -92.7, Y + GH / 2, V.z0 - 0.06); block(xL, -91.6, V.z0 - 0.15, V.z0 + 0.15);   // south: two panes stacked open at the west end...
  pane(3.7, GH, -87.85, Y + GH / 2, V.z0); block(-89.7, V.x1, V.z0 - 0.15, V.z0 + 0.15);                                                   // ...a fixed one at the east end
  pane(3.4, GH, V.x1, Y + GH / 2, 32.2, true); pane(3.4, GH, V.x1 + 0.1, Y + GH / 2, 42.2, true); block(V.x1 - 0.15, V.x1 + 0.15, V.z0, 33.9); block(V.x1 - 0.15, V.x1 + 0.15, 40.5, V.z1);   // east: open in the middle
  pane((xL - V.x0) / 2, 1.6, V.x0 + (xL - V.x0) * 0.25, Y + 1.7, V.z0); pane((xL - V.x0) / 2, 1.6, V.x0 + (xL - V.x0) * 0.75, Y + 1.7, V.z0);
  box(xL - V.x0, 0.08, 0.35, PLANK_D, (V.x0 + xL) / 2, Y + 0.93, V.z0 + 0.12);   // window sill

  // the roof: a Sumba tower roof (uma mbatangu) in alang-alang thatch: a wide, low hipped skirt over the walls and the
  // edge of the balcony, and a tall, steep, slightly concave peak rising out of the middle, with two carved wooden
  // horns on top. Inside there's no ceiling: you look straight up into the woven underside of the peak
  const THATCH = [0.6, 0.48, 0.3], THATCH_D = [0.34, 0.26, 0.16], WEAVE = [0.7, 0.56, 0.36];
  const underMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.BackSide, emissive: 0x4a3018, emissiveIntensity: 0.55 });   // (lit warm from the lamps below)
  const hip = (prof, y0, y1, seg, rgb, m, band, dy = 0) => {   // a four-sided roof shell whose half-width at height fraction t is prof(t)
    const geo = new THREE.CylinderGeometry(1, 1, 1, 4, seg, true); geo.rotateY(Math.PI / 4);
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) + 0.5, k = prof(t) * Math.SQRT2, y = y0 + (y1 - y0) * t;
      p.setXYZ(i, p.getX(i) * k, y + dy, p.getZ(i) * k);
      const bb = band ? 0.84 + 0.16 * (Math.round(y * 3.2) % 2) : 1, j = bb * (0.92 + Math.random() * 0.16); c[i * 3] = rgb[0] * j; c[i * 3 + 1] = rgb[1] * j; c[i * 3 + 2] = rgb[2] * j; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(xm, 0, zm); g.add(mesh); return mesh; };
  const E = 8.4, R = 3.3, yE = Y + 2.75, yR = Y + 4.75, yP = Y + 11.5;   // eave half-width, where the peak rises, heights
  const skirt = (t) => E + (R - E) * t, peak = (t) => 0.28 + (R - 0.28) * Math.pow(1 - t, 1.7);
  hip(skirt, yE, yR, 8, THATCH, mat, true); hip(peak, yR - 0.05, yP, 20, THATCH, mat, true);
  hip((t) => skirt(t) * 0.985, yE, yR, 4, WEAVE, underMat, true, -0.14); hip((t) => peak(t) * 0.97, yR - 0.05, yP, 14, WEAVE, underMat, true, -0.14);   // the woven underside
  hip((t) => E + 0.05 - 0.45 * t, yE - 0.3, yE, 1, THATCH_D, mat, false);   // the thick cut edge of the thatch at the eaves
  // timber structure you see inside: a ring beam where the peak rises, hip rafters up the four corners, tie beams
  for (const [x0, z0, x1, z1] of [[-R, -R, R, -R], [-R, R, R, R], [-R, -R, -R, R], [R, -R, R, R]]) box(Math.abs(x1 - x0) + 0.3, 0.26, Math.abs(z1 - z0) + 0.3, POST, xm + (x0 + x1) / 2, yR - 0.35, zm + (z0 + z1) / 2);
  const beam = (x0, y0, z0, x1, y1, z1, r) => { const m = new THREE.Mesh(tint(new THREE.CylinderGeometry(r, r, 1, 6), POST), mat); const a = new THREE.Vector3(x0, y0, z0), b2 = new THREE.Vector3(x1, y1, z1), d = b2.clone().sub(a);
    m.position.copy(a).add(b2).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); m.scale.set(1, d.length(), 1); g.add(m); };
  for (const [sx2, sz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { beam(xm + sx2 * (V.x1 - V.x0) / 2, Y + H, zm + sz2 * (V.z1 - V.z0) / 2, xm + sx2 * R, yR - 0.35, zm + sz2 * R, 0.1);
    beam(xm + sx2 * (R - 0.2), yR - 0.3, zm + sz2 * (R - 0.2), xm, yP - 0.6, zm, 0.09); }
  for (let x = V.x0 + 2.3; x < V.x1 - 1; x += 3.5) box(0.2, 0.24, V.z1 - V.z0, POST, x, Y + H + 0.02, zm);   // tie beams
  // bamboo rings lashed round the inside of the peak and the skirt, every 60 cm: the woven cone reads from below
  for (let t = 0.06; t < 0.93; t += 0.075) { const a = peak(t) * 0.955, y = yR - 0.05 + (yP - yR) * t - 0.16;
    for (const [dx, dz, w, d] of [[0, -a, 2 * a, 0.05], [0, a, 2 * a, 0.05], [-a, 0, 0.05, 2 * a], [a, 0, 0.05, 2 * a]]) box(w, 0.05, d, [0.78, 0.66, 0.42], xm + dx, y, zm + dz, 0.1); }
  box(0.7, 0.35, 0.7, THATCH_D, xm, yP + 0.05, zm);   // the ridge cap, and its two horns
  for (const sd of [-1, 1]) beam(xm, yP + 0.1, zm, xm + sd * 0.9, yP + 1.5, zm, 0.06);

  // ---- the living room: a linen sofa facing the sea, a rattan armchair, a teak coffee table on a woven rug, a
  // daybed, a shelf of books and shells, surf prints, plants, rattan pendant lamps
  const sx = -90.2, sz = 41.8;
  box(4.6, 0.42, 1.0, PLANK_D, sx, Y + 0.21, sz); box(4.5, 0.22, 0.92, LINEN, sx, Y + 0.52, sz); box(4.5, 0.6, 0.25, LINEN, sx, Y + 0.72, sz + 0.4);
  for (const [x, cc] of [[-91.9, [0.78, 0.46, 0.26]], [-90.3, TEAL], [-88.6, [0.86, 0.74, 0.44]]]) box(0.55, 0.45, 0.18, cc, x, Y + 0.8, sz + 0.2);
  block(sx - 2.35, sx + 2.35, sz - 0.55, V.z1);
  box(3.4, 0.02, 2.4, [0.74, 0.64, 0.48], sx, Y + 0.01, sz - 2.3, 0.2);
  box(1.8, 0.1, 0.9, PLANK_D, sx, Y + 0.42, sz - 2.2); for (const [ox, oz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) box(0.08, 0.38, 0.08, POST, sx + ox, Y + 0.19, sz - 2.2 + oz);
  block(sx - 0.95, sx + 0.95, sz - 2.7, sz - 1.7);
  box(0.9, 0.06, 0.5, [0.2, 0.36, 0.34], sx + 0.3, Y + 0.5, sz - 2.2); cyl(0.12, 0.16, 0.2, [0.9, 0.86, 0.78], sx - 0.5, Y + 0.57, sz - 2.2);
  const ax = -93.6, az = 38.6; cyl(0.45, 0.4, 0.42, RATTAN, ax, Y + 0.21, az, 14); cyl(0.42, 0.42, 0.12, LINEN, ax, Y + 0.48, az, 14);
  { const back = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 14, 1, true, 0, Math.PI * 1.1), RATTAN), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
    back.position.set(ax, Y + 0.8, az); back.rotation.y = Math.PI * 1.25; g.add(back); }
  block(ax - 0.55, ax + 0.55, az - 0.55, az + 0.55);
  box(2.2, 0.35, 1.0, PLANK_D, -92.8, Y + 0.18, 31.1); box(2.1, 0.2, 0.95, LINEN, -92.8, Y + 0.45, 31.1); box(0.35, 0.35, 0.9, TEAL, -93.7, Y + 0.65, 31.1); block(-93.95, -91.65, V.z0, 31.7);   // daybed under the south glass
  box(0.35, 0.06, 2.6, PLANK_D, xL + 0.25, Y + 1.5, 41.5); box(0.35, 0.06, 2.6, PLANK_D, xL + 0.25, Y + 2.1, 41.5);   // shelf by the doorway
  for (let k = 0; k < 9; k++) box(0.22, 0.3 + (k % 3) * 0.05, 0.08, [[0.55, 0.2, 0.15], [0.2, 0.3, 0.45], [0.85, 0.75, 0.55]][k % 3], xL + 0.3, Y + 1.7, 40.4 + k * 0.11);
  cyl(0.02, 0.14, 0.3, [0.95, 0.85, 0.78], xL + 0.3, Y + 2.3, 42.3, 8);
  const PRINT = [[0.13, 0.48, 0.58], [0.93, 0.62, 0.33], [0.17, 0.35, 0.52]];
  for (let k = 0; k < 3; k++) { const x = -92.1 + k * 1.9; box(1.2, 0.85, 0.05, POST, x, Y + 1.95, V.z1 - 0.1); box(1.05, 0.7, 0.06, PRINT[k], x, Y + 1.95, V.z1 - 0.12, 0.25); box(1.05, 0.12, 0.065, [0.95, 0.95, 0.92], x, Y + 1.76, V.z1 - 0.12); }
  const leafGeo = (() => { const geo = new THREE.SphereGeometry(1, 8, 4); geo.scale(0.35, 0.05, 0.6); geo.translate(0, 0, 0.55); return geo; })();
  const plant = (x, z, s) => { cyl(0.28 * s, 0.2 * s, 0.5 * s, [0.66, 0.38, 0.25], x, Y + 0.25 * s, z);
    for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(tint(leafGeo.clone(), LEAF, 0.3), mat); m.position.set(x, Y + (0.6 + k * 0.1) * s, z); m.rotation.set(0, k * 2.4, 0); m.rotateX(-0.6 - (k % 3) * 0.2); m.scale.setScalar(s); g.add(m); }
    block(x - 0.35 * s, x + 0.35 * s, z - 0.35 * s, z + 0.35 * s); };
  plant(-86.7, 43.3, 1.2); plant(-96, 43.2, 1.0); plant(-94.4, 30.9, 0.9);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a4 }), shadeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  for (const [x, z] of [[-91.5, 39], [-88.8, 39], [-97.5, 37]]) {
    const shade = new THREE.Mesh(tint(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), RATTAN), shadeMat); shade.position.set(x, Y + 2.7, z); shade.rotation.x = Math.PI; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow); bulb.position.set(x, Y + 2.62, z); g.add(bulb);
    cyl(0.01, 0.01, 2, [0.15, 0.15, 0.15], x, Y + 3.7, z, 4);
    const L = new THREE.PointLight(0xffc98f, 5, 8, 1.6); L.position.set(x, Y + 2.5, z); g.add(L);
  }

  // a rattan egg chair hanging from the ring beam by the corner glass, and a cluster of pendants under the peak
  { const ex = -88.1, ez = 32.3, egg = new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72); egg.scale(1, 1.25, 1);
    const e = new THREE.Mesh(tint(egg, RATTAN, 0.2), shadeMat); e.position.set(ex, Y + 1.25, ez); e.rotation.set(-Math.PI / 2 - 0.25, 0, 0.6); g.add(e);   // (open side toward the sea)
    cyl(0.5, 0.5, 0.14, LINEN, ex, Y + 0.78, ez, 14); box(0.35, 0.3, 0.12, TEAL, ex - 0.15, Y + 1.0, ez + 0.28);
    cyl(0.012, 0.012, yR - 0.35 - (Y + 1.9), [0.2, 0.2, 0.2], ex, (yR - 0.35 + Y + 1.9) / 2, ez, 4); block(ex - 0.65, ex + 0.65, ez - 0.65, ez + 0.65); }
  for (let k = 0; k < 7; k++) { const an = k * 0.9, r = k ? 0.55 : 0, x = xm + Math.cos(an) * r, z = zm + Math.sin(an) * r, y = Y + 3.4 + (k % 3) * 0.45;
    const sh2 = new THREE.Mesh(tint(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), RATTAN), shadeMat); sh2.position.set(x, y, z); sh2.rotation.x = Math.PI; g.add(sh2);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow); bl.position.set(x, y - 0.06, z); g.add(bl); cyl(0.008, 0.008, yP - 1 - y, [0.15, 0.15, 0.15], x, (yP - 1 + y) / 2, z, 4); }
  { const PL = new THREE.PointLight(0xffc98f, 6, 12, 1.4); PL.position.set(xm, Y + 3.3, zm); g.add(PL); }

  // ---- the board room: whitewashed wall with a teak rack and your four boards, a wax bench, a wetsuit on a hook
  for (let y = 0.1; y < H; y += 0.22) box(0.04, 0.235, V.z1 - V.z0 - 0.3, [0.9, 0.87, 0.8], V.x0 + 0.08, Y + y, zm, 0.03);
  box(0.2, 0.1, 11, PLANK_D, V.x0 + 0.2, Y + 0.3, 37); box(0.2, 0.1, 11, PLANK_D, V.x0 + 0.2, Y + 2.2, 37);
  const holder = new THREE.Group(); holder.position.set(V.x0, Y, 37); holder.rotation.y = Math.PI; g.add(holder);   // (mirrored: boards stand against the west wall, decks to the room)
  const rack = [];
  ['short', 'fish', 'long', 'gun'].forEach((type, i) => {
    const b = makeBoard(type); b.rotation.set(-Math.PI / 2 + 0.12, 0, Math.PI / 2);
    b.position.set(-0.55, b.userData.length / 2 + 0.05, -3.9 + i * 2.6);
    b.userData.type = type; b.traverse((o) => { o.userData.type = type; }); holder.add(b); rack.push(b);
  });
  block(V.x0, V.x0 + 1.05, 32.5, 41.5);
  box(1.6, 0.45, 0.5, PLANK_L, -97.5, Y + 0.23, V.z1 - 0.45); block(-98.4, -96.6, V.z1 - 0.75, V.z1);
  cyl(0.04, 0.04, 0.15, POST, -96.4, Y + 2.3, V.z1 - 0.12, 6); box(0.55, 1.3, 0.1, [0.1, 0.1, 0.12], -96.4, Y + 1.6, V.z1 - 0.2);

  // ---- the balcony: a teak deck wrapping the two sea sides, a slatted rail, two loungers and a bench to watch from
  const deck = (x0, x1, z0, z1) => { for (let x = x0 + 0.15; x < x1; x += 0.3) box(0.29, 0.1, z1 - z0, (Math.round(x * 3.33) % 2) ? FLOOR : FLOOR_L, x, Y - 0.05, (z0 + z1) / 2, 0.04);
    box(x1 - x0, 0.35, z1 - z0, PLANK_D, (x0 + x1) / 2, Y - 0.28, (z0 + z1) / 2); };
  deck(B.x0, B.x1, B.z0, V.z0); deck(V.x1, B.x1, V.z0, B.z1);
  for (const [x, z] of [[B.x0 + 0.3, B.z0 + 0.3], [-93, B.z0 + 0.3], [-86, B.z0 + 0.3], [B.x1 - 0.3, B.z0 + 0.3], [B.x1 - 0.3, 37], [B.x1 - 0.3, B.z1 - 0.3]]) box(0.22, 5, 0.22, POST, x, Y - 2.8, z);   // stilts down onto the rock
  const railZ = (z, x0, x1) => { box(x1 - x0, 0.09, 0.16, POST, (x0 + x1) / 2, Y + 1.05, z); for (let x = x0; x <= x1 + 0.01; x += 0.22) box(0.045, 1.0, 0.045, PLANK_D, x, Y + 0.5, z); };
  const railX = (x, z0, z1) => { box(0.16, 0.09, z1 - z0, POST, x, Y + 1.05, (z0 + z1) / 2); for (let z = z0; z <= z1 + 0.01; z += 0.22) box(0.045, 1.0, 0.045, PLANK_D, x, Y + 0.5, z); };
  railZ(B.z0, B.x0, B.x1); railX(B.x1, B.z0, LZ); railX(B.x0, B.z0, V.z0); railX(V.x1, V.z1, LZ); railZ(LZ, V.x1, TX - 0.9);   // (open at the north end: the stair up the tree)
  deck(V.x1, B.x1, V.z1, LZ);
  for (const z of [34.4, 39.6]) { box(1.6, 0.3, 0.8, PLANK_D, -84.8, Y + 0.15, z); box(1.1, 0.12, 0.75, LINEN, -84.6, Y + 0.36, z); const bk = box(0.65, 0.1, 0.75, LINEN, -85.4, Y + 0.58, z); bk.rotation.z = -0.7; block(-85.6, -84.0, z - 0.45, z + 0.45); }   // loungers facing the waves
  box(0.5, 0.4, 0.5, PLANK_L, -85.2, Y + 0.2, 37); block(-85.5, -84.9, 36.7, 37.3);
  box(3, 0.45, 0.45, PLANK_L, -97, Y + 0.23, B.z0 + 0.5); block(-98.5, -95.5, B.z0, B.z0 + 0.8);   // bench along the south rail


  // ---- the banyan: a huge old tree at the end of the balcony, a spiral stair of teak treads around its trunk, and a
  // round deck up in its canopy, above the roof, strung with lanterns: the highest seat on the point
  {
    const BARK = [0.36, 0.3, 0.24], LEAVES = [[0.14, 0.3, 0.1], [0.18, 0.36, 0.12], [0.11, 0.25, 0.09], [0.22, 0.38, 0.14]];
    const trunk = new THREE.CylinderGeometry(0.55, 0.9, 14.5, 14, 12); const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i), y = tp.getY(i), an = Math.atan2(z, x), k = 1 + 0.1 * Math.sin(an * 5 + y * 0.4) + 0.05 * Math.sin(an * 11 - y);   // (fluted, gnarled)
      tp.setXYZ(i, x * k, y, z * k); }
    const tm = new THREE.Mesh(tint(trunk, BARK, 0.25), mat); tm.position.set(TX, Y + 7, TZ); g.add(tm);
    for (let k = 0; k < 6; k++) { const an = k * 1.05 + 0.3; beam(TX + Math.cos(an) * 0.6, Y + 1.2, TZ + Math.sin(an) * 0.6, TX + Math.cos(an) * 2.2, Y - 0.6, TZ + Math.sin(an) * 2.2, 0.28); }   // buttress roots
    // limbs out to the canopy, and the canopy: big clumps of leaves in a wide dome, kept high over the sea side
    const limbs = [];
    for (let k = 0; k < 7; k++) { const an = k * 0.9 + 0.2, r = 5 + (k % 3), y1 = Y + 12.8 + (k % 2) * 1.5; limbs.push([an, r, y1]); beam(TX, Y + 10.9, TZ, TX + Math.cos(an) * r, y1, TZ + Math.sin(an) * r, 0.3 - (k % 3) * 0.05); }
    const clump = new THREE.IcosahedronGeometry(1, 1);
    for (let k = 0; k < 46; k++) { const an = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 7.5, sea = Math.cos(an) > 0.2 || Math.sin(an) < -0.3;   // (local +x and -z face the waves)
      const m = new THREE.Mesh(tint(clump.clone(), LEAVES[k % 4], 0.3), mat); m.position.set(TX + Math.cos(an) * r, Y + (sea ? 13.8 : 12.6) + (1 - r / 7.5) * 2.2 + Math.random() * 0.8, TZ + Math.sin(an) * r);
      m.scale.set(1.6 + Math.random(), 0.9 + Math.random() * 0.5, 1.6 + Math.random()); m.rotation.y = Math.random() * 3; g.add(m); }
    for (let k = 0; k < 9; k++) { const [an, r, y1] = limbs[k % 7], f = 0.55 + 0.1 * (k % 3), x = TX + Math.cos(an) * r * f, z = TZ + Math.sin(an) * r * f;   // hanging aerial roots
      if (Math.hypot(x - TX, z - TZ) > RD + 0.3 && Math.cos(an) < 0 && Math.sin(an) > 0) beam(x, Y + 12.4, z, x + 0.1, Y - 0.2, z + 0.1, 0.035); }
    // the stair: treads fanning around the trunk, each on a bracket into it, with a rope-and-post rail on the outside
    const NS = 44;
    for (let k = 0; k < NS; k++) { const ph = (k + 0.5) / NS * TURN, an = A0 + ph, h = Y + (k + 1) / NS * DH, c = Math.cos(an), sn = Math.sin(an);
      const t = box(R1 - R0 + 0.1, 0.07, 0.42, k % 2 ? PLANK_L : PLANK, TX + c * (R0 + R1) / 2, h - 0.035, TZ + sn * (R0 + R1) / 2, 0.06); t.rotation.y = -an;
      if (k % 2 === 0) { box(0.05, 0.95, 0.05, POST, TX + c * (R1 - 0.05), h + 0.45, TZ + sn * (R1 - 0.05)); } }
    for (let k = 0; k < NS; k += 2) { const p0 = (k + 0.5) / NS * TURN, p1 = Math.min(TURN, (k + 2.5) / NS * TURN), a0 = A0 + p0, a1 = A0 + p1;
      beam(TX + Math.cos(a0) * (R1 - 0.05), Y + (k + 1) / NS * DH + 0.95, TZ + Math.sin(a0) * (R1 - 0.05), TX + Math.cos(a1) * (R1 - 0.05), Y + Math.min(NS, k + 3) / NS * DH + 0.95, TZ + Math.sin(a1) * (R1 - 0.05), 0.03); }
    // the deck: a ring of radial boards around the trunk, on brackets, with a rail, and lanterns on it
    const ring = new THREE.RingGeometry(R1 - 0.05, RD, 48, 1).toNonIndexed(); ring.rotateX(-Math.PI / 2);
    { const n = ring.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i += 6) { const cc = (i / 6) % 2 ? FLOOR : FLOOR_L; for (let j = 0; j < 6; j++) { c[(i + j) * 3] = cc[0]; c[(i + j) * 3 + 1] = cc[1]; c[(i + j) * 3 + 2] = cc[2]; } }
      ring.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const dk = new THREE.Mesh(ring, mat); dk.position.set(TX, Y + DH, TZ); g.add(dk);
    const fas = new THREE.Mesh(tint(new THREE.CylinderGeometry(RD, RD, 0.3, 48, 1, true), PLANK_D), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })); fas.position.set(TX, Y + DH - 0.15, TZ); g.add(fas);
    const under = new THREE.Mesh(tint(new THREE.RingGeometry(R1 - 0.05, RD, 48, 1), PLANK_D), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); under.rotation.x = Math.PI / 2; under.position.set(TX, Y + DH - 0.3, TZ); g.add(under);
    for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + 0.2; beam(TX + Math.cos(an) * 1.0, Y + DH - 2.4, TZ + Math.sin(an) * 1.0, TX + Math.cos(an) * (RD - 0.3), Y + DH - 0.3, TZ + Math.sin(an) * (RD - 0.3), 0.08); }
    const railR = (r, a0, a1, n) => { for (let k = 0; k <= n; k++) { const an = a0 + (a1 - a0) * k / n; box(0.06, 1.0, 0.06, POST, TX + Math.cos(an) * r, Y + DH + 0.5, TZ + Math.sin(an) * r);
      if (k < n) { const b0 = an, b1 = a0 + (a1 - a0) * (k + 1) / n; beam(TX + Math.cos(b0) * r, Y + DH + 1.0, TZ + Math.sin(b0) * r, TX + Math.cos(b1) * r, Y + DH + 1.0, TZ + Math.sin(b1) * r, 0.045); } } };
    const AE = A0 + TURN;   // where the stair comes out onto the deck
    railR(RD - 0.06, 0, Math.PI * 2, 32); railR(R1 - 0.02, AE + 0.3, AE + Math.PI * 2 - 0.55, 20);
    for (let k = 0; k < 10; k++) { const an = k * Math.PI / 5 + 0.1, x = TX + Math.cos(an) * (RD - 0.06), z = TZ + Math.sin(an) * (RD - 0.06);   // lanterns hung on the rail
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow); bulb.position.set(x, Y + DH + 0.85, z); g.add(bulb); }
    const DL = new THREE.PointLight(0xffc98f, 4, 10, 1.6); DL.position.set(TX + 2, Y + DH + 1.5, TZ - 1); g.add(DL);
    box(1.6, 0.4, 0.5, PLANK_L, TX + 2.8, Y + DH + 0.2, TZ - 0.6); box(1.6, 0.4, 0.5, PLANK_L, TX - 0.2, Y + DH + 0.2, TZ - 2.9);   // two benches facing the waves
  }

  // join the static timber into one mesh (a phone draws it in one go instead of hundreds)
  { const parts = g.children.filter((m) => m.isMesh && m.material === mat);
    const geos = parts.map((m) => { m.updateMatrix(); const q = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; });
    const merged = mergeGeometries(geos);
    if (merged) { for (const m of parts) { g.remove(m); m.geometry.dispose(); } g.add(new THREE.Mesh(merged, mat)); } }

  // walking: which surface is under you (the house and balcony floor, a stair tread, or the tree deck), and where you
  // can't go. Both know how high your feet are now, since the stair winds over itself and the deck is over the stair
  const polar = (x, z) => [Math.hypot(x - TX, z - TZ), Math.atan2(z - TZ, x - TX)];
  const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  const stairAt = (an, foot) => { let best = null; for (let k = -1; k <= 2; k++) { const ph = an - A0 + 2 * Math.PI * k; if (ph < 0 || ph > TURN) continue;
    const h = Y + ph / TURN * DH; if (best === null || Math.abs(h - foot) < Math.abs(best - foot)) best = h; } return best; };
  const inRect = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const floorL = (x, z, foot) => {
    const [r, an] = polar(x, z);
    if (r < R1 + 0.1) { const h = stairAt(an, foot); if (h !== null && Math.abs(h - foot) < 0.6) return h; }
    if (foot > Y + DH - 0.7 && r < RD + 0.3) return Y + DH;
    return Y; };
  const solidL = (x, z, foot) => {
    const [r, an] = polar(x, z);
    if (r < R0 + 0.2) return true;                                                     // the trunk
    if (foot < Y + 0.3) {                                                              // down on the floor
      if (r < R1 + 0.1) { const d = wrap(an - A0); return !(d > -0.35 && d < 0.7); }   // (only the foot of the stair; the rest is under it)
      return !(inRect(x, z, B.x0 + 0.35, B.x1 - 0.35, B.z0 + 0.35, V.z1) || inRect(x, z, V.x1 + 0.3, B.x1 - 0.35, V.z1 - 1, LZ - 0.3)); }
    if (foot > Y + DH - 0.4) {                                                         // up on the deck
      if (r > RD - 0.35) return true;
      if (r < R1 - 0.05) { const d = wrap(an - AE_); return !(d > -0.7 && d < 0.15); }  // (the stairwell, except where the stair arrives)
      return false; }
    return r > R1 - 0.15;                                                              // on the stair: stay on the treads
  };
  const AE_ = A0 + TURN;
  // (the game walks you around in the coast frame; the point is mirrored east-west into place, see OX)
  const toL = (x, z) => [OX - x, z - OZ];
  const floorAt = (x, z, foot = Y) => { const [lx, lz] = toL(x, z); return floorL(lx, lz, foot); };
  const solid = (x, z, foot = Y) => { const [lx, lz] = toL(x, z); return solidL(lx, lz, foot); };
  for (const c of colliders) { const x0 = c[0], x1 = c[1]; c[0] = OX - x1; c[1] = OX - x0; c[2] += OZ; c[3] += OZ; }
  const walk = { x0: OX - Math.max(B.x1, TX + RD), x1: OX - B.x0, z0: B.z0 + OZ, z1: TZ + RD + OZ };
  return { group: root, rack, colliders, walk, floorAt, solid, spawn: { x: OX + 91, z: 37.5 + OZ, yaw: Math.PI + 0.75 }, rackAt: { x: OX - (V.x0 + 0.6), z: 37 + OZ } };
}
