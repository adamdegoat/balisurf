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

// a surfer who works the face: drop, bottom turn, climb, top turn, drop again. Reports turns, speed, how rides end.
export function carve(mode, n = 5, { hi = 0.7, lo = 0.25, dv = null, gain = 2.5 } = {}) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
  G.spawnRider();
  const br = brain({}), out = []; let phase = 'down', guard = 0, hs = [];
  while (out.length < n && guard++ < 30 * 60 * 5) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') {
      const R = r.ride; hs.sort((a, b) => a - b);
      out.push(`${r.why} | ${R.t.toFixed(1)}s top ${Math.round(R.top)}km/h avg ${Math.round(R.speed / Math.max(R.t, 0.1) * 3.6)}+peel turns ${R.turns} snaps ${R.snaps} cutbacks ${R.cutbacks} pocket ${R.pocket.toFixed(1)} score ${R.score} | height used ${hs.length ? hs[Math.floor(hs.length * .1)].toFixed(2) + '-' + hs[Math.floor(hs.length * .9)].toFixed(2) : '-'}`);
      hs = []; phase = 'down'; G.spawnRider(); continue;
    }
    let o = br(r);
    if (r.state === 'RIDE' && r.wave) {
      const sl = r.wave.prof.slice(r.s), hRel = r.y / Math.max(sl.top, 0.3); hs.push(hRel);
      if (phase === 'down' && hRel < lo) phase = 'up'; else if (phase === 'up' && (hRel > hi || r.v < r.wave.cond.speed * 0.8)) phase = 'down';
      // down: come toward the beach faster than the wave; up: slower than it (the wave catches up and you climb)
      const c = r.wave.cond.speed, k = dv ?? 0.5 * c, wantVz = phase === 'down' ? c + k : c - k;
      const d = wrap(Math.asin(Math.max(-0.9, Math.min(0.97, wantVz / Math.max(r.v, 0.5)))) - r.th);
      o = { steer: Math.max(-1, Math.min(1, d * gain)), pump: false };
    }
    G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle;
    G.step(1 / 30, 1 / 30, false);
  }
  G.input.test = null; G.input.paddleBtn = false;
  return `${mode} carving\n` + out.join('\n');
}

export function carveBrain({ hi = 0.7, lo = 0.25, dv = null, gain = 2.5 } = {}) {
  const base = brain({}); let phase = 'down';
  return (r) => {
    if (r.state !== 'RIDE' || !r.wave) { if (!r.standing) phase = 'down'; return base(r); }
    const sl = r.wave.prof.slice(r.s), hRel = r.y / Math.max(sl.top, 0.3);
    if (phase === 'down' && hRel < lo) phase = 'up'; else if (phase === 'up' && (hRel > hi || r.v < r.wave.cond.speed * 0.8)) phase = 'down';
    const c = r.wave.cond.speed, k = dv ?? 0.5 * c, wantVz = phase === 'down' ? c + k : c - k;
    const d = wrap(Math.asin(Math.max(-0.9, Math.min(0.97, wantVz / Math.max(r.v, 0.5)))) - r.th);
    return { steer: Math.max(-1, Math.min(1, d * gain)), paddle: false, pump: false };
  };
}

// a cutback: ride down the line, then turn hard back toward the curl (up, round, and down facing it),
// then turn again to go back down the line. Reports how long the turn takes and what speed survives it.
export function cutback(mode, { at = 5, steer = 1 } = {}) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = brain({}); let phase = 0, t0 = 0, v0 = 0, log = [];
  for (let i = 0; i < 30 * 60; i++) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') { log.push(`END ${r.why} (phase ${phase})`); break; }
    let o = br(r);
    if (r.state === 'RIDE') {
      if (phase === 0 && r.stateT > at) { phase = 1; t0 = r.stateT; v0 = r.v; log.push(`start v ${(r.v * 3.6).toFixed(0)}km/h th ${r.th.toFixed(2)}`); }
      if (phase === 1) {   // turn back: heading swings through out-to-sea round to facing the curl (-x)
        o = { steer: -steer, pump: false };
        if (Math.cos(r.th) < -0.5) { phase = 2; log.push(`facing the curl after ${(r.stateT - t0).toFixed(2)}s, v ${(r.v * 3.6).toFixed(0)}km/h, slip max ${r._slipMax?.toFixed?.(0)}`); t0 = r.stateT; }
      } else if (phase === 2) {   // rebound: turn back round toward the beach and down the line
        o = { steer: steer, pump: false };
        if (Math.cos(r.th) > 0.3) { phase = 3; log.push(`back down the line after ${(r.stateT - t0).toFixed(2)}s, v ${(r.v * 3.6).toFixed(0)}km/h`); t0 = r.stateT; }
      } else if (phase === 3 && r.stateT - t0 > 3) { log.push(`still riding 3s later, v ${(r.v * 3.6).toFixed(0)}km/h`); break; }
    }
    G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle;
    G.step(1 / 30, 1 / 30, false);
  }
  G.input.test = null;
  return `${mode} cutback: ` + log.join(' | ');
}

