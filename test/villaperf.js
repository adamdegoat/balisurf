// Villa cost: go to the villa, wait for your friends, then from a few standing spots time each frame's game work and
// the graphics chip's drawing (GPU timer), with draw calls and triangles.
//   const V = await import('./test/villaperf.js'); await V.run()
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { med: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2) }; };
export async function run(frames = 90) {
  const g = window.__g, r = g.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  g.startVilla(); const t0 = performance.now();
  while (!g.friends && performance.now() - t0 < 25000) { g.step(0.1, 1 / 30, false); await new Promise((res) => setTimeout(res, 150)); }
  const out = {};
  // (standing spots in the villa's frame: the living room looking at the coach and the sofa, the garden by the fire)
  for (const [name, x, z, yaw] of [['living', -88, 38, 2.6], ['garden', -90, 52, 3.4]]) {
    const w = g.walker; w.x = x; w.z = z; w.yaw = yaw; w.pitch = -0.1;
    for (let k = 0; k < 20; k++) g.step(1 / 30, 1 / 30, false);
    const cpu = [], gpu = [], q = [];
    for (let k = 0; k < frames; k++) {
      const a = performance.now(); g.step(1 / 30, 1 / 30, false); cpu.push(performance.now() - a);
      let qq = null; if (ext) { qq = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, qq); }
      r.render(g.scene, g.camera); if (qq) { gl.endQuery(ext.TIME_ELAPSED_EXT); q.push(qq); }
      if (k % 10 === 9) await new Promise((res) => setTimeout(res, 0));
    }
    await new Promise((res) => setTimeout(res, 300));
    for (const qq of q) if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6);
    out[name] = { game: stats(cpu), gpu: gpu.length ? stats(gpu) : null, draws: r.info.render.calls, ktris: Math.round(r.info.render.triangles / 1000) };
  }
  out.friends = g.friends ? g.friends.list.map((f) => f.id + (f.own ? ':own' : ':old')).join(' ') : 'none';
  g.paused = false;
  return out;
}
