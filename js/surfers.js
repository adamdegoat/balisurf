// Surfers in the water, as real people: Rocketbox avatars (MIT licence, see people/) dressed for the sea. Their own
// clothes are painted over from the skeleton outward (whatever the hips and thighs carry is boardshorts, the rest is
// bare skin in their own face's tone, the hands keep their own texture), and they're posed each frame from a handful
// of points: hips, shoulders, head, knees, feet and hands (the same points the old stick figures were drawn from), so
// they sit on their boards, paddle, and ride.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// each person's skin (sampled from their own face, sRGB) and file
export const WATER_PEOPLE = {
  m02: { file: 'Male_Adult_02', skin: [0.76, 0.59, 0.46] },
  m07: { file: 'Male_Adult_07', skin: [0.66, 0.46, 0.33] },
  m08: { file: 'Male_Adult_08', skin: [0.75, 0.55, 0.42] },
  m16: { file: 'Male_Adult_16', skin: [0.78, 0.6, 0.48] },
  f17: { file: 'Female_Adult_17', skin: [0.78, 0.56, 0.43], suit: true },   // (a one-piece instead of boardshorts)
};

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
// turn a bone so the line from it to its child points along dir (world)
function aim(bone, child, dir) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, dir); bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));   // (no need to redo every bone below it: getWorldPosition/Quaternion bring each one up to date as it's read)
}
// two-bone reach (shoulder->elbow->hand, or hip->knee->foot) to a target, the middle joint bending out toward pole
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function reach(up, lo, end, target, pole) {
  up.getWorldPosition(_s); lo.getWorldPosition(_e); end.getWorldPosition(_t);
  const l1 = _s.distanceTo(_e), l2 = _e.distanceTo(_t);
  _x.subVectors(target, _s); const d = Math.max(0.05, Math.min(_x.length(), (l1 + l2) * 0.995)); _x.normalize();
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _y.copy(pole).addScaledVector(_x, -pole.dot(_x)).normalize();
  _e.copy(_s).addScaledVector(_x, a).addScaledVector(_y, h); _t.copy(_s).addScaledVector(_x, d);
  aim(up, lo, _z.subVectors(_e, _s).normalize());
  lo.getWorldPosition(_e); aim(lo, end, _z.subVectors(_t, _e).normalize());
}
// turn a bone about a world axis
function turn(bone, axis, ang) {
  _q.setFromAxisAngle(axis, ang); bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));   // (no need to redo every bone below it: getWorldPosition/Quaternion bring each one up to date as it's read)
}

