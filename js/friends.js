// Your friends at the villa: three surfers staying with you, each doing their own thing. Kai plays guitar by the fire,
// nodding along to the music; Wayan waxes a board on the stands in the garden; Nando is up on the tree deck with
// binoculars, watching the sets. Same body as yours (their own skin, hair and boardshorts), posed bone by bone every
// frame. Walk up and they look round and say something; Nando calls out the barrels he sees.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();
// turn a bone so the line from it to its child points along dir (world), by weight w
function aim(bone, child, dir, w = 1) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, dir); if (w < 1) _q.slerp(_wq.identity(), 1 - w);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq))); bone.updateMatrixWorld(true);
}
// two-bone reach: shoulder->elbow->hand to a target, the elbow bending out toward pole
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function reach(up, lo, hand, target, pole) {
  up.getWorldPosition(_s); lo.getWorldPosition(_e); hand.getWorldPosition(_t);
  const l1 = _s.distanceTo(_e), l2 = _e.distanceTo(_t);
  _x.subVectors(target, _s); const d = Math.max(0.05, Math.min(_x.length(), (l1 + l2) * 0.999)); _x.normalize();
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _y.copy(pole).addScaledVector(_x, -pole.dot(_x)).normalize();
  _e.copy(_s).addScaledVector(_x, a).addScaledVector(_y, h);   // (the elbow)
  _t.copy(_s).addScaledVector(_x, d);                          // (the hand, as far toward the target as the arm reaches)
  aim(up, lo, _z.subVectors(_e, _s).normalize());
  lo.getWorldPosition(_e); aim(lo, hand, _z.subVectors(_t, _e).normalize());
}

const LOOK = [
  { skin: 0x9c6b4c, hair: 0x1b1512, shorts: 0x2f6f73 },   // Kai
  { skin: 0x7a5238, hair: 0x120e0c, shorts: 0xd8592f },   // Wayan
  { skin: 0xc79a7a, hair: 0x6b4a2a, shorts: 0x1f2f4f },   // Nando
];
const LINES = {
  kai: ['Pull up a log, bro. Swell keeps building all evening.', 'This one is for the barrel you just got.', 'Fire is warm, waves are firing. Life is good.', 'Dawn patrol tomorrow? I am in.'],
  wayan: ['Fresh wax, ready for the morning session.', 'Take any board from the rack. All waxed up.', 'Tanjung Uma is pumping today.', 'Feel that offshore? Glassy all day.'],
  nando: ['Set coming! Look out the back.', 'Best seat on the point up here.', 'The peak is shifting right. Sit deeper.', 'Clean lines to the horizon, brother.'],
};

