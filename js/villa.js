// Your villa: a small wooden cliff house out on the rocky point at Tanjung Uma, right beside the takeoff, so from its
// balcony you look straight down the line of the waves and watch every ride. Inside it's all warm timber: plank walls,
// wide floorboards, a pitched boarded ceiling on dark beams. A living room with glass on the two sea sides opens onto
// a wraparound balcony; through a doorway, the board room, with your four boards standing in a rack on the wall.
// Built in the coast's own frame (same as coast() in wave.js), so it sits right once the group is moved back by the
// spot's dz. The waves break at x 0 (coast z about -60) and peel off toward +x; the point is just up the reef from them.
import * as THREE from 'three';
import { makeBoard } from './board.js?v=10';
import { landMaterial } from './wave.js?v=95';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const VILLA = { x0: -100, x1: -86, z0: 30, z1: 44, Y: 26 };   // the house and its floor height (in the point's own frame, below)
// where the point is: the whole house and point are drawn around (-93, 37) and moved by this much, which puts the
// balcony about 75 m from the takeoff and 50-100 m from the rides, as close as it can be without the broken wave's
// whitewater (up to ~60 m behind the peak) ever reaching the rock
const OX = 33, OZ = -25;

export function villa(scene) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const g = new THREE.Group(); g.position.set(OX, 0, OZ); root.add(g);
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

  // ---- the rocky point: a long finger of limestone running out from the cliffs, scrub on top, sheer sides into the sea
  {
    const cliffTop = (xl) => { const x = xl + OX; return (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35)); };   // (the coast's own cliff height, before its fade)
    const cx = (z) => { const k = Math.min(1, Math.max(0, (z - 70) / 150)); return -93 + 4 * Math.sin((z - 37) * 0.03) - 32 * k * k * (3 - 2 * k); }, hw = (z) => 13.5 + 12 * Math.min(1, Math.max(0, (z - 60) / 120)), tipZ = 37;   // (the ridge curves back west into the cliffs)
    const top = (x, z) => { const k = Math.min(1, Math.max(0, (z - 55) / 160)), s = k * k * (3 - 2 * k), far = cliffTop(x) + 1;
      return (Y - 0.25) * (1 - s) + Math.max(3, far) * s + (z > 55 ? Math.sin(x * 0.3) * Math.cos(z * 0.2) * 0.6 : 0); };
    const geo = new THREE.PlaneGeometry(120, 260, 120, 200); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - 104, z = p.getZ(i) + 135, a = Math.atan2(z - tipZ, x - cx(z));
      const w = hw(z) * (1 + 0.14 * Math.sin(z * 0.09 + 2) + 0.08 * Math.sin(z * 0.23 + 1) + 0.05 * Math.sin(z * 0.71) + 0.07 * Math.sin(a * 5) + 0.04 * Math.sin(a * 13)), dx = Math.abs(x - cx(z)) / w, dz = Math.max(0, tipZ - z) / w;
      const d = Math.hypot(dx, dz), t = top(x, z);
      let y, col, X = x, Z = z;
      if (d < 0.78) { y = t; col = d < 0.7 ? [0.16, 0.27, 0.11] : [0.4, 0.37, 0.28]; }
      else { const f = Math.min(1, (d - 0.78) / 0.22); y = t - (t + 4) * Math.pow(f, 0.6);
        // a rugged face: rock strata stepping in and out with height, buttresses and gullies along it
        const out = 1.4 * Math.sin(y * 0.55 + z * 0.13) + 0.7 * Math.sin(y * 1.6 - z * 0.4 + x * 0.3) + 1.1 * Math.sin(z * 0.37 + a * 3) * (y / Math.max(t, 1));
        const nx = x - cx(z), nz = Math.min(0, z - tipZ), nl = Math.hypot(nx, nz) || 1; X = x + nx / nl * out * Math.min(1, f * 4); Z = z + nz / nl * out * Math.min(1, f * 4);
        const band = 0.8 + 0.2 * Math.sin(y * 2.1 + Math.sin(z * 0.2)), streak = 0.88 + 0.12 * Math.sin(x * 1.7 + z * 0.9), wet = y < 1.5 ? 0.45 : 1, moss = Math.sin(y * 0.55 + z * 0.13) > 0.8 && y > 4 ? 1 : 0;
        const k2 = band * streak * wet; col = moss ? [0.22 * k2, 0.3 * k2, 0.15 * k2] : [0.76 * k2, 0.69 * k2, 0.55 * k2]; }
      if (d > 1) y = -5;
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

  // the roof: ridge running east-west, a boarded ceiling on dark rafters inside, shingles outside, deep eaves
  const roofD = V.z1 - V.z0 + 2.4, slope = Math.atan2(RIDGE - H, roofD / 2), rl = Math.hypot(RIDGE - H, roofD / 2);
  for (const side of [-1, 1]) {
    const zc = zm + side * roofD / 4, yc = Y + (H + RIDGE) / 2;
    box(V.x1 - V.x0 + 2, 0.06, rl, PLANK_L, xm, yc - 0.06, zc, 0.06).rotation.x = side * slope;
    box(V.x1 - V.x0 + 2.4, 0.16, rl + 0.2, [0.26, 0.19, 0.12], xm, yc + 0.12, zc, 0.15).rotation.x = side * slope;
    for (let x = V.x0 + 0.7; x < V.x1; x += 1.3) box(0.12, 0.2, rl, POST, x, yc - 0.19, zc).rotation.x = side * slope;
  }
  box(V.x1 - V.x0 + 2.4, 0.3, 0.3, POST, xm, Y + RIDGE - 0.12, zm);
  for (const x of [V.x0, xL, V.x1]) for (let y = H + 0.1; y < RIDGE; y += 0.22) { const half = (RIDGE - y) / (RIDGE - H) * (V.z1 - V.z0 + 0.2) / 2; if (half > 0.1) box(0.12, 0.235, half * 2, PLANK, x, Y + y, zm, 0.05); }   // gables
  for (let x = V.x0 + 2.3; x < V.x1 - 1; x += 3.5) box(0.2, 0.24, V.z1 - V.z0, POST, x, Y + H + 0.02, zm);   // tie beams

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
  railZ(B.z0, B.x0, B.x1); railX(B.x1, B.z0, B.z1); railX(B.x0, B.z0, V.z0); railZ(B.z1, V.x1, B.x1);
  for (const z of [34.4, 39.6]) { box(1.6, 0.3, 0.8, PLANK_D, -84.8, Y + 0.15, z); box(1.1, 0.12, 0.75, LINEN, -84.6, Y + 0.36, z); const bk = box(0.65, 0.1, 0.75, LINEN, -85.4, Y + 0.58, z); bk.rotation.z = -0.7; block(-85.6, -84.0, z - 0.45, z + 0.45); }   // loungers facing the waves
  box(0.5, 0.4, 0.5, PLANK_L, -85.2, Y + 0.2, 37); block(-85.5, -84.9, 36.7, 37.3);
  box(3, 0.45, 0.45, PLANK_L, -97, Y + 0.23, B.z0 + 0.5); block(-98.5, -95.5, B.z0, B.z0 + 0.8);   // bench along the south rail

  // join the static timber into one mesh (a phone draws it in one go instead of hundreds)
  { const parts = g.children.filter((m) => m.isMesh && m.material === mat);
    const geos = parts.map((m) => { m.updateMatrix(); const q = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(k)) q.deleteAttribute(k); return q; });
    const merged = mergeGeometries(geos);
    if (merged) { for (const m of parts) { g.remove(m); m.geometry.dispose(); } g.add(new THREE.Mesh(merged, mat)); } }

  const floorAt = () => Y;
  // (the game walks you around in the coast frame)
  for (const c of colliders) { c[0] += OX; c[1] += OX; c[2] += OZ; c[3] += OZ; }
  const walk = { x0: B.x0 + 0.35 + OX, x1: B.x1 - 0.35 + OX, z0: B.z0 + 0.35 + OZ, z1: B.z1 - 0.35 + OZ };
  return { group: root, rack, colliders, walk, floorAt, spawn: { x: -91 + OX, z: 37.5 + OZ, yaw: -0.75 }, rackAt: { x: V.x0 + 0.6 + OX, z: 37 + OZ } };
}
