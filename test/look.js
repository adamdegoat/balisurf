// Close-up look at a moment: sharp render (both passes, as the game draws it) sent to the local frame receiver
// (scratchpad trailer/recv.py on :8799) as look/NNNNN.jpg.
//   const L = await import('./test/look.js'); await L.shot('hard', 'barrel', 7, 2)
import { moment } from './shots.js';
const G = () => window.__g;
export async function cap(i, pr = 2) {
  const g = G(), r = g.renderer; g.paused = true; r.setPixelRatio(pr);
  r.autoClear = false; r.clear(); r.render(g.scene, g.camera);
  const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); r.clearDepth(); r.render(g.scene, a); r.autoClear = true;
  const b = await new Promise((res) => r.domElement.toBlob(res, 'image/jpeg', 0.92));
  await fetch(`http://127.0.0.1:8799/f?shot=look&i=${i}`, { method: 'POST', body: b });
  return `${r.domElement.width}x${r.domElement.height}`;
}
export async function shot(mode, what, seed, i) {
  document.getElementById('start').style.display = 'none';
  const m = await moment(mode, what, seed); return m + ' ' + (await cap(i));
}