export function friends(scene, src, spots) {
  const group = new THREE.Group(); scene.add(group);
  const list = [];
  spots.forEach((S, i) => {
    const body = cloneSkinned(src), root = new THREE.Group(); root.add(body); group.add(root);
    const L = LOOK[i % LOOK.length];
    body.traverse((o) => { o.layers.set(0); if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); o.material.side = THREE.FrontSide;
      const n = o.material.name; if (n === 'skin') o.material.color.setHex(L.skin); else if (n === 'hair') { o.material.color.setHex(L.hair); o.material.side = THREE.DoubleSide; } else if (/short/.test(n)) o.material.color.setHex(L.shorts); } });
    const B = {}; body.traverse((o) => { if (o.isBone) B[o.name] = o; });
    const skins = []; body.traverse((o) => { if (o.isSkinnedMesh) skins.push(o); });
    root.position.set(S.x, S.y, S.z); root.rotation.y = S.yaw;
    const F = { id: S.id, name: S.name, root, body, B, skins, S, props: {}, look: 0, lineI: 0, talkT: 0, cool: 0, head: new THREE.Vector3() };
    // what each is holding
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.6 });
    if (S.id === 'kai') {   // an acoustic guitar: round body, sound hole, neck, headstock
      const gt = new THREE.Group(); const sb = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 20), wood); sb.rotation.x = Math.PI / 2; sb.scale.set(1, 1, 1); gt.add(sb);
      const sb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 18), wood); sb2.rotation.x = Math.PI / 2; sb2.position.x = 0.2; gt.add(sb2);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), dark); hole.position.set(0.1, 0, 0.047); gt.add(hole);
      const nk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.03), dark); nk.position.set(0.55, 0, 0.03); gt.add(nk);
      const hs = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.03), wood); hs.position.set(0.85, 0, 0.03); gt.add(hs);
      group.add(gt); F.props.guitar = gt;
    }
    if (S.id === 'nando') {   // binoculars, and a sun-faded bucket hat
      const bn = new THREE.Group(); for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.13, 10), dark); t.rotation.x = Math.PI / 2; t.position.x = s * 0.035; bn.add(t); }
      group.add(bn); F.props.bino = bn;
      const hat = new THREE.Group(); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xc9b58c, roughness: 0.9 })); hat.add(crown);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.012, 20), crown.material); brim.position.y = -0.035; brim.rotation.x = 0.12; hat.add(brim);
      group.add(hat); F.props.hat = hat;
    }
    list.push(F);
  });
  // the speech bubble: over the head of whoever is talking
  const bub = document.createElement('div'); bub.id = 'fBubble'; document.body.appendChild(bub);
  let talking = null;
  const say = (F, text) => { talking = F; F.talkT = 4.5; bub.innerHTML = `<b>${F.name}</b>${text}`; bub.classList.add('on'); };

  const V = new THREE.Vector3(), W = new THREE.Vector3(), fw = new THREE.Vector3(), rt = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3(), tgt2 = new THREE.Vector3(), pole = new THREE.Vector3(), SD = new THREE.Vector3(), TA = new THREE.Vector3(), TB = new THREE.Vector3(), HP = new THREE.Vector3();
  function update(dt, t, beat, you, camera) {
    for (const F of list) {
      const { B, S, root } = F; F.cool -= dt;
      for (const m of F.skins) m.skeleton.pose(); root.updateMatrixWorld(true);
      fw.set(Math.sin(S.yaw), 0, Math.cos(S.yaw)); rt.set(-fw.z, 0, fw.x);   // (their right, looking along fw)
      // you nearby, on their level? then they look round at you, and say something
      B.head.getWorldPosition(F.head);
      const dx = you.x - F.head.x, dz = you.z - F.head.z, dist = Math.hypot(dx, dz), near = dist < 3.6 && Math.abs(you.y - F.head.y) < 1.6;
      if (near && F.cool <= 0) { say(F, LINES[F.id][F.lineI++ % LINES[F.id].length]); F.cool = 18; }
      const toYou = Math.atan2(dx, dz) - S.yaw, want = near ? Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(toYou), Math.cos(toYou)))) : 0;
      F.look += (want - F.look) * Math.min(1, dt * 3);
      const hip = B.pelvis.getWorldPosition(HP);
      if (S.pose === 'guitar') {
        // sitting on the log: hips down to the seat, thighs forward, shins down; leaning a little into the guitar
        root.position.y = S.y + S.seat + 0.02 - (hip.y - root.position.y); root.updateMatrixWorld(true);   // (the pelvis down onto the log)
        for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1;
          aim(B['thigh_' + sd], B['calf_' + sd], tgt.copy(fw).multiplyScalar(0.92).addScaledVector(up, -0.28).addScaledVector(rt, sg * 0.18).normalize());
          aim(B['calf_' + sd], B['foot_' + sd], tgt.copy(up).multiplyScalar(-0.95).addScaledVector(fw, 0.25).addScaledVector(rt, sg * 0.05).normalize()); }
        aim(B.spine_02, B.spine_03, tgt.copy(up).addScaledVector(fw, 0.28).normalize());
        aim(B.neck_01, B.head, tgt.copy(up).addScaledVector(fw, 0.35 - 0.12 * beat).addScaledVector(rt, Math.sin(F.look) * 0.8).normalize());   // (nodding to the music)
        // the guitar across the lap, neck out to the left and up
        B.pelvis.getWorldPosition(W); const gt = F.props.guitar, gp = tgt.copy(W).addScaledVector(fw, 0.26).addScaledVector(up, 0.2).addScaledVector(rt, 0.06);
        const neck = tgt2.copy(rt).multiplyScalar(-0.85).addScaledVector(up, 0.42).addScaledVector(fw, 0.2).normalize();
        gt.position.copy(gp); gt.quaternion.setFromUnitVectors(_a.set(1, 0, 0), neck); gt.rotateX(-0.25);   // (face out, a little up)
        // left hand on the neck, right hand strumming over the sound hole in time with the beat
        const fret = W.copy(gp).addScaledVector(neck, 0.5).addScaledVector(fw, 0.05);
        reach(B.upperarm_l, B.lowerarm_l, B.hand_l, fret, pole.copy(up).multiplyScalar(-1).addScaledVector(rt, -0.5));
        const strum = W.copy(gp).addScaledVector(neck, 0.05).addScaledVector(fw, 0.09).addScaledVector(up, 0.05 * Math.sin(t * 9) + 0.04 * beat);
        reach(B.upperarm_r, B.lowerarm_r, B.hand_r, strum, pole.copy(up).multiplyScalar(-1).addScaledVector(rt, 0.6));
      } else if (S.pose === 'wax') {
        // bent over the board on its stands, rubbing wax on in slow circles; stops to talk
        const talk = F.talkT > 0;
        aim(B.spine_01, B.spine_02, tgt.copy(up).addScaledVector(fw, talk ? 0.35 : 0.8).normalize());
        aim(B.spine_03, B.neck_01, tgt.copy(up).addScaledVector(fw, talk ? 0.3 : 0.55).normalize());
        aim(B.neck_01, B.head, tgt.copy(up).addScaledVector(fw, talk ? 0.2 : 0.9).addScaledVector(rt, Math.sin(F.look) * 0.9).normalize());
        for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1; aim(B['thigh_' + sd], B['calf_' + sd], tgt.copy(up).multiplyScalar(-1).addScaledVector(rt, sg * 0.1).addScaledVector(fw, -0.05).normalize()); aim(B['calf_' + sd], B['foot_' + sd], tgt.copy(up).multiplyScalar(-1).addScaledVector(fw, 0.03).normalize()); }
        const deck = W.set(S.board[0], S.board[1], S.board[2]);
        const circle = tgt.copy(deck).addScaledVector(rt, 0.12 + Math.cos(t * 3.2) * 0.12).addScaledVector(fw, Math.sin(t * 3.2) * 0.07);
        if (!talk) reach(B.upperarm_r, B.lowerarm_r, B.hand_r, circle, pole.copy(rt).addScaledVector(up, -0.3));
        else reach(B.upperarm_r, B.lowerarm_r, B.hand_r, tgt.copy(hip).addScaledVector(rt, 0.22).addScaledVector(up, -0.05), pole.copy(fw).multiplyScalar(-1));
        reach(B.upperarm_l, B.lowerarm_l, B.hand_l, tgt2.copy(deck).addScaledVector(rt, -0.22).addScaledVector(fw, talk ? -0.22 : -0.02), pole.copy(rt).multiplyScalar(-1).addScaledVector(up, -0.3));   // (a hand on the board; on its near rail while talking)
      } else if (S.pose === 'bino') {
        // standing at the rail with the binoculars up, panning slowly along the line; lowers them to talk to you
        const talk = F.talkT > 0 || Math.sin(t * 0.21) > 0.85, pan = Math.sin(t * 0.3) * 0.35;
        const look = tgt.copy(fw).applyAxisAngle(up, pan + F.look * (talk ? 1 : 0)); look.y = talk ? 0.05 : -0.18; look.normalize();
        for (const sd of ['l', 'r']) { const sg = sd === 'l' ? -1 : 1; aim(B['thigh_' + sd], B['calf_' + sd], tgt2.copy(up).multiplyScalar(-1).addScaledVector(rt, sg * 0.1).normalize()); aim(B['calf_' + sd], B['foot_' + sd], tgt2.copy(up).multiplyScalar(-1).normalize()); }
        aim(B.spine_03, B.neck_01, tgt2.copy(up).addScaledVector(look, 0.12).normalize());
        aim(B.neck_01, B.head, tgt2.copy(up).addScaledVector(look, 0.55).normalize());
        B.head.getWorldPosition(W); const eyes = W.addScaledVector(up, 0.07);
        const bn = F.props.bino;
        if (!talk) { const at = tgt2.copy(eyes).addScaledVector(look, 0.14); bn.position.copy(at); bn.quaternion.setFromUnitVectors(_a.set(0, 0, 1), look);
          const side = SD.crossVectors(look, up).normalize();
          reach(B.upperarm_l, B.lowerarm_l, B.hand_l, TA.copy(at).addScaledVector(side, 0.07).addScaledVector(up, -0.03), pole.copy(up).multiplyScalar(-1).addScaledVector(side, 0.4));
          reach(B.upperarm_r, B.lowerarm_r, B.hand_r, TB.copy(at).addScaledVector(side, -0.07).addScaledVector(up, -0.03), pole.copy(up).multiplyScalar(-1).addScaledVector(side, -0.4)); }
        else { B.hand_r.getWorldPosition(bn.position); bn.position.addScaledVector(up, -0.05); bn.quaternion.setFromUnitVectors(_a.set(0, 0, 1), up); }   // (hanging from the right hand)
        const hat = F.props.hat; B.head.getWorldPosition(hat.position); hat.position.addScaledVector(up, 0.14); B.head.getWorldQuaternion(hat.quaternion); hat.quaternion.setFromUnitVectors(_a.set(0, 1, 0), tgt2.copy(up).addScaledVector(look, 0.35).normalize());
      }
      if (F.talkT > 0) F.talkT -= dt;
    }
    // the bubble follows the talker's head on screen
    if (talking) {
      if (talking.talkT <= 0) { bub.classList.remove('on'); talking = null; }
      else { V.copy(talking.head).addScaledVector(up, 0.4).project(camera); const on = V.z < 1 && Math.abs(V.x) < 1.1 && Math.abs(V.y) < 1.1;
        bub.style.opacity = on ? '' : '0'; bub.style.transform = `translate(${(V.x * 0.5 + 0.5) * innerWidth}px, ${(-V.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`; }
    }
  }
  const hide = () => { bub.classList.remove('on'); talking = null; };
  return { group, list, update, hide, say: (id, text) => { const F = list.find((f) => f.id === id); if (F) say(F, text); } };
}
