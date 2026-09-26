// Idle life for the Rocketbox people: the small movements real people make standing or sitting still (breathing, weight
// shifting from foot to foot, a glance round, a roll of the shoulders), taken from Rocketbox motion capture (see
// people/idle.json, baked by tools/people/bake.py). Each clip holds only the root, spine, neck, head and shoulders, as
// turns relative to the clip's first frame, so it layers on top of whatever pose the game has already put someone in.
import * as THREE from 'three';

// people/idle.json -> clips of Float32 turns (frames x bones x 4) and hip drift (frames x 3)
export function lifeLib(data) {
  const dec = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Int16Array(u.buffer); };
  const clips = {};
  for (const k in data.clips) { const c = data.clips[k], q = dec(c.q), p = dec(c.p);
    clips[k] = { n: c.n, q: Float32Array.from(q, (v) => v / 32767), p: Float32Array.from(p, (v) => v / 10000) }; }
  return { fps: data.fps, bones: data.bones, clips };
}

const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _c = new THREE.Quaternion(), _d = new THREE.Quaternion(), ID = new THREE.Quaternion();
// one person's idle: plays through a list of clips (a random next one each time, cross-faded), and a second list while
// talking. B: their bones by name (Bip01, Bip01_Spine...)
export function idle(lib, B, list, talkList = null) {
  const bones = lib.bones.map((n) => B[n] || null), NB = bones.length, FADE = 1.2;
  const pick = (L, not) => { const c = L.filter((k) => k !== not && lib.clips[k]); return c.length ? c[Math.random() * c.length | 0] : L.find((k) => lib.clips[k]); };
  let cur = { k: pick(list), t: Math.random() * 8 }, prev = null, fade = 1, talking = false;
  if (!cur.k) return null;
  // a clip's turn of bone i and hip drift at time t (looping frames, blended between the two nearest)
  const sample = (s, i, out) => { const C = lib.clips[s.k], f = (s.t * lib.fps) % (C.n - 1), f0 = f | 0, u = f - f0, o0 = (f0 * NB + i) * 4, o1 = o0 + NB * 4;
    _b.set(C.q[o0], C.q[o0 + 1], C.q[o0 + 2], C.q[o0 + 3]); _c.set(C.q[o1], C.q[o1 + 1], C.q[o1 + 2], C.q[o1 + 3]); return out.slerpQuaternions(_b, _c, u); };
  const drift = (s, out) => { const C = lib.clips[s.k], f = (s.t * lib.fps) % (C.n - 1), f0 = f | 0, u = f - f0, a = f0 * 3, b = a + 3;
    return out.set(C.p[a] + (C.p[b] - C.p[a]) * u, C.p[a + 1] + (C.p[b + 1] - C.p[a + 1]) * u, C.p[a + 2] + (C.p[b + 2] - C.p[a + 2]) * u); };
  const len = (s) => (lib.clips[s.k].n - 1) / lib.fps;
  const go = (k) => { prev = cur; cur = { k, t: 0 }; fade = 0; };
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3();
  return {
    // talk: switch to the talking clips (if any); w: how much of it shows (1 all), head: how much of the head's own turn
    update(dt, talk = false) {
      if (talkList && talk !== talking) { talking = talk; go(pick(talk ? talkList : list, cur.k)); }
      cur.t += dt; if (prev) prev.t += dt; fade = Math.min(1, fade + dt / FADE); if (fade >= 1) prev = null;
      if (cur.t > len(cur) - FADE) go(pick(talking ? talkList : list, cur.k));   // (on to the next one before this one runs out, cross-faded)
    },
    apply(w = 1, head = 1) {
      for (let i = 0; i < NB; i++) { const b = bones[i]; if (!b) continue;
        sample(cur, i, _a); if (prev) _a.slerp(sample(prev, i, _d), 1 - fade);
        const k = lib.bones[i] === 'Bip01_Head' || lib.bones[i] === 'Bip01_Neck' ? w * head : w; if (k < 1) _a.slerp(ID, 1 - k);
        b.quaternion.multiply(_a); }
      const r = bones[0]; if (r) { drift(cur, P0); if (prev) P0.lerp(drift(prev, P1), 1 - fade); r.position.addScaledVector(P0, w); }
    },
  };
}
