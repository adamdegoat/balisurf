// Seabirds over the break, seen from the villa: frigatebirds soaring high on long crooked wings (a flap now and then),
// and terns working low along the line of the waves, flapping, hovering, and every so often folding up and plunging
// into the water after a fish with a little white splash. One instanced mesh; the wings beat in the vertex shader (a
// wing is two joints, the tip lagging the inner wing), so a flock costs one draw and a few matrices a frame.
import * as THREE from 'three';

// a bird, 1 m long, facing +z, wings along x. aJ = which joint: 0 body/tail, 1 inner wing, 2 wing tip
function birdGeo() {
  const P = [], J = [];
  const tri = (a, b, c, ja, jb, jc) => { P.push(...a, ...b, ...c); J.push(ja, jb, jc); };
  for (const s of [-1, 1]) {
    const neck = [0, 0, 0.5], back = [0, 0, -0.12], wrist = [s * 0.55, 0.1, 0.02], wristB = [s * 0.45, 0.06, -0.14], tip = [s * 1.15, -0.02, -0.3];
    tri(neck, wrist, back, 0, 1, 0); tri(wrist, wristB, back, 1, 1, 0);   // inner wing (bent forward at the wrist)
    tri(wrist, tip, wristB, 1, 2, 1);                                      // outer wing, swept back to a point
    tri([0, 0, -0.12], [s * 0.13, 0, -0.55], [0, 0, -0.34], 0, 0, 0);     // forked tail
  }
  tri([0, 0.03, 0.62], [-0.05, 0, 0.3], [0.05, 0, 0.3], 0, 0, 0);          // head and bill
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aJ', new THREE.Float32BufferAttribute(J, 1));
  return g;
}

export function makeBirds(parent, { frigates = 5, terns = 6, center = [80, 0], span = [140, 30], waterY = 0, splash } = {}) {
  const N = frigates + terns, geo = birdGeo();
  const phase = new Float32Array(N), beat = new Float32Array(N), fold = new Float32Array(N);
  geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(phase, 1)); geo.setAttribute('aBeat', new THREE.InstancedBufferAttribute(beat, 1)); geo.setAttribute('aFold', new THREE.InstancedBufferAttribute(fold, 1));
  const uT = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color: 0x23201f, side: THREE.DoubleSide, fog: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'attribute float aJ, aPh, aBeat, aFold; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float fl = sin(uT * 8. + aPh) * aBeat, fl2 = sin(uT * 8. + aPh - .7) * aBeat;   // (the tip follows the inner wing a beat later)
      float side = sign(transformed.x);
      if (aJ > .5) transformed.y += (aJ > 1.5 ? .28 + fl2 * .55 + fl * .25 : fl * .22) * abs(transformed.x) * 1.4;
      if (aJ > .5) transformed.x *= 1. - aFold * (aJ > 1.5 ? .75 : .45);            // (wings swept in for a dive)
      if (aJ > 1.5) transformed.z -= aFold * .35;`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; parent.add(mesh);
  const B = [];
  for (let i = 0; i < N; i++) {
    const fr = i < frigates; phase[i] = Math.random() * 6.3;
    B.push(fr ? { fr, r: 30 + Math.random() * 45, h: 38 + Math.random() * 30, a: Math.random() * 6.3, w: (Math.random() < 0.5 ? 1 : -1) * (0.08 + Math.random() * 0.05), cx: center[0] + (Math.random() - 0.5) * 60, cz: center[1] + 30 + Math.random() * 40, s: 2.1 }
      : { fr, x: center[0] + (Math.random() - 0.5) * span[0], z: center[1] + (Math.random() - 0.5) * span[1], h: 7 + Math.random() * 9, hd: Math.random() * 6.3, v: 7 + Math.random() * 3, turnT: 0, dive: null, next: 6 + Math.random() * 16, s: 0.85 });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let t = 0;
  function update(dt) {
    t += dt; uT.value = t;
    B.forEach((b, i) => {
      let pitch = 0, bank = 0, yaw;
      if (b.fr) {   // soaring: a slow wide circle, the odd few beats
        b.a += b.w * dt; p.set(b.cx + Math.cos(b.a) * b.r, b.h + Math.sin(t * 0.3 + i) * 3, b.cz + Math.sin(b.a) * b.r);
        yaw = -b.a + (b.w > 0 ? 0 : Math.PI); bank = (b.w > 0 ? 1 : -1) * 0.3;
        beat[i] = Math.sin(t * 0.35 + i * 1.7) > 0.8 ? 0.6 : 0.03; fold[i] = 0;
      } else if (b.dive) {   // the plunge: fold, drop, splash, a moment under, then up and away
        const d = b.dive; d.t += dt;
        if (d.t < 1.1) { const k = d.t / 1.1; p.set(d.x0 + (d.x1 - d.x0) * k, d.y0 + (waterY - 0.3 - d.y0) * k * k, d.z0 + (d.z1 - d.z0) * k); pitch = 1.25 * Math.min(1, k * 2); fold[i] = Math.min(1, k * 2.5); beat[i] = 0.05; yaw = b.hd; }
        else if (d.t < 1.7) { if (!d.splashed) { d.splashed = true; if (splash) splash(d.x1, d.z1); } p.set(d.x1, -5, d.z1); yaw = b.hd; }   // (under)
        else { const k = Math.min(1, (d.t - 1.7) / 2); p.set(d.x1 + Math.sin(b.hd) * k * 14, waterY + 0.2 + k * k * 9, d.z1 + Math.cos(b.hd) * k * 14); pitch = -0.5 * (1 - k); fold[i] = 0; beat[i] = 1; yaw = b.hd;
          if (k >= 1) { b.x = p.x; b.z = p.z; b.h = p.y; b.dive = null; b.next = 10 + Math.random() * 20; } }
      } else {   // working the line: fly, turn back at the ends, now and then hover and pick a fish
        b.turnT -= dt; b.next -= dt;
        const dx = b.x - center[0], dz = b.z - center[1];
        if ((Math.abs(dx) > span[0] / 2 || Math.abs(dz) > span[1] / 2) && b.turnT <= 0) { b.hd = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 0.8; b.turnT = 3; }
        b.hd += Math.sin(t * 0.5 + i) * 0.25 * dt;
        b.x += Math.sin(b.hd) * b.v * dt; b.z += Math.cos(b.hd) * b.v * dt; b.h += (9 + 4 * Math.sin(t * 0.4 + i) - b.h) * dt * 0.5;
        p.set(b.x, b.h, b.z); yaw = b.hd; bank = Math.sin(t * 0.5 + i) * 0.25; beat[i] = 1; fold[i] = 0;
        if (b.next <= 0) b.dive = { t: 0, x0: b.x, y0: b.h, z0: b.z, x1: b.x + Math.sin(b.hd) * 5, z1: b.z + Math.cos(b.hd) * 5 };
      }
      e.set(pitch, yaw, bank); q.setFromEuler(e); mesh.setMatrixAt(i, m.compose(p, q, sc.setScalar(b.s)));
    });
    mesh.instanceMatrix.needsUpdate = true; geo.attributes.aBeat.needsUpdate = true; geo.attributes.aFold.needsUpdate = true;
  }
  return { mesh, update };
}
