// at one frame of a ride (the high-wall bot), render your view with the eye dropped straight down by each amount in `drops`
// (metres): how far can the eye duck before your own shoulder shows up in the lens
import { moment } from './shots.js';
import { cap } from './look.js';
const G = () => window.__g;
export async function blob(mode, seed, frame, drops, base = 500) {
  const g = G(); document.getElementById('start').style.display = 'none';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera;
  for (let i = 0; i <= frame && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    const err = yH - 0.85 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + (g.mirror ? -1 : 1)));
    const st = !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false);
  }
  const y0 = c.position.y, out = [];
  for (let k = 0; k < drops.length; k++) { c.position.y = y0 - drops[k]; c.updateMatrixWorld(true); await cap(base + k, 1); out.push(`${base + k}: -${drops[k] * 100}cm`); }
  c.position.y = y0; g.paused = false; g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return out.join(' ') + ` (eye ${(y0 - r.y).toFixed(2)}m over the board)`;
}
