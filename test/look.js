// Close-up look at a moment: sharp render (both passes, as the game draws it) sent to the local frame receiver
// (scratchpad trailer/recv.py on :8799) as look/NNNNN.jpg.
//   const L = await import('./test/look.js'); await L.shot('hard', 'barrel', 7, 2)
import { moment } from './shots.js';
const G = () => window.__g;
export async function cap(i, pr = 2) {
  const g = G(), r = g.renderer; g.paused = true; r.setPixelRatio(pr);
  const mir = g.mirror; if (mir) g.flipProj(g.camera);   // (a right-hand spot: the picture flipped, as the game draws it)
  r.autoClear = false; r.clear(); r.render(g.scene, g.camera);
  const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); if (mir) g.flipProj(a); r.clearDepth(); r.render(g.scene, a); if (mir) g.flipProj(a); r.autoClear = true;
  if (mir) g.flipProj(g.camera);
  const b = await (await fetch(r.domElement.toDataURL('image/jpeg', 0.92))).blob();   // (toBlob never calls back while the browser pane is hidden)
  await fetch(`http://127.0.0.1:8799/f?shot=look&i=${i}`, { method: 'POST', body: b });
  return `${r.domElement.width}x${r.domElement.height}`;
}
export async function shot(mode, what, seed, i) {
  document.getElementById('start').style.display = 'none';
  const m = await moment(mode, what, seed); return m + ' ' + (await cap(i));
}
// in the villa: stand (or sit) at a seat, or anywhere, and capture what you see
export async function villaAt(i, { seat, x, z, eye, yaw, pitch = -0.05, settle = 300 } = {}) {
  const g = G(); if (!g.walker) { g.startVilla(); await new Promise((r) => setTimeout(r, 2500)); }
  const w = g.walker;
  if (seat !== undefined) { const s = g.villaW.seats.filter((q) => !q.radio)[seat]; x = s.x; z = s.z; eye = s.eye; yaw = s.yaw; pitch = s.pitch; }
  g.paused = false; const put = () => { w.x = x; w.z = z; w.y = eye; w.yaw = yaw; w.pitch = pitch; w.sit = { x, z, eye, yaw, pitch }; w.sitT = 0; };
  const t0 = performance.now(); while (performance.now() - t0 < settle) { put(); await new Promise((r) => requestAnimationFrame(r)); }
  put(); const r = await cap(i, 1.6); w.sit = null; g.paused = false; return r;
}
// the wave seen from outside: a camera placed relative to its break (dx along the reef, dz toward the beach, h up),
// looking at a point (ax, ay, az) in the same frame
export async function waveView(i, mode, { dx = -12, dz = 30, h = 8, ax = -25, ay = 1, az = 0, t = 3 } = {}) {
  const g = G(); await moment(mode, 'sit', 7); g.paused = true;
  let w = null; for (let k = 0; k < 60 * 30 && !(w = g.waves.find((q) => q.peelX > 20 && q.peelX < 120)); k++) g.step(1 / 60, 1 / 60, false);
  for (let k = 0; k < 60 * t; k++) g.step(1 / 60, 1 / 60, false);
  w = g.waves.find((q) => q.peelX > 0) || g.waves[0];
  const c = g.camera; c.position.set(w.peelX + dx, h, w.zW + dz); c.lookAt(w.peelX + ax, ay, w.zW + az); c.updateMatrixWorld();
  return (await cap(i)) + ` peel ${w.peelX.toFixed(0)} H ${w.cond.H}`;
}
