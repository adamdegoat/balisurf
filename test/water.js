// The surfers in the water as real people (surfers.js): close looks at the two lineup locals, and at the villa crew
// sitting, paddling and riding, sent to the local frame receiver as look/NNNNN.jpg.
//   const W = await import('./test/water.js'); await W.locals(800); await W.crew(900)
import * as THREE from 'three';
import { cap } from './look.js';
const G = () => window.__g;
const people = () => { const a = []; G().scene.traverse((o) => { if (o.isSkinnedMesh && o.material.customProgramCacheKey && o.material.customProgramCacheKey() === 'surfwear1') a.push(o); }); return a; };
const pelvis = (m) => m.skeleton.bones.find((b) => /Pelvis/.test(b.name)).getWorldPosition(new THREE.Vector3());
async function look(at, from, i, fov = 45) {
  const c = G().camera; c.position.copy(from); c.lookAt(at); c.fov = fov; c.updateProjectionMatrix(); c.updateMatrixWorld(); await cap(i, 1); G().paused = false;
}
// each local from two sides and from where you sit
export async function locals(base = 800) {
  const g = G(); g.step(0.1, 1 / 30, false); const out = [];
  for (const [i, m] of people().filter((m) => !m.userData.crew).entries()) { const p = pelvis(m);
    await look(p.clone().setY(p.y + 0.1), p.clone().add(new THREE.Vector3(3, 1, 3)), base + i * 10);
    await look(p.clone().setY(p.y + 0.1), p.clone().add(new THREE.Vector3(-3, 1, 2.5)), base + i * 10 + 1);
    await look(p.clone().setY(p.y + 0.3), g.camera.position.copy(g.rig.position).add(new THREE.Vector3(0, 1.3, 0)).clone(), base + i * 10 + 2, 30);
    out.push(p.toArray().map((v) => v.toFixed(1)).join(',')); }
  return out.join(' | ');
}
// the villa crew: step the villa and snap whoever is riding (and one sitting, one paddling) from 12 m off
export async function crew(base = 900, n = 8, every = 1.5) {
  const g = G(), S = g.crew.surfers, out = []; let k = 0;
  for (let t = 0; t < n; t++) {
    g.step(every, 1 / 30, false);
    const pick = S.find((s) => s.st === 'RIDE') || S.find((s) => s.st === 'PADDLE') || S[0];
    const p = pick.p.clone(), side = new THREE.Vector3().crossVectors(pick.f, new THREE.Vector3(0, 1, 0)).normalize();
    await look(p.clone().setY(p.y + 0.8), p.clone().addScaledVector(side, 10).add(new THREE.Vector3(0, 3, 0)).addScaledVector(pick.f, 4), base + k++);
    out.push(pick.st);
  }
  return out.join(' ');
}
