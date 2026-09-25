// Set up a moment for a screenshot (paused, so the page keeps drawing that exact frame).
//   const s = await import('./test/shots.js'); await s.moment('medium', 'trim')  // sit | paddle | pop | trim | carve | stall | barrel
//   s.outside()  // swap to a camera beside the surfer (to judge the pose)   s.inside()  // back to first person
import { brain, carveBrain } from './sim2.js';
const G = () => window.__g;
let saved = null;
export async function moment(mode, what, seed = 7) {
  const g = G(); const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.paused = true; g.setMode(mode); document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); document.getElementById('hint').style.visibility = 'hidden';
  g.spawnRider(); const br = what === 'carve' ? carveBrain() : brain({});
  const stop = { sit: (r) => r.state === 'LIE' && r.stateT > 2.5, sitwave: (r) => r.state === 'LIE' && g.incoming().t < 4, paddle: (r) => r.paddling && r.stateT > 1.5 && !r.onFace, pop: (r) => r.state === 'POP' && r.stateT > 0.2, pop0: (r) => r.state === 'POP' && r.stateT > 0.03,
    trim: (r) => r.state === 'RIDE' && r.stateT > 3, carve: (r) => r.state === 'RIDE' && r.stateT > 3 && Math.abs(r.lean) > 0.8, stall: (r) => r.state === 'RIDE' && r.stateT > 3,
    barrel: (r) => r.inBarrel && r.stateT > 3 }[what];
  let ok = false;
  try {
    for (let i = 0; i < 60 * 60; i++) {
      const r = g.rider;
      if (what === 'sit' || what === 'sitwave') { g.input.paddleBtn = false; g.input.test = 0; }
      else if (what === 'paddle' && r.stateT > 0.5 && !r.standing) { g.input.paddleBtn = true; g.input.test = 0; }
      else if (what === 'stall' && r.state === 'RIDE' && r.stateT > 2) { g.input.test = null; g.input.stick = { x: 0, y: 1 }; }
      else { const o = br(r); g.input.test = o.steer; g.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; }
      g.step(1 / 60, 1 / 60, false);
      if (stop(r)) { ok = true; break; }
      if (r.state === 'WIPE' || r.state === 'OUT') break;
    }
  } finally { Math.random = rnd0; g.input.stick = null; g.input.test = null; g.input.paddleBtn = false; }
  saved = null;
  return `${what}: ${ok ? 'ok' : 'NOT REACHED'} ${g.rider.state} t${g.rider.stateT.toFixed(1)} lean ${g.rider.lean.toFixed(2)}`;
}
export function outside(side = 1, dist = 2.6, up = 0.7) {
  const g = G(), c = g.camera, r = g.rig.position, th = g.rider.th;
  if (!saved) saved = { p: c.position.clone(), q: c.quaternion.clone() };
  c.position.set(r.x - Math.sin(th) * dist * side + Math.cos(th) * 0.4, r.y + up, r.z + Math.cos(th) * dist * side + Math.sin(th) * 0.4);
  c.lookAt(r.x, r.y + 0.45, r.z); g.CUT.value = 0; c.layers.enable(1);   // (the body is drawn on layer 1)
  g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(1); });
}
export function inside() { const g = G(); g.camera.layers.disable(1); if (saved) { g.camera.position.copy(saved.p); g.camera.quaternion.copy(saved.q); } g.CUT.value = 0.21; g.surfer.traverse((o) => { if (o.name === 'head') o.scale.setScalar(0.001); }); }
