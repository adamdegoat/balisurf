// One peeling reef wave, built as a moving surface every frame.
// Wave-local frame: x runs ALONG the wave (the break peels toward +x), z runs toward the beach (+z is the wave's front),
// y is up. The cross-section at each x depends on s = x - peelX (how far ahead of the breaking point that slice is):
//   s >> 0   : an unbroken swell, getting steeper as the break approaches
//   s ~ 0    : the peak: the face goes near-vertical and the lip starts to throw
//   s < 0    : the lip has thrown forward and down over a hollow tube (the barrel)
//   s << 0   : the tube has collapsed into a low mound of whitewater
// The cross-section is one continuous sheet: trough -> up the (concave) face -> tube ceiling -> lip tip -> over the
// top of the lip -> down the back of the wave. Rendered double-sided so you can see it from inside the tube.
import * as THREE from 'three';

// Real numbers (surf-science literature): a wave breaks at about 0.78 x the depth; near breaking it travels at about
// sqrt(g(d + H/2)); good surf breaks peel at 45-66 degrees, so the peel rate is c / tan(angle) and a surfer needs c / sin(angle).
//   H = breaking height (m), speed = how fast it comes in (m/s), peel = how fast it breaks along the reef (m/s), period = s between waves
export const CONDITIONS = {
  // each level is a different kind of wave, not just a taller one (his call):
  //   len   = how long the swell is along the reef (shoulder, tube and whitewater all stretch with it)
  //   width = how wide the wave is front to back (fat and soft vs narrow and steep)
  //   fat   = how gently the lower face ramps out in front (soft ramp vs near-vertical wall)
  //   tube  = how much the barrel helps you hold your line inside it (a small friendly tube is easy to stay in; a heavy one is all on you)
  // speed from shallow-water physics c ~ sqrt(g(d+H/2)) with d = H/0.78, ~4.2*sqrt(H)
  easy:    { H: 3.5,  speed: 6.4,  peel: 3.4,  angle: 62, period: 12, hollow: 0.72, forgive: 0.6, len: 1,   width: 1.3,  fat: 1.3, tube: 1.3,  name: 'Easy' },     // a proper double-overhead wave, but slow and forgiving (slower than a real one this size): the beginner's barrel
  medium:  { H: 4.5,  speed: 8.4,  peel: 5.0,  angle: 62, period: 14, hollow: 0.8,  forgive: 1,   len: 1.1, width: 1.1,  fat: 1.1, tube: 1.0,  name: 'Medium' },   // clean peeling walls
  hard:    { H: 6.0,  speed: 10.2, peel: 7.6,  angle: 55, period: 16, hollow: 1.0,  forgive: 0.85,   len: 1.5, width: 0.95, fat: 0.8, tube: 0,    name: 'Hard' },     // steep, hollow, heavy
  // the two rights (drawn mirrored): their own waves, not copies of the lefts
  kanan:   { H: 4.2,  speed: 8.2,  peel: 5.6,  angle: 60, period: 13, hollow: 0.92, forgive: 0.95, len: 1.0, width: 1.05, fat: 1.0, tube: 0.8,  name: 'Medium' },   // a racier, hollower mid-size right: more tube, a bit less wall
  hiu:     { H: 5.6,  speed: 10.0, peel: 7.6,  angle: 52, period: 15, hollow: 1.0,  forgive: 0.85, len: 1.35, width: 0.92, fat: 0.76, tube: 0, name: 'Hard' },     // a fast, shallow, square right over coral: runs away from you
  extreme: { H: 15,   speed: 13.5, peel: 11,   angle: 45, period: 20, hollow: 1.0,  forgive: 1,   len: 4,   width: 1.25, fat: 1.1, tube: 0.3,  name: 'Extreme' },  // a 15 m mountain of water; a giant reef wave breaks in shallower water (H/d ~1.1) and runs ~13-14 m/s, like Jaws
};

// Cross-section keyframes (units of wave height H; z toward the beach, y up). Every keyframe lists the SAME 12
// points in the same order, so blending between them unfolds the lip smoothly as the wave breaks:
// frontFlat, toe, lowFace, midFace, upperFace, ceilingTop, lipInner, lipTip, lipOuter, crest, backUpper, backFlat
const K = {
  swell:    [[1.8,0],[1.2,.02],[.7,.08],[.3,.19],[0,.29],[-.15,.33],[-.22,.345],[-.26,.35],[-.3,.35],[-.4,.345],[-1.3,.2],[-2.8,0]],
  shoulder: [[1.3,0],[.8,.02],[.4,.12],[.15,.33],[0,.55],[-.06,.68],[-.1,.73],[-.12,.75],[-.15,.755],[-.25,.74],[-1.1,.4],[-2.5,0]],
  peak:     [[1.1,0],[.6,.03],[.25,.15],[.06,.42],[0,.72],[.06,.92],[.16,.99],[.24,.97],[.16,1.03],[-.05,1.02],[-.95,.55],[-2.3,0]],
  barrel:   [[1.9,0],[1.45,.02],[.4,.1],[-.02,.38],[-.14,.7],[.18,1.02],[.85,.93],[1.32,.12],[1.0,1.02],[.14,1.1],[-.9,.62],[-2.4,0]],   // a wide, round tube: the lip throws well out in front
  white:    [[1.8,0],[1.3,.03],[.9,.12],[.6,.24],[.35,.34],[.2,.4],[.1,.42],[0,.43],[-.1,.43],[-.3,.4],[-1.2,.2],[-2.6,0]],
};
// per control point: how much it glows (thin water) and where spray/foam sits when curling
const THIN = [0, 0, .05, .2, .45, .75, .95, 1, .8, .45, .1, 0];
const SPRAY = [0, 0, 0, 0, 0, 0, .12, .7, .6, .15, 0, 0];   // foam only where the lip lands (the falling curtain itself is clear water)
const NU = 64;                                     // samples across the wave (Catmull-Rom through the 12 points)
const AHEAD = 70, BEHIND = 55;                     // metres of wave drawn ahead of / behind the break
const NX = 150;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerpK = (A, B, t) => A.map((p, i) => [p[0] + (B[i][0] - p[0]) * t, p[1] + (B[i][1] - p[1]) * t]);
function catmull(P, u) {                           // u in [0,1] across all segments
  const n = P.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  const c = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), i, t];
}

