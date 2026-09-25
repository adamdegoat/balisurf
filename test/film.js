// Filming the trailer: drives the game frame by frame (paused, fixed steps, so it's perfectly smooth), frames each
// shot with its own camera at 1080x1920 (vertical, for phones), and posts every frame to the local receiver
// (scratchpad trailer/recv.py on :8799). Each take is resumable across calls (the browser tool gives ~40 s a call).
//   const f = await import('./test/film.js'); f.setup(); await f.run('ride')  (repeat until it says done)
import * as THREE from 'three';
import { brain, carveBrain } from './sim2.js';
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const G = () => window.__g;
const NATIVE_RANDOM = window.__nativeRandom || (window.__nativeRandom = Math.random);   // (the browser's own, kept the first time this loads: a take seeds Math.random and must hand the real one back)
let W = 1080, H = 1920; const FPS = 30;
const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d');
let saved = null;
export function setup(w = 1080, h = 1920) {
  const g = G(), r = g.renderer; g.paused = true; W = w; H = h; cv.width = W; cv.height = H;
  if (!saved) saved = { pr: r.getPixelRatio() };
  r.setPixelRatio(1); r.setSize(W, H, false);
  document.getElementById('hint') && (document.getElementById('hint').style.visibility = 'hidden');
}
export function teardown() { const g = G(), r = g.renderer; r.setPixelRatio(saved ? saved.pr : devicePixelRatio); r.setSize(innerWidth, innerHeight, false); g.paused = false; saved = null; }
// draw the world through the camera (and your own arms and board through their own lens, like the game does)
function draw(fov, body, crop, chase) {
  const g = G(), r = g.renderer, c = g.camera, a = g.armCam;
  if (chase) {   // (from outside: the surfer drawn whole on the main camera, legs and all, no first-person cut)
    if (r.domElement.width !== W || r.domElement.height !== H) { r.setPixelRatio(1); r.setSize(W, H, false); }
    c.aspect = W / H; c.fov = fov; c.updateProjectionMatrix(); c.updateMatrixWorld(); c.layers.enable(1); const hl = g.HIDELEGS.value, wy = g.WATERY.value, ac = g.ARMCUT.value, cut = g.CUT.value;
    g.HIDELEGS.value = 0; g.WATERY.value = -99; g.ARMCUT.value = 0; g.CUT.value = 0;
    let head = null; g.surfer.traverse((o) => { if (o.isBone && o.name === 'head') head = o; }); const hs = head && head.scale.x; if (head) { head.scale.setScalar(1); head.updateMatrixWorld(true); }   // (your own head, shrunk away for first person, back on)
    const mir = g.mirror; if (mir) g.flipProj(c); r.render(g.scene, c); if (mir) g.flipProj(c);
    if (head) { head.scale.setScalar(hs); head.updateMatrixWorld(true); }
    g.HIDELEGS.value = hl; g.WATERY.value = wy; g.ARMCUT.value = ac; g.CUT.value = cut; c.layers.disable(1);
    if (Array.isArray(chase)) { c.position.copy(chase[0]); c.quaternion.copy(chase[1]); c.updateMatrixWorld(); }
    cx.drawImage(r.domElement, 0, 0, W, H); return; }
  if (r.domElement.width !== W || r.domElement.height !== H) { r.setPixelRatio(1); r.setSize(W, H, false); }   // (the page may have resized it under us)
  // crop: a vertical slice of the game's own landscape view (a phone on its side, 2.16:1), the slice centred at crop
  // (0..1 across it). The camera and its lens are exactly the game's; only the window onto them is tall
  if (crop !== undefined) { const fw = H * 2.16, x0 = Math.max(0, Math.min(fw - W, crop * fw - W / 2)); c.aspect = fw / H; c.fov = fov; c.setViewOffset(fw, H, x0, 0, W, H); c.updateProjectionMatrix();
    if (body) { a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = fw / H; a.fov = body; a.setViewOffset(fw, H, x0, 0, W, H); a.updateProjectionMatrix(); } }
  else { c.aspect = W / H; c.fov = fov; c.updateProjectionMatrix(); if (body) { a.position.copy(c.position); a.quaternion.copy(c.quaternion); a.aspect = W / H; a.fov = typeof body === 'number' ? body : fov; a.updateProjectionMatrix(); } }
  c.updateMatrixWorld();
  const mir = g.mirror; if (mir) { g.flipProj(c); if (body) g.flipProj(a); }   // (a right-hand spot: the picture flipped, as the game draws it)
  r.autoClear = false; r.clear(); r.render(g.scene, c);
  if (body) { r.clearDepth(); r.render(g.scene, a); }
  r.autoClear = true;
  if (mir) { g.flipProj(c); if (body) g.flipProj(a); }
  if (crop !== undefined) { c.clearViewOffset(); a.clearViewOffset(); }
  cx.drawImage(r.domElement, 0, 0, W, H);   // (copied in the same task, before the browser clears the drawing buffer)
  if (CALL.text && CALL.a > 0.01) {   // the game's own callout (#tube in index.html: 22% down, bold condensed, wide letter spacing)
    const fs = Math.round(H * 0.056); cx.save(); cx.globalAlpha = CALL.a; cx.font = `700 ${fs}px "Barlow Condensed", "Helvetica Neue", sans-serif`; cx.letterSpacing = `${(fs * 0.3).toFixed(1)}px`;
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = fs * 0.25; cx.fillStyle = '#f4efe6'; cx.fillText(CALL.text, W / 2 + fs * 0.15, H * 0.22 + fs * 0.5); cx.restore(); }
}
// frames are encoded on the spot and sent in batches (one request per dozen frames: a hidden tab throttles every
// awaited callback to about one a second, which made one-request-per-frame crawl)
let batch = [], batchShot = null;
async function flush() { if (!batch.length) return; const b = batch; batch = []; await fetch(`http://127.0.0.1:8799/b?shot=${batchShot}`, { method: 'POST', body: JSON.stringify(b) }); }
async function grab(shot, i) {
  if (batchShot !== shot) { await flush(); batchShot = shot; }
  batch.push([i, cv.toDataURL('image/jpeg', 0.92)]); if (batch.length >= 12) await flush();
}
// the callout state, driven like the game's (BARREL held 0.4 s after the tube, else the move just landed; fades .25 s)
const CALL = { text: '', a: 0, tubeT: 0, last: '' };
function callout(r, dt) {
  CALL.tubeT = r.inBarrel ? 0.4 : Math.max(0, CALL.tubeT - dt);
  const t = r.state !== 'RIDE' ? '' : CALL.tubeT > 0 ? 'BARREL' : r.trick && !r.trick.name.endsWith('TURN') ? r.trick.name : '';
  if (t) CALL.text = t; CALL.a += ((t ? 1 : 0) - CALL.a) * Math.min(1, dt / 0.12);
}
const seeded = (seed) => { let st = seed >>> 0; return () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296); };

