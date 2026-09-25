// Where the graphics chip's time goes in one surfing frame: time the whole frame, then again with each kind of thing
// hidden (the sea, the waves, the land, the sky, spray and mist, everything else); the difference is its cost.
//   const G = await import('./test/gpu.js'); await G.breakdown('medium', 'trim', 7)
import { moment } from './shots.js';
const g = () => window.__g;
export async function bench(n = 60) {
  const G = g(), r = G.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!ext) return -1;
  const qs = [];
  for (let i = 0; i < n; i++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    r.autoClear = false; r.clear(); r.render(G.scene, G.camera); const a = G.armCam; a.position.copy(G.camera.position); a.quaternion.copy(G.camera.quaternion); r.clearDepth(); r.render(G.scene, a); r.autoClear = true;
    gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); if (i % 10 === 9) await new Promise((res) => setTimeout(res, 0)); }
  const t = [];
  for (let k = 0; k < 90 && qs.length; k++) { await new Promise((res) => requestAnimationFrame(res));
    for (let i = qs.length - 1; i >= 0; i--) if (gl.getQueryParameter(qs[i], gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) t.push(gl.getQueryParameter(qs[i], gl.QUERY_RESULT) / 1e6); gl.deleteQuery(qs[i]); qs.splice(i, 1); } }
  t.sort((a, b) => a - b); return +t[t.length >> 1].toFixed(2);
}
const kind = (o) => {
  const m = o.material; if (!m) return null;
  if (o.isPoints) return 'particles';
  const fs = m.fragmentShader || '';
  if (fs.includes('skyR')) return m.side === 2 ? 'waves' : 'sea';
  if (fs.includes('aerial haze')) return 'land';
  if (m.side === 1 && o.geometry && o.geometry.type === 'SphereGeometry') return 'sky';
  return 'other';
};
export async function breakdown(mode, what, seed = 7, pr = 1.3) {
  const G = g(); G.renderer.setPixelRatio(pr);
  const ok = await moment(mode, what, seed); G.paused = true;
  const groups = {}; G.scene.traverse((o) => { if (!o.visible) return; const k = kind(o); if (k) (groups[k] ||= []).push(o); });
  await bench(20); const all = await bench(60), out = { mode, what: ok, px: `${G.renderer.domElement.width}x${G.renderer.domElement.height}`, total: all };
  for (const [k, list] of Object.entries(groups)) { for (const o of list) o.visible = false; await bench(10); out[k] = +(all - await bench(50)).toFixed(2); for (const o of list) o.visible = true; }
  G.paused = false; return out;
}
// the same split for whatever is on screen now (the menu, the villa): each kind hidden in turn, A/B/A/B to beat drift
export async function now(pr = 1.3) {
  const G = g(); G.renderer.setPixelRatio(pr); G.paused = true;
  const inGroup = (o, grp) => { for (let p = o; p; p = p.parent) if (p === grp) return true; return false; };
  const groups = {};
  G.scene.traverse((o) => { if (!o.material) return; for (let p = o; p; p = p.parent) if (!p.visible) return;
    let k = kind(o); if (G.villaW && inGroup(o, G.villaW.group)) k = 'villa:' + (o.isPoints ? 'points' : o.material.type); else if (G.crew && inGroup(o, G.crew.group)) k = 'crew'; else if (G.wild && inGroup(o, G.wild.group)) k = 'wildlife';
    (groups[k] ||= []).push(o); });
  const out = { px: `${G.renderer.domElement.width}x${G.renderer.domElement.height}`, total: await bench(40) };
  for (const [k, l] of Object.entries(groups)) { let d = 0; for (let rep = 0; rep < 3; rep++) { const a = await bench(20); l.forEach((o) => { o.visible = false; }); const b = await bench(20); l.forEach((o) => { o.visible = true; }); d += a - b; } out[`${k}(${l.length})`] = +(d / 3).toFixed(2); }
  G.paused = false; return out;
}
