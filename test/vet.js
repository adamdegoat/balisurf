// View vet: rides a wave with a scripted surfer (a smooth line, or a rough thumb that swings to full lock) and counts
// every frame where the first-person view goes wrong: the eye inside the water, out past the lip hanging in front,
// up through the tube's roof, jumping in height, or the view swinging fast.
//   const v = await import('./test/vet.js'); await v.vet('hard', 7, true)       // rough line at Batu Hitam
import * as THREE from 'three';
import { heightAt } from '../js/surf.js?v=119';
import { moment } from './shots.js';
const G = () => window.__g;

export async function vet(mode, seed, rough, kind) {
  const g = G(); window.RANCH_KIND = kind || 'medium';
  const r0 = await moment(mode, 'trim', seed);
  if (!r0.includes(': ok')) return `${mode} no ride`;
  const r = g.rider, c = g.camera, pd = new THREE.Vector3(), d = new THREE.Vector3(); c.getWorldDirection(pd);
  let F = 0, water = 0, curt = 0, roof = 0, jumps = 0, swings = 0, relPrev = null, tube = 0;
  for (let i = 0; i < 60 * 40; i++) {
    if (r.state !== 'RIDE') break;
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H, f = w.fade || 1;
    const err = yH - 0.35 - (rough ? 0.3 : 0.2) * Math.sin(i / 60 * 1.3 + seed) + (r.stalling ? 0.12 : 0);
    const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9));
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(Math.asin(sn) - r.th), Math.cos(Math.asin(sn) - r.th)) * 3));
    if (rough && Math.floor(i / 40) % 3 === 1) steer = Math.sign(Math.sin(i * 0.05 + seed));
    const stall = !r.inBarrel && sH > -0.2;
    g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
    g.step(1 / 60, 1 / 60, false);
    if (r.state !== 'RIDE') break;
    F++; if (r.inBarrel) tube += 1 / 60;
    if (heightAt(g.waves, c.position.x, c.position.z) - c.position.y > 0.05 && !r.air) water++;
    const s = c.position.x - w.peelX, zl = c.position.z - w.zW - w.bend(s), cz = w.prof.curtainZ(s, c.position.y / f), rcz = w.prof.curtainZ(r.s, r.y / f);
    if (r.zl < rcz && zl > cz) curt++;
    if (c.position.y > w.prof.ceiling(s, zl) * f) roof++;
    const rel = c.position.y - g.rig.position.y; if (relPrev !== null && Math.abs(rel - relPrev) > 0.12) jumps++; relPrev = rel;
    c.getWorldDirection(d); if (Math.acos(Math.min(1, d.dot(pd))) * 57.3 > 3) swings++; pd.copy(d);
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return `${mode}${rough ? ' rough' : ''}: ${F} frames, eye in water ${water}, past lip ${curt}, through roof ${roof}, eye jumps ${jumps}, view swings ${swings}, barrel ${tube.toFixed(1)}s | ${r.why || r.state}`;
}