// drift: every 4 s of a ride, hold the thumb at `amt` for 1.2 s; how far the board points away from where it's going (deg)
export function drift(mode, amt) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = brain({}), slips = []; let rideT = 0, n = 0;
  for (let i = 0; i < 60 * 90 && n < 4; i++) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') { G.spawnRider(); n++; continue; }
    let o = br(r);
    if (r.state === 'RIDE') {
      rideT += 1 / 60; const ph = rideT % 4;
      if (ph > 2.5 && ph < 3.7) {
        o.steer = (Math.floor(rideT / 4) % 2 ? 1 : -1) * amt;
        if (r.v > 4) { const vd = Math.atan2(r.vz, r.vx); slips.push(Math.abs(wrap(vd - r.th)) * 57.3); }
      }
    }
    G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle; G.step(1 / 60, 1 / 60, false);
  }
  G.input.test = null; slips.sort((a, b) => a - b);
  const p = (q) => slips.length ? slips[Math.floor(q * (slips.length - 1))].toFixed(0) : '-';
  return `${mode} thumb ${amt}: slide p50 ${p(.5)} p90 ${p(.9)} max ${p(1)} deg`;
}

// turn feel: mid-ride, push the thumb to `amt` for 1 s, then let go. How quickly the turn bites, how it lets go,
// and how much the tail slides. (A stiff board: bites and stops almost instantly.)
export function feel(mode, amt = 0.8) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = brain({}), tr = []; let t0 = -1;
  for (let i = 0; i < 60 * 60; i++) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') return `${mode}: ride ended (${r.why})`;
    let o = br(r);
    if (r.state === 'RIDE' && r.stateT > 4 && t0 < 0) t0 = r.stateT;
    if (t0 >= 0) {
      const t = r.stateT - t0;
      o = { steer: t < 1 ? amt : 0, pump: false };
      const slip = Math.abs(wrap(Math.atan2(r.vz, r.vx) - r.th)) * 57.3;
      tr.push({ t, turn: Math.abs(r.turn), slip });
      if (t > 2.2) break;
    }
    G.input.test = o.steer; G.input.paddleBtn = r.standing ? !!o.pump : !!o.paddle; G.step(1 / 60, 1 / 60, false);
  }
  G.input.test = null;
  const peak = Math.max(...tr.filter((x) => x.t < 1).map((x) => x.turn));
  const bite = tr.find((x) => x.turn >= 0.9 * peak)?.t ?? NaN;
  const settle = (tr.find((x) => x.t > 1 && x.turn < 0.1 * peak)?.t ?? NaN) - 1;
  const slips = tr.filter((x) => x.t < 1.3).map((x) => x.slip);
  return `${mode} thumb ${amt}: turn bites in ${bite.toFixed(2)}s, stops ${settle.toFixed(2)}s after letting go, peak ${(peak * 57.3).toFixed(0)} deg/s, tail slide max ${Math.max(...slips).toFixed(0)} deg`;
}

// ride with the real thumb pad (input.stick: x sideways, y up(-)/down(+)), like a player would. `plan(r, t)` gives the
// thumb position t seconds after standing. Paddling in is scripted as usual.
export function thumb(mode, plan, n = 2) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  const br = brain({}), out = []; let hs = [], guard = 0;
  while (out.length < n && guard++ < 60 * 60 * 4) {
    const r = G.rider;
    if (r.state === 'WIPE' || r.state === 'OUT') {
      const R = r.ride; hs.sort((a, b) => a - b);
      out.push(`${r.why} | ${R.t.toFixed(1)}s top ${Math.round(R.top)}km/h avg ${Math.round(R.speed / Math.max(R.t, 0.1) * 3.6)}+peel turns ${R.turns} snaps ${R.snaps} cutbacks ${R.cutbacks} score ${R.score} | height used ${hs.length ? hs[Math.floor(hs.length * .1)].toFixed(2) + '-' + hs[Math.floor(hs.length * .9)].toFixed(2) : '-'}`);
      hs = []; G.spawnRider(); continue;
    }
    if (!r.standing) { const o = br(r); G.input.stick = null; G.input.test = o.steer; G.input.paddleBtn = o.paddle; }
    else {
      G.input.test = null;
      G.input.stick = r.state === 'RIDE' ? plan(r, r.stateT) : plan.pop ? plan.pop(r) : { x: 0, y: 0 };
      G.input.paddleBtn = !!G.input.stick.pump;   // the plan can hold PUMP too
      if (r.wave && r.state === 'RIDE') hs.push(r.y / Math.max(r.wave.prof.slice(r.s).top, 0.3));
    }
    G.step(1 / 60, 1 / 60, false);
  }
  G.input.test = null; G.input.stick = null; G.input.paddleBtn = false;
  return `${mode}\n` + out.join('\n');
}
// a few ways a player might use the thumb
export const PLANS = {
  handsOff: () => ({ x: 0, y: 0 }),
  upDown: (r, t) => ({ x: 0, y: Math.floor(t / 1.1) % 2 ? 1 : -1 }),          // flick up to the lip, down to the bottom, repeat
  upDownHalf: (r, t) => ({ x: 0, y: (Math.floor(t / 1.1) % 2 ? 1 : -1) * 0.5 }),
  // read the wave: go up when low, down when high (what a player watching the screen does)
  reader: (r) => { if (!r.wave) return { x: 0, y: 0 }; const h = r.y / Math.max(r.wave.prof.slice(r.s).top, 0.3); r._ph = r._ph || 'up'; if (h > 0.7) r._ph = 'down'; else if (h < 0.25) r._ph = 'up'; return { x: 0, y: r._ph === 'up' ? -1 : 1 }; },
};
