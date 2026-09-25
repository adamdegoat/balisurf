// Life in the water off the villa: a pod of dolphins porpoising across the bay now and then, sea turtles coming up to
// breathe by the rocks under the balcony, and out the back a humpback whale: it blows and rolls, lifts its tail to
// dive, and every few minutes breaches, most of its body out of the water, and comes down in a huge splash.
// Everything is in the world frame (the waves' frame), low-poly and instanced, and only runs while the villa is shown.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt } from './surf.js?v=115';

const clean = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };   // (every piece the same attributes, or they won't merge)
// colour a geometry: dark on top, pale underneath (countershading, like the real animals)
const shade = (g, top, belly, split = 0) => { g.computeVertexNormals(); const n = g.attributes.normal, p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (n.getY(i) - split) * 1.6 + 0.5)), j = 0.94 + Math.random() * 0.12;
    for (let e = 0; e < 3; e++) c[i * 3 + e] = (belly[e] + (top[e] - belly[e]) * k) * j; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };

function dolphinGeo() {   // ~2.3 m, nose along +z
  const body = new THREE.SphereGeometry(1, 14, 8); const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = z < 0 ? 1 + z * 0.72 : 1 - Math.max(0, z - 0.55) * 1.3;   // taper to the tail and the beak
    p.setXYZ(i, x * 0.3 * Math.max(0.12, t), y * 0.3 * Math.max(0.12, t) + (z > 0.7 ? -0.04 : 0), z * 1.15); }
  const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.2, 0.15, 0, 0.2, -0.3, 0, 0.55, -0.35, 0, 0.2, -0.3, 0, 0.2, 0.15, 0, 0.55, -0.35], 3));
  const fl = new THREE.BufferGeometry(); fl.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1.05, -0.45, 0, -1.4, -0.3, 0, -1.2, 0, 0, -1.05, 0.3, 0, -1.2, 0.45, 0, -1.4, 0, 0, -1.05, -0.3, 0, -1.2, -0.45, 0, -1.4, 0, 0, -1.05, 0.45, 0, -1.4, 0.3, 0, -1.2], 3));
  const g = mergeGeometries([clean(body), clean(fin), clean(fl)]); return shade(g, [0.3, 0.33, 0.37], [0.78, 0.8, 0.82]); }

function turtleGeo() {   // ~1 m green turtle
  const shell = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); shell.scale(0.85, 0.38, 1);
  const plast = new THREE.CircleGeometry(0.5, 12); plast.rotateX(Math.PI / 2); plast.scale(0.85, 1, 1);
  const head = new THREE.SphereGeometry(0.13, 8, 6); head.scale(1, 0.85, 1.3); head.translate(0, 0.03, 0.62);
  const fl = []; for (const [x, z, a, s] of [[0.42, 0.25, 0.7, 1], [-0.42, 0.25, -0.7, 1], [0.3, -0.38, 0.9, 0.55], [-0.3, -0.38, -0.9, 0.55]]) { const f = new THREE.BoxGeometry(0.5 * s, 0.03, 0.18 * s); f.rotateY(a); f.translate(x, 0, z); fl.push(clean(f)); }
  const g = mergeGeometries([clean(shell), clean(plast), clean(head), ...fl]); return shade(g, [0.33, 0.28, 0.16], [0.7, 0.65, 0.45]); }

