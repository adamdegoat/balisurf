// Filming the trailer: drives the game frame by frame (paused, fixed steps, so it's perfectly smooth), frames each
// shot with its own camera at 1080x1920 (vertical, for phones), and posts every frame to the local receiver
// (scratchpad trailer/recv.py on :8799). Each take is resumable across calls (the browser tool gives ~40 s a call).
//   const f = await import('./test/film.js'); f.setup(); await f.run('ride')  (repeat until it says done)
import * as THREE from 'three';
import { brain } from './sim2.js';
const G = () => window.__g;
const W = 1080, H = 1920, FPS = 30;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
let saved = null;
export function setup() {
  const g = G(), r = g.renderer; g.paused = true;
  if (!saved) saved = { pr: r.getPixelRatio() };
  r.setPixelRatio(1); r.setSize(W, H, false);
  document.getElementById('hint') && (document.getElementById('hint').style.visibility = 'hidden');
}
export function teardown() { const g = G(), r = g.renderer; r.setPixelRatio(saved ? saved.pr : devicePixelRatio); r.setSize(innerWidth, innerHeight, false); g.paused = false; saved = null; }
// draw the world through the camera (and your own arms and board through their own lens, like the game does)
function draw(fov, body) {
  const g = G(), r = g.renderer, c = g.camera;
  c.aspect = W / H; c.fov = fov; c.updateProjectionMatrix(); c.updateMatrixWorld();
  r.autoClear = false; r.clear(); r.render(g.scene, c);
  if (body) { const a = g.armCam; a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = W / H; a.fov = typeof body === 'number' ? body : fov; a.updateProjectionMatrix(); r.clearDepth(); r.render(g.scene, a); }   // (your arms through a narrower lens than the world, like the game: a wide lens bloats anything that close)
  r.autoClear = true;
  cx.drawImage(r.domElement, 0, 0, W, H);   // (copied in the same task, before the browser clears the drawing buffer)
}
async function grab(shot, i) {
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.92));
  await fetch(`http://127.0.0.1:8799/f?shot=${shot}&i=${i}`, { method: 'POST', body: blob });
}
const seeded = (seed) => { let st = seed >>> 0; return () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---- the takes. Each: init() once, then frame(i) -> { fov, body } after moving the world on one frame; n frames
const T = {};
// the opener: floating deep in a barrel on the menu's wave, drifting toward the light at the end
T.open = { n: 150, init() { const g = G(); document.getElementById('start').style.display = 'none'; g.step(1, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const c = g.camera; const k = i / 150; c.rotateY(-0.42 + 0.06 * k); c.rotateX(0.1); c.translateZ(-0.8 * k); return { fov: 84 - 6 * k }; } };
// your ride: paddle in, the drop, set up in the pocket, pull in and ride the barrel out (Tanjung Uma); and the giant
function rideTake(mode, seed, n, boardT = 'short') {
  let br, rnd0; const rs = { w: 0 };
  return { n, init() { const g = G(); rnd0 = Math.random; Math.random = seeded(seed); g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing', 'riding');
      g.useBoard(boardT); g.spawnRider(); br = brain({}); const r = g.rider;   // (wait in the lineup until the wave is 3 s away)
      for (let i = 0; i < 60 * 90; i++) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (r.state === 'LIE' && g.incoming().t < 3.2) break; } },
    frame() { const g = G(), r = g.rider;
      for (let k = 0; k < 2; k++) {
        if (r.state === 'RIDE' && r.stateT > 1.2) {   // on the wave: the barrel line (stall until covered, then hold the pocket)
          const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh, err = yH - 0.35 + (r.stalling ? 0.12 : 0);
          const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn), steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
          const stall = !r.inBarrel && sH > -0.2 && r.stateT < 9; g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
        } else { g.input.stick = null; const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
        g.step(1 / 60, 1 / 60, false);
      }
      // the GoPro framing for a tall screen: once you're up, the camera turns from the game's view (toward the beach)
      // to look down the line: the wall on your left, the lip curling over, the way out ahead
      const c = g.camera; rs.w += ((r.standing ? 1 : 0) - rs.w) * 0.06;
      if (rs.w > 0.01) { const f = new THREE.Vector3(); c.getWorldDirection(f); const dl = new THREE.Vector3(1, -0.5, -0.08).normalize(); f.lerp(dl, rs.w * 0.85).normalize(); c.lookAt(c.position.clone().add(f)); }
      return { fov: 116, body: 82 }; },
    done() { const g = G(); if (boardT !== 'short') g.useBoard('short'); Math.random = rnd0; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } };
}
T.ride = rideTake('medium', 3, 600);
T.giant = rideTake('extreme', 7, 540, 'gun');
// the villa and the view from it: free cameras in the villa's world (it keeps living: waves, crew, whale, dolphins)
const V = { ok: false };
function villaInit() { const g = G(); if (!document.body.classList.contains('villa')) { g.startVilla(); } g.step(0.5, 1 / 30, false); V.ok = true; }
const OX = 88, OZ = 31, DZ = 60;   // (the villa's frame: world x = OX - local x, world z = local z + OZ + DZ)
const L = (lx, y, lz) => new THREE.Vector3(OX - lx, y, lz + OZ + DZ);
const Y = 26;
function villaCam(from, to, look, k) { const c = G().camera; c.position.lerpVectors(from, to, k); c.lookAt(look); }
T.deck = { n: 110, init: villaInit, frame(i) { G().step(1 / FPS, 1 / FPS, false); const k = i / 110;   // up the banyan: lanterns, the canopy overhead, the break out past the rail
  villaCam(L(-81.4, Y + 9.5, 48.2), L(-81.0, Y + 9.55, 47.5), L(-20, Y + 16, 5), k); return { fov: 84 }; } };
T.drone = { n: 120, init: villaInit, frame(i) { G().step(1 / FPS, 1 / FPS, false); const k = i / 120, c = G().camera, ctr = L(-92, Y + 2.5, 40), a = Math.PI + 0.75 - 0.45 * k;   // the villa on its point at sunset, circling from the sea
  c.position.set(ctr.x + Math.cos(a) * 42, Y + 11 - 2 * k, ctr.z + Math.sin(a) * 42); c.lookAt(ctr.x, ctr.y + 2, ctr.z); return { fov: 55 }; } };
T.radio = { n: 100, init: villaInit, frame(i) { G().step(1 / FPS, 1 / FPS, false); const k = i / 100;   // the old radio on the balcony table, the song on its dial, the cone pumping
  villaCam(L(-83.9, Y + 0.95, 36.35), L(-84.15, Y + 0.85, 36.6), L(-85.2, Y + 0.62, 37), k); return { fov: 50 }; } };
// the crew from close: a surfer on the face, the camera riding alongside
function crewCam(pick, place, n) { let idx = -1; return { n, init() { villaInit(); const g = G(), S = g.crew.surfers; for (let k = 0; k < 30 * 120; k++) { g.step(1 / 30, 1 / 30, false); idx = S.findIndex(pick); if (idx >= 0) break; } },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const s = g.crew.surfers[idx]; place(g.camera, s, i); return { fov: 60 }; } }; }
T.carve = crewCam((s) => s.st === 'RIDE' && s.tau > 2.5 && s.tau < 4 && !(s.tube < 8), (c, s, i) => { const p = s.p; c.position.set(p.x + 3.5, p.y + 1.6, p.z + 6.5); c.lookAt(p.x, p.y + 0.9, p.z); }, 90);
T.tube = crewCam((s) => s.st === 'RIDE' && s.tubeT > 0.05 && s.tubeT < 0.4, (c, s, i) => { const p = s.p; c.position.set(p.x + 9, p.y + 2.2, p.z + 9); c.lookAt(p.x, p.y + 1, p.z); }, 75);
// wildlife: set the moment up, then film it low from the water
T.dolphins = { n: 100, init() { villaInit(); const g = G(), P = g.wild.pod; P.on = false; P.next = 0; g.step(1 / 30, 1 / 30, false); g.step(4, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const P = g.wild.pod, px = P.x0 + P.dx * P.t, pz = P.z0 + P.dz * P.t; const c = g.camera;
    c.position.set(px + Math.sign(P.dx) * 3.5, 0.9, pz + 6.5); c.lookAt(px - Math.sign(P.dx) * 2.5, 0.6, pz); return { fov: 46 }; } };
T.whale = { n: 170, init() { villaInit(); const g = G(), Wh = g.wild.whale; Wh.st = 'away'; Wh.n = 1; Wh.next = 0; g.step(1 / 30, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const Wh = g.wild.whale, c = g.camera; c.position.set(Wh.x - 26, 2.2, Wh.z + 24); c.lookAt(Wh.x, 5.5, Wh.z); return { fov: 36 }; } };

// run (or carry on) a take; returns progress. Frames land in trailer/frames/<name>/
const S = {};
export async function run(name, budget = 36000) {
  const t = T[name]; if (!t) return 'no take ' + name;
  if (!S[name]) { S[name] = { i: 0 }; t.init(); }
  const s = S[name], t0 = performance.now();
  while (s.i < t.n && performance.now() - t0 < budget) { const o = t.frame(s.i); draw(o.fov, o.body); await grab(name, s.i); s.i++; }
  if (s.i >= t.n) { if (t.done) t.done(); return `${name}: done (${t.n} frames)`; }
  return `${name}: ${s.i}/${t.n}`;
}
export function reset(name) { delete S[name]; }
// one test frame of a take (after k frames), saved as frames/_peek/<name>.jpg, to judge the framing before filming it all
export async function peek(name, k = 0) { const t = T[name]; delete S[name]; t.init(); let o; for (let i = 0; i <= k; i++) o = t.frame(i); draw(o.fov, o.body);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85)); await fetch(`http://127.0.0.1:8799/f?shot=_peek_${name}&i=${k}`, { method: 'POST', body: blob }); return 'peeked ' + name; }
