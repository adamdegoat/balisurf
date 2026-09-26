// the eye's height over the board every frame of a ride (the high-wall bot, or a normal line with aim 0.35), to compare
// two builds frame by frame (the same page load, the same seed = the same ride)
import { moment } from './shots.js';
const G = () => window.__g;
export async function duck(mode, seed = 7, aim = 0.85, push = 1.0) {
  const g = G(); document.getElementById('start').style.display = 'none';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera, ys = [];
  for (let i = 0; i < 60 * 40 && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    const err = yH - aim + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + push * (g.mirror ? -1 : 1)));
    const st = !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break;
    ys.push(Math.round((c.position.y - r.y) * 1000));
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return ys.join(',');
}