// ---- the takes. Each: init() once, then frame(i) -> { fov, body } after moving the world on one frame; n frames
const T = {};
// the opener: floating deep in a barrel on the menu's wave, drifting toward the light at the end
T.open = { n: 150, init() { const g = G(); document.getElementById('start').style.display = 'none'; g.step(1, 1 / 30, false); },
  frame(i) { const g = G(); g.step(1 / FPS, 1 / FPS, false); const c = g.camera; const k = i / 150; c.rotateY(-0.42 + 0.06 * k); c.rotateX(0.1); c.translateZ(-0.8 * k); return { fov: 84 - 6 * k }; } };
// your ride: paddle in, the drop, set up in the pocket, pull in and ride the barrel out (Tanjung Uma); and the giant
function rideTake(mode, seed, n, boardT = 'short', line = false) {
  let br, rnd0; const rs = { w: 0, pan: 0.5, dir: null, k: 0 };
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
      const c = g.camera, lip = new THREE.Vector3(); if (r.wave && r.state === 'RIDE') { const L = r.wave.lipAt(r.s + 2); lip.set(L[0], L[1] * (r.wave.fade || 1), L[2]); c.updateMatrixWorld();
      const sp = lip.clone().project(c); const fx = 0.5 + sp.x * 0.5 * (1 / 2.16) * 2.16; rs.pan += (Math.max(0.33, Math.min(0.67, 0.5 + (fx - 0.5) * 0.55)) - rs.pan) * 0.05; } else rs.pan += (0.5 - rs.pan) * 0.05;
      if (line) {   // (the reel's POV: once you're up, eyes down the line where you're going, the wall and the lip beside you)
        const up = r.state === 'RIDE' && r.standing; rs.k += ((up ? 1 : 0) - rs.k) * 0.06;
        if (rs.k > 0.01 && r.wave) { const Lh = r.wave.lipAt(r.s + 14), d = new THREE.Vector3(Lh[0] - c.position.x, 0, Lh[2] + 3 - c.position.z); if (d.lengthSq() > 0.04) { d.normalize(); rs.dir = rs.dir ? rs.dir.lerp(d, 0.07).normalize() : d; }   // (at the wave 14 m ahead: the way out of the tube)
          if (rs.dir) { const q0 = c.quaternion.clone(), tg = c.position.clone().addScaledVector(rs.dir, 10); tg.y = c.position.y - 1.9; c.lookAt(tg); c.quaternion.copy(q0.slerp(c.quaternion.clone(), rs.k)); c.updateMatrixWorld(); } }
        return { fov: 74, body: 62, crop: 0.5 }; }
      return { fov: 70, body: 62, crop: rs.pan }; },   // (the game's own camera, untouched)
    done() { const g = G(); if (boardT !== 'short') g.useBoard('short'); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } };
}
T.ride = rideTake('medium', 3, 600);
// the reel: the other breaks, each in the game's own first-person view
T.rHard = rideTake('hard', 11, 300, 'short', true); T.rHiu = rideTake('hiu', 5, 250, 'short', true); T.rKanan = rideTake('kanan', 8, 360, 'short', true); T.rEasy = rideTake('easy', 4, 380, 'fish', true);
T.rUma = rideTake('medium', 3, 480, 'short', true); T.rGiant = rideTake('extreme', 7, 330, 'gun', true);
T.rHard.keep = [[120, 300]]; T.rHiu.keep = [[125, 250]]; T.rKanan.keep = [[150, 360]]; T.rEasy.keep = [[170, 380]]; T.rUma.keep = [[100, 480]]; T.rGiant.keep = [[100, 330]];
T.giant = rideTake('extreme', 7, 300, 'gun'); T.giant.keep = [[110, 300]];
// the landscape trailer: a pro in the game's own first-person view (your arms and board, the game's lens), paddling
// in and riding like a pro: 'carve' (snaps off the top), 'cut' (cutbacks), 'barrel' (sets up and pulls in), 'air'
const LOG = {}; window.__filmLog = LOG; const CH = {};
export function addPro(name, mode, seed, n, boardT, plan, cbo, keep, cam) { T[name] = proTake(name, mode, seed, n, boardT, plan, cbo, cam); if (keep) T[name].keep = keep; return name; }
function proTake(name, mode, seed, n, boardT, plan, cbo, cam) {
  let br, cb, rnd0, armK = 0, cut = 0, lastCut = -9, i0 = 0;
  const gameFov = (asp) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(50)) / Math.min(asp, 2)));
  return { n, init() { const g = G(); rnd0 = Math.random; Math.random = seeded(seed); g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
      g.useBoard(boardT); g.spawnRider(); br = brain({}); cb = carveBrain(cbo || (plan === 'air' ? { hi: 0.97, lo: 0.12, gain: 4 } : { hi: 0.8, lo: 0.16, gain: 3.4 })); const r = g.rider; LOG[name] = []; CALL.a = 0; CALL.tubeT = 0; CH.p = CH.l = null;
      for (let i = 0; i < 60 * 90; i++) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (r.state === 'LIE' && g.incoming().t < 3.4) break; } },
    frame(i) { const g = G(), r = g.rider;
      for (let k = 0; k < 2; k++) {
        let o = br(r), stick = null;
        if (r.state === 'RIDE' && r.wave && r.stateT > 1.0) {
          const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh;
          if (plan === 'barrel' && r.stateT > 2.5) {   // set up in the pocket, stall till it covers you, then hold the line
            const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
            const steer = Math.max(-1, Math.min(1, wrapA(a0 - r.th) * 3)), stall = !r.inBarrel && sH > -0.2 && !(r.spitOut > 0);
            o = { steer: stall ? null : steer, pump: !stall && sH < -1.2 }; if (stall) stick = { x: steer, y: 1 };
          } else if (plan === 'cut' && (cut || (r.stateT > 4 && r.stateT - lastCut > 4 && sH > 2.0 && r.v > w.cond.speed * 0.85))) {   // (well out on the shoulder, flying: closer in, the curl lands on you as you come round)   // out on the shoulder with speed: swing back round to the curl
            if (!cut) cut = 1;
            if (cut === 1) { o = { steer: 1, pump: false }; if (Math.cos(r.th) < -0.5) cut = 2; }   // (round through the face and back toward the curl...)
            else { o = { steer: -1, pump: false }; if (Math.cos(r.th) > 0.35) { cut = 0; lastCut = r.stateT; } }   // (...then rebound back down the line)
          } else if (plan === 'snap') {   // bottom turn, drive hard up to the lip, whip it back down at full lock, again
            const sl = w.prof.slice(r.s), hT = r.y / Math.max(sl.top, 0.3), c = w.cond.speed, relVz = r.vz - c;
            const aim = (vz) => wrapA(Math.asin(Math.max(-0.95, Math.min(0.97, vz / Math.max(r.v, 0.5)))) - r.th);
            if (!r._ph) r._ph = 'up';
            if (r._ph === 'up' && hT > (cbo && cbo.top || 0.74)) r._ph = 'snap'; else if (r._ph === 'snap' && relVz > 1.2) r._ph = 'down'; else if (r._ph === 'down' && hT < 0.22) r._ph = 'up';
            const d = r._ph === 'up' ? aim(c - 0.8 * c) : aim(c + 0.7 * c);
            o = { steer: r._ph === 'snap' ? Math.sign(d) : Math.max(-1, Math.min(1, d * 3)), pump: r._ph !== 'snap' && r.v < c * 0.95 };
          } else { o = cb(r); o.pump = r.v < w.cond.speed * 0.85; }
        }
        g.input.stick = stick; g.input.test = stick ? null : o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle;
        g.step(1 / 60, 1 / 60, false);
      }
      callout(r, 1 / FPS);
      LOG[name].push([i, r.state, r.inBarrel ? 1 : 0, r.trick && r.trick.t < 0.05 ? r.trick.name : '', r.air ? 1 : 0, r.why || '', cut]);
      armK += ((r.standing ? 1 : 0) - armK) * Math.min(1, 4 / FPS);
      if (cam && r.wave) {   // a filmer in the channel on a jet ski: out in front of the wave and ahead on the shoulder, keeping pace, long lens on the surfer
        const Hh = r.wave.cond.H, c = g.camera, want = new THREE.Vector3(r.x + cam.ahead * Hh, Math.max(1.2, cam.up * Hh), r.z + cam.out * Hh);
        CH.p = CH.p ? CH.p.lerp(want, 0.08) : want.clone(); CH.l = CH.l ? CH.l.lerp(new THREE.Vector3(r.x, r.y + 1, r.z), 0.25) : new THREE.Vector3(r.x, r.y + 1, r.z);
        const pov = [c.position.clone(), c.quaternion.clone()];   // (the game lines your body up under its own camera next frame: it gets its camera back after the shot)
        c.position.copy(CH.p); c.lookAt(CH.l); c.updateMatrixWorld(); return { fov: cam.fov, chase: pov }; }
      const fov = gameFov(W / H); return { fov, body: fov + (62 - fov) * armK }; },
    done() { const g = G(); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; if (boardT !== 'short') g.useBoard('short'); CALL.a = 0; } };
}
T.pUma = proTake('pUma', 'medium', 3, 900, 'short', 'barrel'); T.pUmaC = proTake('pUmaC', 'medium', 9, 900, 'short', 'carve');
T.pHard = proTake('pHard', 'hard', 11, 800, 'short', 'carve'); T.pHardB = proTake('pHardB', 'hard', 11, 700, 'short', 'barrel');
T.pKanan = proTake('pKanan', 'kanan', 8, 800, 'short', 'cut'); T.pHiu = proTake('pHiu', 'hiu', 5, 700, 'short', 'barrel');
T.pEasy = proTake('pEasy', 'easy', 4, 900, 'fish', 'air'); T.pCut = proTake('pCut', 'medium', 7, 900, 'short', 'cut'); T.pGiant = proTake('pGiant', 'extreme', 7, 600, 'gun', 'carve');
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
// the showcase ride: paddle in, the drop, a bottom turn and carves up and down the face, then pull in, get barrelled
// and spat out as the wave backs off at the end (one continuous take; the GoPro turns down the line once you're tubed)
T.ride2 = (() => { let br, cb, rnd0; const rs = { w: 0, pan: 0.5 }; return { n: 830, keep: [[90, 440], [540, 830]],
  init() { const g = G(); rnd0 = Math.random; Math.random = seeded(3); g.setMode('medium'); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing', 'riding');
    g.useBoard('short'); g.spawnRider(); br = brain({}); cb = carveBrain({ hi: 0.72, lo: 0.22 }); const r = g.rider;
    for (let i = 0; i < 60 * 90; i++) { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; g.step(1 / 60, 1 / 60, false); if (r.state === 'LIE' && g.incoming().t < 3.0) break; } },
  frame() { const g = G(), r = g.rider;
    for (let k = 0; k < 2; k++) {
      if (r.state === 'RIDE' && r.stateT > 4.2) {   // the barrel
        const w = r.wave, Hh = w.cond.H, sH = r.s / Hh, yH = r.y / Hh, err = yH - 0.35 + (r.stalling ? 0.12 : 0);
        const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn), steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
        const stall = !r.inBarrel && sH > -0.2 && !(r.spitOut > 0); g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
      } else if (r.state === 'RIDE' && r.stateT > 1.2) { g.input.stick = null; const o = cb(r); g.input.test = o.steer; g.input.paddleBtn = false; }   // carving
      else if (r.state === 'RIDE' || r.state === 'POP' || r.state === 'LIE') { g.input.stick = null; const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
      g.step(1 / 60, 1 / 60, false);
    }
    const c = g.camera, lip = new THREE.Vector3(); if (r.wave && r.state === 'RIDE') { const L = r.wave.lipAt(r.s + 2); lip.set(L[0], L[1] * (r.wave.fade || 1), L[2]); c.updateMatrixWorld();
      const sp = lip.clone().project(c); const fx = 0.5 + sp.x * 0.5 * (1 / 2.16) * 2.16; rs.pan += (Math.max(0.33, Math.min(0.67, 0.5 + (fx - 0.5) * 0.55)) - rs.pan) * 0.05; } else rs.pan += (0.5 - rs.pan) * 0.05;
    return { fov: 70, body: 62, crop: rs.pan }; },   // (the game's own first-person camera and lenses; the frame is a tall slice of it that leans toward the wave)
  done() { const g = G(); Math.random = typeof rnd0 === 'function' ? rnd0 : NATIVE_RANDOM; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; } }; })();