const SHARED = new Map();                           // condition -> built geometry + material
// soft round sprites for spray, mist and the offshore veil: drawn once and shared by every wave (making them per wave
// cost a canvas draw and a texture upload each time a new wave appeared: a small hitch on phones)
const SPRITES = {};
function sprite(key, size, stops) {
  if (SPRITES[key]) return SPRITES[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const cx = cv.getContext('2d'), h = size / 2, gr = cx.createRadialGradient(h, h, 0, h, h, h);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  cx.fillStyle = gr; cx.fillRect(0, 0, size, size);
  return (SPRITES[key] = new THREE.CanvasTexture(cv));
}
export class Wave {
  constructor(scene, cond) {
    this.cond = cond; this.peelX = 0; this.zW = 0; this.t = 0; this.fade = 1;
    // every wave of the same size has the same shape: build the mesh once per condition and share it (no hitch per wave)
    const shared = SHARED.get(cond);
    if (shared) {
      this.geo = shared.geo; this.xs = shared.xs; this.shared = true;
      this.mesh = new THREE.Mesh(shared.geo, shared.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
      this.initSpray(scene); this.initMist(scene); this.initVeil(scene); this.initSpit(scene);
      return;
    }
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(NX * NU * 3);
    this.attr = new Float32Array(NX * NU * 2);      // foam, thinness
    this.brk = new Float32Array(NX * NU);           // how much this vertex churns (whitewater)
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aFoamThin', new THREE.BufferAttribute(this.attr, 2));
    g.setAttribute('aBrk', new THREE.BufferAttribute(this.brk, 1));
    const idx = [];
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NU - 1; j++) {
      const a = i * NU + j, b = a + 1, c = a + NU, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, waterMaterial({ wave: true }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.initSpray(scene);
    this.initMist(scene); this.initVeil(scene); this.initSpit(scene);
    this.xs = new Float32Array(NX);
    this.build();
    SHARED.set(cond, { geo: this.geo, mat: this.mesh.material, xs: this.xs }); this.shared = true;
  }

  // the crest line wraps slightly toward the beach along the wave (in proportion to the swell). The physics uses the
  // same curve (surf.js waterAt), or on a big wave the drawn face and the ridden face drift apart.
  bend(s) { const Lx = this.cond.len || 1, sb = s / Lx; return (0.004 * sb * sb * Math.sign(sb) * -0.5 + 0.0015 * sb * sb) * Lx; }
  // how far the wave reaches along the reef and front to back (the physics only looks for water inside this)
  span() { const Lx = this.cond.len || 1, H = this.cond.H, Wd = this.cond.width || 1;
    return this._span ||= { sLo: -BEHIND * Lx, sHi: AHEAD * Lx, zLo: -4.6 * H * Wd - 2,   /* the whole drawn back of the wave */ zHi: 2.4 * H * Wd + 6 }; }
  // how tall the wave stands at distance s from the break: tallest at the peak, fading down the line (scaled by swell length)
  amp(s) { const L = this.cond.len || 1; return s > 0 ? 1 - 0.55 * smooth(8 * L, 70 * L, s) : 1 - 0.15 * smooth(0, 40 * L, -s); }
  // which blend of keyframes a slice at distance s ahead of the break has, plus how broken it is
  // (cached by 10 cm: the particles ask for it hundreds of times a second, and building the blend each time made garbage
  // that stuttered phones)
  shapeAt(s) {
    const key = Math.round(s * 10), c = (this._shp ||= new Map()).get(key);
    if (c) return c;
    const r = this._shapeAt(key / 10); if (this._shp.size > 4000) this._shp.clear(); this._shp.set(key, r); return r;
  }
  _shapeAt(s) {
    const { H, hollow } = this.cond;
    const barrel = this._barrel ||= lerpK(K.peak, K.barrel, Math.min(1, hollow * 1.25));  // gentle waves never get a full round tube (built once)
    let P, curl = 0, broken = 0;
    const L = this.cond.len || 1;
    if (s >= 45 * L) P = K.swell;
    else if (s >= 15 * L) P = lerpK(K.shoulder, K.swell, smooth(15 * L, 45 * L, s));
    else if (s >= 0) P = lerpK(K.peak, K.shoulder, smooth(0, 15 * L, s));
    else if (s >= -1.1 * H) { curl = smooth(0, 1.1 * H, -s); P = lerpK(K.peak, barrel, curl); }
    else if (s >= -4.5 * H) { curl = 1; P = barrel; }                      // a long open tube behind the throw
    else { curl = 1; broken = smooth(4.5 * H, 8 * H, -s); P = lerpK(barrel, K.white, broken); }
    return { P, curl: curl * hollow, broken };
  }

  // cross-section at distance s ahead of the break: fills out[] with [z, y, foam, thin] per sample
  section(s, out) {
    const { H } = this.cond;
    const { P, curl, broken } = this.shapeAt(s);
    const amp = this.amp(s), Wd = this.cond.width || 1, Fat = this.cond.fat || 1, L = this.cond.len || 1;
    let k = 0;
    for (let j = 0; j < NU; j++) {
      const [z, y, i, t] = catmull(P, j / (NU - 1));
      const thin = THIN[i] + (THIN[Math.min(11, i + 1)] - THIN[i]) * t;
      const spray = SPRAY[i] + (SPRAY[Math.min(11, i + 1)] - SPRAY[i]) * t;
      // the lower face runs further out in front than the keyframes say: steep near the lip, easing into the flats like a real wave
      // Real faces: near vertical only in the top third, ~45-55 deg through the middle, flattening to 20-30 deg at the
      // bottom; on the unbroken shoulder a broad ramp. The keyframes are a steep outline, so the lower and middle face
      // are pushed out in front (more on the shoulder, less under a pitching lip so the tube stays open) and the back
      // of the wave is made thicker.
      const below = i < 5 ? 1 : i === 5 ? 1 - t * t * (3 - 2 * t) : 0;
      const push = (0.45 + 0.3 * smooth(0, 30 * L, s)) * Fat * (1 - 0.8 * curl) * Math.pow(1 - smooth(0, 0.85, y), 1.3) * below;
      const back = i >= 9 ? 1.6 : i === 8 ? 1 + 0.6 * t : 1;
      out[k++] = (z * back + push) * H * Wd; out[k++] = Math.max(0, y) * H * amp;
      out[k++] = Math.min(1, broken * 0.9 + spray * curl * 0.5);
      out[k++] = thin * (1 - broken * 0.7);
    }
    out[0] += 9 * H; out[1] = 0; out[2] = 0; out[3] = 0;   // skirt: the first sample runs far out over the flat water so the mesh edge sits well away from the rider
  }

  build() {
    const tmp = new Float32Array(NU * 4);
    // denser slices near the break, where the shape changes fastest
    for (let i = 0; i < NX; i++) {
      const u = i / (NX - 1);
      const w = u * 2 - 1;                                            // -1..1
      const Lx = this.cond.len || 1, s = w < 0 ? -BEHIND * Lx * Math.pow(-w, 1.6) : AHEAD * Lx * Math.pow(w, 1.6);   // a longer swell is drawn longer
      this.xs[i] = s;
      this.section(s, tmp);
      for (let j = 0; j < NU; j++) {
        const p = (i * NU + j) * 3, a = (i * NU + j) * 2;
        const bend = this.bend(s);   // crest line wraps slightly toward the beach (the physics uses the same curve)
        this.pos[p] = s; this.pos[p + 1] = tmp[j * 4 + 1]; this.pos[p + 2] = tmp[j * 4] + bend;
        this.brk[i * NU + j] = s < -4.5 * this.cond.H ? Math.min(1, (-s - 4.5 * this.cond.H) / (3.5 * this.cond.H)) * Math.sin(Math.PI * j / (NU - 1)) : 0;
        this.attr[a] = tmp[j * 4 + 2]; this.attr[a + 1] = tmp[j * 4 + 3];
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aFoamThin.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  // whitewater mist: big soft puffs boiling off the broken part of the wave and drifting back in the offshore wind
  initMist(scene) {
    const N = 240; this.mistN = N;
    this.mp = new Float32Array(N * 3); this.mv = new Float32Array(N * 3); this.ml = new Float32Array(N).fill(-1); this.ma = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.mp, 3));
    this.mist = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf2efe9, size: Math.min(4.5, 0.75 * this.cond.H), map: sprite('mist', 64, [[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]), transparent: true, opacity: 0.24, depthWrite: false }));
    this.mist.frustumCulled = false; scene.add(this.mist);
  }
  updateMist(dt) {
    const H = this.cond.H, P = this.mp, V = this.mv;
    for (let i = 0; i < this.mistN; i++) {
      if (this.ml[i] <= 0) {
        if (Math.random() > 0.2) { P[i * 3 + 1] = -99; continue; }
        // born along the top of the whitewater and where the lip hits the water
        const s = -(4 + Math.random() * 10) * H;
        if (s < -50 * (this.cond.len || 1)) continue;
        const sh = this.shapeAt(s), crest = sh.P[9], amp = this.amp(s);
        const atLip = Math.random() < 0.4 && sh.broken < 0.5;
        P[i * 3] = this.peelX + s + (Math.random() - .5) * 2;
        P[i * 3 + 1] = (atLip ? 0.2 * H : crest[1] * H * amp * (0.7 + Math.random() * 0.4)) * this.fade;   // (the wave is drawn squashed by fade: particles too)
        P[i * 3 + 2] = (atLip ? sh.P[7][0] : crest[0]) * H * (this.cond.width || 1) + this.zW + this.bend(s) + (Math.random() - .5) * H;
        V[i * 3] = (Math.random() - .5) * 0.6; V[i * 3 + 1] = 0.5 + Math.random() * 1.2; V[i * 3 + 2] = this.cond.speed * 0.6 - 1.5 - Math.random() * 2;
        this.ml[i] = 1 + Math.random() * 1.5;
      }
      this.ml[i] -= dt;
      V[i * 3 + 1] -= 0.6 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (this.ml[i] <= 0) P[i * 3 + 1] = -99;
    }
    this.mist.geometry.attributes.position.needsUpdate = true;
    this.mist.material.opacity = 0.26 * this.fade;
  }
  // barrel spit: every few seconds a hollow wave's tube compresses and blows a burst of mist out of its mouth, along
  // the line ahead of the curl (its own particles: brighter than the drifting whitewater mist)
  initSpit(scene) {
    const N = 110; this.spitN = N;
    this.tp = new Float32Array(N * 3).fill(-99); this.tv = new Float32Array(N * 3); this.tl = new Float32Array(N).fill(-1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.tp, 3));
    this.spit = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf6f4ee, size: 0.45 * this.cond.H, map: sprite('mist', 64, [[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]), transparent: true, opacity: 0.6, depthWrite: false }));
    this.spit.frustumCulled = false; scene.add(this.spit);
    this.spitT = 3 + Math.random() * 4;
  }
  updateSpit(dt) {
    const H = this.cond.H, P = this.tp, V = this.tv;
    if (this.cond.hollow > 0.5 && this.fade > 0.3 && (this.spitT -= dt) <= 0) {
      this.spitT = 5 + Math.random() * 5;
      for (let i = 0; i < this.spitN; i++) {
        const s0 = -(0.5 + Math.random() * 1.3) * H, sh = this.shapeAt(s0), amp = this.amp(s0);
        P[i * 3] = this.peelX + s0; P[i * 3 + 1] = (0.2 + Math.random() * 0.3) * H * amp * this.fade;
        P[i * 3 + 2] = sh.P[5][0] * H * (this.cond.width || 1) + this.zW + this.bend(s0) + (Math.random() - .5) * 0.4 * H;
        V[i * 3] = this.cond.peel * (1.5 + Math.random()); V[i * 3 + 1] = (Math.random() - .3) * 1.5; V[i * 3 + 2] = this.cond.speed * 0.9 + (Math.random() - .5) * 2;
        this.tl[i] = 0.6 + Math.random() * 0.9;
      }
    }
    for (let i = 0; i < this.spitN; i++) {
      if (this.tl[i] <= 0) { P[i * 3 + 1] = -99; continue; }
      this.tl[i] -= dt; V[i * 3] *= Math.exp(-1.5 * dt); V[i * 3 + 1] -= 0.8 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
    }
    this.spit.geometry.attributes.position.needsUpdate = true;
    this.spit.material.opacity = 0.6 * this.fade;
  }
  // offshore spray: the land breeze blows a thin veil of spray back off the top of the standing face (the Bali look)
  initVeil(scene) {
    const N = 560; this.veilN = N;
    this.vp = new Float32Array(N * 3); this.vv = new Float32Array(N * 3); this.vl = new Float32Array(N).fill(-1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.vp, 3));
    this.veil = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.55 * Math.sqrt(this.cond.H), map: sprite('veil', 64, [[0, 'rgba(255,255,255,.7)'], [0.45, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]), transparent: true, opacity: 0.3, depthWrite: false }));
    this.veil.frustumCulled = false; scene.add(this.veil);
  }
  updateVeil(dt) {
    const H = this.cond.H, P = this.vp, V = this.vv;
    for (let i = 0; i < this.veilN; i++) {
      if (this.vl[i] <= 0) {
        if (Math.random() > 0.75) { P[i * 3 + 1] = -99; continue; }
        // along the crest of the standing face, from the curl out onto the shoulder, where the wave is tall and steep
        const s = -H + Math.pow(Math.random(), 1.8) * 13 * H;   // thickest near the curl, where the face is steepest
        const sh = this.shapeAt(s), crest = sh.P[9];
        if (crest[1] < 0.55 || sh.broken > 0.3) { P[i * 3 + 1] = -99; continue; }
        const amp = this.amp(s);
        P[i * 3] = this.peelX + s + (Math.random() - .5) * 1.5;
        P[i * 3 + 1] = (crest[1] * H * amp + Math.random() * 0.15 * H) * this.fade;
        P[i * 3 + 2] = crest[0] * H * (this.cond.width || 1) + this.zW + this.bend(s);
        V[i * 3] = (Math.random() - .5) * 0.8; V[i * 3 + 1] = 1 + Math.random() * 1.8; V[i * 3 + 2] = this.cond.speed - 4 - Math.random() * 5;   // rides in with the wave, blown back off its top
        this.vl[i] = 0.8 + Math.random() * 1.2;
      }
      this.vl[i] -= dt;
      V[i * 3 + 1] -= 0.9 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (this.vl[i] <= 0) P[i * 3 + 1] = -99;
    }
    this.veil.geometry.attributes.position.needsUpdate = true;
    this.veil.material.opacity = 0.75 * this.fade;
  }
  initSpray(scene) {
    const N = 900; this.sprayN = N;
    this.sp = new Float32Array(N * 3).fill(-99); this.sv = new Float32Array(N * 3); this.sl = new Float32Array(N);   // (parked out of sight until born)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
    // soft round droplet sprite
    const tex = sprite('drop', 32, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
    this.spray = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1e0, size: 0.22, map: tex, alphaMap: tex, transparent: true, opacity: 0.65, depthWrite: false, fog: false }));
    this.spray.frustumCulled = false; scene.add(this.spray);
    for (let i = 0; i < N; i++) this.sl[i] = -1;
  }
  // where the break is (peelX) and where the wave is on its way in (zW)
  place(peelX, zW) { this.placed = true; this.peelX = peelX; this.zW = zW; }
  dispose(scene) {
    scene.remove(this.mesh); scene.remove(this.spray);
    if (!this.shared) { this.geo.dispose(); this.mesh.material.dispose(); }   // shared shapes stay for the next wave
    this.spray.geometry.dispose(); this.spray.material.dispose();
    scene.remove(this.mist); this.mist.geometry.dispose(); this.mist.material.dispose();
    scene.remove(this.veil); this.veil.geometry.dispose(); this.veil.material.dispose();
    scene.remove(this.spit); this.spit.geometry.dispose(); this.spit.material.dispose();   // (sprites are shared: kept)
  }
  lipAt(s) {                                          // world position of the lip tip for the slice at s
    // the shape for a given s never changes, so remember it (per 10 cm); only x moves with the peel
    const key = Math.round(s * 10), c = (this._lip ||= new Map()).get(key);
    if (c) return [this.peelX + s, c[0], c[1] + this.zW + this.bend(s)];
    const r = this._lipAt(key / 10); if (this._lip.size > 5000) this._lip.clear(); this._lip.set(key, [r[1], r[2]]);
    return [this.peelX + s, r[1], r[2] + this.zW + this.bend(s)];
  }
  _lipAt(s) {
    const { P } = this.shapeAt(s); const H = this.cond.H;
    return [this.peelX + s, P[7][1] * H * this.amp(s), P[7][0] * H * (this.cond.width || 1)];
  }
  updateSpray(dt) {
    if (!this.spray) return;
    const H = this.cond.H;
    for (let i = 0; i < this.sprayN; i++) {
      if (this.sl[i] <= 0) {
        if (Math.random() > 0.16) continue;   // (plenty of droplets along the lip: they break up its edge)
        // born along the throwing lip and the top of the tube behind it
        const s = -Math.random() * 4 * H;
        const [x, y, z] = this.lipAt(s);
        const crest = this.shapeAt(s).P[9];
        const top = Math.random() < 0.6;
        this.sp[i * 3] = x + (Math.random() - .5) * .3;
        this.sp[i * 3 + 1] = (top ? crest[1] * H : y) * this.fade;
        this.sp[i * 3 + 2] = top ? crest[0] * H * (this.cond.width || 1) + this.zW + this.bend(s) : z;
        this.sv[i * 3] = (Math.random() - .5) * .6; this.sv[i * 3 + 1] = 1 + Math.random() * 2.2 * (H / 2); this.sv[i * 3 + 2] = -1.5 - Math.random() * 3;   // offshore wind blows it back
        this.sl[i] = 0.6 + Math.random() * 1.2;
      }
      this.sl[i] -= dt;
      this.sv[i * 3 + 1] -= 3.5 * dt;
      this.sp[i * 3] += this.sv[i * 3] * dt; this.sp[i * 3 + 1] += this.sv[i * 3 + 1] * dt; this.sp[i * 3 + 2] += this.sv[i * 3 + 2] * dt;
      if (this.sl[i] <= 0) this.sp[i * 3 + 1] = -99;
    }
    this.spray.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.t += dt;
    if (!this.placed) this.peelX += this.cond.peel * dt;   // test page: just peel; the game places waves itself
    this.mesh.position.set(this.peelX, 0, this.zW);   // same shape, slid along the reef as it peels and toward the beach as it comes in
    this.mesh.scale.y = this.fade;
    this.mesh.material.uniforms.uH.value = this.cond.H;
    this.updateSpray(dt);
    this.updateMist(dt);
    this.updateVeil(dt);
    this.updateSpit(dt);
  }
}

