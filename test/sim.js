// Automated ride checks: run scripted riders through many waves and report what happened.
// Use in the page console: const m = await import('./test/sim.js'); m.batch()
const g = () => window.__g;
export function run(policy, secs = 70) {
  const G = g(); G.newWave(); const r = G.rider; let t = 0; const trace = [];
  G.input.paddleBtn = false; G.input.test = 0;
  for (; t < secs; t += 1 / 30) {
    if (r.state === 'WAIT' && r.zRel < 2.5 * r.wave.cond.speed) G.input.paddleBtn = true;
    if (r.state === 'RIDE' || r.state === 'POPUP') { const o = policy(r); G.input.test = typeof o === 'number' ? o : o.steer; G.input.paddleBtn = typeof o === 'number' ? false : !!o.pump; }
    G.step(1 / 30, 1 / 30, false);
    if (r.state === 'RIDE' && Math.round(t * 30) % 30 === 0) trace.push(`${t.toFixed(0)} s=${r.s.toFixed(1)} a=${r.a.toFixed(2)} v=${r.v.toFixed(1)} psi=${r.psi.toFixed(2)}${r.inBarrel ? ' B' : ''}`);
    if (r.state === 'WIPE' || r.state === 'DONE') break;
  }
  G.input.test = null; G.input.paddleBtn = false; const R = r.ride;
  return { line: `${r.wave.cond.name}: ${r.why} | t=${R.t.toFixed(1)} pocket=${R.pocket.toFixed(1)} barrel=${R.barrel.toFixed(1)} top=${R.top.toFixed(0)} score=${R.score}`, trace };
}
// hold a target height on the face
export const hold = (ta) => (r) => {
  return Math.max(-1, Math.min(1, (0.5 - ta) / 0.38));   // thumb position = the line you want
};
// pump: swing up and down the face in the pocket to build speed and score turns
export const pump = (r) => { const H = r.wave.cond.H; const hi = (r.t = (r.t || 0) + 1 / 30) % 1.6 < 0.8; return hold(r.s > 3 * H ? 0.8 : hi ? 0.7 : 0.25)(r); };
// a decent surfer: stay near the curl, go high to slow down when too far ahead, low to run when the curl is close, tuck low in the barrel
export const pocket = (r) => {
  const H = r.wave.cond.H, s = r.s;
  let ta = s > 2 * H ? 0.75 : s < -0.2 * H ? 0.35 : 0.5;
  return hold(ta)(r);
};
// barrel hunter: stall high to let the curl catch up, then drop low and hold a line inside
export const tube = (r) => { const H = r.wave.cond.H, s = r.s; return hold(s > 0.5 * H ? 0.85 : s > -0.3 * H ? 0.5 : 0.4)(r); };
// barrel rider: stall high to let the curl come, drop in, then high line to stay deep, low line if too deep
export const barrel = (k = 1) => (r) => {
  const H = r.wave.cond.H, s = r.s;
  if (s > k * H) return hold(0.85)(r);
  if (s > -0.4 * H) return hold(0.5)(r);
  return hold(s > -1.3 * H ? 0.66 : s > -2.2 * H ? 0.52 : 0.38)(r);
};
// any rider plus well-timed pumping (push only while dropping) vs mashing (always held)
export const withPump = (p) => (r) => ({ steer: p(r), pump: r.psi < -0.12 });
export const mash = (p) => (r) => ({ steer: p(r), pump: true });
export function batch(n = 4, policies = { straight: () => 0, hold5: hold(.5), pocket, pump, tube }) {
  const out = [];
  for (let i = 0; i < n; i++) for (const [k, p] of Object.entries(policies)) out.push(k + ' ' + run(p).line);
  return out.join('\n');
}

// screenshot helpers: freeze the live loop and step the game to a moment
export function scene(mode = 'medium') {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
  G.newWave(); G.input.paddleBtn = false; G.input.test = 0; return G.rider;
}
export function until(cond, policy = () => 0, max = 60) {
  const G = g(), r = G.rider; let t = 0;
  while (!cond(r) && t < max) { if (r.state === 'WAIT' && r.zRel < 2.5 * r.wave.cond.speed) G.input.paddleBtn = true; if (r.state === 'RIDE' || r.state === 'POPUP') { const o = policy(r); G.input.test = typeof o === 'number' ? o : o.steer; G.input.paddleBtn = typeof o === 'number' ? false : !!o.pump; } G.step(1 / 30, 1 / 30, false); t += 1 / 30; }
  G.step(1 / 60); return `${r.state} s=${r.s.toFixed(1)} a=${r.a.toFixed(2)} v=${r.v.toFixed(1)} zRel=${r.zRel.toFixed(1)} barrel=${r.inBarrel} ${r.why}`;
}
// a fixed debug camera around the rider (dx, dy, dz metres from the board)
export function look(dx, dy, dz, ty = 0.8) {
  const G = g(), p = G.rig.position; G.camera.position.set(p.x + dx, p.y + dy, p.z + dz); G.camera.lookAt(p.x, p.y + ty, p.z); G.renderer.render(G.scene, G.camera);
}
// catching like a person: wait, start paddling when the wave is `lead` seconds away, keep holding until up
export function catchTest(lead, n = 6) {
  const G = g(), out = {};
  for (let i = 0; i < n; i++) {
    G.newWave(); const r = G.rider; G.input.test = 0; G.input.paddleBtn = false;
    for (let t = 0; t < 30 && (r.state === 'WAIT' || r.state === 'PADDLE'); t += 1 / 30) {
      if (r.zRel < lead * r.wave.cond.speed) G.input.paddleBtn = true;
      G.step(1 / 30, 1 / 30, false);
    }
    const k = r.state === 'POPUP' ? 'CAUGHT' : r.why; out[k] = (out[k] || 0) + 1;
  }
  G.input.paddleBtn = false; G.input.test = null;
  return JSON.stringify(out);
}
