// the same wall bot, but asking the DRAWN wave (the mesh you see), not the physics shape: every frame, is your eye
// inside the water? (a ray straight down from the eye: the first surface it meets is hit from below = you're inside it)
import { moment } from './shots.js';
import * as THREE from 'three';
const G = () => window.__g;
export async function probe(mode, seed = 7, push = 1.0, aim = 0.85, stopAt = -1) {
  const g = G(), T = THREE; document.getElementById('start').style.display = 'none';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera, rc = new T.Raycaster(), down = new T.Vector3(0, -1, 0), nm = new T.Matrix3();
  let n = 0, tube = 0, inside = 0, near = 0, deep = null, eyeSum = 0; const hits = [];
  for (let i = 0; i < 60 * 40 && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    const err = yH - aim + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + push * (g.mirror ? -1 : 1)));
    const st = !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break; n++; if (r.inBarrel) { tube++; eyeSum += c.position.y - r.y; }
    const diag = () => { const f = w.fade || 1, ep = c.position, es = ep.x - w.peelX, ez = ep.z - w.zW - w.bend(es), ey = ep.y / f, sl = w.prof.slice(es);
      const xs = Array.from(w.xs), k = xs.findIndex((x) => x > es);
      return ({ eye: { s: +es.toFixed(2), zl: +ez.toFixed(2), y: +ey.toFixed(2) }, rider: { s: +r.s.toFixed(2), zl: +r.zl.toFixed(2), y: +r.y.toFixed(2) }, H: w.cond.H, fade: f,
        curl: +sl.curl.toFixed(2), Ftop: sl.F[sl.F.length - 1].map((v) => +v.toFixed(2)), Ulen: sl.U.length, U: sl.U.map((p) => p.map((v) => +v.toFixed(2))),
        top: +sl.top.toFixed(2), ceiling: w.prof.ceiling(es, ez), curtain: w.prof.curtainZ(es, ey), frontAtEye: w.prof.frontZAt(es, ey), meshSlices: [xs[k - 1], xs[k]].map((v) => +v.toFixed(2)),
        hit: (() => { const m = w.mesh; m.updateMatrixWorld(true); c.updateMatrixWorld(true); const eye = c.getWorldPosition(new T.Vector3()); rc.set(eye, down); rc.far = 40;
          return rc.intersectObject(m, false).slice(0, 4).map((h) => { const lp = m.worldToLocal(h.point.clone()); nm.getNormalMatrix(m.matrixWorld); const nn = h.face.normal.clone().applyMatrix3(nm).normalize();
            return { d: +h.distance.toFixed(2), j: h.face.a % 64, jb: h.face.b % 64, i: Math.floor(h.face.a / 64), local: lp.toArray().map((v) => +v.toFixed(2)), n: nn.toArray().map((v) => +v.toFixed(2)) }; }); })(),
        eyeWorld: c.getWorldPosition(new T.Vector3()).toArray().map((v) => +v.toFixed(2)), meshPos: w.mesh.position.toArray().map((v) => +v.toFixed(2)), meshScale: w.mesh.scale.toArray().map((v) => +v.toFixed(2)), NU: 64 }); };
    if (i === stopAt) return JSON.stringify(diag());
    const m = w.mesh; m.updateMatrixWorld(true); c.updateMatrixWorld(true);
    const eye = c.getWorldPosition(new T.Vector3());
    rc.set(eye, down); rc.far = 40; const h = rc.intersectObject(m, false)[0];
    if (h && h.face) { nm.getNormalMatrix(m.matrixWorld); const ny = h.face.normal.clone().applyMatrix3(nm).normalize().y;
      if (ny < 0) { inside++; if (!deep && h.distance > (window.__deepT || 0.3)) deep = diag(); if (!window.__why) window.__why = []; { const f = w.fade || 1, ep = c.position, es = ep.x - w.peelX, ez = ep.z - w.zW - w.bend(es), sl = w.prof.slice(es), U = sl.U; let lu = Infinity; if (U.length >= 2 && ez > U[0][0] && ez < U[U.length - 1][0]) for (let q = 1; q < U.length; q++) if (ez <= U[q][0]) { lu = U[q - 1][1] + (U[q][1] - U[q - 1][1]) * (ez - U[q - 1][0]) / Math.max(1e-6, U[q][0] - U[q - 1][0]); break; }
        window.__why.push({ m: mode, f: +f.toFixed(2), size: +(w.size || 1).toFixed(2), endK: +(w.endK ?? 1).toFixed(2), curl: +sl.curl.toFixed(2), tube: r.inBarrel ? 1 : 0, eyeUp: +(ep.y - r.y).toFixed(2), lipUp: isFinite(lu) ? +(lu * f - r.y).toFixed(2) : null, d: +h.distance.toFixed(2) }); }
        if (hits.length < 400) hits.push(`f${i} fade ${(w.fade || 1).toFixed(2)} tube ${r.inBarrel ? 1 : 0} y/H ${yH.toFixed(2)} s/H ${sH.toFixed(2)} surface ${h.distance.toFixed(2)}m above-under`); }
      if (h.distance < 0.12) near++; }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  if (stopAt === -2) return JSON.stringify(deep);
  return `${mode}/${seed} push ${push} aim ${aim}: ${n} frames (${tube} tube, eye ${(eyeSum / Math.max(1, tube)).toFixed(3)}m over the board in it), eye INSIDE the drawn water ${inside}, eye within 12cm of the water ${near}\n  ` + hits.join('\n  ') + '\n  ' + (r.why || r.state);
}