// ---------------------------------------------------------------- shading
export const SUN_DIR = new THREE.Vector3(0.25, 0.1, -1).normalize();   // low sun out to sea, behind the waves

// Weather follows the difficulty. Every water/sky material shares these uniforms, so switching weather is instant.
export const WEATHER = {
  // good weather on the three normal levels (his call): morning, midday, afternoon sun; the storm is Extreme only
  easy:    { sun: [0.35, 0.62, -0.7], zen: 0x2a6cb8, hor: 0xa9d5ec, sunCol: 0xfff4dc, fog: 0xb6daeb, deep: 0x0a5a84, turq: 0x1ccabb, cloud: 0.18, chop: 0.8, fogFar: 320, rain: 0, sunVis: 1 },
  medium:  { sun: [0.2, 0.85, -0.45], zen: 0x2562ab, hor: 0xacd4e8, sunCol: 0xfff7e6, fog: 0xbadae9, deep: 0x08527c, turq: 0x18c2b3, cloud: 0.22, chop: 1.0, fogFar: 330, rain: 0, sunVis: 1 },
  hard:    { sun: [0.55, 0.42, -0.72], zen: 0x2158a6, hor: 0xa6cde3, sunCol: 0xffe6bf, fog: 0xb4d4e3, deep: 0x07496e, turq: 0x16b2a5, cloud: 0.2, chop: 1.5, fogFar: 300, rain: 0, sunVis: 1 },
  kanan:   { sun: [-0.45, 0.5, -0.75], zen: 0x2a66b0, hor: 0xb4d8e8, sunCol: 0xffefd2, fog: 0xc0dbe8, deep: 0x075a7a, turq: 0x1ec8b4, cloud: 0.26, chop: 0.9, fogFar: 320, rain: 0, sunVis: 1 },   // late morning, a few puffy clouds
  hiu:     { sun: [0.35, 0.62, -0.7], zen: 0x1f5aa8, hor: 0xa2cde6, sunCol: 0xfff3dc, fog: 0xb0d4e6, deep: 0x06466e, turq: 0x12c4c4, cloud: 0.12, chop: 1.3, fogFar: 300, rain: 0, sunVis: 1 },   // clear and windy, glassy blue over the coral
  extreme: { sun: [0.1, 0.35, -1],    zen: 0x1a2124, hor: 0x56646a, sunCol: 0x8a9496, fog: 0x4a565b, deep: 0x07181b, turq: 0x2a6258, cloud: 0.92, chop: 2.4, fogFar: 150, rain: 1, sunVis: 0.08 },
  villa:   { gold: 1, sun: [-0.35, 0.22, -0.9], zen: 0x3a64a8, hor: 0xf0c9a2, sunCol: 0xffc68a, fog: 0xf0c6a0, deep: 0x0a4a62, turq: 0x15a39a, cloud: 0.18, chop: 0.9, fogFar: 1100, rain: 0, sunVis: 1 },   // golden hour at the villa: the sun going down over the sea
  ranch:   { sun: [0.45, 0.72, -0.5], zen: 0x2a6cb8, hor: 0xcfe2ea, sunCol: 0xfff3dd, fog: 0xd4e5ec, deep: 0x1a8ea0, turq: 0x3fd6c8, cloud: 0.08, chop: 0.3, fogFar: 700, rain: 0, sunVis: 1 },   // dry, clear country sky; calm pool water
  random:  { sun: [0.3, 0.7, -0.6],  zen: 0x2766ae, hor: 0xabd3e7, sunCol: 0xfff3dc, fog: 0xb9d9e8, deep: 0x09547e, turq: 0x19bdb2, cloud: 0.32, chop: 1.1, fogFar: 310, rain: 0, sunVis: 1 },
};
export const ENV = {
  uSun: { value: SUN_DIR.clone() }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
  uFog: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uTurq: { value: new THREE.Color() },
  uTime: { value: 0 },                                // one clock for every water surface, so the sea and the wave match
  uCloud: { value: 0.3 }, uChop: { value: 1 }, uFogFar: { value: 260 }, uSunVis: { value: 1 }, uFlash: { value: 0 },
  uPool: { value: new THREE.Vector4(-1e6, 1e6, -1e6, 1e6) },   // water only inside this box (x0, x1, z0, z1): the wave pool
  uReef: { value: 1 },
  uGold: { value: 0 },                                // golden hour (the villa's evening): 0 = plain day
  uReefEnd: { value: 190 }, uReefTint: { value: new THREE.Color(1, 1, 1) },   // where the shallows stop (the beach), and each spot's reef colour                                           // 0 = no reef under the water (a concrete pool)
};
export function setWeather(name) {
  const w = WEATHER[name]; ENV.weather = w; ENV.name = name;
  ENV.uSun.value.set(...w.sun).normalize();
  for (const k of ['zen', 'hor', 'sunCol', 'fog', 'deep', 'turq']) ENV['u' + k[0].toUpperCase() + k.slice(1)].value.setHex(w[k]);
  ENV.uGold.value = w.gold || 0;
  ENV.uCloud.value = w.cloud; ENV.uChop.value = w.chop; ENV.uFogFar.value = w.fogFar; ENV.uSunVis.value = w.sunVis;
}
setWeather('medium');
const NOISE = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

