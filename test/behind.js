// does the first-person camera end up behind the wave (on its back, the far side of the crest) while you ride the front?
import { moment } from './shots.js';
import { carveBrain } from './sim2.js';
const G = () => window.__g;
export async function behind(mode, kind = 'carve', seed = 7) {
  const g = G(); window.RANCH_KIND = 'medium';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera, cb = carveBrain({ hi: 0.8, lo: 0.18, gain: 3.4 }); let n = 0, bad = 0, first = -1, why = '', after = -1, badAfter = 0, whyAfter = '';
  for (let i = 0; i < 60 * 45; i++) {
    const st = r.state; if (st !== 'RIDE' && st !== 'POP') { if (after === -1) after = i; if (i - after > 60 * 4) break; }
    const w = r.wave || g.waves[0]; if (!w) break; const H = w.cond.H, sH = (r.s || 0) / H, yH = (r.y || 0) / H;
    if (after >= 0) { g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; g.step(1 / 60, 1 / 60, false);
      for (const q of g.waves) { const s2 = c.position.x - q.peelX, z2 = c.position.z - q.zW - q.bend(s2), l2 = q.prof.slice(s2); if (Math.abs(s2) < 3 * q.cond.H && z2 < l2.topZ - 0.4 && z2 > l2.topZ - 3 * q.cond.H && c.position.y < l2.top * (q.fade || 1) - 0.2) { badAfter++; if (!whyAfter) whyAfter = `${r.state} +${((i - after) / 60).toFixed(1)}s`; } }
      continue; }
    if (kind === 'barrel') { const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
      const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3)), stall = !r.inBarrel && sH > -0.2;
      g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2; }
    else { const o = cb(r); g.input.stick = null; g.input.test = o.steer; g.input.paddleBtn = r.v < w.cond.speed * 0.85; }
    g.step(1 / 60, 1 / 60, false); n++;
    const s = c.position.x - w.peelX, zl = c.position.z - w.zW - w.bend(s), sl = w.prof.slice(s);
    const riderSl = w.prof.slice(r.s);
    if (r.state === 'RIDE' && r.zl > riderSl.topZ - 0.3 && zl < sl.topZ - 0.4 && c.position.y < sl.top * (w.fade || 1) + 0.3) { bad++; if (first < 0) { first = i; why = `cam zl ${zl.toFixed(1)} crest ${sl.topZ.toFixed(1)} rider zl ${r.zl.toFixed(1)}`; } }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return `${mode}/${kind}/${seed}: ${n} frames, camera behind the wave ${bad}, after the ride ${badAfter}${whyAfter ? ' (' + whyAfter + ')' : ''}${first >= 0 ? ` (first at ${first}: ${why})` : ''} | ${r.why || r.state}`;
}
