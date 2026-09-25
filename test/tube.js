// Barrel check: a scripted surfer that sets up for the tube (stalls low in the pocket until the curl covers it, then
// pumps to hold its spot) and reports how long it was barreled and how the ride ended.
//   const t = await import('./test/tube.js'); await t.all()      // every level, three waves each
import { moment } from './shots.js';
const G = () => window.__g;

export async function tubeTry(mode, seed, { targetY = 0.35, verbose = false } = {}) {
  const g = G();
  const r0 = await moment(mode, 'trim', seed);
  if (!r0.includes(': ok')) return `${mode} seed${seed} no ride`;
  let tube = 0, longest = 0, total = 0, why = '', t = 0, out = false;
  const log = [];
  for (let i = 0; i < 60 * 25; i++) {
    const r = g.rider;
    if (r.state !== 'RIDE') { why = r.why || r.state; break; }
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    // hold a height on the face: above it, turn down toward the beach; below it, turn back up (+steer raises th, and
    // a heading with sin(th) > 0 points down the face); aim a little down while stalling, since a stalled board rises
    const dir = 1, err = yH - targetY + (r.stalling ? 0.12 : 0);
    // keep the board pointed along the line (down the tube), angled a little down or up to hold the height
    // (the wave itself runs at the beach at its own speed: holding a height means matching that, so 'along the line' is
    // angled toward the beach by asin(wave speed / your speed))
    const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    const thT = dir > 0 ? a0 : Math.PI - a0;
    const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(thT - r.th), Math.cos(thT - r.th)) * 3));
    const stall = !r.inBarrel && sH > -0.2;   // stall until covered, then trim (pump if it gets deep)
    g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null;
    g.input.paddleBtn = !stall && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); t += 1 / 60;
    if (r.inBarrel) { tube += 1 / 60; total += 1 / 60; longest = Math.max(longest, tube); } else { if (tube > 0.5) out = true; tube = 0; }
    if (verbose && i % 10 === 0) { const sl = w.prof.slice(r.s); log.push(`s${sH.toFixed(2)} y${yH.toFixed(2)} zl-lip${((r.zl - sl.lipZ) / H).toFixed(2)} v${r.v.toFixed(1)}${w.secK > 0 ? ' sec' : ''}${stall ? ' ST' : ''}${r.inBarrel ? ' B' : ''}`); }
  }
  g.input.stick = null; g.input.test = null; g.input.paddleBtn = false;
  return `${mode} seed${seed} longest ${longest.toFixed(1)}s total ${total.toFixed(1)}s ${out ? 'CAME OUT' : ''} end: ${why}` + (verbose ? '\n' + log.slice(-30).join('\n') : '');
}

export async function all(seeds = [3, 7, 11]) {
  const out = [];
  for (const m of ['easy', 'medium', 'hard', 'extreme']) for (const s of seeds) out.push(await tubeTry(m, s));
  return out.join('\n');
}