// which bones' skin is what: 0 skin, 1 boardshorts (or the suit: hips and body up to the shoulders, legs bare), 2 the
// hands (their own texture)
const zone = (n, suit) => /Hand|Finger/.test(n) ? 2 : (suit ? /Pelvis|Spine|^Bip01$/ : /Thigh|Pelvis|^Bip01$/).test(n) ? 1 : 0;
function paint(mesh, look) {
  const g = mesh.geometry;
  if (!g.userData.surf) {   // (once per model: every clone shares the geometry)
    const bones = mesh.skeleton.bones.map((b) => zone(b.name.replace(/^Bip01_/, ''), look.suit)), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count, a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k), z = bones[si.getComponent(i, k)]; if (z === 1) a[i * 2] += w; else if (z === 2) a[i * 2 + 1] += w; }
    g.setAttribute('aSurf', new THREE.BufferAttribute(a, 2)); g.userData.surf = true;
  }
  const m = mesh.material = mesh.material.clone(); m.metalness = 0;
  const U = { uSkin: { value: new THREE.Color().setRGB(...look.skin, THREE.SRGBColorSpace) }, uCloth: { value: new THREE.Color(look.shorts) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute vec2 aSurf; varying vec2 vSurf;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSurf = aSurf;');
    sh.fragmentShader = 'uniform vec3 uSkin, uCloth; varying vec2 vSurf;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(.3, .59, .11));
      vec3 body = mix(uSkin, uCloth * (.75 + .5 * lum), smoothstep(.4, .6, vSurf.x));   // (a little of the cloth's own folds in the shorts)
      diffuseColor.rgb = mix(body, diffuseColor.rgb, smoothstep(.3, .7, vSurf.y));`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * .3;');   // (a little of their own colour as fill light: against the sun they otherwise go to a black cut-out, like the villa friends did)
  };
  m.customProgramCacheKey = () => 'surfwear1';
  return m;
}

// a person for the water: their body (a clone), dressed; bones by name and by the short names the poses use; their
// standing pose to start each frame from
export function waterPerson(src, look) {
  const body = cloneSkinned(src), root = new THREE.Group(); root.add(body);
  const B = {}; body.traverse((o) => { if (o.isBone) B[o.name.replace(/^Bip01_/, '')] = o; if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; if (o.isSkinnedMesh && /body/.test(o.material.name)) paint(o, look);
    else if (o.material.map && !o.material.userData.fill) { o.material.emissiveMap = o.material.map; o.material.emissive.setScalar(0.3); o.material.metalness = 0; o.material.userData.fill = true; } } });   // (face and hair: the same fill light)
  Object.assign(B, { pelvis: B.Pelvis, thigh_l: B.L_Thigh, calf_l: B.L_Calf, foot_l: B.L_Foot, thigh_r: B.R_Thigh, calf_r: B.R_Calf, foot_r: B.R_Foot,
    upperarm_l: B.L_UpperArm, lowerarm_l: B.L_Forearm, hand_l: B.L_Hand, upperarm_r: B.R_UpperArm, lowerarm_r: B.R_Forearm, hand_r: B.R_Hand, neck: B.Neck, head: B.Head, spine: B.Spine2 });
  // (turn the body to face +z, from the head toward the eyes, like the villa friends)
  body.updateMatrixWorld(true); const hp = B.Head.getWorldPosition(new THREE.Vector3()), ep = B.LEye.getWorldPosition(new THREE.Vector3()).add(B.REye.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).sub(hp);
  body.rotation.y = -Math.atan2(ep.x, ep.z); body.updateMatrixWorld(true);
  const rest = []; body.traverse((o) => { if (o.isBone) rest.push([o, o.position.clone(), o.quaternion.clone()]); });
  const pelvisY = B.Pelvis.getWorldPosition(new THREE.Vector3()).y;
  const bn = {}; body.traverse((o) => { if (o.isBone) bn[o.name] = o; });   // (by their full names, for the idle clips)
  return { root, body, B, bn, pelvisY, reset() { for (const [b, p, q] of rest) { b.position.copy(p); b.quaternion.copy(q); } } };
}

// pose a water person from points in the world: hip, sho(ulders), head, feet fL fR, knees kL kR, hands hL hR; up (along
// the spine), face (the way the chest faces), look (where the eyes go)
const M = new THREE.Matrix4(), SPD = new THREE.Vector3(), LFT = new THREE.Vector3(), UP = new THREE.Vector3(), FC = new THREE.Vector3(), PV = new THREE.Vector3(), MID = new THREE.Vector3(), HD = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
export function poseFrom(P, J) {
  const { root, B } = P; P.reset();
  UP.copy(J.up).normalize(); FC.copy(J.face).addScaledVector(UP, -J.face.dot(UP)).normalize(); LFT.crossVectors(UP, FC);
  root.quaternion.setFromRotationMatrix(M.makeBasis(LFT, UP, FC)); root.position.set(0, 0, 0); root.updateWorldMatrix(true, false);
  B.pelvis.getWorldPosition(PV); root.position.subVectors(J.hip, PV); root.updateWorldMatrix(true, false);   // (the hips on the hip point)
  aim(B.spine, B.neck, SPD.subVectors(J.sho, J.hip).normalize());   // (its own vector: aim() uses _a and _b itself)
  // legs and arms to their points: each limb takes whichever point lies on its own side of the body
  const lr = (a, b) => (_a.subVectors(a, J.hip).dot(LFT) >= _b.subVectors(b, J.hip).dot(LFT) ? [a, b] : [b, a]);
  const [fl, fr] = lr(J.fL, J.fR), [kl, kr] = fl === J.fL ? [J.kL, J.kR] : [J.kR, J.kL];
  for (const [sd, f, k] of [['l', fl, kl], ['r', fr, kr]]) { MID.addVectors(J.hip, f).multiplyScalar(0.5); reach(B['thigh_' + sd], B['calf_' + sd], B['foot_' + sd], f, _y.subVectors(k, MID)); }
  const [hl, hr] = lr(J.hL, J.hR);
  for (const [sd, h, s] of [['l', hl, 1], ['r', hr, -1]]) reach(B['upperarm_' + sd], B['lowerarm_' + sd], B['hand_' + sd], h, _y.copy(UP).multiplyScalar(-1).addScaledVector(FC, -0.4).addScaledVector(LFT, s * 0.6));
  // the head: up along the neck, then turned toward where they look (not past their shoulder)
  aim(B.neck, B.head, HD.subVectors(J.head, J.sho).normalize());
  if (J.look) { const la = Math.atan2(_a.copy(J.look).dot(LFT), J.look.dot(FC)); turn(B.head, UP, Math.max(-1.2, Math.min(1.2, la)) * 0.8); }
}

// the old lineup locals' straddle, for a water person sitting on their board (R: the board's frame, +z its nose)
const BF = new THREE.Vector3(), BS = new THREE.Vector3(), SP = new THREE.Vector3(), T = new THREE.Vector3(), RQ = new THREE.Quaternion(), RP = new THREE.Vector3();
export function straddle(P, R) {
  const { B } = P; R.getWorldQuaternion(RQ); R.getWorldPosition(RP); BF.set(0, 0, 1).applyQuaternion(RQ); BS.set(1, 0, 0).applyQuaternion(RQ);
  // sitting up straight whatever the board does (it rides nose-up on its tail), looking out to sea
  aim(B.Spine, B.Spine1, T.copy(Y).addScaledVector(BF, 0.12).normalize()); aim(B.spine, B.neck, T.copy(Y).addScaledVector(BF, 0.18).normalize()); aim(B.neck, B.head, T.copy(Y).addScaledVector(BF, 0.3).normalize());
  B.pelvis.getWorldPosition(SP); const deckY = RP.y + 0.07;
  for (const [s, sg] of [['l', 1], ['r', -1]]) {
    const side = B['thigh_' + s].getWorldPosition(_a).sub(RP).dot(BS) > 0 ? 1 : -1;
    // thighs forward and down either side of the rails, shins hanging in the water
    const foot = T.copy(SP).addScaledVector(BF, 0.35).addScaledVector(BS, side * 0.3).addScaledVector(Y, -0.62);
    reach(B['thigh_' + s], B['calf_' + s], B['foot_' + s], foot, _y.copy(BF).addScaledVector(BS, side * 0.4));
    const ua = B['upperarm_' + s], hs = ua.getWorldPosition(_a).sub(RP).dot(BS) > 0 ? 1 : -1;
    const hand = T.copy(SP).addScaledVector(BF, 0.5).addScaledVector(BS, hs * 0.2); hand.y = deckY;   // (hands on the rails just ahead of the knees)
    reach(ua, B['lowerarm_' + s], B['hand_' + s], hand, _y.copy(BS).multiplyScalar(hs).addScaledVector(BF, -0.3).addScaledVector(Y, -0.2));
  }
}