// in the villa, as you: walking from the board room through the living room, out through the open doors to the balcony
// and the view; and reaching for a board in the rack
function walkTake(n, start, pts, pitch0, pitch1, cropX = 0.5) { let wi = 0; return { n,
  init() { villaInit(); const g = G(), w = g.walker; w.sit = null; w.x = OX - start[0]; w.z = start[1] + OZ; w.y = 27.65; w.yaw = Math.atan2(pts[0][1] + OZ - w.z, OX - pts[0][0] - w.x); wi = 0; g.step(0.3, 1 / 30, false); },
  frame(i) { const g = G(), w = g.walker, k = i / n; const tgt = pts[Math.min(wi, pts.length - 1)], tx = OX - tgt[0], tz = tgt[1] + OZ;
    if (Math.hypot(tx - w.x, tz - w.z) < 0.6 && wi < pts.length - 1) wi++;
    const want = Math.atan2(tz - w.z, tx - w.x); w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * 0.08; w.pitch = pitch0 + (pitch1 - pitch0) * k;
    w.mz = wi >= pts.length - 1 && Math.hypot(tx - w.x, tz - w.z) < 0.7 ? 0 : 0.85; g.step(1 / FPS, 1 / FPS, false); return { fov: 61.6, body: 61.6, crop: cropX }; } }; }   // (the villa's own camera and lens, a tall slice of it)
