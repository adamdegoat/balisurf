// run on the OLD build: every frame, how far the new rule (keep the eye 12 cm under any overhanging lip) would lower the eye
// from where the old build put it, and whether the old eye was inside the drawn water then
import { moment } from './shots.js';
import * as THREE from 'three';
const G = () => window.__g;
const _sec = new Float32Array(256);
function lipUnder(w, sk, zl, y) {
  const c = w.prof.slice(sk), U = c.U; if (U.length < 2 || zl <= U[0][0] || zl >= U[U.length - 1][0]) return Infinity;
  if (!c.lipTop) {   // (once per slice: the lip's upper side, from its tip back over the crest and down the back)
    w.section(Math.round(sk * 5) / 5, _sec); c.lipTop = [];
    for (let j = c.F.length + U.length - 2; j < 64; j++) c.lipTop.push(_sec[j * 4], _sec[j * 4 + 1]);
  }
  const T = c.lipTop; let top = -Infinity;
  for (let i = 2; i < T.length; i += 2) { const z0 = T[i - 2], z1 = T[i]; if ((zl - z0) * (zl - z1) <= 0) top = Math.max(top, T[i - 1] + (T[i + 1] - T[i - 1]) * (zl - z0) / (z1 - z0 || 1e-6)); }
  if (y >= top) return Infinity;
  for (let i = 1; i < U.length; i++) if (zl <= U[i][0]) { const t = (zl - U[i - 1][0]) / Math.max(1e-6, U[i][0] - U[i - 1][0]); return U[i - 1][1] + (U[i][1] - U[i - 1][1]) * t; }
  return Infinity;
}
export async function est(mode, seed = 7, aim = 0.85, push = 1.0) {
  const g = G(); document.getElementById('start').style.display = 'none';
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const r = g.rider, c = g.camera, rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), nm = new THREE.Matrix3();
  let n = 0, e2 = 0, e5 = 0, e10 = 0, mx = 0, inside = 0, insideFixed = 0, insideNotFixed = 0, fullIn = 0, fullFixed = 0;
  for (let i = 0; i < 60 * 40 && r.state === 'RIDE'; i++) {
    const w = r.wave, H = w.cond.H, sH = r.s / H, yH = r.y / H;
    const err = yH - aim + (r.stalling ? 0.12 : 0), sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(r.v, 1) + err * 0.9)), a0 = Math.asin(sn);
    let steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - r.th), Math.cos(a0 - r.th)) * 3));
    if (Math.floor(i / 45) % 2) steer = Math.max(-1, Math.min(1, steer + push * (g.mirror ? -1 : 1)));
    const st = !r.inBarrel && sH > -0.2;
    g.input.test = st ? null : steer; g.input.stick = st ? { x: steer, y: 1 } : null; g.input.paddleBtn = !st && sH < -1.2;
    g.step(1 / 60, 1 / 60, false); if (r.state !== 'RIDE') break; n++;
    const f = w.fade || 1, p = c.position, s = p.x - w.peelX;
    let lip = Infinity; for (let k = -1; k <= 1; k++) { const sk = s + k * 0.4; lip = Math.min(lip, lipUnder(w, sk, p.z - w.zW - w.bend(sk), p.y / f)); }
    const extra = Math.min(0.1, Math.max(0, p.y - Math.max(lip * f - 0.12, r.y + 0.6)));
    if (extra > 0.02) e2++; if (extra > 0.05) e5++; if (extra > 0.1) e10++; mx = Math.max(mx, extra);
    const m = w.mesh; m.updateMatrixWorld(true); rc.set(p, down); rc.far = 40; const h = rc.intersectObject(m, false)[0];
    if (h && h.face) { nm.getNormalMatrix(m.matrixWorld); if (h.face.normal.clone().applyMatrix3(nm).y < 0) { inside++; const fx = p.y - extra < h.point.y - 0.02; if (fx) insideFixed++; else insideNotFixed++; if (f >= 0.8) { fullIn++; if (fx) fullFixed++; } } }
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  return `${mode}/${seed} aim ${aim}: ${n} frames | new rule lowers the eye >2cm ${e2}, >5cm ${e5}, >10cm ${e10}, most ${(mx * 100).toFixed(0)}cm | old eye inside the water ${inside}: fixed ${insideFixed}, not fixed ${insideNotFixed} | on full-size waves ${fullIn}: fixed ${fullFixed}`;
}
