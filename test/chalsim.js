// what a ride at each spot actually produces (for setting challenge numbers): a carving bot and a barrel bot
import { moment } from './shots.js';
import { carveBrain } from './sim2.js';
const G = () => window.__g;
export async function ride(mode, kind = 'carve', seed = 7, board = 'short') {
  const g = G(); g.useBoard(board); window.RANCH_KIND = 'medium';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, cb = carveBrain({ hi: 0.8, lo: 0.18, gain: 3.4 }); let maxTube = 0;
  for (let i = 0; i < 60 * 60 && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    if (kind === 'barrel') { const err = yH - 0.35 + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
      const steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3)), stall = !r.inBarrel && sH > -0.2;
      g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2; }
    else { const o = cb(r); g.input.stick = null; g.input.test = o.steer; g.input.paddleBtn = r.v < w.cond.speed * 0.85; }
    g.step(1 / 60, 1 / 60, false); if (r.inBarrel) maxTube = Math.max(maxTube, r.ride.tubeT);
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false; g.useBoard('short');
  const d = r.ride, m = d.moves.map((x) => x.name);
  return `${mode}/${kind}/${board}: t ${d.t.toFixed(1)} top ${d.top.toFixed(0)} snaps ${d.snaps} cut ${d.cutbacks} turns ${d.turns} tube ${maxTube.toFixed(1)} barrelOut ${m.includes('BARREL') ? 1 : 0} air ${m.some((x) => x.startsWith('AIR')) ? 1 : 0} end ${d.end} score ${(d.score || 0).toFixed(1)} | ${r.why || r.state}`;
}
