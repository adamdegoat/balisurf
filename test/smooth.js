// Smoothness meter: plays rides with the scripted surfer at 60 fps and measures shake, frame to frame.
//   cam turn  = how far the camera's view direction swings per frame (deg); spikes = jerky camera
//   cam jerk  = sudden changes in the camera's motion (m/s^3-ish, second difference of velocity)
//   board jump = sudden changes in the board's height/tilt per frame
// In the page console: const m = await import('./test/smooth.js'); m.measure('medium')
import { brain } from './sim2.js';
const g = () => window.__g;
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))] || 0; };

export function measure(mode, secs = 60, opts = {}) {
  const G = g(); G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing');
  G.spawnRider();
  const br = brain(opts), dt = 1 / 60, cam = G.camera;
  const dir = cam.getWorldDirection(new cam.position.constructor()), pd = dir.clone();
  const P = [], turn = [], jerk = [], byJump = [], tilt = [], stateAt = [];
  let prevUp = null, prevState = '';
  const spikes = [], jspikes = [];
  for (let t = 0; t < secs; t += dt) {
    const r = G.rider;
    let skip = false;
    if (r.state === 'WIPE' || r.state === 'OUT') { if (r.stateT > 3.5) { G.spawnRider(); skip = true; } }
    else { const o = br(r); G.input.test = o.steer; G.input.paddleBtn = r.standing ? o.pump : o.paddle; }
    G.step(dt, dt, false);
    cam.getWorldDirection(dir);
    if ((prevState === 'OUT' || prevState === 'WIPE') && r.state === 'LIE') skip = true;   // the game respawned you
    prevState = r.state;
    if (skip) { pd.copy(dir); P.length = 0; prevUp = null; continue; }   // a respawn is a deliberate cut
    const tr = Math.acos(Math.min(1, dir.dot(pd))) * 57.3; turn.push(tr); pd.copy(dir);
    if (tr > 2.5) spikes.push(`${t.toFixed(2)}s ${r.state}/${r.stateT.toFixed(2)} ${tr.toFixed(1)}deg`);
    P.push(cam.position.clone());
    if (P.length >= 4) {
      const n = P.length, a = P[n - 1], b = P[n - 2], c = P[n - 3], d = P[n - 4];
      // third difference of position ~ jerk
      const jk = Math.hypot(a.x - 3 * b.x + 3 * c.x - d.x, a.y - 3 * b.y + 3 * c.y - d.y, a.z - 3 * b.z + 3 * c.z - d.z) / (dt * dt * dt);
      jerk.push(jk); if (jk > 3000) jspikes.push(`${t.toFixed(2)}s ${r.state}/${r.stateT.toFixed(2)} ${jk.toFixed(0)} ${[a.x - b.x, a.y - b.y, a.z - b.z].map((v) => (v * 60).toFixed(1))}${r.inBarrel ? ' B' : ''}`);
    }
    const up = G.rig.up.clone().applyQuaternion(G.rig.quaternion);
    if (prevUp) tilt.push(Math.acos(Math.min(1, up.dot(prevUp))) * 57.3);
    prevUp = up;
    stateAt.push(r.state);
  }
  G.input.test = null; G.input.paddleBtn = false;
  const f = (x) => x.toFixed(2);
  return `${mode}: cam turn/frame p50 ${f(pct(turn, .5))} p99 ${f(pct(turn, .99))} max ${f(Math.max(...turn))} deg | cam jerk p50 ${pct(jerk, .5).toFixed(0)} p99 ${pct(jerk, .99).toFixed(0)} | board tilt/frame p99 ${f(pct(tilt, .99))} max ${f(Math.max(...tilt))} deg | states ${[...new Set(stateAt)].join(',')}\n  spikes: ${spikes.sort((a, b) => parseFloat(b.split(' ').pop()) - parseFloat(a.split(' ').pop())).slice(0, 8).join(', ')} (${spikes.length} frames over 2.5deg)\n  jerks: ${jspikes.slice(0, 8).join(', ')}`;
}
