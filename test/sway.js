(async () => {
  const S = await import('./test/shots.js'); const g = __g;
  const ok = await S.moment('medium', 'trim', 7); const r = g.rider;
  let st = 99; const rnd0 = Math.random; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const V = g.camera.position.constructor, Q = g.camera.quaternion.constructor;
  const ci = new Q(), bf = new V(), bu = new V(), rows = [];
  for (let i = 0; i < 420 && r.state === 'RIDE'; i++) {
    const steer = Math.sin(i / 60 * Math.PI / 1.2) > 0 ? 1 : -1;   // a player swinging hard left and right every 1.2 s
    g.input.test = steer; g.input.paddleBtn = false; g.step(1 / 60, 1 / 60, true);
    ci.copy(g.camera.quaternion).invert();
    bf.set(0, 0, 1).applyQuaternion(g.rig.quaternion).applyQuaternion(ci);   // board nose direction, in the view
    bu.set(0, 1, 0).applyQuaternion(g.rig.quaternion).applyQuaternion(ci);   // board up, in the view
    const roll = Math.atan2(bu.x, bu.y) * 57.3, yaw = Math.atan2(bf.x, -bf.z) * 57.3;
    const rel = new V().copy(g.rig.position).sub(g.camera.position).applyQuaternion(ci);
    rows.push([roll, yaw, rel.x, rel.y]);
  }
  Math.random = rnd0; g.input.test = null;
  const st2 = (k) => { const a = rows.map((x) => x[k]); const m = a.reduce((s, v) => s + v, 0) / a.length; const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); let sp = 0; for (let i = 1; i < a.length; i++) sp = Math.max(sp, Math.abs(a[i] - a[i - 1])); return `sd ${sd.toFixed(2)} maxStep ${sp.toFixed(2)}`; };
  window.__sway = { ok, frames: rows.length, end: r.state, boardRollDeg: st2(0), boardYawDeg: st2(1), boardSideM: st2(2), boardUpDownM: st2(3) };
})();