// golden hour: a burning orange band low around the sun, turning rose and then lilac away from it, a deeper blue
// overhead and a wide warm glow round the sun (on the sky, and on the sky as the water mirrors it)
const SUNSET = /* glsl */`
  vec3 sunset(vec3 d, vec3 c){
    if (uGold < .01) return c;
    float h = clamp(d.y, 0., 1.);
    vec2 da = d.xz / max(length(d.xz), 1e-4), sa = uSun.xz / max(length(uSun.xz), 1e-4);
    float az = dot(da, sa) * .5 + .5;
    vec3 horz = mix(vec3(.78, .5, .56), mix(vec3(.92, .38, .3), vec3(.95, .45, .1), az), smoothstep(.15, .8, az));   // (kept below full brightness: the filmic curve turns near-white orange into pastel)
    c = mix(c, horz, exp(-h * 5.) * uGold * .92);
    c = mix(c, c * vec3(.72, .78, 1.08), smoothstep(.2, .75, h) * uGold);
    return c + uSunCol * pow(max(dot(d, uSun), 0.), 5.) * .4 * uGold;
  }
`;
export function waterMaterial({ wave = false } = {}) {
  return new THREE.ShaderMaterial({
    side: wave ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { ...ENV, uH: { value: 2 } },
    vertexShader: /* glsl */`
      attribute vec2 aFoamThin;${wave ? '\n      attribute float aBrk;' : ''}
      uniform float uTime, uH;
      varying vec3 vW; varying vec3 vN; varying vec2 vFT; varying float vAge;
      void main(){
        vec3 pp = position;
        vAge = ${wave ? 'clamp((-position.x / max(uH, .5) - 2.) / 7., 0., 1.)' : '0.'};   // how long ago this bit broke (0 at the curl, 1 far behind)
        ${wave ? 'pp.y += aBrk * uH * (sin(pp.x * 1.7 + pp.z * 2.3 + uTime * 3.) * .09 + sin(pp.x * .63 - uTime * 2.1 + pp.z * .9) * .12 + sin(pp.x * 4.1 + pp.z * 3.3 - uTime * 5.) * .045 + sin(pp.x * 2.9 - pp.z * 5.2 + uTime * 4.2) * .04); pp.z += aBrk * uH * sin(pp.x * 1.3 + uTime * 2.6) * .08;   // a churning, lumpy bore, not a smooth plateau' : ''}
        vec4 w = modelMatrix * vec4(pp,1.);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vFT = ${wave ? 'aFoamThin' : 'vec2(0.)'};
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uH, uCloud, uChop, uFogFar, uSunVis, uFlash, uReef, uReefEnd, uGold; uniform vec3 uReefTint; uniform vec3 uSun, uZen, uHor, uSunCol, uFog, uDeep, uTurq; uniform vec4 uPool;
      varying vec3 vW; varying vec3 vN; varying vec2 vFT; varying float vAge;
      ${NOISE}${SUNSET}
      vec3 sky(vec3 d){
        float h = clamp(d.y, 0., 1.);
        vec3 c = mix(uHor, uZen, pow(h, .45));
        float s = max(dot(d, uSun), 0.);
        c += uSunCol * (pow(s, 600.) * 6. * uSunVis + pow(s, 12.) * .35);   // (the hard sun disk is left to the glitter term below: reflected at full strength it smeared into white blobs)
        c = mix(c, uHor * .8 + uZen * .2, uCloud * .6);               // overcast skies reflect flat grey light
        return c + uFlash;
      }
      // the sky as the water reflects it: no sun disk or glow (the sun on the water is drawn by the glitter below; the
      // smooth glow reflected through ripples smeared into white blobs beside the board)
      vec3 skyR(vec3 d){
        float h = clamp(d.y, 0., 1.);
        vec3 c = sunset(d, mix(uHor, uZen, pow(h, .3))) + uSunCol * pow(max(dot(d, uSun), 0.), 12.) * .08;   // (a touch more blue sky in it than the view straight at the horizon: the sea read milky)
        return mix(c, uHor * .8 + uZen * .2, uCloud * .6) + uFlash;
      }
      void main(){
        if (vW.x < uPool.x || vW.x > uPool.y || vW.z < uPool.z || vW.z > uPool.w) discard;   // (the wave pool's walls)
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        ${wave ? 'N = normalize(mix(vec3(0., 1., 0.), N, smoothstep(.0, .12 * uH, vW.y)));   // the wave\'s flat edge shades exactly like the open sea' : ''}
        // small ripples
        // ripples mapped on the flat sea (xz) and on steep walls (x, height+depth) so they never stretch into rings
        float wall = abs(N.y) < .6 ? 1. : 0.;
        vec2 q = mix(vW.xz, vec2(vW.x, vW.y + vW.z), smoothstep(.75, .35, abs(N.y))) * .45 + vec2(uTime*.12, uTime*.07);
        float n1 = fbm(q), n2 = fbm(q*2.3 + 7.1);
        N = normalize(N + vec3(n1 - .5, 0., n2 - .5) * .28 * uChop);
        // fine wind ripples close to you (the big ripple pattern alone leaves the water glassy up close)
        float nearK = smoothstep(30., 3., length(cameraPosition - vW)) * step(.6, abs(N.y));
        if (nearK > .001) {   // (worked out only where it shows: most of the screen is further off than 30 m)
          vec2 rq = vW.xz * 3.2 + vec2(uTime * .5, uTime * .35);
          N = normalize(N + vec3(fbm(rq) - .5, 0., fbm(rq * 1.7 + 4.3) - .5) * .32 * nearK * (.7 + .3 * min(uChop, 1.)));   // (capped: in the storm it made bright squiggles)
        }
        ${wave ? `
        // fine texture on the face: water being drawn up the wall leaves streaky ripples that stream upward;
        // strongest on steep faces, fading with distance (it would only shimmer far away)
        float wallK = smoothstep(.85, .3, abs(N.y)) * smoothstep(18., 4., length(cameraPosition - vW));
        if (wallK > .001) {
          vec2 fq = vec2(vW.x * 2.6, (vW.y + vW.z) * 1.1 - uTime * 1.4);
          float f1 = fbm(fq), f2 = fbm(fq * 2.1 + 3.7);
          vec3 T = normalize(cross(N, vec3(1., 0., 0.)) + vec3(0., 1e-4, 0.));
          N = normalize(N + (vec3(1., 0., 0.) * (f1 - .5) * .35 + T * (f2 - .5) * .5) * wallK);
        }` : ''}
        float fres = .03 + .97 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = skyR(R);
        // body colour: deep blue at the base, turquoise where the wall is thin and lit from behind
        float thin = vFT.y;
        vec3 deep = uDeep, turq = uTurq;
        // water pulled up the face leaves vertical streaks; the base of the wave is darker and denser
        ${wave ? 'if (vW.y > .03) thin *= .75 + .5 * fbm(vec2(vW.x * 2.2 + vW.z * .6, vW.y * .35 - uTime * .6));   // (on the flat skirt round the wave it comes out 0 below anyway)' : ''}
        thin *= smoothstep(.03, .22 * uH, vW.y);                        // flat water in front of the wave matches the open sea (no seam)
        float base = smoothstep(.0, .9, vW.y / max(uH, .5));
        float back = pow(max(dot(-V, uSun), 0.), 3.);                // looking toward the sun through the water
        vec3 body = mix(deep, turq, thin * .8) + turq * thin * back * 1.3 * uSunVis + uSunCol * thin * back * .25 * uSunVis + turq * thin * .25 * (1. - uSunVis);
        body *= .55 + .45 * base;
        body = mix(vec3(dot(body, vec3(.3, .59, .11))), body, 1.2 - .2 * thin);   // (the filmic tone curve greys colours: the water gets a little back; not the glowing thin water, which went neon)
        // the reef under clear shallow water (flat water inside the break, toward the beach): pale turquoise over sand
        // with darker coral and rock patches, fading out in deep water, on the wave faces and under a stormy sky
        float reefK = smoothstep(-45., 15., vW.z) * (1. - smoothstep(uReefEnd - 25., uReefEnd, vW.z)) * smoothstep(-160., -60., vW.x)
                    * smoothstep(.55, .99, normalize(vN).y) * (1. - smoothstep(.05, 1.4, vW.y)) * (1. - .7 * uCloud) * uReef;
        if (reefK > .001) {
          float rn = fbm(vW.xz * .06), rn2 = fbm(vW.xz * .27 + 3.1);
          vec3 reefCol = mix(vec3(.3, .66, .62), vec3(.13, .25, .22), clamp(smoothstep(.46, .6, rn) + .35 * (rn2 - .5), 0., 1.));
          body = mix(body, reefCol * uReefTint * (.55 + .45 * uSunVis), reefK * .38);   // (fades in gradually up the trough: a narrow switch followed one row of the wave mesh and drew a ruler-straight edge)
        }
        ${wave ? '// the upper face and lip glow a lighter, see-through green: skylight passing through thin water near the top\n        float glow = smoothstep(.4, .95, vW.y / max(uH, .5)) * clamp(thin * 1.4, 0., 1.);\n        body += (turq * .55 + vec3(.04, .1, .08)) * glow * (.5 + .5 * uSunVis);\n        // the throwing lip is a moving sheet: light and dark streaks run through it, and its thinnest edge glows palest\n        if (glow > .001) {   // (the upper face and lip only)\n          vec2 shq = vec2(vW.x * .9, (vW.y - vW.z) * .3 + uTime * 1.2); float sheet = vnoise(shq) * .62 + vnoise(shq * 2.3 + 1.7) * .38;   // (two layers of noise: plenty for a streak, half the cost of the full four)\n          body *= 1. + (sheet - .5) * 1.4 * glow;\n          body += vec3(.3, .55, .5) * smoothstep(.8, 1., vFT.y) * glow * .25 * (.4 + .6 * uSunVis);\n        }' : ''}
        ${wave ? 'if (N.y < -.15) refl = mix(refl, body * .8, smoothstep(-.15, -.55, N.y));   // (the underside of the lip mirrors the water below it, not the sky)' : ''}
        vec3 col = mix(body, refl, fres);
        // sun glint
        // (broken into glitter by the small ripples, as on real water; a smooth glint reads as a white smudge up close)
        float spec = pow(max(dot(R, uSun), 0.), 220.) * uSunVis;
        if (spec > .0005) {   // (only in the sun's own reflection: everywhere else it adds nothing)
          float glit = smoothstep(.6, .74, fbm(vW.xz * 16. + vec2(uTime * 1.6, -uTime * 1.1))) * smoothstep(.3, .6, fbm(vW.xz * 3.1 - uTime * .3));   // fine sparkles, not blobs
          col += uSunCol * min(.55, spec * 3. * (.04 + glit));   // (capped: unbounded it merged into white blobs)
        }
        // sun sparkle: tiny points of sunlight winking on the water. Each 40 cm cell holds one little ripple facet tilted its
        // own way (and rocking); it flashes only when it would really mirror the sun into your eye, so the sparkle gathers
        // toward the sun and none shows looking away from it. Kept a pixel or two wide, faded where it'd go sub-pixel
        vec2 gp = vW.xz * 2.5; float fw = fwidth(gp.x) * 1.4;   // (fwidth outside the branch: it needs every pixel of the block)
        if (N.y > ${wave ? '.96' : '.5'} && fw < .7 && uSunVis * (1. - uCloud) > .02) {   // (on a wave, only its flat skirt: on the face they read as specks of dust)   // (skipped wholesale where it can't show: steep faces, far off, a storm)
        vec2 gi = floor(gp), gf = fract(gp);
        float sh = hash(gi), ph = sh * 60.;
        vec3 nC = normalize(vec3((hash(gi + 1.3) - .5) * 1.2 + .2 * sin(uTime * 2.1 + ph), 1., (hash(gi + 5.9) - .5) * 1.2 + .2 * cos(uTime * 1.7 + ph)));
        float spr = clamp(fw * .9, .03, .07);   // (up close a bigger point read as a white blob)
        float spark = (1. - smoothstep(spr * .4, spr, length(gf - vec2(hash(gi + 3.1), hash(gi + 7.7)) * .7 - .15))) * smoothstep(.93, .985, dot(reflect(-V, nC), uSun)) * (1. - smoothstep(.3, .7, fw));
        col += uSunCol * spark * 0.9 * uSunVis * (1. - uCloud);   // (more of them, softer: a few hard white points read as dust, a field of soft ones as glitter)
        }
        ${wave ? `
        // foam: churned white where the lip throws and the whitewater rolls (none of it is worked out on clean water:
        // with less than this much foam the mask below can't come out above zero)
        if (vFT.x > .04) {
        // foam features scale with the wave: a 15 m wave boils in big lumps, not a fine repeating pattern
        float fk = pow(2. / max(uH, 2.), .65);
        float foamN = fbm(vec2(vW.x, vW.y + vW.z) * 1.4 * fk + vec2(0., uTime * 1.3 * fk));
        float foamMask = smoothstep(.35, .75, vFT.x + (foamN - .5) * .6);
        // whitewater ages: solid and churning just behind the curl, then it thins into drifting patches and lace with the
        // water showing through (a uniform white blanket read as a carpet)
        float patches = fbm(vW.xz * .28 * fk + vec2(uTime * .04, -uTime * .07)) + (foamN - .5) * .35;
        foamMask *= mix(1., (.1 + .9 * smoothstep(.46, .66, patches)) * (1. - .55 * smoothstep(.3, 1., vAge)), vAge);   // old foam: thinner, fainter patches the longer ago it broke
        // (a drifting foam-line lace was tried and taken out: from the rider's eye it read as white scribbles on the face)
        // whitewater is lumpy boiling foam, not a white slab: churning lumps with grey shadows between them, lit by the sky
        vec2 fp = vec2(vW.x * 1.7 + vW.z * .5, vW.y * 2.2 + vW.z * 1.3) * fk + vec2(uTime * .35, -uTime * 1.1) * fk;
        float lump = fbm(fp) * .65 + fbm(fp * 2.7 + 5.3) * .35;
        float shade = .55 + .45 * smoothstep(.25, .75, lump);
        vec3 foamCol = vec3(.93, .92, .9) * shade * (.72 + .28 * max(dot(N, uSun), 0.)) + mix(uHor, uZen, .5) * .12 * (1. - shade * .5);
        col = mix(col, foamCol, foamMask * (.82 + .18 * lump));   // thin spots show the water through
        }
        ` : ''}
        // distance haze toward the horizon
        float d = length(cameraPosition - vW);
        col = mix(col, uFog, smoothstep(uFogFar * .25, uFogFar, d) * .9);   // (from a quarter of the way out: from 15% the whole mid-distance went milky)
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function skyDome(scene) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...ENV, uTime: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uSun, uZen, uHor, uSunCol; uniform float uCloud, uSunVis, uTime, uFlash, uGold; varying vec3 vD; ${NOISE}${SUNSET}
      void main(){
        vec3 d = normalize(vD); float h = clamp(d.y, 0., 1.);
        vec3 c = sunset(d, mix(uHor, uZen, pow(h, .45)));
        float s = max(dot(d, uSun), 0.);
        c += uSunCol * (pow(s, 900.) * 8. * uSunVis + pow(s, 10.) * .5 * max(uSunVis, .3));
        // clouds: thin streaks on clear days, a heavy low ceiling in a storm
        vec2 p = d.xz / max(d.y + .08, .02) * .6 + vec2(uTime * .01, 0.);
        float n = fbm(p * vec2(1., 3. - uCloud * 2.));
        float cl = smoothstep(.62 - uCloud * .5, .82 - uCloud * .35, n);
        vec3 warm = mix(vec3(.95,.6,.5), vec3(.9,.92,.95), clamp(uSunVis * (1. - uCloud), 0., 1.));
        warm = mix(warm, mix(vec3(.95, .55, .6), vec3(1., .66, .38), pow(max(dot(normalize(d.xz + 1e-4), normalize(uSun.xz)), 0.), 2.)), uGold * .85);   // (at golden hour the clouds catch the low sun: orange near it, pink away from it)
        vec3 cloudLit = mix(vec3(.42,.47,.5), warm, clamp(uSunVis * 1.5, 0., 1.));        // no sun, no colour: storm clouds are grey
        vec3 cloudCol = mix(cloudLit, vec3(.12,.14,.16), uCloud * .85) * (.75 + .25 * n);
        cloudCol += uSunCol * pow(s, 6.) * .4 * uSunVis;                       // silver lining near the sun
        c = mix(c, cloudCol, cl * mix(.55, .97, uCloud) * smoothstep(.0, .2, d.y));
        if (d.y < 0.) c = mix(uHor, uHor * .3, clamp(-d.y*6., 0., 1.));
        gl_FragColor = vec4(c + uFlash, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), m);
  sky.renderOrder = 2;   // (last of all: it only fills what nothing else covers)
  scene.add(sky);
  sky.onBeforeRender = () => { m.uniforms.uTime.value = performance.now() / 1000; };
  return sky;
}

export function ocean(scene) {
  const g = new THREE.PlaneGeometry(1400, 1400, 1, 1); g.rotateX(-Math.PI / 2);
  const m = waterMaterial();
  const mesh = new THREE.Mesh(g, m); mesh.position.y = -0.02; scene.add(mesh);
  mesh.renderOrder = 1;   // (drawn after the waves and the land: wherever they cover it, its costly water shading is skipped, not painted over)
  return mesh;
}

// Rain streaks that follow the camera, and lightning that lights the whole scene for a moment (storm only).
export class WeatherFX {
  constructor(scene) {
    const N = 1400; this.N = N;
    this.p = new Float32Array(N * 6);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab6ba, transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    this.flashT = 0; this.nextFlash = 9;
    for (let i = 0; i < N; i++) this.reset(i, new THREE.Vector3(), true);
  }
  reset(i, c, anyHeight) {
    const x = c.x + (Math.random() - .5) * 40, z = c.z + (Math.random() - .5) * 40, y = c.y + (anyHeight ? Math.random() * 20 - 4 : 16);
    this.p.set([x, y, z, x + 0.25, y - 0.9, z - 0.35], i * 6);          // wind-slanted streak
  }
  update(dt, cam) {
    const w = ENV.weather;
    this.rain.visible = w.rain > 0;
    if (this.rain.visible) {
      for (let i = 0; i < this.N; i++) {
        const o = i * 6, vy = -22 * dt, vx = 5 * dt, vz = -2 * dt;
        this.p[o] += vx; this.p[o + 1] += vy; this.p[o + 2] += vz; this.p[o + 3] += vx; this.p[o + 4] += vy; this.p[o + 5] += vz;
        if (this.p[o + 1] < -0.5 || Math.abs(this.p[o] - cam.x) > 22 || Math.abs(this.p[o + 2] - cam.z) > 22) this.reset(i, cam, false);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    // lightning: a double flicker every so often in the storm
    ENV.uFlash.value = 0;
    if (w.rain > 0) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flashT = 0.35; this.nextFlash = 7 + Math.random() * 12; this.onFlash?.(); }
      if (this.flashT > 0) { this.flashT -= dt; ENV.uFlash.value = (Math.sin(this.flashT * 60) > 0 ? 0.45 : 0.1) * (this.flashT / 0.35); }
    }
  }
}

// The coast behind the break (a Bukit-style left like Uluwatu / Padang Padang): golden sand, a line of
// coconut palms, jungle behind, and Mount Agung far inland. All of it hazed by distance like real sea air.
// the land material (vertex colours, sun, sky light and aerial haze), shared by every coast and its props
let _landMat = null;
export function landMaterial() { return _landMat || (_landMat = makeLandMat()); }
// each surf spot is this coast built with its own look: sand, rock, how tall the cliffs are, how far back the beach is
// (a longer run to the sand = a longer ride), and a few landmarks
export function coast(scene, opt = {}) {
  const O = Object.assign({ dz: 0, sandWet: [0.36, 0.3, 0.22], sandDry: [0.4, 0.35, 0.25], land: [0.12, 0.2, 0.1], palms: 1, cliffH: 1, rock: [0.9, 0.8, 0.63],
    cliffGreen: 1, temple: true, mountain: [0.26, 0.3, 0.3], mountainScale: 1, jungle: 1, clear: null }, opt);   // clear: a patch of clifftop kept flat and bare (where the villa stands)
  const mat = landMaterial();
  return buildCoast(scene, O, mat);
}
function makeLandMat() {
  return new THREE.ShaderMaterial({
    uniforms: ENV,
    vertexShader: `attribute vec3 color; varying vec3 vC; varying vec3 vW; varying vec3 vN;
      void main(){ vC = color; vec4 w = modelMatrix * vec4(position, 1.);
        #ifdef USE_INSTANCING
          w = modelMatrix * instanceMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vN = normalize(mat3(modelMatrix) * normal);
        #endif
        vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun, uSunCol, uHor, uZen, uFog; uniform float uSunVis, uFlash; varying vec3 vC; varying vec3 vW; varying vec3 vN;
      void main(){
        float l = .45 + .55 * max(dot(normalize(vN), uSun), 0.) * uSunVis;
        vec3 c = vC * (l * mix(vec3(1.), uSunCol, .5) + uZen * .25) + uFlash * .4;
        float d = length(cameraPosition - vW);
        c = mix(c, mix(mix(uFog, uHor, .5), uZen, .25), .15 + .62 * smoothstep(120., 900., d));   // aerial haze: distant land turns blue-grey
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
function buildCoast(scene, O, mat) {
  const colorize = (g, rgb, jitter = 0.08) => {
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = 1 + (Math.random() - .5) * jitter; c[i * 3] = rgb[0] * k; c[i * 3 + 1] = rgb[1] * k; c[i * 3 + 2] = rgb[2] * k; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  };
  const group = new THREE.Group();
  // beach: dark volcanic sand rising gently from the water
  const sand = new THREE.PlaneGeometry(1600, 40, 60, 4); sand.rotateX(-Math.PI / 2);
  { const p = sand.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, (z + 20) / 40 * 2.2 - 0.2 + Math.sin(p.getX(i) * 0.05) * 0.2); } sand.computeVertexNormals(); }
  // golden reef-break sand (Bali's Bukit beaches): darker and wet at the water's edge, pale and dry up the beach
  sand.dispose(); const sd = new THREE.PlaneGeometry(1600, 40, 160, 8); sd.rotateX(-Math.PI / 2);
  { const p = sd.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), x = p.getX(i); p.setY(i, (z + 20) / 40 * 2.2 - 0.2 + Math.sin(x * 0.05) * 0.2);
      const dry = Math.min(1, Math.max(0, (z + 17) / 10)), k = 1 + (Math.random() - .5) * 0.06 + Math.sin(x * 0.21) * 0.03;
      c[i * 3] = (O.sandWet[0] + O.sandDry[0] * dry) * k; c[i * 3 + 1] = (O.sandWet[1] + O.sandDry[1] * dry) * k; c[i * 3 + 2] = (O.sandWet[2] + O.sandDry[2] * dry) * k;
    }
    sd.setAttribute('color', new THREE.BufferAttribute(c, 3)); sd.computeVertexNormals(); }
  group.add(at(new THREE.Mesh(sd, mat), 0, 0, 205));
  // land behind, gently rolling
  const land = new THREE.PlaneGeometry(1800, 500, 90, 20); land.rotateX(-Math.PI / 2);
  { const p = land.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 2 + 4 * Math.sin(x * 0.013) * Math.cos(z * 0.02) + (z + 250) * 0.03); } land.computeVertexNormals(); }
  group.add(at(new THREE.Mesh(colorize(land, O.land, 0.2), mat), 0, 0, 475));
  // height of the rolling land at a world point (the same formula that shapes the land mesh, placed at z = 475)
  const landY = (x, z) => { const lz = z - 475; return 2 + 4 * Math.sin(x * 0.013) * Math.cos(lz * 0.02) + (lz + 250) * 0.03; };
  // jungle: layered tree canopies behind the palms. Each tree is a lumpy crown (a noise-dented blob, darker underneath
  // where it's in shade) sitting on the ground or on a short trunk; neighbours overlap into one uneven forest edge.
  const blob = new THREE.IcosahedronGeometry(1, 1);   // (42 points each: it's 80 m+ away; phones draw hundreds of these)
  { const p = blob.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + 0.16 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7 - v.y * 2.1) + 0.1 * Math.sin(v.x * 11 + v.z * 9);
      v.multiplyScalar(n); if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;   // flatter underside
      p.setXYZ(i, v.x, v.y, v.z);
      const lit = 0.55 + 0.45 * Math.min(1, Math.max(0, (v.y + 0.6) / 1.4)), k = lit * (0.9 + Math.random() * 0.2);
      c[i * 3] = 0.09 * k; c[i * 3 + 1] = 0.2 * k; c[i * 3 + 2] = 0.08 * k;
    }
    blob.setAttribute('color', new THREE.BufferAttribute(c, 3)); blob.computeVertexNormals(); }
  const NJ = Math.round(620 * O.jungle), jungle = new THREE.InstancedMesh(blob, mat, NJ); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const NT = 90, jTrunk = new THREE.InstancedMesh(colorize(new THREE.CylinderGeometry(0.25, 0.45, 1, 6).translate(0, 0.5, 0), [0.22, 0.18, 0.14], 0.2), mat, NT);
  let n = 0, nt = 0;
  const crown = (x, y, z, r) => { if (n >= NJ) return; q.setFromEuler(new THREE.Euler(0, Math.random() * 6.3, 0));
    jungle.setMatrixAt(n++, m4.compose(ps.set(x, y, z), q, sc.set(r * (1 + Math.random() * 0.4), r * (0.7 + Math.random() * 0.3), r * (0.9 + Math.random() * 0.4)))); };
  // understory: a dense band of low bushes so no sky shows through at the foot of the forest
  for (let i = 0; i < 380 * O.jungle; i++) { const x = -750 + Math.random() * 1500, z = 232 + Math.random() * 60, r = 3 + Math.random() * 4; crown(x, landY(x, z) + r * 0.4, z, r); }
  // trees: a crown of two or three overlapping lumps; the tall ones stand on a trunk above the understory
  while (n < NJ - 3) {
    const tall = nt < NT && Math.random() < 0.3, r = tall ? 5 + Math.random() * 4 : 3 + Math.random() * 3;
    const x = -750 + Math.random() * 1500, z = 238 + Math.random() * 55, ground = landY(x, z), cy = ground + (tall ? r * (1.2 + Math.random() * 0.5) : r * 0.8);
    for (let k = 0; k < 3; k++) crown(x + (Math.random() - 0.5) * r, cy + (k ? (Math.random() - 0.3) * r * 0.5 : 0), z + (Math.random() - 0.5) * r, r * (k ? 0.65 : 1));
    if (tall) jTrunk.setMatrixAt(nt++, m4.compose(ps.set(x, ground - 0.5, z), q.identity(), sc.set(r * 0.08 + 0.3, cy - ground, r * 0.08 + 0.3)));
  }
  jungle.count = n; jTrunk.count = nt;
  group.add(jungle, jTrunk);
  // coconut palms along the beach: slender curving trunks and a crown of long drooping fronds
  const N = 170;
  const trunkG = colorize(new THREE.CylinderGeometry(0.16, 0.26, 1, 6, 6).translate(0, 0.5, 0), [0.4, 0.34, 0.26]);
  { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.9 * y * y); } trunkG.computeVertexNormals(); }   // palms curve toward the sea
  // one frond: a leaf blade arcing out and drooping, wide in the middle, tapering to a point, with a zig-zag edge of leaflets
  const frondParts = [];
  { const SEG = 6, pos = [], idx = [];   // (6 steps along each frond: palms are 50 m off at the closest, and 170 of them at 10 steps was the most geometry on screen)
    for (let j = 0; j <= SEG; j++) {
      const t = j / SEG, x = t * 4.2, y = 0.9 * t - 2.2 * t * t, w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.75 + 0.25 * (j % 2));
      pos.push(x, y, -w, x, y + 0.15 * (1 - t), 0, x, y, w);
      if (j) { const a = (j - 1) * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
    for (let k = 0; k < 9; k++) frondParts.push(fg.clone().rotateZ((k % 3 - 1) * 0.18).rotateY(k * Math.PI * 2 / 9 + (k % 2) * 0.2));
  }
  const leafMat = mat.clone(); leafMat.uniforms = ENV; leafMat.side = THREE.DoubleSide;   // (share the live weather uniforms: a clone would freeze them)   // fronds are thin blades, seen from above and below
  const crownG = colorize(mergeGeos(frondParts), [0.15, 0.3, 0.1], 0.25);
  const trunks = new THREE.InstancedMesh(trunkG, mat, N), crowns = new THREE.InstancedMesh(crownG, leafMat, N);
  for (let i = 0; i < N; i++) {
    const h = 8 + Math.random() * 7, lean = (Math.random() - 0.5) * 0.25 - 0.08, yaw = Math.PI / 2 + (Math.random() - 0.5) * 1.4;   // most lean out toward the sea
    const x = -700 + i * 8.2 + (Math.random() - .5) * 5, z = 222 + Math.random() * 12;
    if ((O.cliffH >= 0.2 && x < -60) || Math.random() > O.palms) { trunks.setMatrixAt(i, m4.makeScale(0, 0, 0)); crowns.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }   // (under the cliffs; fewer on a sparse coast)
    q.setFromEuler(new THREE.Euler(lean, yaw, 0));
    trunks.setMatrixAt(i, m4.compose(ps.set(x, 1.8, z), q, sc.set(1, h, 1)));
    const top = new THREE.Vector3(0.9, h, 0).applyQuaternion(q).add(ps);   // the top of the curved trunk
    crowns.setMatrixAt(i, m4.compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), sc.set(1, 1, 1).multiplyScalar(0.85 + Math.random() * 0.4)));
  }
  group.add(trunks, crowns);
  // Uluwatu-style limestone cliffs up the reef from the break (toward -x): pale sheer rock streaked darker, wet and
  // dark at the base, jungle hanging over the top edge; they slope down into the beach near the peak. A temple on the edge.
  const cliffTop = (x) => O.cliffH * (58 + 12 * Math.sin(x * 0.021) + 6 * Math.sin(x * 0.067 + 1.3)) * Math.min(1, Math.max(0, (-x - 70) / 35));
  const CW = 660, cliff = new THREE.PlaneGeometry(CW, 1, 132, 26);
  { const p = cliff.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) - 400, v = p.getY(i) + 0.5, top = cliffTop(x), y = v * top;
      const band = Math.sin(y * 0.55 + Math.sin(x * 0.02) * 2), n = Math.sin(x * 0.31 + y * 0.12) * 1.8 + Math.sin(x * 0.083 - y * 0.05) * 3.4 + Math.sin(x * 1.3 + y * 0.9) * 0.6 + band * 0.9;   // ledges and horizontal strata
      p.setXYZ(i, x, y, 214 + n + y * 0.12 + (v > 0.97 ? 3 : 0));   // leans back a little; the top lip rolls back into the plateau
      const streak = 0.7 + 0.3 * Math.pow(0.5 + 0.5 * Math.sin(x * 0.9 + Math.sin(y * 0.3) * 2), 2) + 0.1 * band, wet = Math.min(1, y / 4), green = Math.max(0, (v - 0.84) / 0.16) + Math.max(0, Math.sin(x * 0.13) * Math.sin(y * 0.2) - 0.75) * 2;   // weathered streaks, tufts of green on ledges
      const crev = 0.6 + 0.4 * Math.min(1, Math.abs(Math.sin(x * 0.47 + Math.sin(y * 0.11) * 1.5)) * 2.2);   // dark vertical cracks and gullies
      const ledge = 0.72 + 0.28 * Math.min(1, Math.max(0, band * 2 + 0.6));   // shadow under each ledge
      const k = streak * crev * ledge * (0.4 + 0.6 * wet) * (0.8 + 0.2 * v), r = O.rock[0] * k, g = O.rock[1] * k, b = O.rock[2] * k;   // warm cream limestone at Temple Point (each spot has its own rock)
      const gr = Math.min(1, green) * O.cliffGreen; c[i * 3] = r + (0.16 - r) * gr; c[i * 3 + 1] = g + (0.25 - g) * gr; c[i * 3 + 2] = b + (0.11 - b) * gr;
    }
    { const ix = cliff.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } }   // face the sea
    cliff.setAttribute('color', new THREE.BufferAttribute(c, 3)); cliff.computeVertexNormals(); }
  group.add(new THREE.Mesh(cliff, mat));
  // the plateau on top, and jungle along the edge
  const plat = new THREE.PlaneGeometry(CW, 140, 66, 6); plat.rotateX(-Math.PI / 2);
  { const p = plat.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) - 400, z = p.getZ(i) + 290; let y = cliffTop(x) + 1 + Math.sin(x * 0.05) * Math.cos(z * 0.04) * 2; const C = O.clear; if (C && x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1) y = Math.min(y, C.y - 0.6); p.setXYZ(i, x, y, z); } plat.computeVertexNormals(); }
  group.add(new THREE.Mesh(colorize(plat, [0.13, 0.21, 0.1], 0.2), mat));
  const NE = 160, edge = new THREE.InstancedMesh(blob, mat, NE);
  for (let i = 0; i < NE; i++) { const x = -720 + Math.random() * 640, r = 3 + Math.random() * 4, t = cliffTop(x), ez = 219 + Math.random() * 30, C = O.clear;
    if (t < 4 || (C && x > C.x0 - r && x < C.x1 + r && ez > C.z0 - r && ez < C.z1 + r)) { edge.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
    edge.setMatrixAt(i, m4.compose(ps.set(x, t + r * 0.3, ez), q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)), sc.set(r * 1.3, r * 0.7, r))); }
  group.add(edge);
  // a Balinese temple on the cliff edge: stone base, a meru tower of stacked dark thatch roofs
  if (O.temple) { const tx = -190, ty = cliffTop(tx), tz = 226, stone = [0.62, 0.56, 0.48], thatch = [0.14, 0.11, 0.09];
    group.add(at(new THREE.Mesh(colorize(new THREE.BoxGeometry(9, 3, 9), stone, 0.1), mat), tx, ty + 1.5, tz));
    group.add(at(new THREE.Mesh(colorize(new THREE.BoxGeometry(3, 3.5, 3), stone, 0.1), mat), tx, ty + 4.7, tz));
    for (let k = 0; k < 3; k++) { const rr = 4.2 - k * 1.1, roof = new THREE.ConeGeometry(rr, 1.5, 4); roof.rotateY(Math.PI / 4);
      group.add(at(new THREE.Mesh(colorize(roof, thatch, 0.1), mat), tx, ty + 7 + k * 1.9, tz)); }
    // the split gate (candi bentar) at the cliff edge: two stepped stone halves with a gap between them
    for (const gs of [-1, 1]) for (let k = 0; k < 4; k++) group.add(at(new THREE.Mesh(colorize(new THREE.BoxGeometry(2.4 - k * 0.45, 1.8, 2.4 - k * 0.45), stone, 0.1), mat), tx - 13 + gs * 1.8, ty + 0.9 + k * 1.8, tz - 2));
    group.add(at(new THREE.Mesh(colorize(new THREE.BoxGeometry(22, 1.6, 0.8), stone, 0.1), mat), tx + 12, ty + 0.8, tz - 3)); }
  // Mount Agung, far inland: a broad volcanic cone
  // (placed inside the 900 m sky dome at the same apparent size it would have 30 km away)
  const agung = new THREE.ConeGeometry(470, 165, 40, 6, true); { const p = agung.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const n = Math.sin(p.getX(i) * 0.03) * Math.cos(p.getZ(i) * 0.04) * 10; p.setX(i, p.getX(i) * (1 + n / 470)); p.setY(i, y + (y < 60 ? n * 0.3 : 0)); } agung.computeVertexNormals(); }
  { const mt = at(new THREE.Mesh(colorize(agung, O.mountain, 0.1), mat), -230, 80 * O.mountainScale, 820); mt.scale.setScalar(O.mountainScale); group.add(mt); }
  group.position.z = O.dz;   // the whole coast further back: a longer run in to the sand
  scene.add(group);
  return group;
}
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }
function mergeGeos(list) {
  // join simple non-indexed-compatible geometries into one (positions + normals)
  const parts = list.map((g) => g.index ? g.toNonIndexed() : g);
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); g.computeVertexNormals(); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
