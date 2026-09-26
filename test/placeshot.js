// Each spot as the surfer sees it: sitting in the lineup looking at the land (base + i), and riding (base + 100 + i),
// sent to the local frame receiver as look/NNNNN.jpg.
//   const P = await import('./test/placeshot.js'); await P.places(100)
import { moment } from './shots.js';
import { cap } from './look.js';
export const MODES = ['easy', 'medium', 'kanan', 'hard', 'hiu', 'extreme'];
export async function places(base = 100, modes = MODES) {
  const g = window.__g, out = [];
  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    await moment(m, 'sit', 7);
    const r = g.rig.position, c = g.camera;
    c.position.set(r.x, r.y + 1.3, r.z); c.lookAt(r.x, r.y + 6, r.z + 150); c.updateMatrixWorld();
    await cap(base + i, 1); g.paused = false;
    await moment(m, 'trim', 7); await cap(base + 100 + i, 1); g.paused = false;
    out.push(m);
  }
  return out.join(' ');
}
