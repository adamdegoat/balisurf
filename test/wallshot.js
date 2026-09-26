// the wall bot again, but snapping what you see (look/NNN.jpg) every `every` frames in and near the tube,
// with where the eye is against the face / curtain / roof at that moment
import { moment } from './shots.js';
import { cap } from './look.js';
const G = () => window.__g;
// which way the eye looks: toward the beach (+z, away from the wave), seaward (-z, into it), up/down
const THREE_V = (c) => { const e = c.matrixWorld.elements; return `z${(-e[10]).toFixed(2)} y${(-e[9]).toFixed(2)}`; };
export async function wallshot(mode, seed = 7, push = 0.7, every = 40, base = 0, aim = 0.35) {
  const g = G(); document.getElementById('start').style.display = 'none';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera, log = []; let k = 0;
  for (let i = 0; i < 60 * 40 && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H, f = w.fade || 1;
    const err = yH - aim + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + push * (g.mirror ? -1 : 1)));
    const st = !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break;
    if (i % every === 0 && (r.inBarrel || sH > -0.6)) {
      const s = c.position.x - w.peelX, zl = c.position.z - w.zW - w.bend(s), cy = c.position.y / f, sl = w.prof.slice(s);
      const fz = cy > 0.05 && cy < sl.top ? w.prof.frontZAt(s, cy) : NaN, cz = w.prof.curtainZ(s, cy), ce = w.prof.ceiling(s, zl);
      await cap(base + k, 1);
      const fw = THREE_V(c), lip = sl.top;
      log.push(`${base + k} f${i} tube ${r.inBarrel ? 1 : 0} y/H ${yH.toFixed(2)} eyeY-top ${(cy - lip).toFixed(2)} look ${fw} eye: face+${(zl - fz).toFixed(2)} curtain-${(cz - zl).toFixed(2)} roof-${(ce - cy).toFixed(2)}`);
      k++; g.paused = false;
    }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return log.join('\n') + '\n' + (r.why || r.state);
}
