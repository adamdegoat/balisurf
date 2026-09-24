// Turn meter: after 4 s of riding, hold the thumb at `amt` (one way) for `hold` s, then the other way (rail to rail),
// and measure what a sports scientist would: board yaw rate, travel-direction turn rate, radius, lateral g, slip angle
// (heading vs travel), how long the slide lasts, time to turn 90/180 deg, speed kept, rail-to-rail bite delay.
// In the page console: const m = await import('./test/turns.js'); m.turns('medium', 1)
import { brain } from './sim2.js';
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function turns(mode, amt = 1, hold = 1.6, seed = 7) {
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const G = window.__g; G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; G.spawnRider();
  const br = brain({}), tr = []; let t0 = -1, pth = null, ptr = null;
  try {
    for (let i = 0; i < 60 * 60; i++) {
      const r = G.rider;
      if (r.state === 'WIPE' || r.state === 'OUT') { if (t0 < 0) return `${mode}: ride ended before the test (${r.why})`; break; }
      let o = br(r);
      if (r.state === 'RIDE' && r.stateT > 4 && t0 < 0) t0 = r.stateT;
      if (t0 >= 0) {
        const t = r.stateT - t0;
        o = { steer: t < hold ? amt : t < 2 * hold ? -amt : 0, pump: false };
        const trav = Math.atan2(r.vz, r.vx);
        const yaw = pth == null ? 0 : wrap(r.th - pth) * 60, trn = ptr == null ? 0 : wrap(trav - ptr) * 60;
        pth = r.th; ptr = trav;
        tr.push({ t, yaw, trn, v: r.v, slip: wrap(r.th - trav) * 57.3, th: r.th });
        if (t > 2 * hold + 1) break;
      }
      G.input.test = o.steer; G.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; G.step(1 / 60, 1 / 60, false);
    }
  } finally { G.input.test = null; Math.random = rnd0; }
  const A = tr.filter((x) => x.t < hold), f = (x, d = 0) => x.toFixed(d);
  const peakYaw = Math.max(...A.map((x) => Math.abs(x.yaw))) * 57.3, avgYaw = A.reduce((a, x) => a + Math.abs(x.yaw), 0) / A.length * 57.3;
  let tot = 0; const t90 = A.find((x) => (tot += Math.abs(x.yaw) / 60 * 57.3) >= 90)?.t; tot = 0; const t180 = A.find((x) => (tot += Math.abs(x.yaw) / 60 * 57.3) >= 180)?.t;
  const totalTurn = A.reduce((a, x) => a + Math.abs(x.yaw) / 60, 0) * 57.3;
  const radii = A.filter((x) => Math.abs(x.trn) > 0.2).map((x) => x.v / Math.abs(x.trn)); radii.sort((a, b) => a - b);
  const g = Math.max(...A.map((x) => Math.abs(x.trn) * x.v)) / 9.8;
  const slipPk = Math.max(...A.map((x) => Math.abs(x.slip))), slipT = A.filter((x) => Math.abs(x.slip) > 10).length / 60;
  const bite = A.find((x) => Math.abs(x.yaw) * 57.3 > 0.5 * peakYaw)?.t;
  const B = tr.filter((x) => x.t >= hold && x.t < 2 * hold), sgn = Math.sign(A[A.length - 1].yaw);
  const r2r = B.find((x) => Math.sign(x.yaw) === -sgn && Math.abs(x.yaw) * 57.3 > 30)?.t;
  const vIn = tr[0].v, vOut = tr.find((x) => x.t >= hold)?.v;
  return `${mode} thumb ${amt}: in ${f(vIn * 3.6)} km/h, kept ${f(vOut / vIn * 100)}% | yaw peak ${f(peakYaw)} avg ${f(avgYaw)} deg/s | turned ${f(totalTurn)} deg in ${hold}s (90 at ${t90 ? f(t90, 2) : '-'}s, 180 at ${t180 ? f(t180, 2) : '-'}s) | radius min ${radii.length ? f(radii[0], 1) : '-'} m | ${f(g, 1)} g | slip peak ${f(slipPk)} deg, >10deg for ${f(slipT, 2)}s | bites ${bite != null ? f(bite, 2) : '-'}s | rail-to-rail ${r2r != null ? f(r2r - hold, 2) : '-'}s`;
}
