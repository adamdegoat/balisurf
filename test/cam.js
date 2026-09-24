// Camera framing check: distance, height above the surfer, and whether the wave hides them,
// split into the pop-up/drop (first 2 s) and the rest of the ride.
// In the page console: const m = await import('./test/cam.js'); await m.camCheck('medium')
import { brain } from './sim2.js';
import * as THREE from 'three';
const ray = new THREE.Raycaster(), UP = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3();
export function camCheck(mode, n = 2, seed = 7) {
  // same waves every run (seeded random) so two camera settings can be compared fairly
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  try { return run(mode, n); } finally { Math.random = rnd0; }
}
function run(mode, n) {
  const G = window.__g; G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = brain({}), A = { pop: { d: [], u: [], v: 0, t: 0, wet: 0 }, ride: { d: [], u: [], v: 0, t: 0, wet: 0 } }; let rides = 0;
  for (let i = 0; i < 60 * 100 && rides < n; i++) {
    const r = G.rider; if (r.state === 'WIPE' || r.state === 'OUT') { G.spawnRider(); rides++; continue; }
    const o = br(r); G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle; G.step(1 / 60, 1 / 60, false);
    if (!r.standing || i % 3) continue;
    const a = A[r.state === 'POP' || r.stateT < 2 ? 'pop' : 'ride'], c = G.camera.position, p = G.rig.position;
    G.scene.updateMatrixWorld();   // the waves moved this frame: raycast against where they are now, not last render
    a.d.push(c.distanceTo(p)); a.u.push(c.y - p.y);
    const h = p.clone(); h.y += 0.8; const dd = h.clone().sub(c), L = dd.length(); ray.set(c, dd.normalize()); ray.far = L - 0.3;
    a.t++; if (!ray.intersectObjects(G.waves.map((w) => w.mesh).filter(Boolean), false).length) a.v++;
    // camera inside the water: looking straight up from it hits the wave surface (fine inside a barrel, wrong anywhere else)
    if (!r.inBarrel) { up.set(c.x, c.y, c.z); ray.set(up, UP); ray.far = 8; const hit = ray.intersectObjects(G.waves.map((w) => w.mesh), false)[0]; if (hit) a.wet++; }
  }
  G.input.test = null;
  const md = (x) => { x.sort((a, b) => a - b); return `${x[Math.floor(x.length * .5)].toFixed(1)} (max ${x[x.length - 1].toFixed(1)})`; };
  return mode + ': ' + ['pop', 'ride'].map((k) => `${k}: dist ${md(A[k].d)} above ${md(A[k].u)} visible ${(A[k].v / A[k].t * 100).toFixed(0)}% camera-in-water ${(A[k].wet / A[k].t * 100).toFixed(0)}%`).join(' | ');
}

