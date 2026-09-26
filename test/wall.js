// in and near the barrel, pushing into the wall: does your view end up through the wave face (inside the water, or out
// behind the wave) instead of in the tube? Counts every frame the camera is on the wrong side of the face or the curtain
import { moment } from './shots.js';
const G = () => window.__g;
export async function wall(mode, seed = 7, push = 0.7, stall = true) {
  const g = G(); const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera; let n = 0, tube = 0, face = 0, curt = 0, first = '';
  for (let i = 0; i < 60 * 40 && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H, f = w.fade || 1;
    const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    // pushing into the wall now and then, like a player hugging the face (the turn that takes you up toward the wave)
    const into = Math.sign(Math.sin(r.th + 1.2)) || 1; if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + push * (g.mirror ? -1 : 1)));
    const st = stall && !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break; n++; if (r.inBarrel) tube++;
    const s = c.position.x - w.peelX, zl = c.position.z - w.zW - w.bend(s), cy = c.position.y / f, sl = w.prof.slice(s);
    if (cy > 0.05 && cy < sl.top - 0.1) {
      const fz = w.prof.frontZAt(s, cy); if (fz !== undefined && isFinite(fz) && zl < fz - 0.08) { face++; if (!first) first = `face ${i} tube ${r.inBarrel ? 1 : 0} y/H ${yH.toFixed(2)} s/H ${sH.toFixed(2)}`; }
      const cz = w.prof.curtainZ(s, cy); if (isFinite(cz) && r.zl < w.prof.curtainZ(r.s, r.y / f) && zl > cz + 0.08) curt++;
    }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return `${mode}/${seed}/push ${push}: ${n} frames (${tube} in the tube), camera through the face ${face}, out past the curtain ${curt}${first ? ' | first: ' + first : ''} | ${r.why || r.state}`;
}
