// Performance check: surf a wave frame by frame (paused, fixed 60 Hz steps), and for every frame time the game's own
// work (physics, waves, spray, sound, HUD), the time to hand the frame to the graphics chip, and (with the GPU timer)
// how long the graphics chip actually spends drawing it; plus draw calls, triangles and memory.
//   const p = await import('./test/perf.js'); await p.level('hard', 7)
import { moment } from './shots.js';
const G = () => window.__g;
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { med: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2) }; };

export async function level(mode, seed = 7, frames = 480, budget = 30000) {
  const g = G(), r = g.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  const sim = [], sub = [], q = [], calls = [], tris = [], heap = [], spikes = []; let lastProg = -1; const t00 = performance.now(); let n = 0;
  const rd = g.rider;
  for (; n < frames && performance.now() - t00 < budget; n++) {
    if (rd.state === 'RIDE') {   // the barrel bot: stall until covered, then hold the pocket
      const w = rd.wave, H = w.cond.H, sH = rd.s / H, yH = rd.y / H, err = yH - 0.35 - 0.2 * Math.sin(n / 60 * 1.3) + (rd.stalling ? 0.12 : 0);
      const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(rd.v, 1) + err * 0.9)), a0 = Math.asin(sn), steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - rd.th), Math.cos(a0 - rd.th)) * 3));
      const stall = !rd.inBarrel && sH > -0.2; g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2;
    }
    const t0 = performance.now(); g.step(1 / 60, 1 / 60, false); const t1 = performance.now();
    let qq = null; if (ext) { qq = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, qq); }
    r.info.autoReset = false; r.info.reset();
    r.autoClear = false; r.clear(); r.render(g.scene, g.camera); const a = g.armCam; a.position.copy(g.camera.position); a.quaternion.copy(g.camera.quaternion); r.clearDepth(); r.render(g.scene, a); r.autoClear = true;
    if (ext) gl.endQuery(ext.TIME_ELAPSED_EXT);
    const t2 = performance.now(); calls.push(r.info.render.calls); tris.push(r.info.render.triangles); r.info.autoReset = true;
    sim.push(t1 - t0); sub.push(t2 - t1); if (qq) q.push(qq); const progs = r.info.programs ? r.info.programs.length : -1; if (t2 - t1 > 15) spikes.push(`#${n} ${(t2 - t1).toFixed(0)}ms waves${g.waves.length} programs${progs} (was ${lastProg}) tex${r.info.memory.textures} geo${r.info.memory.geometries}`); lastProg = progs;
    if (n % 30 === 0 && performance.memory) heap.push(performance.memory.usedJSHeapSize / 1e6);
    if (n % 20 === 19) await new Promise((res) => setTimeout(res, 0));   // (let the browser breathe and deliver timer results)
    if (rd.state !== 'RIDE' && rd.state !== 'POP') break;
  }
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  // collect the GPU times (they arrive a few frames late)
  const gpu = []; for (let tries = 0; tries < 60 && q.length; tries++) { await new Promise((res) => requestAnimationFrame(res));
    for (let i = q.length - 1; i >= 0; i--) if (gl.getQueryParameter(q[i], gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q[i], gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q[i]); q.splice(i, 1); } }
  return { mode, frames: n, end: rd.why || rd.state, gameMs: stats(sim), submitMs: stats(sub), gpuMs: gpu.length ? stats(gpu) : 'n/a', draws: stats(calls), ktris: +(stats(tris).med / 1000).toFixed(0),
    heapMB: heap.length ? `${heap[0].toFixed(1)} -> ${heap[heap.length - 1].toFixed(1)} (max ${Math.max(...heap).toFixed(1)})` : 'n/a', slowGame: sim.filter((x) => x > 8).length, spikes: spikes.join(', ') };
}
// the real thing: the game running on its own loop at the screen's pace (the robot only steers), timing every frame
export async function live(mode, seed = 7, ms = 12000) {
  const g = G(); const ok = await moment(mode, 'trim', seed); if (!ok.includes(': ok')) return mode + ' no ride';
  g.paused = false; const rd = g.rider, gaps = []; let last = performance.now(); const t0 = last; let long = [], n = 0;
  await new Promise((res) => { const f = () => { const now = performance.now(), dt = now - last; last = now; gaps.push(dt); if (dt > 50) long.push(`${(now - t0) / 1000 | 0}s:${dt | 0}ms`); n++;
    if (rd.state === 'RIDE') { const w = rd.wave, H = w.cond.H, sH = rd.s / H, yH = rd.y / H, err = yH - 0.35 - 0.2 * Math.sin(n / 60 * 1.3) + (rd.stalling ? 0.12 : 0);
      const sn = Math.max(-0.6, Math.min(0.97, w.cond.speed / Math.max(rd.v, 1) + err * 0.9)), a0 = Math.asin(sn), steer = Math.max(-1, Math.min(1, Math.atan2(Math.sin(a0 - rd.th), Math.cos(a0 - rd.th)) * 3));
      const stall = !rd.inBarrel && sH > -0.2; g.input.test = stall ? null : steer; g.input.stick = stall ? { x: steer, y: 1 } : null; g.input.paddleBtn = !stall && sH < -1.2; }
    if (now - t0 < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  g.input.test = null; g.input.stick = null; g.input.paddleBtn = false;
  const s = stats(gaps.slice(5)); return { mode, fps: +(1000 / s.med).toFixed(0), frameMs: s, longFrames: long.slice(0, 8).join(' '), state: rd.state, why: rd.why || '' };
}