// how often the surfer is visible, split by moment: being picked up, standing up, and the first seconds of the ride.
// Uses the real thumb control: angle the take-off along the wave, then hold a line.
import { brain as _brain } from './sim2.js';
export function popSlices(mode, n = 3, seed = 11) {
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  try { return slices(mode, n); } finally { Math.random = rnd0; }
}
function slices(mode, n) {
  const G = window.__g; G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = _brain({}), B = {}; let rides = 0;
  const plan = (r) => (r.state === 'POP' || r.stateT < 0.9 ? { x: 0, y: -0.7 } : { x: 0.3, y: 0 });
  for (let i = 0; i < 60 * 80 && rides < n; i++) {
    const r = G.rider; if (r.state === 'WIPE' || r.state === 'OUT') { G.spawnRider(); rides++; continue; }
    if (!r.standing) { const o = br(r); G.input.stick = null; G.input.test = o.steer; G.input.paddleBtn = o.paddle; }
    else { G.input.test = null; G.input.paddleBtn = false; G.input.stick = plan(r); }
    G.step(1 / 60, 1 / 60, false);
    const t = r.state === 'POP' ? -0.35 + r.stateT : r.state === 'RIDE' ? r.stateT : r.state === 'LIE' && r.onFace ? -1 : null;
    if (t == null || t > 4) continue;
    const k = t < -0.35 ? 'picked up' : t < 0 ? 'standing' : t < 1 ? 'ride 0-1s' : t < 2 ? 'ride 1-2s' : 'ride 2-4s';
    G.scene.updateMatrixWorld();
    const c = G.camera.position, p = G.rig.position.clone(); p.y += 0.8; const d = p.clone().sub(c), L = d.length();
    ray.set(c.clone(), d.normalize()); ray.far = L - 0.3;
    const b = (B[k] = B[k] || [0, 0, 0]); b[1]++; if (!ray.intersectObjects(G.waves.map((w) => w.mesh), false).length) b[0]++;
    if (!r.inBarrel) { up.set(c.x, c.y, c.z); ray.set(up, UP); ray.far = 8; if (ray.intersectObjects(G.waves.map((w) => w.mesh), false).length) b[2]++; }
  }
  G.input.stick = null; G.input.test = null;
  return mode + ': ' + Object.entries(B).map(([k, [v, t, wt]]) => `${k} ${(v / t * 100).toFixed(0)}%${wt ? ` (cam under water ${(wt / t * 100).toFixed(0)}%)` : ''}`).join(' | ');
}

// Ground truth: render the real frame small, with the surfer painted flat magenta, and count magenta pixels.
// 0 = you can't see the surfer (blocked, off screen, camera in the water), whatever the geometry checks say.
const RT = new THREE.WebGLRenderTarget(160, 74), PIX = new Uint8Array(160 * 74 * 4), MAG = new THREE.MeshBasicMaterial({ color: 0xff00ff, fog: false });
export function surferPixels() {
  const G = window.__g, r = G.renderer, saved = [];
  G.surfer.traverse((o) => { if (o.isMesh) { saved.push([o, o.material]); o.material = MAG; } });
  G.camera.updateMatrixWorld(); r.setRenderTarget(RT); r.render(G.scene, G.camera); r.readRenderTargetPixels(RT, 0, 0, 160, 74, PIX); r.setRenderTarget(null);
  for (const [o, m] of saved) o.material = m;
  let n = 0; for (let i = 0; i < PIX.length; i += 4) if (PIX[i] > 200 && PIX[i + 1] < 60 && PIX[i + 2] > 200) n++;
  return n / (160 * 74);
}
// ride Hard (angled take-off, then hold a line) and report how often the surfer really shows, in and around barrels
export function barrelView(mode = 'hard', rides = 2, seed = 5) {
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  try {
    const G = window.__g; G.paused = true; G.setMode(mode);
    document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
    const br = _brain({}), B = {}; let done = 0;
    for (let i = 0; i < 60 * 150 && done < rides; i++) {
      const r = G.rider; if (r.state === 'WIPE' || r.state === 'OUT') { G.spawnRider(); done++; continue; }
      if (!r.standing) { const o = br(r); G.input.stick = null; G.input.test = o.steer; G.input.paddleBtn = o.paddle; }
      else { G.input.test = null; G.input.paddleBtn = false; G.input.stick = r.state === 'POP' || r.stateT < 0.9 ? { x: 0, y: -0.7 } : { x: 0.3, y: 0 }; }
      G.step(1 / 60, 1 / 60, false);
      if (!r.standing || i % 4) continue;
      const k = r.inBarrel ? 'barrel' : r.state === 'POP' || r.stateT < 2 ? 'drop' : 'ride';
      const px = surferPixels(), b = (B[k] = B[k] || [0, 0]); b[1]++; if (px > 0.004) b[0]++;
    }
    G.input.stick = null; G.input.test = null;
    return `${mode}: ` + Object.entries(B).map(([k, [v, t]]) => `${k} seen ${(v / t * 100).toFixed(0)}% (${t})`).join(' | ');
  } finally { Math.random = rnd0; }
}