T.walk = walkTake(165, [-97.2, 36.6], [[-94.5, 36.5], [-91, 35.8], [-87.5, 36.6], [-85.9, 37.4], [-83.6, 38.2]], 0.12, -0.08);
T.coach = walkTake(120, [-91.2, 35.2], [[-89.2, 36.4], [-88.4, 36.9]], 0.02, -0.02, 0.5);   // (in the living room, up to Coach Rudi at the open doors)
T.rack = walkTake(85, [-95.6, 38.3], [[-97.9, 38.3], [-98.1, 38.3]], -0.02, -0.14, 0.58);
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
  while (s.i < t.n && performance.now() - t0 < budget) { const o = t.frame(s.i); if (!t.keep || t.keep.some(([a, b]) => s.i >= a && s.i <= b)) { draw(o.fov, o.body, o.crop, o.chase); await grab(name, s.i); } s.i++; }   // (keep: only the stretches the edit uses get drawn)
  await flush();
  if (s.i >= t.n) { if (t.done) t.done(); return `${name}: done (${t.n} frames)`; }
  return `${name}: ${s.i}/${t.n}`;
}
export function reset(name) { delete S[name]; }
// one test frame of a take (after k frames), saved as frames/_peek/<name>.jpg, to judge the framing before filming it all
export async function peek(name, k = 0) { const t = T[name]; delete S[name]; t.init(); let o; for (let i = 0; i <= k; i++) { o = t.frame(i); if (i < k && Array.isArray(o.chase)) { const c = G().camera; c.position.copy(o.chase[0]); c.quaternion.copy(o.chase[1]); } } draw(o.fov, o.body, o.crop, o.chase);
  const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85)); await fetch(`http://127.0.0.1:8799/f?shot=_peek_${name}&i=${k}`, { method: 'POST', body: blob }); return 'peeked ' + name; }
// dry run of a take (no drawing): the rider's line every few frames, to set a take up before filming it
export function sim(name, n, every = 20) { const t = T[name], g = G(); delete S[name]; t.init(); const out = [];
  for (let i = 0; i < n; i++) { const o = t.frame(i); if (o && Array.isArray(o.chase)) { g.camera.position.copy(o.chase[0]); g.camera.quaternion.copy(o.chase[1]); } if (i % every === 0) { const r = g.rider; if (!r) continue; const w = r.wave, H = w ? w.cond.H : 1;
    out.push(`${i} ${r.state} t${r.stateT.toFixed(1)} s${w ? (r.s / H).toFixed(2) : '-'} y${w ? (r.y / H).toFixed(2) : '-'}${r.inBarrel ? ' B' : ''}${w && w.endK < 1 ? ' end' + (w.endK * 100 | 0) : ''}`); } }
  return out.join(' | '); }