function whaleGeo() {   // a humpback, ~14 m, nose along +z: long white pectoral fins, knobbly head, broad flukes
  const prof = [[0.01, -7], [0.3, -6.4], [0.75, -4.5], [1.35, -2], [1.7, 0.5], [1.75, 2.5], [1.5, 4.5], [1.1, 6.1], [0.5, 6.9], [0.01, 7.1]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 16); body.rotateX(Math.PI / 2); body.scale(1, 0.85, 1);
  { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (y < 0) p.setY(i, y * 1.08 + (z > 3 ? 0.15 : 0)); } }   // (a fuller throat)
  const hump = new THREE.ConeGeometry(0.35, 0.6, 6); hump.translate(0, 1.55, -2.6);
  const pec = (side) => { const f = new THREE.BoxGeometry(0.9, 0.12, 4.6); const p = f.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) * (1 - (z + 2.3) / 4.6 * 0.6)); }
    f.translate(0, 0, -2.3); f.rotateY(-side * 0.6); f.rotateZ(side * 0.3); f.translate(side * 1.45, -0.7, 3.4); return clean(f); };   // (angled out and back from the flanks)
  const fluke = new THREE.BufferGeometry(); fluke.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -6.8, -2.4, 0, -8.2, -1.2, 0, -7.4, 0, 0, -6.8, 1.2, 0, -7.4, 2.4, 0, -8.2, 0, 0, -6.8, -1.2, 0, -7.4, -2.4, 0, -8.2, 0, 0, -6.8, 2.4, 0, -8.2, 1.2, 0, -7.4,
    -2.4, 0, -8.2, 0, 0, -7.7, -1.2, 0, -7.4, 1.2, 0, -7.4, 0, 0, -7.7, 2.4, 0, -8.2, -1.2, 0, -7.4, 0, 0, -7.7, -2.4, 0, -8.2, 2.4, 0, -8.2, 0, 0, -7.7, 1.2, 0, -7.4], 3));
  const g = mergeGeometries([clean(body), clean(hump), pec(1), pec(-1), clean(fluke)]); shade(g, [0.22, 0.23, 0.26], [0.9, 0.9, 0.88], -0.25);
  const c = g.attributes.color, p = g.attributes.position;   // (the pectoral fins are white all over)
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) > 1.8 && p.getZ(i) < 3.6 && p.getZ(i) > -1.5) { c.setXYZ(i, 0.9, 0.9, 0.88); }
  return g; }

// white water: splashes, spray and the whale's blow, as soft round points (two sizes)
function splashes(scene, size, n, mistK) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3).fill(-999), vel = new Float32Array(n * 3), life = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9, color: 0xf4f8fa }));
  pts.frustumCulled = false; scene.add(pts); let k = 0;
  return { pts, emit(x, y, z, vx, vy, vz, spread, count, up = 1) { for (let i = 0; i < count; i++) { k = (k + 1) % n; pos[k * 3] = x + (Math.random() - 0.5) * spread; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z + (Math.random() - 0.5) * spread;
      vel[k * 3] = vx + (Math.random() - 0.5) * spread * 2; vel[k * 3 + 1] = vy * up * (0.5 + Math.random() * 0.8); vel[k * 3 + 2] = vz + (Math.random() - 0.5) * spread * 2; life[k] = 1.2 + Math.random() * (mistK ? 2.5 : 1); } },
    update(dt) { for (let i = 0; i < n; i++) { if (life[i] <= 0) continue; life[i] -= dt; if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
      vel[i * 3 + 1] -= (mistK ? 2.2 : 9.8) * dt; if (mistK) { vel[i * 3] *= 1 - dt * 0.8; vel[i * 3 + 2] *= 1 - dt * 0.8; }
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (!mistK && pos[i * 3 + 1] < -0.3) life[i] = 0; }
      geo.attributes.position.needsUpdate = true; } };
}

// the foam a big splash leaves on the sea: a soft, broken white patch that spreads and fades
function bursts(group, n) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 40, x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, s = 3 + Math.random() * 9;
    const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - s, y - s, s * 2, s * 2); }
  const tex = new THREE.CanvasTexture(cv), plane = new THREE.PlaneGeometry(2, 2); plane.rotateX(-Math.PI / 2);
  const B = Array.from({ length: n }, () => { const r = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); r.visible = false; group.add(r); return { r, t: 99 }; });
  let k = 0;
  return { fire(x, z, h, rad) { const b = B[k = (k + 1) % n]; Object.assign(b, { t: 0, rad }); b.r.position.set(x, 0.2, z); b.r.rotation.y = Math.random() * 6; b.r.visible = true; },
    update(dt) { for (const b of B) { if (b.t > 10) continue; b.t += dt; const rr = b.rad * (0.8 + b.t * 0.35); b.r.scale.set(rr, 1, rr); b.r.material.opacity = Math.min(1, b.t * 3) * Math.max(0, 1 - b.t / 10); if (b.t > 10) b.r.visible = false; } } };
}

