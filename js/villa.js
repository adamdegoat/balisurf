// Your villa: a small wooden cliff house out on the rocky point at the far end of the Tanjung Uma reef, looking back up
// the line at the waves as they come: from down the line you see into the barrels, not the back of the lip. Inside it's all warm timber: plank walls,
// wide floorboards, a pitched boarded ceiling on dark beams. A living room with glass on the two sea sides opens onto
// a wraparound balcony; through a doorway, the board room, with your four boards standing in a rack on the wall.
// Built in the coast's own frame (same as coast() in wave.js), so it sits right once the group is moved back by the
// spot's dz. The waves break at x 0 (coast z about -60) and peel off toward +x, toward the point. A banyan beside the
// house carries a spiral stair up to a deck in its canopy, the highest seat on the point.
import * as THREE from 'three';
import { makeBoard } from './board.js?v=14';
import { landMaterial, waterMaterial } from './wave.js?v=108';
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
  const PLANK = [0.58, 0.35, 0.19], PLANK_L = [0.66, 0.42, 0.23], PLANK_D = [0.42, 0.24, 0.12], POST = [0.27, 0.15, 0.08], FLOOR = [0.34, 0.19, 0.09], FLOOR_L = [0.4, 0.23, 0.11],   // (merbau and old teak)
    LINEN = [0.94, 0.86, 0.73], RATTAN = [0.72, 0.56, 0.34], TEAL = [0.2, 0.44, 0.44], LEAF = [0.13, 0.33, 0.1];
  const H = 3.2, RIDGE = 5.4, xm = (V.x0 + V.x1) / 2, zm = (V.z0 + V.z1) / 2;
  const xL = -95;                                  // the wall between the board room (west) and the living room (east)
  const B = { x0: V.x0, x1: V.x1 + 3.4, z0: V.z0 - 3.4, z1: V.z1 };   // the balcony wraps the two sea sides (south and east)
  const GY0 = Y - 0.2, fire0 = { x: -94.5, z: 49.5 };                 // the garden's grass level and the fire pit (behind the house)
  const LZ = 46.6;                                                   // ...and runs on past the house to the tree
  const PL = { x0: -82.6, x1: -79.4, z0: 29.6, z1: 39.4 };        // the infinity pool, hung off the east balcony over the cliff
  const TX = -83.5, TZ = 48.5, R0 = 1.05, R1 = 2.1, RD = 3.6, DH = 8, TURN = 3 * Math.PI, A0 = -Math.PI / 2;   // the banyan: trunk, stair ring, deck radius and height, stair turns and start angle

  // ---- the rocky point: a long finger of limestone running out from the cliffs, scrub on top, sheer sides into the sea
  {
    const cliffTop = (xl) => { const x = OX - xl; return (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35)); };   // (the coast's own cliff height, before its fade)
    const cx = (z) => { const k = Math.min(1, Math.max(0, (z - 70) / 150)); return -93 + 4 * Math.sin((z - 37) * 0.03) - 60 * k * k * (3 - 2 * k); }, hw = (z) => 13.6 + 11 * Math.min(1, Math.max(0, (z - 60) / 120)),   /* (wide enough at the tip that the cliff edge sits right under the balcony) */ tipZ = 37;   // (the ridge curves back west into the cliffs)
    const top = (x, z) => { const k = Math.min(1, Math.max(0, (z - 55) / 120)), s = k * k * (3 - 2 * k), far = cliffTop(x) + 1;
      return (Y - 0.25) * (1 - s) + Math.max(3, far) * s + (z > 55 ? Math.sin(x * 0.3) * Math.cos(z * 0.2) * 0.6 : 0); };
    // the top of the point: grass and scrub out to the cliff edge (beyond the edge it drops out of sight, inside the wall)
    const EDGE = 0.8, noiseW = (z, a) => { const nk = z < 58 ? 0.3 : 1; return 1 + nk * (0.14 * Math.sin(z * 0.09 + 2) + 0.08 * Math.sin(z * 0.23 + 1) + 0.05 * Math.sin(z * 0.71) + 0.07 * Math.sin(a * 5) + 0.04 * Math.sin(a * 13)); };
    const geo = new THREE.PlaneGeometry(130, 200, 130, 160); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - 115, z = p.getZ(i) + 105, a = Math.atan2(z - tipZ, x - cx(z)), w = hw(z) * noiseW(z, a);
      const d = Math.hypot(Math.abs(x - cx(z)) / w, Math.max(0, tipZ - z) / w), t = top(x, z);
      let X = x, Z = z, y = t; const col = d < 0.7 ? [0.16, 0.27, 0.11] : [0.36, 0.34, 0.24];
      if (d > EDGE) { const kk = (EDGE - 0.04) / d, oz = z < tipZ ? tipZ : z; X = cx(z) + (x - cx(z)) * kk; Z = oz + (z - oz) * kk; y = t - 12; }   // (past the edge: tucked in behind the cliff wall, out of sight)
      p.setXYZ(i, X, y, Z); const k = 0.9 + Math.random() * 0.2; c[i * 3] = col[0] * k; c[i * 3 + 1] = col[1] * k; c[i * 3 + 2] = col[2] * k;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, landMaterial()));
    // the cliff: a wall of rock all round the edge, built row by row from the lip down into the sea: layers of limestone
    // stepping in and out as ledges and overhangs, scrub caught on the ledges, dark and wet at the waterline, and a
    // rubble apron spreading into the sea at its foot
    {
      const pts = [];   // the edge, all the way round: up the east side, round the tip, back down the west side
      const edgeAt = (z, side) => { let x = cx(z) + side * EDGE * hw(z); for (let it = 0; it < 2; it++) { const a = Math.atan2(z - tipZ, x - cx(z)); x = cx(z) + side * EDGE * hw(z) * noiseW(z, a); } return x; };
      for (let z = 200; z > tipZ; z -= 1.1) pts.push([edgeAt(z, 1), z]);
      for (let k = 0; k <= 40; k++) { const th = -k / 40 * Math.PI, r = EDGE * hw(tipZ) * noiseW(tipZ - 1, th); pts.push([cx(tipZ) + Math.cos(th) * r, tipZ + Math.sin(th) * r]); }
      for (let z = tipZ + 1.1; z <= 200; z += 1.1) pts.push([edgeAt(z, -1), z]);
      const R = 26, n = pts.length, pos = new Float32Array(n * (R + 1) * 3), col = new Float32Array(n * (R + 1) * 3), idx = [];
      for (let i = 0; i < n; i++) {
        const [x, z] = pts[i], [xa, za] = pts[Math.max(0, i - 1)], [xb, zb] = pts[Math.min(n - 1, i + 1)];
        let nx = -(zb - za), nz = xb - xa; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;   // (outward, away from the point's spine)
        const t = top(x, z), seed = Math.sin(i * 12.9898) * 43758.5453 % 1;
        for (let j = 0; j <= R; j++) {
          const v = j / R, y = (t - 0.05) * (1 - v) + -2.5 * v;
          const ledge = 0.55 * Math.sin(y * 0.85 + i * 0.05) + 0.3 * Math.sin(y * 2.1 - i * 0.12) + 0.25 * Math.sin(i * 0.21 + y * 0.35), talus = 4 * Math.pow(v, 2.4);
          const o = j === 0 ? 0 : 0.95 + ledge + talus + 0.15 * Math.abs(seed);   // (always a little proud of the edge, stepping out in ledges)
          const q = (i * (R + 1) + j) * 3; pos[q] = x + nx * o; pos[q + 1] = y; pos[q + 2] = z + nz * o;
          const band = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(y * 1.9 + Math.sin(i * 0.05) * 2)), jit = 0.88 + Math.random() * 0.24, wet = y < 1.2 ? 0.5 : 1;
          const scrub = y > 3 && Math.sin(y * 0.85 + i * 0.07) > 0.62 && Math.random() < 0.7, crack = Math.sin(i * 0.9 + y * 0.2) > 0.93;
          const cc = scrub ? [0.19, 0.28, 0.12] : crack ? [0.3, 0.27, 0.22] : v > 0.9 ? [0.4, 0.37, 0.32] : [0.58, 0.51, 0.4];
          for (let e = 0; e < 3; e++) col[q + e] = cc[e] * band * jit * wet;
        }
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < R; j++) { const a0 = i * (R + 1) + j, b0 = a0 + R + 1; idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1); }
      const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.BufferAttribute(pos, 3)); wall.setAttribute('color', new THREE.BufferAttribute(col, 3)); wall.setIndex(idx);
      const flat = wall.toNonIndexed(); flat.computeVertexNormals();   // (faceted, like broken rock)
      g.add(new THREE.Mesh(flat, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })));
    }
    // boulders at the foot, where the sea breaks on the rock
    for (let k = 0; k < 16; k++) { const z = 22 + k * 7 + Math.random() * 4, side = k % 2 ? 1 : -1, r = 1.2 + Math.random() * 2;
      const rock = new THREE.Mesh(tint(new THREE.DodecahedronGeometry(r, 0), [0.42, 0.39, 0.33], 0.2), landMaterial()); rock.position.set(cx(z) + side * hw(z) * 1.02, 0, z); rock.rotation.set(k, k * 2, 0); g.add(rock); }
  }

  // ---- the house: stone footing, floorboards, plank walls between dark posts
  box(V.x1 - V.x0 + 0.4, 1.2, V.z1 - V.z0 + 0.4, [0.6, 0.51, 0.4], xm, Y - 0.7, zm, 0.12);   // (warm paras stone)
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
  for (const [x, cc] of [[-91.9, [0.62, 0.2, 0.12]], [-90.3, [0.16, 0.2, 0.36]], [-88.6, [0.78, 0.5, 0.2]]]) box(0.55, 0.45, 0.18, cc, x, Y + 0.8, sz + 0.2);
  block(sx - 2.35, sx + 2.35, sz - 0.55, V.z1);
  box(3.4, 0.02, 2.4, [0.74, 0.64, 0.48], sx, Y + 0.01, sz - 2.3, 0.2);
  box(1.8, 0.1, 0.9, PLANK_D, sx, Y + 0.42, sz - 2.2); for (const [ox, oz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) box(0.08, 0.38, 0.08, POST, sx + ox, Y + 0.19, sz - 2.2 + oz);
  block(sx - 0.95, sx + 0.95, sz - 2.7, sz - 1.7);
  box(0.9, 0.06, 0.5, [0.2, 0.36, 0.34], sx + 0.3, Y + 0.5, sz - 2.2); cyl(0.12, 0.16, 0.2, [0.9, 0.86, 0.78], sx - 0.5, Y + 0.57, sz - 2.2);
  const ax = -93.6, az = 38.6;   // a low teak lounge chair with fat linen cushions, turned to the sea
  { const ch = new THREE.Group(); ch.position.set(ax, Y, az); ch.rotation.y = -0.8; g.add(ch);
    const cb = (w, h, d, rgb, x, y, z, rx = 0) => { const m = new THREE.Mesh(tint(new THREE.BoxGeometry(w, h, d), rgb), mat); m.position.set(x, y, z); m.rotation.x = rx; ch.add(m); };
    cb(0.85, 0.12, 0.85, PLANK_D, 0, 0.3, 0); for (const sx2 of [-0.4, 0.4]) cb(0.1, 0.55, 0.85, PLANK_D, sx2, 0.4, 0);
    for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) cb(0.07, 0.3, 0.07, POST, x, 0.15, z);
    cb(0.68, 0.16, 0.7, LINEN, 0, 0.44, 0.02); cb(0.68, 0.62, 0.16, LINEN, 0, 0.72, 0.36, -0.25); cb(0.4, 0.3, 0.12, [0.78, 0.46, 0.26], 0.05, 0.66, 0.24, -0.2); }
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
  plant(-87.5, 42.5, 1.1); plant(-96.4, 42.6, 1.0); plant(-94.4, 31.3, 0.95); plant(-89.8, 31.5, 1.0);   // (leaves reach 1.15 m per unit of size: each far enough from the walls that none pokes through; the last clear of the egg chair's view)
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false });   // (full brightness, not dimmed by the tone curve: lit bulbs, not cream beads)
  const shadeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x7a4818, emissiveIntensity: 0.7 });   // (woven shades glow with the bulb inside)
  for (const [x, z] of [[-91.5, 39], [-88.8, 39], [-97.5, 37]]) {
    const shade = new THREE.Mesh(tint(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), RATTAN), shadeMat); shade.position.set(x, Y + 2.7, z); shade.rotation.x = Math.PI; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow); bulb.position.set(x, Y + 2.62, z); g.add(bulb);
    cyl(0.01, 0.01, 2, [0.15, 0.15, 0.15], x, Y + 3.7, z, 4);
  }

  // a rattan egg chair hanging from the ring beam by the corner glass, and a cluster of pendants under the peak
  { const ex = -88.1, ez = 32.3, egg = new THREE.SphereGeometry(0.62, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72); egg.scale(1, 1.25, 1);
    const e = new THREE.Mesh(tint(egg, RATTAN, 0.2), shadeMat); e.position.set(ex, Y + 1.25, ez); e.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(Math.cos(-0.3), 0.25, Math.sin(-0.3)).normalize()); g.add(e);   // (its open side faces the way you look from it: out of the corner glass at the waves)
    cyl(0.5, 0.5, 0.14, LINEN, ex, Y + 0.78, ez, 14); box(0.35, 0.3, 0.12, TEAL, ex - 0.15, Y + 1.0, ez + 0.28);
    cyl(0.012, 0.012, yR - 0.35 - (Y + 1.9), [0.2, 0.2, 0.2], ex, (yR - 0.35 + Y + 1.9) / 2, ez, 4); block(ex - 0.65, ex + 0.65, ez - 0.65, ez + 0.65); }
  for (let k = 0; k < 7; k++) { const an = k * 0.9, r = k ? 0.55 : 0, x = xm + Math.cos(an) * r, z = zm + Math.sin(an) * r, y = Y + 3.4 + (k % 3) * 0.45;
    const sh2 = new THREE.Mesh(tint(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), RATTAN), shadeMat); sh2.position.set(x, y, z); sh2.rotation.x = Math.PI; g.add(sh2);
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow); bl.position.set(x, y - 0.06, z); g.add(bl); cyl(0.008, 0.008, yP - 1 - y, [0.15, 0.15, 0.15], x, (yP - 1 + y) / 2, z, 4); }
  { const PL = new THREE.PointLight(0xffc98f, 7, 15, 1.3); PL.position.set(xm, Y + 3.3, zm); g.add(PL); }   // (the one real light: every extra light costs a phone on every pixel)

  // Sumba and Bali in the room: a hinggi ikat cloth hung on the wall by the doorway (rust and indigo, horses and
  // diamonds), a pair of carved, gilded Balinese doors on the back wall, woven pandan rug, canang sari offerings
  const canvasTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const ikat = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#6e2616'; c.fillRect(0, 0, w, h);
    const band = (y, bh, col) => { c.fillStyle = col; c.fillRect(0, y, w, bh); };
    band(18, 10, '#e9d8b4'); band(h - 60, 10, '#e9d8b4'); band(40, 26, '#1f2a4a'); band(h - 94, 26, '#1f2a4a');
    c.strokeStyle = '#e9d8b4'; c.lineWidth = 5;
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) { const cx = 42 + k * 86, cy = 110 + r * 64; c.beginPath(); c.moveTo(cx, cy - 26); c.lineTo(cx + 30, cy); c.lineTo(cx, cy + 26); c.lineTo(cx - 30, cy); c.closePath(); c.stroke();
      c.fillStyle = r % 2 ? '#1f2a4a' : '#c8872e'; c.fillRect(cx - 7, cy - 7, 14, 14); }
    c.fillStyle = '#e9d8b4'; for (const y of [78, 422]) for (let k = 0; k < 4; k++) { const x = 30 + k * 60; c.fillRect(x, y, 34, 8); c.fillRect(x + 4, y + 8, 4, 12); c.fillRect(x + 26, y + 8, 4, 12); c.fillRect(x + 30, y - 10, 6, 12); }   // (little horses)
    for (let x = 4; x < w; x += 9) { c.fillStyle = '#5a1e12'; c.fillRect(x, h - 40, 4, 40); }   // fringe
    for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 3, 1); } });   // (the blur of hand-tied thread)
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.4), new THREE.MeshStandardMaterial({ map: ikat, roughness: 1 })); m.position.set(xL + 0.08, Y + 1.7, 32.4); m.rotation.y = Math.PI / 2; g.add(m);
    box(0.06, 0.06, 1.5, POST, xL + 0.1, Y + 2.95, 32.4); }
  const door = canvasTex(256, 512, (c, w, h) => {
    const gd = c.createLinearGradient(0, 0, w, 0); gd.addColorStop(0, '#5a2a14'); gd.addColorStop(0.5, '#6e3519'); gd.addColorStop(1, '#5a2a14'); c.fillStyle = gd; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c99a3a'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28); c.beginPath(); c.moveTo(w / 2, 14); c.lineTo(w / 2, h - 14); c.stroke();
    for (const side of [0, 1]) { const x0 = side ? w / 2 + 12 : 26, pw = w / 2 - 38;
      for (const [y0, ph] of [[30, 150], [200, 90], [310, 170]]) { c.lineWidth = 3; c.strokeStyle = '#3a1a0a'; c.strokeRect(x0, y0, pw, ph);
        c.strokeStyle = '#d4a848'; c.lineWidth = 2.5; for (let k = 0; k < 7; k++) { const cx = x0 + pw / 2, cy = y0 + ph / 2; c.beginPath(); c.ellipse(cx, cy, pw * (0.12 + k * 0.05), ph * (0.1 + k * 0.05), 0, k * 0.7, k * 0.7 + 3.6); c.stroke(); }   // (gilded scroll carving)
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x0, y0 + ph - 5, pw, 5); } }
    c.fillStyle = '#d4a848'; c.beginPath(); c.arc(w / 2 - 16, h / 2, 7, 0, 7); c.arc(w / 2 + 16, h / 2, 7, 0, 7); c.fill(); });
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.5), new THREE.MeshStandardMaterial({ map: door, roughness: 0.7 })); m.position.set(-94.1, Y + 1.26, V.z1 - 0.08); m.rotation.y = Math.PI; g.add(m);
    box(1.7, 0.18, 0.14, POST, -94.1, Y + 2.6, V.z1 - 0.1); box(0.14, 2.6, 0.14, POST, -94.95, Y + 1.3, V.z1 - 0.1); box(0.14, 2.6, 0.14, POST, -93.25, Y + 1.3, V.z1 - 0.1); }
  const pandan = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#b89a62'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { c.fillStyle = ((x + y) / 8) % 2 ? '#a88852' : '#c8aa70'; c.fillRect(x, y, 8, 8); }
    c.strokeStyle = '#6e2616'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28); c.strokeStyle = '#1f2a4a'; c.lineWidth = 4; c.strokeRect(30, 30, w - 60, h - 60); });
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshStandardMaterial({ map: pandan, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(-90.2, Y + 0.03, 39.5); g.add(m); }
  // canang sari: little palm-leaf trays of flowers, set out each morning (by the doors, on the shelf, at the stair)
  const canang = (x, y, z) => { box(0.16, 0.03, 0.16, [0.55, 0.7, 0.3], x, y + 0.015, z);
    for (const [dx, dz, cc] of [[-0.04, -0.04, [0.95, 0.9, 0.85]], [0.04, -0.04, [0.9, 0.2, 0.15]], [-0.04, 0.04, [0.98, 0.75, 0.1]], [0.04, 0.04, [0.6, 0.2, 0.6]]]) box(0.05, 0.03, 0.05, cc, x + dx, y + 0.045, z + dz); };
  canang(-91.2, Y, 30.35); canang(-85.6, Y, 36.1); canang(xL + 0.3, Y + 1.53, 42.3); canang(-83.3, Y, 46.4);
  // speakers for the music: an old teak valve radio on the balcony table between the loungers (where you watch the
  // surf), and wooden speakers by the fire and up on the tree deck. Walk up to any of them to switch the music off
  const speakersL = [], woofers = [];
  // the song on every speaker's little amber screen (one canvas, shared)
  const songCv = document.createElement('canvas'); songCv.width = 512; songCv.height = 128; const songTex = new THREE.CanvasTexture(songCv); songTex.colorSpace = THREE.SRGBColorSpace;
  const dispMat = new THREE.MeshBasicMaterial({ map: songTex, toneMapped: false });
  const setSong = (title, artist) => { const c = songCv.getContext('2d'); c.fillStyle = '#140a04'; c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#b8732a'; c.font = 'bold 20px Helvetica, Arial, sans-serif'; c.fillText('NOW PLAYING', 18, 30);
    c.fillStyle = '#ffc266'; c.font = 'bold 40px Helvetica, Arial, sans-serif'; let t = title; while (c.measureText(t).width > 480 && t.length > 4) t = t.slice(0, -2); c.fillText(t === title ? t : t + '...', 18, 76);
    c.fillStyle = '#d99a4a'; c.font = '26px Helvetica, Arial, sans-serif'; c.fillText(artist, 18, 112); songTex.needsUpdate = true; };
  setSong('Island radio', 'Tap MUSIC near a speaker');
  const weave = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#6e5230'; c.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) { c.fillStyle = ((x + y) / 8) % 2 ? '#c9a468' : '#a8844c'; c.fillRect(x + 1, y + 1, 6, 6); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 5); return t; })();
  const grilleMat = new THREE.MeshStandardMaterial({ map: weave, roughness: 0.9 }), coneMat = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.8 }), rimMat = new THREE.MeshStandardMaterial({ color: 0xb08850, metalness: 0.5, roughness: 0.35 });
  const display = (rg, w, h, x, y, z) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dispMat); d.position.set(x, y, z); d.scale.x = -1; rg.add(d); };   // (flipped back: the house is mirrored)
  const cone = (rg, r, x, y, z) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.12, 6, 20), rimMat); ring.position.set(x, y, z); rg.add(ring);
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, r * 0.5, 20, 1, true), coneMat); c.rotation.x = -Math.PI / 2; c.position.set(x, y, z - r * 0.2); c.userData.z0 = z - r * 0.2; rg.add(c); woofers.push(c);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), coneMat); cap.rotation.x = Math.PI / 2; cap.position.set(x, y, z - r * 0.05); rg.add(cap); cap.userData.z0 = z - r * 0.05; woofers.push(cap); };
  // a floor-standing teak speaker: rattan-woven front, a big cone that pumps with the bass, the song on a screen
  const tall = (x, y, z, ry) => { const rg = new THREE.Group(); rg.position.set(x, y, z); rg.rotation.y = ry; g.add(rg); speakersL.push([x, z, y + 0.6]);
    const rb = (w, h, d, c, px, py, pz) => { const q = new THREE.Mesh(tint(new THREE.BoxGeometry(w, h, d), c, 0.05), mat); q.position.set(px, py, pz); rg.add(q); };
    rb(0.5, 1.0, 0.38, [0.34, 0.18, 0.08], 0, 0.62, 0); for (const [lx, lz] of [[-0.2, -0.14], [0.2, -0.14], [-0.2, 0.14], [0.2, 0.14]]) rb(0.05, 0.12, 0.05, POST, lx, 0.06, lz);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), grilleMat); gr.position.set(0, 0.55, 0.191); rg.add(gr);
    cone(rg, 0.15, 0, 0.48, 0.205); cone(rg, 0.055, 0, 0.76, 0.2); display(rg, 0.42, 0.105, 0, 1.03, 0.192); };
  // the old teak valve radio on the balcony table, with the song on its dial
  const radio = (x, y, z, ry) => { const rg = new THREE.Group(); rg.position.set(x, y, z); rg.rotation.y = ry; g.add(rg); speakersL.push([x, z, y + 0.2]);
    const rb = (w, h, d, c, px, py, pz) => { const q = new THREE.Mesh(tint(new THREE.BoxGeometry(w, h, d), c, 0.04), mat); q.position.set(px, py, pz); rg.add(q); };
    rb(0.62, 0.38, 0.26, [0.4, 0.22, 0.1], 0, 0.19, 0); rb(0.66, 0.04, 0.3, POST, 0, 0.39, 0);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.26), grilleMat); gr.position.set(-0.13, 0.18, 0.131); rg.add(gr); cone(rg, 0.1, -0.13, 0.18, 0.14);
    display(rg, 0.24, 0.06, 0.16, 0.26, 0.132); rb(0.04, 0.04, 0.03, [0.2, 0.15, 0.1], 0.1, 0.1, 0.14); rb(0.04, 0.04, 0.03, [0.2, 0.15, 0.1], 0.22, 0.1, 0.14); };
  radio(-85.2, Y + 0.4, 37, Math.PI / 2);                                                   // on the balcony table between the loungers
  tall(-85.65, Y, 33.45, Math.PI / 2); tall(-85.65, Y, 40.95, Math.PI / 2); block(-86, -85.3, 33.1, 33.8); block(-86, -85.3, 40.6, 41.3);   // either side of the open doors, facing the waves
  { const sx = fire0.x + Math.cos(5.4) * 2.4, sz = fire0.z + Math.sin(5.4) * 2.4; tall(sx, GY0, sz, -5.4 - Math.PI / 2); block(sx - 0.35, sx + 0.35, sz - 0.35, sz + 0.35); }   // by the fire, facing it
  tall(TX - 2.55, Y + DH, TZ + 1.9, Math.atan2(-1.9, 2.55) + Math.PI / 2);                  // up on the tree deck

  // ---- the board room: whitewashed wall with a teak rack and your four boards, a wax bench, a wetsuit on a hook
  for (let y = 0.1; y < H; y += 0.22) box(0.04, 0.235, V.z1 - V.z0 - 0.3, (Math.round(y * 4.5) % 2) ? [0.8, 0.64, 0.42] : [0.74, 0.58, 0.37], V.x0 + 0.08, Y + y, zm, 0.05);   // (woven bamboo panelling behind the rack)
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
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 360; const x2 = cv.getContext('2d');
    x2.fillStyle = '#1f2a26'; x2.fillRect(0, 0, 512, 360); x2.strokeStyle = '#6b4a2c'; x2.lineWidth = 22; x2.strokeRect(0, 0, 512, 360);
    x2.fillStyle = 'rgba(240,236,224,.92)'; x2.font = 'bold 34px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif'; x2.fillText('TANJUNG UMA', 34, 62);
    x2.font = '26px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif';
    ['Surf  4.5 m, clean', 'Wind  light offshore', 'Swell  14 s, SW', 'Tide  mid, pushing in', 'Crowd  7 out'].forEach((t, i) => x2.fillText(t, 34, 118 + i * 44));
    x2.fillStyle = '#ffcf8a'; x2.font = 'bold 26px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif'; x2.fillText('GO!', 400, 320);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const cb = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.25 }));
    cb.position.set(-98.4, Y + 1.8, V.z1 - 0.09); cb.rotation.y = Math.PI; cb.scale.x = -1; g.add(cb);   // (flipped back: the house is mirrored)
    root.userData.report = { cv, x2, tx }; }
  for (const [type, x, y, z, ry] of [['long', V.x0 + 2.3, Y + H + 0.2, 34.4, 0], ['fish', V.x0 + 2.3, Y + H + 0.2, 40.6, 0.04]]) {   // spare boards laid up on the tie beam
    const b = makeBoard(type); b.rotation.set(0, Math.PI / 2 + ry, 0); b.position.set(x, y, z); g.add(b); }
  cyl(0.04, 0.04, 0.15, POST, -96.4, Y + 2.3, V.z1 - 0.12, 6); box(0.55, 1.3, 0.1, [0.1, 0.1, 0.12], -96.4, Y + 1.6, V.z1 - 0.2);

  // ---- the balcony: a teak deck wrapping the two sea sides, a slatted rail, two loungers and a bench to watch from
  const deck = (x0, x1, z0, z1) => { for (let x = x0 + 0.15; x < x1; x += 0.3) box(0.29, 0.1, z1 - z0, (Math.round(x * 3.33) % 2) ? FLOOR : FLOOR_L, x, Y - 0.05, (z0 + z1) / 2, 0.04);
    box(x1 - x0, 0.35, z1 - z0, PLANK_D, (x0 + x1) / 2, Y - 0.28, (z0 + z1) / 2); };
  deck(B.x0, B.x1, B.z0, V.z0); deck(V.x1, B.x1, V.z0, B.z1);
  // the balcony hangs off the cliff on raking timber brackets anchored back into the rock under the house (a sheer cliff
  // has no ground below for posts to stand on), with a beam along its outer edge
  for (const [x, z] of [[B.x0 + 0.4, B.z0 + 0.3], [-95.5, B.z0 + 0.3], [-90.5, B.z0 + 0.3], [-85.8, B.z0 + 0.3], [B.x1 - 0.3, B.z0 + 0.4], [B.x1 - 0.3, 33.5], [B.x1 - 0.3, 38.5], [B.x1 - 0.3, 43], [B.x1 - 0.3, LZ - 0.3]]) {
    const dx = xm - x, dz = zm - z, d = Math.hypot(dx, dz); beam(x, Y - 0.42, z, x + dx / d * 3.2, Y - 4.2, z + dz / d * 3.2, 0.11); }
  box(B.x1 - B.x0, 0.22, 0.2, POST, (B.x0 + B.x1) / 2, Y - 0.52, B.z0 + 0.15); box(0.2, 0.22, LZ - B.z0, POST, B.x1 - 0.15, Y - 0.52, (B.z0 + LZ) / 2);
  const railZ = (z, x0, x1) => { box(x1 - x0, 0.09, 0.16, POST, (x0 + x1) / 2, Y + 1.05, z); for (let x = x0; x <= x1 + 0.01; x += 0.22) box(0.045, 1.0, 0.045, PLANK_D, x, Y + 0.5, z); };
  const railX = (x, z0, z1) => { box(0.16, 0.09, z1 - z0, POST, x, Y + 1.05, (z0 + z1) / 2); for (let z = z0; z <= z1 + 0.01; z += 0.22) box(0.045, 1.0, 0.045, PLANK_D, x, Y + 0.5, z); };
  railZ(B.z0, B.x0, B.x1); railX(B.x1, B.z0, PL.z0); railX(B.x1, PL.z1, LZ); railX(B.x0, B.z0, V.z0); railZ(LZ, V.x1, TX - 0.9);   // (the east rail stops either side of the pool: its edge is the view)   // (open to the garden on the west, and at the north end: the stair up the tree)
  deck(V.x1, B.x1, V.z1, LZ);
  for (const z of [34.4, 39.6]) { box(1.6, 0.3, 0.8, PLANK_D, -84.8, Y + 0.15, z); box(1.1, 0.12, 0.75, LINEN, -84.6, Y + 0.36, z); const bk = box(0.65, 0.1, 0.75, LINEN, -85.4, Y + 0.58, z); bk.rotation.z = -0.7; block(-85.6, -84.0, z - 0.45, z + 0.45); }   // loungers facing the waves
  box(0.5, 0.4, 0.5, PLANK_L, -85.2, Y + 0.2, 37); block(-85.5, -84.9, 36.7, 37.3);
  // a round teak soaking tub on the south balcony, full to the brim, looking straight out at the waves
  const tub = { x: -97.3, z: 28.3 }, TY = Y + 0.5;
  { const staves = new THREE.CylinderGeometry(0.85, 0.8, 0.72, 28, 1, true), sp = staves.attributes.position, sc2 = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++) { const an = Math.atan2(sp.getZ(i), sp.getX(i)), k = (Math.floor((an + Math.PI) / (Math.PI * 2) * 28) % 2 ? 0.92 : 1.05) * (0.95 + Math.random() * 0.1); sc2[i * 3] = PLANK_L[0] * k; sc2[i * 3 + 1] = PLANK_L[1] * k; sc2[i * 3 + 2] = PLANK_L[2] * k; }
    staves.setAttribute('color', new THREE.BufferAttribute(sc2, 3)); staves.computeVertexNormals();
    const tb = new THREE.Mesh(staves, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })); tb.position.set(tub.x, TY + 0.36, tub.z); g.add(tb);
    for (const y of [0.12, 0.6]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.845, 0.018, 5, 32), new THREE.MeshStandardMaterial({ color: 0x3a3430, metalness: 0.6, roughness: 0.4 })); hoop.rotation.x = Math.PI / 2; hoop.position.set(tub.x, TY + y, tub.z); g.add(hoop); }
    const rim = new THREE.Mesh(tint(new THREE.TorusGeometry(0.83, 0.04, 5, 32), PLANK_D), mat); rim.rotation.x = Math.PI / 2; rim.position.set(tub.x, TY + 0.72, tub.z); g.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.8, 28), new THREE.MeshStandardMaterial({ color: 0x5fb8c0, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 })); water.rotation.x = -Math.PI / 2; water.position.set(tub.x, TY + 0.64, tub.z); g.add(water);
    root.userData.tubWater = water;
    box(1.9, 0.5, 1.9, PLANK_D, tub.x, Y + 0.25, tub.z); for (let k = 0; k < 6; k++) box(0.3, 0.02, 1.9, k % 2 ? FLOOR : FLOOR_L, tub.x - 0.8 + k * 0.32, Y + 0.51, tub.z);   // up on a teak platform, so from the water you see over the rail
    box(0.5, 0.25, 1.0, PLANK_L, tub.x + 1.2, Y + 0.13, tub.z); box(0.35, 0.08, 0.35, [0.95, 0.94, 0.9], tub.x + 0.75, TY + 0.04, tub.z + 0.75);   // a step, and a folded towel
    block(tub.x - 0.95, tub.x + 1.45, tub.z - 0.95, tub.z + 0.95); }


  // ---- the banyan: a huge old tree at the end of the balcony, a spiral stair of teak treads around its trunk, and a
  // round deck up in its canopy, above the roof, strung with lanterns: the highest seat on the point
  {
    const BARK = [0.36, 0.3, 0.24], LEAVES = [[0.14, 0.3, 0.1], [0.18, 0.36, 0.12], [0.11, 0.25, 0.09], [0.22, 0.38, 0.14]];
    const trunk = new THREE.CylinderGeometry(0.55, 0.9, 14.5, 14, 12); const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i), y = tp.getY(i), an = Math.atan2(z, x), k = 1 + 0.1 * Math.sin(an * 5 + y * 0.4) + 0.05 * Math.sin(an * 11 - y);   // (fluted, gnarled)
      tp.setXYZ(i, x * k, y, z * k); }
    const tm = new THREE.Mesh(tint(trunk, BARK, 0.25), mat); tm.position.set(TX, Y + 7, TZ); g.add(tm);
    for (let k = 0; k < 6; k++) { const an = A0 + 0.75 + k * 0.95; beam(TX + Math.cos(an) * 0.5, Y + 0.45, TZ + Math.sin(an) * 0.5, TX + Math.cos(an) * 2.4, Y - 0.5, TZ + Math.sin(an) * 2.4, 0.22); }   // buttress roots (low, and clear of the first steps)
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
    // (the deck stands on posts just outside the stair, braced out to its rim: nothing crosses the stair itself)
    for (let k = 0; k < 6; k++) { const an = A0 + 0.9 + k * (2 * Math.PI - 1.8) / 5, c = Math.cos(an), sn = Math.sin(an);
      box(0.16, DH + 0.5, 0.16, POST, TX + c * 2.35, Y + (DH - 0.5) / 2, TZ + sn * 2.35);
      beam(TX + c * 2.35, Y + DH - 1.4, TZ + sn * 2.35, TX + c * (RD - 0.25), Y + DH - 0.3, TZ + sn * (RD - 0.25), 0.06); }
    const railR = (r, a0, a1, n) => { for (let k = 0; k <= n; k++) { const an = a0 + (a1 - a0) * k / n; box(0.06, 1.0, 0.06, POST, TX + Math.cos(an) * r, Y + DH + 0.5, TZ + Math.sin(an) * r);
      if (k < n) { const b0 = an, b1 = a0 + (a1 - a0) * (k + 1) / n; beam(TX + Math.cos(b0) * r, Y + DH + 1.0, TZ + Math.sin(b0) * r, TX + Math.cos(b1) * r, Y + DH + 1.0, TZ + Math.sin(b1) * r, 0.045); } } };
    const AE = A0 + TURN;   // where the stair comes out onto the deck
    railR(RD - 0.06, 0, Math.PI * 2, 32); railR(R1 - 0.02, AE + 0.3, AE + Math.PI * 2 - 0.55, 20);
    box(0.5, 0.4, 1.6, PLANK_L, TX + 2.9, Y + DH + 0.2, TZ - 0.3); box(1.6, 0.4, 0.5, PLANK_L, TX - 0.3, Y + DH + 0.2, TZ - 2.9);   // two benches along the rail, facing the waves
  }

  // ---- the garden behind the house, on the grass of the point: a fire pit with log seats, a hammock slung between
  // two coconut palms, frangipani. One step down off the end of the balcony
  const GY = GY0, G = { x0: -103, x1: -86.3, z0: 44.4, z1: 53.5 };
  const frondGeos = [], swayT = { value: 0 };
  const fire = fire0;
  {
    const STONE = [0.5, 0.47, 0.42];
    for (let k = 0; k < 11; k++) { const an = k / 11 * Math.PI * 2, st = new THREE.Mesh(tint(new THREE.DodecahedronGeometry(0.2, 0), STONE, 0.25), mat); st.position.set(fire.x + Math.cos(an) * 0.62, GY + 0.1, fire.z + Math.sin(an) * 0.62); st.scale.set(1.2, 0.8, 1); st.rotation.y = k; g.add(st); }
    for (let k = 0; k < 3; k++) { const an = k * 2.1; beam(fire.x + Math.cos(an) * 0.4, GY + 0.08, fire.z + Math.sin(an) * 0.4, fire.x - Math.cos(an) * 0.35, GY + 0.22, fire.z - Math.sin(an) * 0.35, 0.07); }
    for (const an of [0.5, 2.2, 3.9]) { const x = fire.x + Math.cos(an) * 2.1, z = fire.z + Math.sin(an) * 2.1, lg = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.22, 0.24, 1.6, 9), [0.42, 0.3, 0.2], 0.2), mat);
      lg.position.set(x, GY + 0.22, z); lg.rotation.set(0, -an, Math.PI / 2); g.add(lg); block(x - 0.6, x + 0.6, z - 0.6, z + 0.6); }
    block(fire.x - 0.75, fire.x + 0.75, fire.z - 0.75, fire.z + 0.75);
    // palms with the hammock between
    const palm = (x, z, lean) => { const h = 7.5; for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8; beam(x + lean * t0 * t0 * h * 0.25, GY + t0 * h, z, x + lean * t1 * t1 * h * 0.25, GY + t1 * h, z, 0.17 - 0.06 * t0); }
      const tx = x + lean * h * 0.25, ty = GY + h; const frond = new THREE.PlaneGeometry(0.7, 3.2, 1, 4); frond.translate(0, 1.6, 0);
      { const fp = frond.attributes.position; for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setZ(i, -0.12 * y * y); } frond.computeVertexNormals(); }
      for (let k = 0; k < 9; k++) { const f = new THREE.Object3D(); f.position.set(tx, ty, z); f.rotation.set(0, k * 0.7, 0); f.rotateX(-1.1 - (k % 2) * 0.3); f.updateMatrix();
        const q = tint(frond.clone(), [0.26, 0.45, 0.16], 0.3), fp = q.attributes.position, sw = new Float32Array(fp.count); for (let i = 0; i < fp.count; i++) sw[i] = fp.getY(i) / 3.2;
        q.setAttribute('aSway', new THREE.BufferAttribute(sw, 1)); q.applyMatrix4(f.matrix); frondGeos.push(q); }
      block(x - 0.3, x + 0.3, z - 0.3, z + 0.3); return [tx, ty]; };
    palm(-101.8, 46.2, 0.6); palm(-101.4, 52.4, -0.4);
    // (all the fronds as one mesh that sways in the sea breeze in its vertex shader: the tips move most)
    leafMat.onBeforeCompile = (sh) => { sh.uniforms.uT = swayT; sh.vertexShader = 'attribute float aSway; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sk = aSway * aSway, ph = position.x * .35 + position.z * .3;
      transformed.x += (sin(uT * 1.3 + ph) * .16 + sin(uT * 3.1 + ph * 2.) * .03) * sk; transformed.z += cos(uT * 1.05 + ph) * .12 * sk; transformed.y += sin(uT * 1.7 + ph) * .06 * sk;`); };
    const fronds = new THREE.Mesh(mergeGeometries(frondGeos), leafMat); g.add(fronds);
    const hm = new THREE.PlaneGeometry(1.1, 4.6, 6, 16); hm.rotateX(-Math.PI / 2);
    { const hp = hm.attributes.position; for (let i = 0; i < hp.count; i++) { const zz = hp.getZ(i) / 2.3, xx = hp.getX(i) / 0.55; hp.setY(i, -0.55 * (1 - zz * zz) - 0.12 * (1 - xx * xx)); } hm.computeVertexNormals(); }
    const hmm = new THREE.Mesh(tint(hm, [0.86, 0.8, 0.66], 0.1), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })); hmm.position.set(-101.6, GY + 1.5, 49.3); g.add(hmm);
    beam(-101.6, GY + 1.5, 47, -101.75, GY + 1.75, 46.4, 0.015); beam(-101.6, GY + 1.5, 51.6, -101.45, GY + 1.75, 52.2, 0.015);
    block(-102.2, -101, 46.9, 51.7);
    // frangipani: short twisted trees with a crown of leaves and white-and-yellow flowers
    for (const [x, z] of [[-88.2, 52.3], [-99, 44.8]]) { beam(x, GY, z, x + 0.3, GY + 1.6, z + 0.2, 0.09); beam(x + 0.3, GY + 1.6, z + 0.2, x - 0.4, GY + 2.5, z - 0.1, 0.06); beam(x + 0.3, GY + 1.6, z + 0.2, x + 0.9, GY + 2.4, z + 0.3, 0.06);
      for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(tint(new THREE.IcosahedronGeometry(0.45, 0), [0.2, 0.36, 0.14], 0.3), mat); m.position.set(x + 0.2 + Math.cos(k) * 0.8, GY + 2.5 + (k % 2) * 0.2, z + Math.sin(k) * 0.7); m.scale.y = 0.6; g.add(m);
        const fl = new THREE.Mesh(tint(new THREE.IcosahedronGeometry(0.08, 0), [0.98, 0.95, 0.85], 0.05), mat); fl.position.set(m.position.x, m.position.y + 0.25, m.position.z); g.add(fl); }
      block(x - 0.3, x + 0.3, z - 0.3, z + 0.3); }
  }
  // a path of flat stepping stones from the balcony steps to the fire, and tufts of grass
  for (let k = 0; k < 6; k++) { const t = k / 5, x = -87 + (fire.x + 1.4 - -87) * t, z = 45.4 + (fire.z - 1.2 - 45.4) * t + Math.sin(t * 3) * 0.4, st = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.34, 0.36, 0.08, 9), [0.62, 0.58, 0.52], 0.12), mat);
    st.position.set(x, GY + 0.03, z); st.scale.set(1, 1, 0.8 + (k % 2) * 0.2); st.rotation.y = k; g.add(st); }
  { const bl = []; for (let k = 0; k < 7; k++) { const an = k / 7 * Math.PI * 2, lx = Math.cos(an), lz = Math.sin(an), h = 0.28 + (k % 3) * 0.08, w = 0.025;   // a clump of thin blades, leaning out
      bl.push(-lz * w, 0, lx * w, lz * w, 0, -lx * w, lx * h * 0.45, h, lz * h * 0.45); }
    const tuft = new THREE.BufferGeometry(); tuft.setAttribute('position', new THREE.Float32BufferAttribute(bl, 3)); tuft.computeVertexNormals();
    const n = 260, tm = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: 0x6a8a3a, roughness: 0.9, side: THREE.DoubleSide }), n), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler();
    for (let i = 0; i < n; i++) { let x, z; do { x = G.x0 - 1 + Math.random() * (G.x1 - G.x0 + 1); z = G.z0 + Math.random() * (G.z1 - G.z0 + 2); } while (Math.hypot(x - fire.x, z - fire.z) < 2.6 || (x > -89 && z < 47));
      e4.set((Math.random() - 0.5) * 0.4, Math.random() * 3, (Math.random() - 0.5) * 0.4); const sc = 0.6 + Math.random() * 0.9; tm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, GY - 0.05, z), q4.setFromEuler(e4), new THREE.Vector3(sc, sc * (0.7 + Math.random() * 0.6), sc))); }
    g.add(tm); }
  // the flames: soft glowing tongues (a painted flame on three crossed cards, added onto what's behind like real fire
  // light), a tall outer one and a hot inner core, each flickering at its own pace
  const flameTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d');
    for (let i = 0; i < 16; i++) { const t = i / 15, y = 114 - t * 100, r = 27 * (1 - t * 0.8), gr = c.createRadialGradient(32, y, 0, 32, y, r);
      gr.addColorStop(0, `rgba(255,236,170,${0.55 * (1 - t * 0.6)})`); gr.addColorStop(0.45, `rgba(255,140,40,${0.3 * (1 - t * 0.7)})`); gr.addColorStop(1, 'rgba(255,70,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 128); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const flameCards = (w, h, op) => { const grp = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    for (let k = 0; k < 3; k++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm); q.position.y = h / 2; q.rotation.y = k * Math.PI / 3; grp.add(q); } grp.position.set(fire.x, GY + 0.12, fire.z); g.add(grp); return grp; };
  const flame = flameCards(0.9, 1.05, 0.9), flame2 = flameCards(0.5, 0.6, 1);

  // ---- evening lights: festoon bulbs on sagging cables between bamboo poles at the balcony corners and back to the
  // eaves, a ring of them under the banyan's canopy, and paper lanterns on the tree deck rail. Each glows with a soft
  // halo. All the bulbs are one instanced mesh, the halos one cloud of sprites, the cables one set of lines
  const haloTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,226,170,1)'); gr.addColorStop(0.22, 'rgba(255,184,96,.55)'); gr.addColorStop(0.55, 'rgba(255,150,60,.12)'); gr.addColorStop(1, 'rgba(255,140,50,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const haloMat = (size, opacity) => new THREE.PointsMaterial({ map: haloTex, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const bulbP = [], cableP = [];
  const strand = (a, b, sag, n) => { let prev = null; for (let k = 0; k <= n; k++) { const t = k / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    if (prev) cableP.push(...prev, ...p); prev = p; if (k > 0 && k < n) bulbP.push([p[0], p[1] - 0.06, p[2]]); } };
  const pole = (x, z, h) => { cyl(0.04, 0.055, h, [0.66, 0.54, 0.3], x, Y + h / 2, z, 6); for (let y = 0.5; y < h; y += 0.55) cyl(0.058, 0.058, 0.04, [0.5, 0.4, 0.2], x, Y + y, z, 6); return [x, Y + h - 0.06, z]; };   // (bamboo, with its joints)
  { const P1 = pole(B.x0 + 0.12, B.z0 + 0.12, 2.8), P2 = pole(B.x1 - 0.12, B.z0 + 0.12, 2.8), P3 = pole(B.x1 - 0.12, PL.z1 + 0.25, 2.8), P4 = pole(B.x1 - 0.12, LZ - 0.12, 2.8);
    strand(P1, P2, 0.5, 26); strand(P2, P3, 0.45, 18); strand(P3, P4, 0.3, 10);
    strand(P1, [V.x0 + 0.1, Y + H - 0.15, V.z0 - 0.1], 0.2, 5); strand(P2, [V.x1 + 0.1, Y + H - 0.15, V.z0 - 0.1], 0.25, 7); strand(P3, [V.x1 + 0.1, Y + H - 0.15, PL.z1 + 0.25], 0.2, 5);
    // under the canopy: a festoon ring on the limbs, and four drops from the trunk
    const NR = 12, ring = []; for (let k = 0; k < NR; k++) { const an = k / NR * Math.PI * 2 + 0.2; ring.push([TX + Math.cos(an) * (RD + 0.3), Y + DH + 2.6 + 0.3 * Math.sin(k * 1.7), TZ + Math.sin(an) * (RD + 0.3)]); }
    for (let k = 0; k < NR; k++) strand(ring[k], ring[(k + 1) % NR], 0.35, 5);
    for (let k = 0; k < NR; k += 3) strand([TX, Y + DH + 3.1, TZ], ring[k], 0.3, 5); }
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), glow, bulbP.length); { const m4 = new THREE.Matrix4(); bulbP.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p[0], p[1], p[2]))); } g.add(bulbs);
  { const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(bulbP.flat(), 3)); g.add(new THREE.Points(hg, haloMat(0.7, 0.75))); }
  { const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cableP, 3)); g.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x1d1611 }))); }
  // paper lanterns hung from the tree deck rail: warm orange, capped in rattan, each on its own string, swaying
  const lanterns = [], lanternMat = new THREE.MeshBasicMaterial({ color: 0xff9a4a, toneMapped: false }), capMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 });
  { const body = new THREE.SphereGeometry(0.16, 12, 8); body.scale(1, 1.25, 1); const cap = new THREE.CylinderGeometry(0.07, 0.09, 0.05, 10), str = new THREE.CylinderGeometry(0.005, 0.005, 0.28, 3);
    const hp = [];
    for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + 0.35, x = TX + Math.cos(an) * (RD - 0.06), z = TZ + Math.sin(an) * (RD - 0.06), hook = new THREE.Group(); hook.position.set(x, Y + DH + 1.02, z); g.add(hook);
      const s1 = new THREE.Mesh(str, capMat); s1.position.y = -0.14; hook.add(s1);
      const b1 = new THREE.Mesh(body, lanternMat); b1.position.y = -0.47; hook.add(b1);
      const c1 = new THREE.Mesh(cap, capMat); c1.position.y = -0.27; hook.add(c1); const c2 = new THREE.Mesh(cap, capMat); c2.position.y = -0.67; hook.add(c2);
      lanterns.push({ hook, ph: k * 1.9 }); hp.push(x, Y + DH + 0.55, z); }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); g.add(new THREE.Points(hg, haloMat(1.5, 0.6))); }

  // ---- the infinity pool: a long teak-and-stone basin cantilevered off the east balcony on raking brackets, its outer
  // edge a knife-edge weir, so from the loungers the water runs straight into the sea and the break beyond it
  { const STONE = [0.33, 0.31, 0.29], TILE = [0.42, 0.72, 0.74], d = 1.2, wx = PL.x1 - PL.x0, wz = PL.z1 - PL.z0, cx = (PL.x0 + PL.x1) / 2, cz = (PL.z0 + PL.z1) / 2;
    box(wx + 0.3, 0.14, wz + 0.3, STONE, cx, Y - d - 0.07, cz);                                         // floor
    box(wx, 0.02, wz, TILE, cx, Y - d + 0.01, cz, 0.08);                                                  // (tiled)
    for (const zz of [PL.z0 - 0.08, PL.z1 + 0.08]) { box(wx + 0.3, d + 0.12, 0.16, STONE, cx, Y - d / 2 + 0.03, zz); box(wx + 0.3, 0.06, 0.34, [0.5, 0.36, 0.2], cx, Y + 0.12, zz); }   // end walls, teak coping
    box(0.16, d, wz, STONE, PL.x1 + 0.08, Y - d / 2 - 0.06, cz);                                        // the weir wall (just under the water: the edge you can't see)
    box(0.4, 0.14, wz + 0.3, STONE, PL.x1 + 0.35, Y - 0.62, cz); box(0.12, 0.3, wz + 0.3, STONE, PL.x1 + 0.5, Y - 0.56, cz);   // the catch gutter, low enough under the edge that from the deck the water runs straight into the sea
    box(0.36, 0.12, wz, [0.5, 0.36, 0.2], PL.x0 + 0.02, Y + 0.02, cz);                                  // teak coping along the balcony side
    for (let k = 0; k < 4; k++) { const z = PL.z0 + 0.8 + k * (wz - 1.6) / 3; beam(PL.x1, Y - d - 0.1, z, PL.x0 - 2.6, Y - d - 3.6, z, 0.12); }   // brackets back into the rock
    // the water: the same water as the sea (sky in it, ripples, the sun's sparkle), in the pool's clear turquoise
    const wm = waterMaterial(); wm.uniforms.uDeep = { value: new THREE.Color(0.1, 0.46, 0.52) }; wm.uniforms.uTurq = { value: new THREE.Color(0.3, 0.8, 0.8) }; wm.uniforms.uReef = { value: 0 };
    const wg = new THREE.PlaneGeometry(wx + 0.12, wz); wg.rotateX(-Math.PI / 2); const w = new THREE.Mesh(wg, wm); w.position.set(cx + 0.06, Y - 0.04, cz); g.add(w); root.userData.pool = w; }

  // ---- the fire's sparks, and fireflies over the garden: points of light, coloured as they fade
  const sparkN = 36, sparkP = new Float32Array(sparkN * 3), sparkC = new Float32Array(sparkN * 3), sparkV = new Float32Array(sparkN * 3), sparkL = new Float32Array(sparkN);
  const sparks = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: haloTex, size: 0.14, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sparks.geometry.setAttribute('position', new THREE.BufferAttribute(sparkP, 3)); sparks.geometry.setAttribute('color', new THREE.BufferAttribute(sparkC, 3)); sparks.frustumCulled = false; g.add(sparks);
  const flyN = 22, flyP = new Float32Array(flyN * 3), flyC = new Float32Array(flyN * 3), fly = [];
  const flies = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: haloTex, size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  flies.geometry.setAttribute('position', new THREE.BufferAttribute(flyP, 3)); flies.geometry.setAttribute('color', new THREE.BufferAttribute(flyC, 3)); flies.frustumCulled = false; g.add(flies);
  for (let i = 0; i < flyN; i++) fly.push({ x: G.x0 + 1 + Math.random() * (G.x1 - G.x0 - 2), z: G.z0 + Math.random() * (G.z1 - G.z0), y: GY + 0.4 + Math.random() * 1.6, a: Math.random() * 6.3, ph: Math.random() * 20, sp: 0.25 + Math.random() * 0.3 });

  // ---- the house dog: a lean ginger Sumba village dog who lives in the garden. Trots about, sits, lies down by the
  // fire, and comes over to see you (tail going) when you're near
  const dog = (() => {
    const GING = [0.7, 0.45, 0.24], PALE = [0.9, 0.8, 0.64], DARK = [0.22, 0.15, 0.1];
    const root2 = new THREE.Group(); g.add(root2); const body = new THREE.Group(); body.position.y = 0.42; root2.add(body);
    const part = (geo, c, par, x, y, z) => { const m = new THREE.Mesh(tint(geo, c, 0.08), mat); m.position.set(x, y, z); par.add(m); return m; };
    const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
    part(cap(0.1, 0.36).rotateX(Math.PI / 2).scale(1, 1.12, 1), GING, body, 0, 0, 0);                     // lean body, deep chest
    part(cap(0.085, 0.14).rotateX(Math.PI / 2).scale(0.95, 1, 1), PALE, body, 0, -0.035, 0.13);            // (pale chest and belly)
    part(new THREE.SphereGeometry(0.09, 10, 8).scale(1, 0.95, 1.1), GING, body, 0, 0.01, -0.2);             // haunch
    const head = new THREE.Group(); head.position.set(0, 0.12, 0.27); body.add(head);
    part(cap(0.055, 0.12).rotateX(0.9), GING, head, 0, 0.0, 0.0);                                           // neck
    part(new THREE.SphereGeometry(0.075, 12, 10).scale(1, 0.92, 1.05), GING, head, 0, 0.1, 0.07);          // skull
    part(new THREE.CylinderGeometry(0.03, 0.05, 0.12, 10).rotateX(Math.PI / 2), PALE, head, 0, 0.075, 0.16);   // muzzle, tapering
    part(new THREE.SphereGeometry(0.018, 8, 6), DARK, head, 0, 0.085, 0.225);                               // nose
    for (const sx of [-1, 1]) { const e = part(new THREE.ConeGeometry(0.035, 0.09, 6), GING, head, sx * 0.045, 0.18, 0.05); e.rotation.set(-0.15, 0, -sx * 0.3); part(new THREE.SphereGeometry(0.011, 6, 4), DARK, head, sx * 0.03, 0.12, 0.135); }   // ears up, eyes
    const legs = []; for (const [x, z] of [[-0.065, 0.17], [0.065, 0.17], [-0.065, -0.2], [0.065, -0.2]]) { const hip = new THREE.Group(); hip.position.set(x, -0.04, z); body.add(hip);
      part(cap(0.03, 0.26), GING, hip, 0, -0.17, 0); part(new THREE.SphereGeometry(0.03, 6, 4).scale(1, 0.6, 1.4), PALE, hip, 0, -0.34, 0.015); legs.push(hip); }   // (white socks)
    // the tail: curled up over the back, the way Sumba's village dogs carry it
    const tail = new THREE.Group(); tail.position.set(0, 0.06, -0.3); body.add(tail);
    part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.1, -0.05), new THREE.Vector3(0, 0.18, 0.02), new THREE.Vector3(0.02, 0.17, 0.1)]), 10, 0.022, 6), GING, tail, 0, 0, 0);
    return { root: root2, body, head, legs, tail, x: -91, z: 51.8, hd: 0, st: 'walk', t: 0, tx: -95, tz: 47, gait: 0, cool: 0 };
  })();
  const dogOK = (x, z) => x > G.x0 + 0.8 && x < G.x1 - 0.6 && z > G.z0 + 0.5 && z < G.z1 - 0.5 && Math.hypot(x - fire.x, z - fire.z) > 2.9 && !(x < -100.6 && z > 46.3 && z < 52.3) && !(x > -89 && z < 47);
  const dogPick = () => { if (Math.random() < 0.35) { const an = Math.random() * 6.3; return [fire.x + Math.cos(an) * 3.2, fire.z + Math.sin(an) * 3.2]; }   // (a warm spot by the fire)
    for (let k = 0; k < 20; k++) { const x = G.x0 + 1 + Math.random() * (G.x1 - G.x0 - 2), z = G.z0 + 0.6 + Math.random() * (G.z1 - G.z0 - 1.2); if (dogOK(x, z)) return [x, z]; } return [-94, 51.5]; };
  let fT = 0;
  function tick(dt, beat = 0, wx, wz, wfoot) {
    fT += dt; swayT.value = fT;
    for (const L of lanterns) { L.hook.rotation.z = 0.08 * Math.sin(fT * 1.1 + L.ph) + 0.03 * Math.sin(fT * 2.7 + L.ph); L.hook.rotation.x = 0.06 * Math.sin(fT * 0.9 + L.ph * 1.3); }
    // sparks: born in the flames, rising on the heat, drifting, fading from yellow to red
    for (let i = 0; i < sparkN; i++) { const j = i * 3; sparkL[i] -= dt;
      if (sparkL[i] <= 0) { if (Math.random() > 0.05) { sparkC[j] = sparkC[j + 1] = sparkC[j + 2] = 0; continue; }
        sparkL[i] = 0.7 + Math.random() * 1.5; sparkP[j] = fire.x + (Math.random() - 0.5) * 0.4; sparkP[j + 1] = GY + 0.45; sparkP[j + 2] = fire.z + (Math.random() - 0.5) * 0.4;
        sparkV[j] = (Math.random() - 0.5) * 0.5; sparkV[j + 1] = 1.1 + Math.random() * 1.8; sparkV[j + 2] = (Math.random() - 0.5) * 0.5; }
      sparkV[j] += Math.sin(fT * 3 + i) * 0.8 * dt; sparkV[j + 2] += Math.cos(fT * 2.3 + i) * 0.8 * dt; sparkV[j + 1] -= 0.4 * dt;
      sparkP[j] += sparkV[j] * dt; sparkP[j + 1] += sparkV[j + 1] * dt; sparkP[j + 2] += sparkV[j + 2] * dt;
      const k = Math.min(1, sparkL[i] * 1.5) * (0.7 + 0.3 * Math.sin(fT * 30 + i)); sparkC[j] = k; sparkC[j + 1] = 0.35 + 0.3 * k * k; sparkC[j + 1] *= k; sparkC[j + 2] = 0.12 * k; }
    sparks.geometry.attributes.position.needsUpdate = true; sparks.geometry.attributes.color.needsUpdate = true;
    // fireflies: drifting lazily over the grass, each glowing and going dark on its own slow beat
    fly.forEach((f, i) => { const j = i * 3; f.a += Math.sin(fT * 0.7 + f.ph) * 1.4 * dt; let nx = f.x + Math.cos(f.a) * f.sp * dt, nz = f.z + Math.sin(f.a) * f.sp * dt;
      if (nx < G.x0 + 0.5 || nx > G.x1 - 0.5 || nz < G.z0 || nz > G.z1) { f.a += Math.PI; nx = f.x; nz = f.z; } f.x = nx; f.z = nz; f.y = Math.min(GY + 2.2, Math.max(GY + 0.3, f.y + Math.sin(fT * 1.3 + f.ph) * 0.25 * dt));
      flyP[j] = f.x; flyP[j + 1] = f.y; flyP[j + 2] = f.z; let b = Math.max(0, Math.sin(fT * 1.6 + f.ph)); b = b * b * b; flyC[j] = 0.75 * b; flyC[j + 1] = b; flyC[j + 2] = 0.3 * b; });
    flies.geometry.attributes.position.needsUpdate = true; flies.geometry.attributes.color.needsUpdate = true;
    dogTick(dt, wx, wz, wfoot);
    for (const w of woofers) { w.position.z = w.userData.z0 + beat * 0.02; }   // (the cones pump with the bass)
    const fl = 1 + 0.16 * Math.sin(fT * 13) + 0.09 * Math.sin(fT * 23 + 1) + 0.05 * Math.sin(fT * 41); flame.scale.set(1 + 0.06 * Math.sin(fT * 17), fl, 1); flame2.scale.set(1, 2.05 - fl, 1); flame.rotation.y = fT * 0.7; flame2.rotation.y = -fT * 1.1;
    const ch = root.userData.chime; if (ch) { ch.rotation.z = 0.06 * Math.sin(fT * 1.7) + 0.03 * Math.sin(fT * 4.1); ch.rotation.x = 0.05 * Math.sin(fT * 1.3 + 1); }
  }

  // the dog's day: walk somewhere, sit or lie down a while (often by the fire), and trot over to you when you come near
  function dogTick(dt, wx, wz, wfoot) {
    const d = dog; d.t -= dt; let px = null, pz = null;
    if (wx !== undefined && wfoot < Y + 0.5) { const [lx, lz] = toL(wx, wz); if (Math.hypot(lx - d.x, lz - d.z) < 6 && lx < G.x1 + 3.5 && lz > G.z0 - 3) { px = lx; pz = lz; } }   // (you, on the ground nearby)
    if (px !== null && d.st !== 'come' && d.st !== 'greet' && d.cool <= 0) { d.st = 'come'; }
    d.cool = (d.cool || 0) - dt;
    let speed = 0;
    if (d.st === 'come') { if (px === null) { d.st = 'walk'; } else { const dx = px - d.x, dz = pz - d.z, dd = Math.hypot(dx, dz); d.tx = px - dx / dd * 0.9; d.tz = pz - dz / dd * 0.9; speed = 1.9; if (dd < 1.3) { d.st = 'greet'; d.t = 5 + Math.random() * 3; } } }
    else if (d.st === 'walk') speed = 1.1;
    else if (d.t <= 0) { if (d.st === 'greet') d.cool = 15; d.st = 'walk'; [d.tx, d.tz] = dogPick(); }
    if (d.st === 'greet' && px !== null) { const a = Math.atan2(px - d.x, pz - d.z); d.hd += Math.atan2(Math.sin(a - d.hd), Math.cos(a - d.hd)) * Math.min(1, dt * 3); }   // (sitting there looking up at you)
    if (speed > 0) { const dx = d.tx - d.x, dz = d.tz - d.z, dd = Math.hypot(dx, dz);
      if (dd < 0.3 && d.st === 'walk') { const byFire = Math.hypot(d.x - fire.x, d.z - fire.z) < 3.6; d.st = byFire || Math.random() < 0.3 ? 'lie' : 'sit'; d.t = d.st === 'lie' ? 10 + Math.random() * 14 : 4 + Math.random() * 6; speed = 0; }
      else { const want = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(want - d.hd), Math.cos(want - d.hd)); d.hd += Math.max(-3.5 * dt, Math.min(3.5 * dt, turn)); if (Math.abs(turn) > 1.2) speed *= 0.4;
        // (something in the way, the fire or the hammock: go round it, trying a little to either side, then more)
        let hd = d.hd; const free = !dogOK(d.x, d.z);   // (and never stuck: from anywhere it shouldn't be, it can always walk out)
        for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) { const h2 = d.hd + off; if (free || dogOK(d.x + Math.sin(h2) * 0.4, d.z + Math.cos(h2) * 0.4)) { hd = h2; break; } }
        const nx = d.x + Math.sin(hd) * speed * dt, nz = d.z + Math.cos(hd) * speed * dt;
        if (free || dogOK(nx, nz)) { d.x = nx; d.z = nz; d.hd += (hd - d.hd) * Math.min(1, dt * 6); } else if (d.st === 'walk') [d.tx, d.tz] = dogPick(); } }
    // the pose
    const sit = d.st === 'sit' || d.st === 'greet', lie = d.st === 'lie', k = Math.min(1, dt * 5);
    d.gait += speed * dt * 8.5; d.pose = (d.pose || 0) + ((lie ? 2 : sit ? 1 : 0) - (d.pose || 0)) * k;
    const sitK = Math.max(0, 1 - Math.abs(d.pose - 1)), lieK = Math.max(0, d.pose - 1), swing = speed > 0 ? Math.min(0.7, speed * 0.4) : 0;
    d.body.position.y = 0.42 - 0.06 * sitK - 0.26 * lieK; d.body.rotation.x = -0.42 * sitK;
    d.legs.forEach((L, i) => { const front = i < 2, ph = (i === 0 || i === 3) ? 0 : Math.PI; L.rotation.x = Math.sin(d.gait + ph) * swing + (front ? 0.42 * sitK : -1.25 * sitK) + (front ? -1.45 : -1.35) * lieK; L.rotation.z = front ? 0 : (i === 2 ? -0.5 : 0.5) * lieK; });   // (lying like a sphinx: front paws out, back legs tucked under to the side)
    let look = 0; if (px !== null) { const a = Math.atan2(px - d.x, pz - d.z); look = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(a - d.hd), Math.cos(a - d.hd)))); }
    d.head.rotation.y += (look - d.head.rotation.y) * k; d.head.rotation.x = 0.25 * lieK + 0.2 * sitK;
    const wagF = d.st === 'greet' || d.st === 'come' ? 16 : lie ? 3 : 7, wagA = d.st === 'greet' || d.st === 'come' ? 0.6 : lie ? 0.15 : 0.3;
    d.tail.rotation.z = Math.sin(fT * wagF) * wagA; d.tail.rotation.x = -0.9 * lieK + 0.4 * sitK;
    d.root.position.set(d.x, GY, d.z); d.root.rotation.y = d.hd;
  }

  // join everything that doesn't move into one mesh per material (a phone draws each in one go instead of hundreds of
  // little pieces): the timber, the furniture, the speakers' cabinets, lamps, tub... Not the moving parts (speaker cones,
  // the fire, the boards you pick from the rack) and not anything drawn mirrored, which would turn inside out merged
  { g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), rel = new THREE.Matrix4();
    const keep = new Set([...woofers]); flame.traverse((o) => keep.add(o)); flame2.traverse((o) => keep.add(o)); for (const b of rack) b.traverse((o) => keep.add(o)); for (const L of lanterns) L.hook.traverse((o) => keep.add(o)); dog.root.traverse((o) => keep.add(o));
    const byMat = new Map(); g.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || keep.has(o)) return; rel.multiplyMatrices(inv, o.matrixWorld); if (rel.determinant() < 0) return;
      if (!byMat.has(o.material)) byMat.set(o.material, []); byMat.get(o.material).push(o); });
    for (const [M, parts] of byMat) { if (parts.length < 2) continue;
      const want = ['position', 'normal', ...(M.vertexColors || parts.every((o) => o.geometry.attributes.color) ? ['color'] : []), ...(M.map ? ['uv'] : [])], ok = [], geos = [];   // (colours kept for the land's own shader too: dropped, the garden came out white)
      for (const o of parts) { let q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); if (!q.attributes.normal) q.computeVertexNormals();
        if (!want.every((k) => q.attributes[k])) continue; for (const k of Object.keys(q.attributes)) if (!want.includes(k)) q.deleteAttribute(k);
        rel.multiplyMatrices(inv, o.matrixWorld); q.applyMatrix4(rel); geos.push(q); ok.push(o); }
      if (ok.length < 2) continue; const merged = mergeGeometries(geos); if (!merged) continue;
      for (const o of ok) { o.parent.remove(o); o.geometry.dispose(); } g.add(new THREE.Mesh(merged, M)); } }

  // walking: which surface is under you (the house and balcony floor, a stair tread, or the tree deck), and where you
  // can't go. Both know how high your feet are now, since the stair winds over itself and the deck is over the stair
  const polar = (x, z) => [Math.hypot(x - TX, z - TZ), Math.atan2(z - TZ, x - TX)];
  const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d));
  const stairAt = (an, foot) => { let best = null; for (let k = -1; k <= 2; k++) { const ph = an - A0 + 2 * Math.PI * k; if (ph < 0 || ph > TURN) continue;
    const h = Y + ph / TURN * DH; if (best === null || Math.abs(h - foot) < Math.abs(best - foot)) best = h; } return best; };
  const inRect = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const floorL = (x, z, foot) => {
    const [r, an] = polar(x, z);
    if (foot > Y + DH - 0.7 && r >= R1 - 0.1 && r < RD + 0.3) return Y + DH;   // (on the deck, the deck: never the stair below its edge)
    if (r < R1 + 0.4) { const h = stairAt(an, foot); if (h !== null && Math.abs(h - foot) < 0.6) return h; }
    if (foot > Y + DH - 0.7 && r < RD + 0.3) return Y + DH;
    if (inRect(x, z, G.x0, G.x1 + 0.3, G.z0 - 0.2, G.z1) && !inRect(x, z, V.x1, B.x1, V.z1, LZ)) return GY;   // (the grass)
    return Y; };
  const solidL = (x, z, foot) => {
    const [r, an] = polar(x, z);
    if (r < R0 + 0.2) return true;                                                     // the trunk
    if (foot < Y + 0.3) {                                                              // down on the floor
      if (r < R1 + 0.1) { const d = wrap(an - A0); return !(d > -0.9 && d < 0.9); }   // (only the foot of the stair, from either side; the rest is under it)
      if (r < R1 + 0.8 && Math.abs(wrap(an - A0)) < 0.9 && x >= V.x1 - 0.2 && x <= B.x1 - 0.35) return false;   // (the landing runs right up to the first step)
      return !(inRect(x, z, B.x0 + 0.35, B.x1 - 0.35, B.z0 + 0.35, V.z1) || inRect(x, z, V.x1 - 0.2, B.x1 - 0.35, V.z1 - 1, LZ - 0.3) || inRect(x, z, G.x0 + 0.3, G.x1 + 0.3, V.z1 + 0.4, G.z1 - 0.3)); }
    if (foot > Y + DH - 0.4) {                                                         // up on the deck
      if (r > RD - 0.35) return true;
      if (inRect(x, z, TX + 2.55, TX + 3.25, TZ - 1.2, TZ + 0.6) || inRect(x, z, TX - 1.2, TX + 0.6, TZ - 3.25, TZ - 2.55) || inRect(x, z, TX - 2.85, TX - 2.25, TZ + 1.6, TZ + 2.2)) return true;   // (the benches, the speaker)
      if (r < R1 - 0.05) { const d = wrap(an - AE_); return !(d > -0.7 && d < 0.15); }  // (the stairwell, except where the stair arrives)
      return false; }
    return r > R1 + 0.15;                                                              // on the stair: stay on the treads (fixL eases you in off the edge)
  };
  const AE_ = A0 + TURN;
  // the round edges (trunk, stair, deck rim, stairwell) push you back along the radius, so you glide round them
  // instead of catching on them
  const fixL = (x, z, foot) => {   // (only smooth radial limits here: the angular ones are walls in solidL, never a jump)
    const dx = x - TX, dz = z - TZ, r = Math.hypot(dx, dz) || 1e-6; let rr = Math.max(r, R0 + 0.25);
    if (foot > Y + DH - 0.4) rr = Math.min(rr, RD - 0.36);
    else if (foot > Y + 0.9) rr = Math.min(rr, R1 - 0.16);                               // (on the stair: the rail holds you)
    else if (foot > Y + 0.3) rr = Math.min(rr, Math.max(R1 - 0.16, r - 0.1));    // (eased in, stepping up off the wide foot of the stair)
    return rr === r ? null : [TX + dx / r * rr, TZ + dz / r * rr]; };
  // (the game walks you around in the coast frame; the point is mirrored east-west into place, see OX)
  const toL = (x, z) => [OX - x, z - OZ];
  const floorAt = (x, z, foot = Y) => { const [lx, lz] = toL(x, z); return floorL(lx, lz, foot); };
  const solid = (x, z, foot = Y) => { const [lx, lz] = toL(x, z); return solidL(lx, lz, foot); };
  const fix = (x, z, foot = Y) => { const [lx, lz] = toL(x, z), f = fixL(lx, lz, foot); return f ? [OX - f[0], f[1] + OZ] : null; };
  for (const c of colliders) { const x0 = c[0], x1 = c[1]; c[0] = OX - x1; c[1] = OX - x0; c[2] += OZ; c[3] += OZ; }
  const walk = { x0: OX - Math.max(B.x1, TX + RD), x1: OX - G.x0, z0: B.z0 + OZ, z1: Math.max(TZ + RD, G.z1) + OZ };
  // places to sit (or lie), each with the view it frames: [x, z, eye height, look direction, look pitch, what it is]
  const seatL = [
    [-84.7, 34.4, Y + 0.95, 0.35, -0.08, 'LIE BACK'], [-84.7, 39.6, Y + 0.95, -0.2, -0.08, 'LIE BACK'], [-88.1, 32.3, Y + 1.15, -0.3, -0.06, 'SIT'],
    [-90.2, 41.5, Y + 1.1, -Math.PI / 2 + 0.25, -0.05, 'SIT'], [tub.x, tub.z, Y + 1.38, -0.55, -0.08, 'SOAK'],
    [TX + 2.5, TZ - 0.3, Y + DH + 1.4, 0, -0.3, 'SIT'], [TX - 0.3, TZ - 2.5, Y + DH + 1.4, -Math.PI / 2 + 0.3, -0.3, 'SIT'],   // (perched up on the bench back, looking down over the rail at the break)
    [-101.6, 49.3, GY + 1.25, -Math.PI / 2, 0.25, 'LIE IN HAMMOCK'], [PL.x0 + 1.3, 34.5, Y + 0.28, 0.05, -0.02, 'SWIM'],   // (in the pool, arms on the edge, the break right there over the water)
    ...[0.5, 2.2, 3.9].map((an) => [fire.x + Math.cos(an) * 2.1, fire.z + Math.sin(an) * 2.1, GY + 1.0, an + Math.PI, -0.25, 'SIT BY THE FIRE'])];
  const seats = seatL.map(([x, z, eye, a, pitch, name]) => ({ x: OX - x, z: z + OZ, eye, yaw: Math.PI - a, pitch, name }));
  for (const [x, z, y] of speakersL) seats.push({ x: OX - x, z: z + OZ, eye: y + 1.1, radio: true, name: 'MUSIC' });
  const sounds = { speakers: speakersL.map(([x, z, y]) => [OX - x, z + OZ, y + 0.3]), fire: [OX - fire.x, fire.z + OZ, GY], chime: [OX + 85, 28.8 + OZ, Y + 2.2], tub: [OX - tub.x, tub.z + OZ, Y] };
  { const ch = new THREE.Group(); ch.position.set(-85, Y + 2.62, 28.8); g.add(ch);   // bamboo wind chimes under the eave, swaying
    const bm = new THREE.MeshStandardMaterial({ color: 0xb89a62, roughness: 0.6 }); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), bm); ch.add(top);
    for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2, L = 0.28 + (k % 3) * 0.1, c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 6), bm); c.position.set(Math.cos(an) * 0.12, -0.12 - L / 2, Math.sin(an) * 0.12); ch.add(c); }
    root.userData.chime = ch; }
  return { group: root, rack, colliders, walk, floorAt, solid, fix, tick, seats, sounds, setSong, dog, spawn: { x: OX + 91, z: 37.5 + OZ, yaw: Math.PI + 0.2 }, rackAt: { x: OX - (V.x0 + 0.6), z: 37 + OZ } };
}
