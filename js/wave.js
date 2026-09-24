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
  easy:   { H: 1.1, speed: 4.4, peel: 2.1, angle: 64, period: 11, hollow: 0.35, forgive: 0.55, name: 'Easy' },    // waist-chest high, gentle
  medium: { H: 2.0, speed: 5.9, peel: 4.1, angle: 55, period: 13, hollow: 0.75, forgive: 1, name: 'Medium' },     // overhead, a proper wave
  hard:   { H: 3.4, speed: 7.7, peel: 7.2, angle: 47, period: 15, hollow: 1.0, forgive: 1, name: 'Hard' },        // double overhead and fast
};

// Cross-section keyframes (units of wave height H; z toward the beach, y up). Every keyframe lists the SAME 12
// points in the same order, so blending between them unfolds the lip smoothly as the wave breaks:
// frontFlat, toe, lowFace, midFace, upperFace, ceilingTop, lipInner, lipTip, lipOuter, crest, backUpper, backFlat
const K = {
  swell:    [[1.8,0],[1.2,.02],[.7,.08],[.3,.19],[0,.29],[-.15,.33],[-.22,.345],[-.26,.35],[-.3,.35],[-.4,.345],[-1.3,.2],[-2.8,0]],
  shoulder: [[1.3,0],[.8,.02],[.4,.12],[.15,.33],[0,.55],[-.06,.68],[-.1,.73],[-.12,.75],[-.15,.755],[-.25,.74],[-1.1,.4],[-2.5,0]],
  peak:     [[1.1,0],[.6,.03],[.25,.15],[.06,.42],[0,.72],[.06,.92],[.16,.99],[.24,.97],[.16,1.03],[-.05,1.02],[-.95,.55],[-2.3,0]],
  barrel:   [[1.6,0],[1.15,.02],[.35,.1],[.02,.38],[-.08,.68],[.14,.97],[.62,.9],[.95,.12],[.72,.98],[.1,1.05],[-.9,.6],[-2.4,0]],
  white:    [[1.8,0],[1.3,.03],[.9,.12],[.6,.24],[.35,.34],[.2,.4],[.1,.42],[0,.43],[-.1,.43],[-.3,.4],[-1.2,.2],[-2.6,0]],
};
// per control point: how much it glows (thin water) and where spray/foam sits when curling
const THIN = [0, 0, .05, .2, .45, .75, .95, 1, .8, .45, .1, 0];
const SPRAY = [0, 0, 0, 0, 0, .1, .5, 1, .8, .2, 0, 0];
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
export class Wave {
  constructor(scene, cond) {
    this.cond = cond; this.peelX = 0; this.zW = 0; this.t = 0; this.fade = 1;
    // every wave of the same size has the same shape: build the mesh once per condition and share it (no hitch per wave)
    const shared = SHARED.get(cond);
    if (shared) {
      this.geo = shared.geo; this.xs = shared.xs; this.shared = true;
      this.mesh = new THREE.Mesh(shared.geo, shared.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
      this.initSpray(scene); this.initMist(scene);
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
    this.initMist(scene);
    this.xs = new Float32Array(NX);
    this.build();
    SHARED.set(cond, { geo: this.geo, mat: this.mesh.material, xs: this.xs }); this.shared = true;
  }

  // which blend of keyframes a slice at distance s ahead of the break has, plus how broken it is
  shapeAt(s) {
    const { H, hollow } = this.cond;
    const barrel = lerpK(K.peak, K.barrel, Math.min(1, hollow * 1.25));  // gentle waves never get a full round tube
    let P, curl = 0, broken = 0;
    if (s >= 45) P = K.swell;
    else if (s >= 15) P = lerpK(K.shoulder, K.swell, smooth(15, 45, s));
    else if (s >= 0) P = lerpK(K.peak, K.shoulder, smooth(0, 15, s));
    else if (s >= -1.1 * H) { curl = smooth(0, 1.1 * H, -s); P = lerpK(K.peak, barrel, curl); }
    else if (s >= -4.5 * H) { curl = 1; P = barrel; }                      // a long open tube behind the throw
    else { curl = 1; broken = smooth(4.5 * H, 8 * H, -s); P = lerpK(barrel, K.white, broken); }
    return { P, curl: curl * hollow, broken };
  }

  // cross-section at distance s ahead of the break: fills out[] with [z, y, foam, thin] per sample
  section(s, out) {
    const { H } = this.cond;
    const { P, curl, broken } = this.shapeAt(s);
    const amp = s > 0 ? 1 - 0.55 * smooth(8, 70, s) : 1 - 0.15 * smooth(0, 40, -s);   // tallest at the peak, fading down the line
    let k = 0;
    for (let j = 0; j < NU; j++) {
      const [z, y, i, t] = catmull(P, j / (NU - 1));
      const thin = THIN[i] + (THIN[Math.min(11, i + 1)] - THIN[i]) * t;
      const spray = SPRAY[i] + (SPRAY[Math.min(11, i + 1)] - SPRAY[i]) * t;
      // the lower face runs further out in front than the keyframes say: steep near the lip, easing into the flats like a real wave
      const wide = z > 0 ? 1 + 0.55 * (1 - smooth(0, 0.6, y)) * (i < 4 ? 1 : i === 4 ? 1 - t * t * (3 - 2 * t) : 0) : 1;   // eased out, no crease
      out[k++] = z * H * wide; out[k++] = Math.max(0, y) * H * amp;
      out[k++] = Math.min(1, broken * 0.9 + spray * curl * 0.7);
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
      const s = w < 0 ? -BEHIND * Math.pow(-w, 1.6) : AHEAD * Math.pow(w, 1.6);
      this.xs[i] = s;
      this.section(s, tmp);
      for (let j = 0; j < NU; j++) {
        const p = (i * NU + j) * 3, a = (i * NU + j) * 2;
        const bend = 0.004 * s * s * Math.sign(s) * -0.5 + 0.0015 * s * s;       // crest line wraps slightly toward the beach
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
    const N = 160; this.mistN = N;
    this.mp = new Float32Array(N * 3); this.mv = new Float32Array(N * 3); this.ml = new Float32Array(N).fill(-1); this.ma = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.mp, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    this.mist = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf2efe9, size: 1.1 * this.cond.H, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.38, depthWrite: false }));
    this.mist.frustumCulled = false; scene.add(this.mist);
  }
  updateMist(dt) {
    const H = this.cond.H, P = this.mp, V = this.mv;
    for (let i = 0; i < this.mistN; i++) {
      if (this.ml[i] <= 0) {
        if (Math.random() > 0.12) { P[i * 3 + 1] = -99; continue; }
        // born along the top of the whitewater and where the lip hits the water
        const s = -(4 + Math.random() * 10) * H;
        if (s < -50) continue;
        const sh = this.shapeAt(s), crest = sh.P[9], amp = 1 - 0.15 * smooth(0, 40, -s);
        const atLip = Math.random() < 0.4 && sh.broken < 0.5;
        P[i * 3] = this.peelX + s + (Math.random() - .5) * 2;
        P[i * 3 + 1] = atLip ? 0.2 * H : crest[1] * H * amp * (0.7 + Math.random() * 0.4);
        P[i * 3 + 2] = (atLip ? sh.P[7][0] : crest[0]) * H + this.zW + (Math.random() - .5) * H;
        V[i * 3] = (Math.random() - .5) * 0.6; V[i * 3 + 1] = 0.5 + Math.random() * 1.2; V[i * 3 + 2] = this.cond.speed * 0.6 - 1.5 - Math.random() * 2;
        this.ml[i] = 1 + Math.random() * 1.5;
      }
      this.ml[i] -= dt;
      V[i * 3 + 1] -= 0.6 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (this.ml[i] <= 0) P[i * 3 + 1] = -99;
    }
    this.mist.geometry.attributes.position.needsUpdate = true;
    this.mist.material.opacity = 0.38 * this.fade;
  }
  initSpray(scene) {
    const N = 900; this.sprayN = N;
    this.sp = new Float32Array(N * 3); this.sv = new Float32Array(N * 3); this.sl = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3));
    // soft round droplet sprite
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    this.spray = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1e0, size: 0.05, map: tex, alphaMap: tex, transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
    this.spray.frustumCulled = false; scene.add(this.spray);
    for (let i = 0; i < N; i++) this.sl[i] = -1;
  }
  // where the break is (peelX) and where the wave is on its way in (zW)
  place(peelX, zW) { this.placed = true; this.peelX = peelX; this.zW = zW; }
  dispose(scene) {
    scene.remove(this.mesh); scene.remove(this.spray);
    if (!this.shared) { this.geo.dispose(); this.mesh.material.dispose(); }   // shared shapes stay for the next wave
    this.spray.geometry.dispose(); this.spray.material.map.dispose(); this.spray.material.dispose();
    scene.remove(this.mist); this.mist.geometry.dispose(); this.mist.material.map.dispose(); this.mist.material.dispose();
  }
  lipAt(s) {                                          // world position of the lip tip for the slice at s
    // the shape for a given s never changes, so remember it (per 10 cm); only x moves with the peel
    const key = Math.round(s * 10), c = (this._lip ||= new Map()).get(key);
    if (c) return [this.peelX + s, c[0], c[1] + this.zW];
    const r = this._lipAt(key / 10); if (this._lip.size > 5000) this._lip.clear(); this._lip.set(key, [r[1], r[2]]);
    return [this.peelX + s, r[1], r[2] + this.zW];
  }
  _lipAt(s) {
    const { P } = this.shapeAt(s); const H = this.cond.H;
    const amp = s > 0 ? 1 - 0.55 * smooth(8, 70, s) : 1 - 0.15 * smooth(0, 40, -s);
    return [this.peelX + s, P[7][1] * H * amp, P[7][0] * H];
  }
  updateSpray(dt) {
    if (!this.spray) return;
    const H = this.cond.H;
    for (let i = 0; i < this.sprayN; i++) {
      if (this.sl[i] <= 0) {
        if (Math.random() > 0.08) continue;
        // born along the throwing lip and the top of the tube behind it
        const s = -Math.random() * 4 * H;
        const [x, y, z] = this.lipAt(s);
        const crest = this.shapeAt(s).P[9];
        const top = Math.random() < 0.6;
        this.sp[i * 3] = x + (Math.random() - .5) * .3;
        this.sp[i * 3 + 1] = top ? crest[1] * H : y;
        this.sp[i * 3 + 2] = top ? crest[0] * H + this.zW : z;
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
  }
}

// ---------------------------------------------------------------- shading
export const SUN_DIR = new THREE.Vector3(0.25, 0.1, -1).normalize();   // low sun out to sea, behind the waves

// Weather follows the difficulty. Every water/sky material shares these uniforms, so switching weather is instant.
export const WEATHER = {
  easy:   { sun: [0.35, 0.62, -0.7], zen: 0x2e6db4, hor: 0xbfe0ee, sunCol: 0xfff4dc, fog: 0xc8e2ec, deep: 0x0b5a73, turq: 0x19b3a4, cloud: 0.18, chop: 0.8, fogFar: 320, rain: 0, sunVis: 1 },
  medium: { sun: [0.25, 0.1, -1],    zen: 0x2a3a6e, hor: 0xf29a5c, sunCol: 0xffd8a0, fog: 0xd98a62, deep: 0x04172a, turq: 0x0d8c84, cloud: 0.35, chop: 1.0, fogFar: 260, rain: 0, sunVis: 1 },
  hard:   { sun: [0.1, 0.35, -1],    zen: 0x1a2124, hor: 0x56646a, sunCol: 0x8a9496, fog: 0x4a565b, deep: 0x07181b, turq: 0x2a6258, cloud: 0.92, chop: 2.4, fogFar: 150, rain: 1, sunVis: 0.08 },
  random: { sun: [0.3, 0.22, -1],    zen: 0x33415c, hor: 0xc49678, sunCol: 0xffd2a4, fog: 0xa88876, deep: 0x06202c, turq: 0x167e76, cloud: 0.62, chop: 1.5, fogFar: 210, rain: 0, sunVis: 0.55 },
};
export const ENV = {
  uSun: { value: SUN_DIR.clone() }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
  uFog: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uTurq: { value: new THREE.Color() },
  uTime: { value: 0 },                                // one clock for every water surface, so the sea and the wave match
  uCloud: { value: 0.3 }, uChop: { value: 1 }, uFogFar: { value: 260 }, uSunVis: { value: 1 }, uFlash: { value: 0 },
};
export function setWeather(name) {
  const w = WEATHER[name]; ENV.weather = w; ENV.name = name;
  ENV.uSun.value.set(...w.sun).normalize();
  for (const k of ['zen', 'hor', 'sunCol', 'fog', 'deep', 'turq']) ENV['u' + k[0].toUpperCase() + k.slice(1)].value.setHex(w[k]);
  ENV.uCloud.value = w.cloud; ENV.uChop.value = w.chop; ENV.uFogFar.value = w.fogFar; ENV.uSunVis.value = w.sunVis;
}
setWeather('medium');
const NOISE = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

export function waterMaterial({ wave = false } = {}) {
  return new THREE.ShaderMaterial({
    side: wave ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { ...ENV, uH: { value: 2 } },
    vertexShader: /* glsl */`
      attribute vec2 aFoamThin;${wave ? '\n      attribute float aBrk;' : ''}
      uniform float uTime, uH;
      varying vec3 vW; varying vec3 vN; varying vec2 vFT;
      void main(){
        vec3 pp = position;
        ${wave ? 'pp.y += aBrk * uH * (sin(pp.x * 1.7 + pp.z * 2.3 + uTime * 3.) * .08 + sin(pp.x * .63 - uTime * 2.1 + pp.z * .9) * .1);' : ''}
        vec4 w = modelMatrix * vec4(pp,1.);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vFT = ${wave ? 'aFoamThin' : 'vec2(0.)'};
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime, uH, uCloud, uChop, uFogFar, uSunVis, uFlash; uniform vec3 uSun, uZen, uHor, uSunCol, uFog, uDeep, uTurq;
      varying vec3 vW; varying vec3 vN; varying vec2 vFT;
      ${NOISE}
      vec3 sky(vec3 d){
        float h = clamp(d.y, 0., 1.);
        vec3 c = mix(uHor, uZen, pow(h, .45));
        float s = max(dot(d, uSun), 0.);
        c += uSunCol * (pow(s, 600.) * 6. * uSunVis + pow(s, 12.) * .35);
        c = mix(c, uHor * .8 + uZen * .2, uCloud * .6);               // overcast skies reflect flat grey light
        return c + uFlash;
      }
      void main(){
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
        ${wave ? `
        // fine texture on the face: water being drawn up the wall leaves streaky ripples that stream upward;
        // strongest on steep faces, fading with distance (it would only shimmer far away)
        float wallK = smoothstep(.85, .3, abs(N.y)) * smoothstep(18., 4., length(cameraPosition - vW));
        vec2 fq = vec2(vW.x * 2.6, (vW.y + vW.z) * 1.1 - uTime * 1.4);
        float f1 = fbm(fq), f2 = fbm(fq * 2.1 + 3.7);
        vec3 T = normalize(cross(N, vec3(1., 0., 0.)));
        N = normalize(N + (vec3(1., 0., 0.) * (f1 - .5) * .35 + T * (f2 - .5) * .5) * wallK);` : ''}
        float fres = .03 + .97 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = sky(R);
        // body colour: deep blue at the base, turquoise where the wall is thin and lit from behind
        float thin = vFT.y;
        vec3 deep = uDeep, turq = uTurq;
        // water pulled up the face leaves vertical streaks; the base of the wave is darker and denser
        ${wave ? 'thin *= .75 + .5 * fbm(vec2(vW.x * 2.2 + vW.z * .6, vW.y * .35 - uTime * .6));' : ''}
        thin *= smoothstep(.03, .22 * uH, vW.y);                        // flat water in front of the wave matches the open sea (no seam)
        float base = smoothstep(.0, .9, vW.y / max(uH, .5));
        float back = pow(max(dot(-V, uSun), 0.), 3.);                // looking toward the sun through the water
        vec3 body = mix(deep, turq, thin * .8) + turq * thin * back * 1.6 * uSunVis + uSunCol * thin * back * .25 * uSunVis + turq * thin * .25 * (1. - uSunVis);
        body *= .55 + .45 * base;
        vec3 col = mix(body, refl, fres);
        // sun glint
        col += uSunCol * pow(max(dot(R, uSun), 0.), 220.) * 3. * uSunVis;
        ${wave ? `
        // foam: churned white where the lip throws and the whitewater rolls
        float foamN = fbm(vec2(vW.x, vW.y + vW.z) * 1.4 + vec2(0., uTime * 1.3));
        float foamMask = smoothstep(.35, .75, vFT.x + (foamN - .5) * .6);
        // thin lace of old foam drifting on the face
        // lacework: thin wandering foam lines (contours of a noise field), not blobs
        float ln = fbm(vec2(vW.x * 1.3 + vW.z * .4, vW.y * 1.1 + vW.z * .7) * 1.8 + vec2(0., uTime * .04));
        // lines stay about a pixel or two wide at any distance, and soften right up close so they don't read as scribbles
        float lw = min(fwidth(ln) * 1.3 + .003, .022);
        float lace = (1. - smoothstep(.0, lw, abs(ln - .5))) * smoothstep(.35, .6, fbm(vec2(vW.x, vW.y + vW.z) * .7));
        lace *= .45 + .55 * smoothstep(2., 10., length(cameraPosition - vW));
        foamMask = max(foamMask, lace * .3 * step(.02, vFT.y) * (1. - base * .5));   // faint: old foam lines, not chalk marks
        vec3 foamCol = vec3(.95, .9, .86) * (.75 + .25 * max(dot(N, uSun), 0.)) + uHor * .12;
        col = mix(col, foamCol, foamMask);
        ` : ''}
        // distance haze toward the horizon
        float d = length(cameraPosition - vW);
        col = mix(col, uFog, smoothstep(uFogFar * .15, uFogFar, d) * .9);
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
    fragmentShader: `uniform vec3 uSun, uZen, uHor, uSunCol; uniform float uCloud, uSunVis, uTime, uFlash; varying vec3 vD; ${NOISE}
      void main(){
        vec3 d = normalize(vD); float h = clamp(d.y, 0., 1.);
        vec3 c = mix(uHor, uZen, pow(h, .45));
        float s = max(dot(d, uSun), 0.);
        c += uSunCol * (pow(s, 900.) * 8. * uSunVis + pow(s, 10.) * .5 * max(uSunVis, .3));
        // clouds: thin streaks on clear days, a heavy low ceiling in a storm
        vec2 p = d.xz / max(d.y + .08, .02) * .6 + vec2(uTime * .01, 0.);
        float n = fbm(p * vec2(1., 3. - uCloud * 2.));
        float cl = smoothstep(.62 - uCloud * .5, .82 - uCloud * .35, n);
        vec3 warm = mix(vec3(.95,.6,.5), vec3(.9,.92,.95), clamp(uSunVis * (1. - uCloud), 0., 1.));
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
  scene.add(sky);
  sky.onBeforeRender = () => { m.uniforms.uTime.value = performance.now() / 1000; };
  return sky;
}

export function ocean(scene) {
  const g = new THREE.PlaneGeometry(1400, 1400, 1, 1); g.rotateX(-Math.PI / 2);
  const m = waterMaterial();
  const mesh = new THREE.Mesh(g, m); mesh.position.y = -0.02; scene.add(mesh);
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
