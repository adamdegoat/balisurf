// Free-roam checks: a scripted surfer that reads the sea like a person and plays whole sessions.
// In the page console: const m = await import('./test/sim2.js'); m.session('medium', 6)
const g = () => window.__g;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// lying: wait facing out, turn to the beach as a wave comes, paddle for the last `lead` seconds
// riding: angle down the line; climb when low, drop when high (`style` 0..1 = how hard it carves)
export function brain({ lead = 2.5, style = 0.5, pumpOn = true } = {}) {
  return (r) => {
    const G = g();
    if (!r.standing) {
      const inc = G.incoming();
      const wantTh = inc.w && inc.t < 6 ? Math.PI / 2 : -Math.PI / 2;
      const d = wrap(wantTh - r.th);
      return { steer: Math.max(-1, Math.min(1, d * 2)), paddle: !!(inc.w && inc.t < lead && Math.abs(d) < 0.5), pump: false };
    }
    const sl = r.wave ? r.wave.prof.slice(r.s) : null, top = sl ? Math.max(sl.top, 0.3) : 1;
    const hRel = r.y / top;                                           // 0 = bottom, 1 = top of the wave
    const c = r.wave ? r.wave.cond.speed : 5;
    // keep pace with the wave coming in (v*sin(th) ~ c), a bit more when high (drop), a bit less when low (climb)
    const want = c + (hRel - 0.5) * 3 * (1 + style);
    const base = r.v < c * 0.95 ? 1.1 : Math.asin(Math.max(-0.6, Math.min(0.97, want / Math.max(r.v, 0.5))));
    const d = wrap(base - r.th);
    return { steer: Math.max(-1, Math.min(1, d * 2.2)), paddle: false, pump: pumpOn && r.gAlong < -0.05 };
  };
}

// play n waves (each ends in a wipe or the ride ending); report what happened
export function session(mode, n = 6, opts = {}) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
  G.spawnRider();
  const br = brain(opts), out = [];
  let t = 0, guard = 0;
  while (out.length < n && guard++ < 30 * 60 * 4) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') {
      const R = r.ride;
      out.push(`${r.why} | ride ${R.t.toFixed(1)}s top ${Math.round(R.top)}km/h turns ${R.turns} barrel ${R.barrel.toFixed(1)} score ${R.score}`);
      G.spawnRider(); continue;
    }
    const o = br(r);
    G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle;
    G.step(1 / 30, 1 / 30, false); t += 1 / 30;
  }
  G.input.test = null; G.input.paddleBtn = false;
  return `${mode} (${(t / 60).toFixed(1)} min)\n` + out.join('\n');
}

// follow one ride in detail
export function trace(mode, opts = {}, secs = 40) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
  G.spawnRider();
  const br = brain(opts), lines = [];
  for (let t = 0; t < secs; t += 1 / 30) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') { lines.push(`END ${r.why}`); break; }
    const o = br(r); G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle;
    G.step(1 / 30, 1 / 30, false);
    if (Math.round(t * 30) % 10 === 0) lines.push(`${t.toFixed(1)} ${r.state} x=${r.x.toFixed(1)} z=${r.z.toFixed(1)} y=${r.y.toFixed(2)} v=${r.v.toFixed(1)} vz=${r.vz.toFixed(1)} th=${r.th.toFixed(2)} s=${r.s.toFixed(1)} zl=${r.zl.toFixed(1)} face=${r.onFace ? 1 : 0}${r.inBarrel ? ' B' : ''}`);
  }
  G.input.test = null; G.input.paddleBtn = false;
  return lines.join('\n');
}
