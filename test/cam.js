// Camera framing check: distance, height above the surfer, and whether the wave hides them,
// split into the pop-up/drop (first 2 s) and the rest of the ride.
// In the page console: const m = await import('./test/cam.js'); await m.camCheck('medium')
import { brain } from './sim2.js';
import * as THREE from 'three';
const ray = new THREE.Raycaster();
export function camCheck(mode, n = 2) {
  const G = window.__g; G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = brain({}), A = { pop: { d: [], u: [], v: 0, t: 0 }, ride: { d: [], u: [], v: 0, t: 0 } }; let rides = 0;
  for (let i = 0; i < 60 * 100 && rides < n; i++) {
    const r = G.rider; if (r.state === 'WIPE' || r.state === 'OUT') { G.spawnRider(); rides++; continue; }
    const o = br(r); G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle; G.step(1 / 60, 1 / 60, false);
    if (!r.standing || i % 3) continue;
    const a = A[r.state === 'POP' || r.stateT < 2 ? 'pop' : 'ride'], c = G.camera.position, p = G.rig.position;
    a.d.push(c.distanceTo(p)); a.u.push(c.y - p.y);
    const h = p.clone(); h.y += 0.8; const dd = h.clone().sub(c), L = dd.length(); ray.set(c, dd.normalize()); ray.far = L - 0.3;
    a.t++; if (!ray.intersectObjects(G.waves.map((w) => w.mesh).filter(Boolean), false).length) a.v++;
  }
  G.input.test = null;
  const md = (x) => { x.sort((a, b) => a - b); return `${x[Math.floor(x.length * .5)].toFixed(1)} (max ${x[x.length - 1].toFixed(1)})`; };
  return mode + ': ' + ['pop', 'ride'].map((k) => `${k}: dist ${md(A[k].d)} above ${md(A[k].u)} visible ${(A[k].v / A[k].t * 100).toFixed(0)}%`).join(' | ');
}
