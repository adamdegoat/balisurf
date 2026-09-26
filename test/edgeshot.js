// the wall bot high on the face; snaps what you see (look/NNN.jpg) only at the moments this fix is about: a lip only
// starting to curl over you at the edge of the barrel, on a full-size wave
import { moment } from './shots.js';
import { cap } from './look.js';
const G = () => window.__g;
export async function edgeshot(mode, seed = 7, base = 0, max = 6, at = null) {
  const g = G(); document.getElementById('start').style.display = 'none';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera, log = []; let k = 0, last = -99;
  for (let i = 0; i < 60 * 40 && r.state === 'RIDE' && k < (at ? at.length : max); i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    const err = yH - 0.85 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + (g.mirror ? -1 : 1)));
    const st = !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break;
    const f = w.fade || 1, s = c.position.x - w.peelX, zl = c.position.z - w.zW - w.bend(s), sl = w.prof.slice(s), U = sl.U;
    const under = U.length >= 2 && zl > U[0][0] && zl < U[U.length - 1][0];
    if (at ? at.includes(i) : f > 0.85 && sl.curl <= 0.3 && under && c.position.y / f > sl.F[sl.F.length - 1][1] - 0.6 && (at || i - last > 20)) {
      await cap(base + k, 1); g.paused = false; last = i;
      log.push(`${base + k} f${i} curl ${sl.curl.toFixed(2)} eye ${(c.position.y / f).toFixed(2)} lip underside ~${(U[Math.min(U.length - 1, 3)][1]).toFixed(2)}`); k++;
    }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return log.join('\n') || 'no edge moments';
}
