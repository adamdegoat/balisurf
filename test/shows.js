// The villa's wildlife shows (wildlife.js SHOWS), filmed from the balcony: puts one on, lets the five-second note run,
// then sends a frame every `every` seconds (look/NNNNN.jpg), the camera on where the show is.
//   const S = await import('./test/shows.js'); await S.film('breach', 1000)
import { cap } from './look.js';
const G = () => window.__g;
const P = { x: 172, z: 125 }, EYE = 28.4;   // (the balcony, in the waves' frame, as wildlife.js has it)
export async function film(kind, base = 1000, { n = 10, every = 1.5 } = {}) {
  const g = G(); if (!g.walker) { g.startVilla(); for (let k = 0; k < 30 && !g.friends; k++) { g.step(0.2, 1 / 30, false); await new Promise((r) => setTimeout(r, 200)); } }
  const w = g.wild; w.show(kind); g.step(5.2, 1 / 30, false);
  const out = [];
  for (let k = 0; k < n; k++) {
    g.step(every, 1 / 30, false);
    const W = w.whale, pod = w.pod, c = g.camera;
    let tx, ty = 0, tz, fov = 40;
    if (kind === 'breach' || kind === 'lobtail' || kind === 'calf') { tx = W.x; tz = W.z; ty = 2; fov = 9; }
    else if (kind === 'dolphins') { tx = pod.x0 + pod.dx * pod.t; tz = pod.z0; fov = 30; }
    else if (kind === 'mantas') { tx = P.x - 28; tz = P.z - 18; fov = 45; }
    else if (kind === 'eagle') { tx = P.x - 22; ty = 20; tz = P.z - 28; fov = 60; }
    else { tx = P.x - 32; tz = P.z - 34; fov = 35; }
    c.position.set(P.x - 3, EYE, P.z - 6); c.lookAt(tx, ty, tz); c.fov = fov; c.updateProjectionMatrix(); c.updateMatrixWorld();   // (just out past the balcony rail, clear of its posts)
    await cap(base + k, 1); g.paused = false; out.push(w.shows.on || '-');
  }
  return out.join(' ');
}
