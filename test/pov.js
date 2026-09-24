// First-person vet: play rides with the real thumb control and record, moment by moment, what the player sees of
// their own body: are the hands in view, does an arm or shoulder block the view (a big blob), does a hand clip into
// the lens. Split by moment (paddling, pop-up/drop, carving, trimming, stalling, barrel).
// In the page console: const m = await import('./test/pov.js'); m.vet('medium')
import * as THREE from 'three';
import { brain, carveBrain } from './sim2.js';
const RT = new THREE.WebGLRenderTarget(160, 74), PIX = new Uint8Array(160 * 74 * 4), MAG = new THREE.MeshBasicMaterial({ color: 0xff00ff, fog: false });
// share of the screen covered by your own body, and the share of the bottom-centre (where a shoulder would block the view)
function bodyCover(G) {
  const r = G.renderer, saved = [];
  if (!MAG.userData.cut && G.cutaway) { G.cutaway(MAG); MAG.userData.cut = true; }   // count only what the player sees (the near-camera cutaway)
  G.surfer.traverse((o) => { if (o.isMesh) { saved.push([o, o.material]); o.material = MAG; } });
  G.camera.updateMatrixWorld(); r.setRenderTarget(RT); r.render(G.scene, G.camera); r.readRenderTargetPixels(RT, 0, 0, 160, 74, PIX); r.setRenderTarget(null);
  for (const [o, m] of saved) o.material = m;
  let n = 0, c = 0, cn = 0;
  for (let y = 0; y < 74; y++) for (let x = 0; x < 160; x++) {
    const i = (y * 160 + x) * 4, mag = PIX[i] > 200 && PIX[i + 1] < 60 && PIX[i + 2] > 200;
    if (mag) n++;
    if (x > 40 && x < 120 && y < 37) { cn++; if (mag) c++; }        // bottom half, middle: the view ahead
  }
  return { all: n / (160 * 74), centre: c / cn };
}
export function vet(mode = 'medium', rides = 2, seed = 7) {
  const rnd0 = Math.random; let st = seed >>> 0; Math.random = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);
  const G = window.__g, hands = {}; G.paused = true; G.setMode(mode);
  document.getElementById('start').style.display = 'none'; document.body.classList.add('playing'); G.spawnRider();
  G.surfer.traverse((o) => { if (o.isBone && (o.name === 'hand_l' || o.name === 'hand_r')) hands[o.name] = o; });
  const pad = brain({}), carve = carveBrain(), B = {}; let done = 0, i = 0;
  const v = new THREE.Vector3();
  try {
    for (; i < 60 * 150 && done < rides; i++) {
      const r = G.rider;
      if (r.state === 'WIPE' || r.state === 'OUT') { G.spawnRider(); done++; continue; }
      let stall = false;
      if (!r.standing) { const o = pad(r); G.input.stick = null; G.input.test = o.steer; G.input.paddleBtn = o.paddle; }
      else { const o = carve(r); G.input.test = null; G.input.paddleBtn = false; stall = r.stateT > 6 && r.stateT < 7.5; G.input.stick = { x: stall ? 0 : o.steer, y: stall ? 1 : 0 }; }
      G.step(1 / 60, 1 / 60, false);
      if (i % 6) continue;
      const k = !r.standing ? (r.paddling ? 'paddling' : 'sitting/lying') : r.inBarrel ? 'barrel' : r.state === 'POP' || r.stateT < 1 ? 'pop-up & drop' : stall ? 'stalling' : Math.abs(r.lean) > 0.5 ? 'carving' : 'trimming';
      const b = (B[k] = B[k] || { n: 0, hand: 0, blob: 0, lens: 0, cover: 0 });
      b.n++;
      G.camera.updateMatrixWorld();
      let seen = false, close = false;
      for (const h of Object.values(hands)) { h.getWorldPosition(v); if (v.distanceTo(G.camera.position) < 0.22) close = true; const p = v.project(G.camera); if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) seen = true; }
      const cov = bodyCover(G);
      if (seen) b.hand++; if (close) b.lens++; if (cov.centre > 0.25) b.blob++; b.cover += cov.all;
    }
  } finally { Math.random = rnd0; G.input.stick = null; G.input.test = null; G.input.paddleBtn = false; }
  const pc = (a, n) => Math.round(a / Math.max(1, n) * 100) + '%';
  return mode + '\n' + Object.entries(B).map(([k, b]) => `  ${k.padEnd(14)} hand in view ${pc(b.hand, b.n)} | body blocks the view ahead ${pc(b.blob, b.n)} | hand in the lens ${pc(b.lens, b.n)} | body covers ${pc(b.cover, b.n)} of screen (${b.n})`).join('\n');
}