export function wildlife(scene, { point }) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const small = splashes(group, 0.45, 500, false), big = splashes(group, 3.2, 900, false), huge = splashes(group, 6.5, 400, false), mist = splashes(group, 2.6, 260, true), foam = bursts(group, 4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  let T = 0, waves = [];
  const sea = (x, z) => (waves.length ? heightAt(waves, x, z) : 0);

  // ---- dolphins: a pod of 6 comes through every minute or so, porpoising in long low arcs, now and then a high leap
  const DN = 6, dol = new THREE.InstancedMesh(dolphinGeo(), mat, DN); dol.frustumCulled = false; group.add(dol);
  const pod = { on: false, next: 8, t: 0 }, D = Array.from({ length: DN }, (_, i) => ({ off: [(i % 3 - 1) * 3.5 + Math.random(), -(i / 3 | 0) * 5 - Math.random() * 2], ph: Math.random() * 6, amp: 1, above: false }));
  function podStart() {   // across the bay in front of the balcony, 60-140 m out, one way or the other
    const dir = Math.random() < 0.5 ? 1 : -1, zc = point.z - 50 - Math.random() * 50;
    Object.assign(pod, { on: true, t: 0, dur: 30, x0: dir > 0 ? point.x - 170 : point.x - 5, z0: zc, dx: dir * 5.5, dz: (Math.random() - 0.5) * 1.5 }); }
  // ---- turtles: two, grazing on the reef by the rocks and coming up to breathe
  const TN = 2, tur = new THREE.InstancedMesh(turtleGeo(), mat, TN); tur.frustumCulled = false; group.add(tur);
  const TU = Array.from({ length: TN }, (_, i) => ({ x: point.x - 18 - i * 9, z: point.z - 8 + i * 14, h: Math.random() * 6, t: Math.random() * 20, up: 0, sw: Math.random() * 6 }));
  // ---- the humpback
  const whale = new THREE.Mesh(whaleGeo(), mat); whale.frustumCulled = false; whale.visible = false; group.add(whale);
  const W = { st: 'away', t: 0, next: 20, n: 0, x: 0, z: 0, yaw: 0, notify: null, sound: null };   // (sound(kind, x, z): the game plays it, late by the distance)
  function whaleEvent() {
    if (W.st === 'away') { W.x = 100 + Math.random() * 70; W.z = -55 - Math.random() * 40; W.yaw = Math.PI / 2 + (Math.random() - 0.5) * 0.8; }   // (out the back, clear of the swells still coming in: ~180-220 m from the balcony)
    W.n++; const kind = W.n % 4 === 0 || (W.n === 2) ? 'breach' : W.n % 4 === 3 ? 'dive' : 'roll';
    Object.assign(W, { st: kind, t: 0, blown: false, hit: false }); whale.visible = true;
    if (kind === 'breach' && W.notify) W.notify('A humpback is breaching out the back. Tap ZOOM!');
  }

  function update(dt, wv) {
    if (!group.visible) return; T += dt; waves = wv || [];
    small.update(dt); big.update(dt); huge.update(dt); mist.update(dt); foam.update(dt);
    // dolphins
    if (!pod.on && (pod.next -= dt) <= 0) podStart();
    if (pod.on) { pod.t += dt; const px = pod.x0 + pod.dx * pod.t, pz = pod.z0 + pod.dz * pod.t;
      D.forEach((d, i) => { d.ph += dt * 2 * Math.PI / 1.7; if (d.ph > Math.PI * 2) { d.ph -= Math.PI * 2; d.amp = Math.random() < 0.15 ? 2.6 : 0.9 + Math.random() * 0.4; }
        const s = Math.sin(d.ph), y = (d.amp * 0.9) * s - 0.55, vy = d.amp * 0.9 * Math.cos(d.ph) * 2 * Math.PI / 1.7, x = px + d.off[1] * Math.sign(pod.dx), z = pz + d.off[0] + Math.sin(T * 0.3 + i) * 1.5;
        const surf = sea(x, z), above = y > 0.1;
        if (above !== d.above) { small.emit(x, surf, z, pod.dx * 0.3, 3.5, 0, 0.5, above ? 8 : 16); d.above = above; }
        e.set(-Math.atan2(vy, Math.abs(pod.dx)), Math.atan2(pod.dx, pod.dz), 0); q.setFromEuler(e);
        dol.setMatrixAt(i, m4.compose(v.set(x, surf + y, z), q, sc.set(1, 1, 1))); });
      dol.instanceMatrix.needsUpdate = true; dol.visible = true;
      if (pod.t > pod.dur) { pod.on = false; pod.next = 45 + Math.random() * 50; dol.visible = false; } }
    // turtles: ~25 s gliding below, ~7 s at the top breathing, head up
    TU.forEach((t, i) => { t.t += dt; t.sw += dt * 1.6; const cyc = t.t % 32, up = cyc > 25 ? Math.min(1, (cyc - 25) * 1.5, (32 - cyc) * 1.5) : 0;
      t.x += Math.sin(t.t * 0.08 + i) * dt * 0.4; t.z += Math.cos(t.t * 0.06 + i * 2) * dt * 0.4;
      if (up > 0.95 && !t.breathed) { small.emit(t.x, sea(t.x, t.z), t.z + 0.5, 0, 1.2, 0, 0.2, 5); t.breathed = true; } if (up < 0.1) t.breathed = false;
      e.set(-0.12 + 0.1 * Math.sin(t.sw), t.t * 0.05 + i * 2, 0.05 * Math.sin(t.sw * 0.5)); q.setFromEuler(e);
      tur.setMatrixAt(i, m4.compose(v.set(t.x, sea(t.x, t.z) - 1.3 + up * 1.22, t.z), q, sc.set(1, 1, 1))); });
    tur.instanceMatrix.needsUpdate = true;
    // the whale
    if (W.st === 'away' || W.st === 'wait') { if ((W.next -= dt) <= 0) whaleEvent(); }
    else {
      W.t += dt; const t = W.t, fx = Math.sin(W.yaw), fz = Math.cos(W.yaw); let cy = -3, pitch = 0, roll = 0, dur = 6;
      if (W.st === 'roll') {   // up to breathe: the blow, then the long back rolls over, the little dorsal, and under
        dur = 7; const k = t / dur; cy = -2.2 + 1.6 * Math.sin(Math.PI * k); pitch = 0.3 * Math.cos(Math.PI * k); W.x += fx * 2.2 * dt; W.z += fz * 2.2 * dt;
        if (!W.blown && t > 1.2) { W.blown = true; mist.emit(W.x + fx * 5, 0.5, W.z + fz * 5, 0, 7, 0, 0.6, 90); if (W.sound) W.sound('blow', W.x, W.z); } }
      else if (W.st === 'dive') {   // the tail comes up out of the water and slides under
        dur = 6; const k = t / dur; W.x += fx * 1.8 * dt; W.z += fz * 1.8 * dt; pitch = -0.15 - 1.15 * Math.min(1, k * 1.6); cy = -1.2 - 4 * k;
        if (!W.blown && t > 0.3) { W.blown = true; mist.emit(W.x + fx * 5, 0.5, W.z + fz * 5, 0, 7, 0, 0.6, 70); }
        if (k > 0.55 && !W.hit) { W.hit = true; big.emit(W.x - fx * 6, 0.5, W.z - fz * 6, 0, 4, 0, 1.5, 60); } }
      else {   // the breach: straight up out of the sea, twisting, and over onto its side
        dur = 8; if (t < 1.5) { const k = t / 1.5; cy = -10 + 14 * (1 - (1 - k) * (1 - k)); pitch = 1.3; roll = 1.4 * k; }
        else if (t < 2.7) { const k = (t - 1.5) / 1.2; cy = 4 - 5 * k * k; pitch = 1.3 - 1.25 * k; roll = 1.4 + 0.6 * k; W.x += fx * 3 * dt; W.z += fz * 3 * dt; }
        else { const k = (t - 2.7) / 5.3; cy = -1 - 5 * k; pitch = 0.05; roll = 2; }
        if (t > 0.9 && !W.blown) { W.blown = true; big.emit(W.x, 0.3, W.z, 0, 9, 0, 3, 160); huge.emit(W.x, 0.5, W.z, 0, 6, 0, 3, 50); foam.fire(W.x, W.z, 6, 5); }   // (bursting out)
        if (t > 2.6 && !W.hit) { W.hit = true; big.emit(W.x + fx * 2, 0.3, W.z + fz * 2, 0, 16, 0, 6, 400); big.emit(W.x, 0.3, W.z, 0, 7, 0, 10, 300); huge.emit(W.x + fx * 3, 0.5, W.z + fz * 3, 0, 13, 0, 5, 160); huge.emit(W.x, 0.5, W.z, 0, 6, 0, 9, 120); foam.fire(W.x + fx * 3, W.z + fz * 3, 14, 11); if (W.sound) W.sound('crash', W.x, W.z); } }   // (the crash)
      e.set(-pitch, W.yaw, roll); q.setFromEuler(e); whale.quaternion.copy(q); whale.position.set(W.x, cy, W.z);
      if (t > dur) { const was = W.st; whale.visible = false; W.st = 'wait'; W.next = was === 'breach' ? 40 : 14 + Math.random() * 16; if (W.n % 4 === 0) { W.st = 'away'; W.next = 60 + Math.random() * 60; } }
    }
  }
  return { group, update, whale: W, pod, splash(x, z) { small.emit(x, 0.2, z, 0, 3.2, 0, 0.5, 22); }, set notify(f) { W.notify = f; }, set sound(f) { W.sound = f; } };   // (splash: a bird hitting the water)
}
