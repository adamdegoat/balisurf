// Bali surf: session loop, controls, camera, surfer model, HUD, automatic quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Wave, CONDITIONS, skyDome, ocean, coast, setWeather, WeatherFX, ENV } from './wave.js?v=81';
import { Rider, Profile, waterAt, heightAt, RIDE } from './surf.js?v=92';
import { makeBoard } from './board.js?v=6';
import { SurfAudio } from './audio.js?v=7';

const Q = new URLSearchParams(location.search);
// ---------- renderer with hidden automatic quality (drops sharpness if the phone struggles, raises it back if not)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const MAX_PR = Math.min(devicePixelRatio, 1.6);
let pr = Math.min(devicePixelRatio, 1.3);
renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.getElementById('view').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.08, 2000);
// POV: a wide, GoPro-like view (about 100 degrees across); the outside wipeout shot uses a normal ~80
let hfovHalf = 50;
const fitFov = () => { camera.aspect = innerWidth / innerHeight; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfovHalf)) / Math.min(camera.aspect, 2.0))); camera.updateProjectionMatrix(); };
const setHfov = (h) => { if (h !== hfovHalf) { hfovHalf = h; fitFov(); } };
fitFov();
skyDome(scene); ocean(scene); coast(scene);
const fx = new WeatherFX(scene);
const audio = new SurfAudio();
fx.onFlash = () => audio.thunder(Math.random());
addEventListener('visibilitychange', () => audio.pause(document.hidden || !document.body.classList.contains('playing')));
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a4a48, 1.3); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff0dd, 2.0); scene.add(sunLight); scene.add(sunLight.target);
// fit the screen whenever it changes: rotation, the browser bar sliding away, split screen (iOS doesn't always send 'resize')
let lastW = 0, lastH = 0;
const fit = () => { const w = innerWidth, h = innerHeight; if (w === lastW && h === lastH) return; lastW = w; lastH = h; renderer.setSize(w, h); fitFov(); };
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 250)); visualViewport?.addEventListener('resize', fit);
// iPhone Safari ignores user-scalable=no: stop pinch-zoom, double-tap zoom and the rubber-band page drag ourselves
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
// in the Safari browser (not opened from the home screen icon), tell them how to get full screen
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) document.getElementById('homeTip').hidden = false;
fit();

// ---------- surfer on a board
const rig = new THREE.Group(); scene.add(rig);           // board frame: +z along the board, +y out of the deck
const board = makeBoard(); rig.add(board);
// a jukung (Balinese outrigger fishing boat) anchored in the channel up-reef of the peak, bobbing on the swell, and a
// few frigate birds wheeling high over the lineup
const jukung = (() => {
  const g = new THREE.Group(), m = (geo, c) => new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c }));
  const hull = m(new THREE.CylinderGeometry(0.42, 0.25, 7, 8, 1), 0xf2efe6); hull.rotation.z = Math.PI / 2; hull.scale.set(1, 1, 0.75); g.add(hull);
  const stripe = m(new THREE.CylinderGeometry(0.44, 0.27, 6.4, 8, 1, true), 0x2f6fa8); stripe.rotation.z = Math.PI / 2; stripe.scale.set(1, 1, 0.77); stripe.position.y = 0.12; g.add(stripe);
  for (const e of [-1, 1]) { const beak = m(new THREE.ConeGeometry(0.28, 1.2, 6), 0xd23b2a); beak.rotation.z = -e * Math.PI / 2; beak.position.set(e * 4, 0.25, 0); g.add(beak); }
  for (const zs of [-1, 1]) {
    const float = m(new THREE.CylinderGeometry(0.1, 0.1, 5.5, 5), 0x3a3026); float.rotation.z = Math.PI / 2; float.position.set(0, -0.15, zs * 2.6); g.add(float);
    for (const xs of [-1.4, 1.4]) { const arm = m(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 4), 0x5b4a36); arm.rotation.x = Math.PI / 2; arm.position.set(xs, 0.35, zs * 1.3); g.add(arm); }
  }
  const mast = m(new THREE.CylinderGeometry(0.04, 0.05, 3, 4), 0x5b4a36); mast.position.y = 1.7; g.add(mast);
  g.position.set(-70, 0, -120); g.rotation.y = 0.35; g.scale.setScalar(1.2); scene.add(g); return g;   // anchored out the back, where the swells pass unbroken: you see it while you wait
})();
const birds = (() => {
  // a frigate bird: long narrow wings bent at the wrist (the classic 'W' seen from below), forked tail
  const V = [0, 0, 0.55,  -0.5, 0.12, 0.05,  0, 0, -0.1,    -0.5, 0.12, 0.05,  -1.25, -0.05, -0.25,  -0.35, 0.05, -0.12,
             0, 0, 0.55,   0.5, 0.12, 0.05,  0, 0, -0.1,     0.5, 0.12, 0.05,   1.25, -0.05, -0.25,   0.35, 0.05, -0.12,
             0, 0, -0.1,   -0.12, 0, -0.55,  0, 0, -0.35,     0, 0, -0.1,        0.12, 0, -0.55,       0, 0, -0.35];
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(V), 3));
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1d22, side: THREE.DoubleSide }), list = [];
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(geo, mat); b.userData = { r: 25 + Math.random() * 30, h: 35 + Math.random() * 25, a: Math.random() * 6.3, w: 0.12 + Math.random() * 0.08, cx: -20 + Math.random() * 60, cz: 20 + Math.random() * 40 }; scene.add(b); list.push(b); }
  return list;
})();
const locals = [], _lq = new THREE.Quaternion(), _le = new THREE.Euler(0, 0, 0, 'YXZ');
function updateLocals(dt) {
  for (const L of locals) {
    L.grp.visible = !!rider; if (!rider) continue;
    const y = heightAt(waves, L.x, L.z);
    L.grp.position.set(L.x + Math.sin(T * 0.2 + L.ph) * 0.6, y + 0.05, L.z);
    L.grp.quaternion.setFromEuler(_le.set(-0.25 + Math.sin(T * 1.3 + L.ph) * 0.05, Math.PI + Math.sin(T * 0.15 + L.ph) * 0.3, Math.sin(T * 1.1 + L.ph) * 0.04));   // facing the sets, nose up (sitting on the tail)
    L.mx.update(dt);
  }
}
function updateScenery(dt) {
  if (jukung.visible = !!rider) { const y = heightAt(waves, jukung.position.x, jukung.position.z); jukung.position.y += (y - 0.05 - jukung.position.y) * Math.min(1, dt * 3); jukung.rotation.x = Math.sin(T * 0.9) * 0.04; jukung.rotation.z = Math.sin(T * 0.7 + 1) * 0.03; }
  for (const b of birds) { const u = b.userData; u.a += u.w * dt; b.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(T * 0.3 + u.r) * 2, u.cz + Math.sin(u.a) * u.r); b.rotation.set(0, -u.a, Math.sin(T * 0.8 + u.r) * 0.25);
    const flap = Math.sin(T * 7 + u.r) * (Math.sin(T * 0.4 + u.r) > 0.6 ? 0.5 : 0.05); b.scale.set(1.8, 1.8 + flap, 1.8); }
}
// the leash: from the tail of the board to your back ankle, hanging in a loose curve (a thin dark line: 7 mm cord)
const LEASH_N = 14, leash = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(LEASH_N * 3), 3)),
  new THREE.LineBasicMaterial({ color: 0x1b1f24 }));
leash.frustumCulled = false; scene.add(leash);
const _la = new THREE.Vector3(), _lb = new THREE.Vector3(), _lc = new THREE.Vector3();
function updateLeash() {
  if (!surfer || !bones.foot_l || !rig.visible || !surfer.visible) { leash.visible = false; return; }   // (hidden while you tumble: you ARE the camera)
  leash.visible = true;
  rig.localToWorld(_la.set(0, 0.05, -0.9));                                              // the plug near the tail
  const fl = bones.foot_l.getWorldPosition(_lb), fr = bones.foot_r.getWorldPosition(_lc);
  const ankle = fl.distanceToSquared(_la) < fr.distanceToSquared(_la) ? fl : fr;         // whichever foot is at the back
  const d = _la.distanceTo(ankle), sag = Math.max(0, 1.8 - d) * 0.35, p = leash.geometry.attributes.position;
  for (let i = 0; i < LEASH_N; i++) { const t = i / (LEASH_N - 1);
    p.setXYZ(i, _la.x + (ankle.x - _la.x) * t, _la.y + (ankle.y - _la.y) * t - sag * 4 * t * (1 - t), _la.z + (ankle.z - _la.z) * t); }
  p.needsUpdate = true;
}
let surfer = null, mixer = null, clips = {}, curClip = null;
// first-person cutaway: your own head, neck, chest and shoulders (a column from your eyes down, this wide) aren't drawn (your neck, shoulders
// and upper arms are right at the camera and would fill the screen); hands, forearms, legs and the board stay
const CUT = { value: 0.21 };   // just the neck and head (at 42 cm it cut your arms off at the elbow: floating hands)
// which skeleton bones are "arm" (upper arm down to the fingertips): the cutaway never removes those, so you always see
// whole arms, while your chest, shoulders and neck near the camera are hidden (they were showing as a stretched skin fin)
const ARMBONE = { value: new Float32Array(96) };
function cutaway(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = CUT; sh.uniforms.uArmBone = ARMBONE; sh.uniforms.uNear = { value: m.userData.near || 0 };
    sh.vertexShader = 'varying vec3 vCutW; varying float vArm; uniform float uArmBone[96];\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
vCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#ifdef USE_SKINNING
vArm = skinWeight.x * uArmBone[int(skinIndex.x)] + skinWeight.y * uArmBone[int(skinIndex.y)] + skinWeight.z * uArmBone[int(skinIndex.z)] + skinWeight.w * uArmBone[int(skinIndex.w)];
#else
vArm = 0.;
#endif`);
    sh.fragmentShader = 'uniform float uCut, uNear;\nvarying vec3 vCutW; varying float vArm;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  vec3 cq = vCutW - cameraPosition; float cy = clamp(cq.y, -0.75, 0.);
  if (vArm < 0.12 && (length(cq - vec3(0., cy, 0.)) < uCut * 1.9 || length(cq) < uCut * 2.2)) discard;   // body near the eyes
  if (length(cq) < uCut * 0.6 + uNear) discard;   // (uNear > 0 on the shorts: sliced close to the lens they showed as teal hooks)   // anything right in the lens (arms are never cut: a cut shows the hollow inside of the arm as a 'fin')`);
  };
  m.side = THREE.FrontSide;   // (so a cut shows nothing behind it, not the inside of the arm)
  m.customProgramCacheKey = () => 'cutaway3' + (m.userData.near || 0);
  m.needsUpdate = true;
}
const ready = new Promise((res, rej) => new GLTFLoader().load('surfer.glb?v=1', (g) => {
  surfer = g.scene; rig.add(surfer);
  surfer.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material.name === 'hair') o.material.side = THREE.DoubleSide; else { if (/short/i.test(o.material.name + o.name)) o.material.userData.near = 0.45; cutaway(o.material); } } });
  surfer.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b, i) => { if (i < 96 && /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/.test(b.name)) ARMBONE.value[i] = 1; }); });
  mixer = new THREE.AnimationMixer(surfer);
  for (const c of g.animations) { c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale')); clips[c.name] = mixer.clipAction(c); }
  // two locals sitting in the lineup either side of you, waiting for a set like you (same body, their own board)
  const sit = g.animations.find((c) => c.name === 'sit');
  for (const [x, z, ph] of [[-13, -15, 0], [17, -7, 2.1]]) {
    const body = cloneSkinned(g.scene), grp = new THREE.Group(), brd = makeBoard();
    body.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    body.position.set(0, -0.36, -0.25); grp.add(brd, body); scene.add(grp);
    const mx = new THREE.AnimationMixer(body); if (sit) { const a = mx.clipAction(sit); a.play(); a.time = ph; }
    locals.push({ grp, mx, x, z, ph });
  }
  res();
}, undefined, (err) => { ui.load.textContent = 'Could not load the surfer. Check your connection and reload.'; rej(err); }));
function play(name, { fade = 0.25, once = false, speed = 1, weight = 1 } = {}) {
  const a = clips[name]; if (!a) return;
  a.timeScale = speed; a.weight = weight;
  if (curClip === a) return;
  if (curClip === clips.crouch && clips.stand) clips.stand.fadeOut(fade);   // the stance blend's second layer must not linger into other poses
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true;
  if (curClip) a.crossFadeFrom(curClip, fade, false);
  a.play(); curClip = a;
}

// ---------- the surf: a reef with the peak at x=0, z=0. Waves come in from the sea one swell period apart.
// Each wave breaks at the peak when it gets there and peels off to the right. You sit in the lineup and pick your own.
let mode = null, rider = null, waves = [], session = { waves: 0, total: 0, best: 0, scores: [] }, nextBreak = 0, setLeft = 0, setPos = 0;
const REEF = { xEnd: 190, zBeach: 150 }, PROFILES = new Map();   // room for the bigger swells to run (the sand starts ~185 m in)
function condFor(m) { return m === 'random' ? ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] : m; }
function addWave(tBreak) {
  const cond = CONDITIONS[condFor(mode)];
  const w = new Wave(scene, cond);
  if (!PROFILES.has(cond)) PROFILES.set(cond, new Profile(w));      // the surface shape is the same for every wave of a size: share its cache
  w.tBreak = tBreak; w.prof = PROFILES.get(cond); w.xEnd = REEF.xEnd; w.zBeach = REEF.zBeach; w.seed = Math.random() * 100;
  waves.push(w);
  return w;
}
function updateWaves(dt) {
  for (const pr of PROFILES.values()) pr.warm(24);
  // keep the next wave lined up out to sea; a swell period apart, give or take
  // swell arrives in sets: 3-4 waves one period apart, the bigger ones in the middle, then a lull (shortened for play)
  while (nextBreak - T < 150 / 6) {
    const w = addWave(nextBreak);
    if (setLeft <= 0) { setLeft = 3 + (Math.random() < 0.5 ? 1 : 0); setPos = 0; }
    const n = setPos / Math.max(1, setLeft + setPos - 1);
    w.size = 0.82 + 0.28 * Math.sin(Math.PI * Math.min(1, n + 0.15)) + (Math.random() - 0.5) * 0.08;
    setPos++; setLeft--;
    nextBreak += setLeft > 0 ? w.cond.period * (0.9 + Math.random() * 0.2) : w.cond.period * (1.2 + Math.random() * 0.4);   // lull: long enough to paddle back and breathe, short enough not to bore
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], C = w.cond, t = T - w.tBreak;
    // the break doesn't peel at one steady speed: sections race ahead and slow down (more so in heavy surf), so a tube
    // opens and pinches and you have to keep adjusting. Integrated so it stays smooth.
    const sg = C.name === 'Hard' || C.name === 'Extreme' ? 0.3 : C.name === 'Medium' ? 0.18 : 0.06;
    let rate = C.peel * (1 + sg * (0.6 * Math.sin(t * 0.55 + w.seed) + 0.4 * Math.sin(t * 1.3 + w.seed * 2.1)));
    // sections: every few seconds a stretch ahead of the curl throws all at once, so the break races ahead for about a
    // second (the curl jumps 1.5-2 wave heights down the line), then eases while it recovers. You race it, or pull in.
    if (t > 0 && C.name !== 'Easy') {
      if (w.secT === undefined) w.secT = 3 + Math.random() * 4;
      if (w.secK === undefined || w.secK <= 0) { w.secT -= dt; if (w.secT <= 0) { w.secK = 1.1; w.secT = 5 + Math.random() * 5; if (w.spitT !== undefined) w.spitT = 0.25; } }
      else { w.secK -= dt; const ph = 1 - w.secK / 1.1, A = C.name === 'Medium' ? 1.5 : 2.1; rate *= ph < 0.75 ? 1 + A * Math.sin(Math.PI * ph / 0.75) : 0.6; }
    }
    w.px = (w.px === undefined ? C.peel * t : w.px + rate * dt);
    w.peelRate = rate;   // the physics uses the peel speed right now (not the average), so the wave's push matches what you see
    w.place(w.px, C.speed * t);
    w.fade = (w.size || 1) * Math.min(1, Math.max(0, 1 - (w.peelX - REEF.xEnd) / 40)) * Math.min(1, Math.max(0.15, 1 + (w.zW + 160) / 60));   // far out it's a small swell; past the end of the reef it backs off
    w.update(dt);
    if (w.zW > REEF.zBeach + 40 || w.peelX > REEF.xEnd + 45) { w.dispose(scene); waves.splice(i, 1); }
  }
}
// the next wave that hasn't reached you yet, and how many seconds until its face gets to you
function incoming() {
  let best = null, tBest = 1e9;
  for (const w of waves) {
    const zl = rider.z - w.zW; if (zl < -2) continue;                 // already past you
    const t = (zl - 6) / w.cond.speed; if (t < tBest) { tBest = t; best = w; }
  }
  return { w: best, t: tBest };
}
function spawnRider() {
  if (surfer) endWipe(); rig.visible = true; for (const b of birds) b.visible = true;
  pumpC = 0; stanceW = 0; lastState = ''; endT = -1; snapCam = true;
  rider = rider || new Rider();
  // in the lineup: just outside and a little down the line from the peak, sitting up facing the sets
  rider.reset(2 + Math.random() * 4, -7 - Math.random() * 3, -Math.PI / 2);
  // don't drop a wave on your head as you arrive
  // don't drop a wave on your head as you arrive: hold back every wave that hasn't reached you yet
  { const inc = incoming(); if (inc.t < 7) { const shift = 7 - inc.t;
      for (const w of waves) if (rider.z - w.zW >= -2) { w.tBreak += shift; if (w.px !== undefined) w.px -= w.cond.peel * shift; }   // (its break point too, or it breaks down the reef)
      nextBreak += shift; } }
  ui.msg.style.display = 'none';
}

// ---------- controls: PADDLE/PUMP (hold, left) and a thumb pad (right half). Keyboard for testing.
const input = { paddle: false, steer: 0 };
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());   // (switching apps mid-press)
const ui = {
  paddle: document.getElementById('paddle'), stall: document.getElementById('stall'), pad: document.getElementById('pad'), touch: document.getElementById('touch'), knob: document.querySelector('#touch b'),
  speed: document.getElementById('speed'), score: document.getElementById('score'), cond: document.getElementById('cond'),
  msg: document.getElementById('msg'), msgT: document.getElementById('msg-t'), msgN: document.getElementById('msg-n'), msgS: document.getElementById('msg-s'),
  tube: document.getElementById('tube'), hint: document.getElementById('hint'), load: document.getElementById('load'), start: document.getElementById('start'), sess: document.getElementById('sess'),
};
const hold = (el, on, off) => {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); on(e); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('touchcancel', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('mousedown', on); addEventListener('mouseup', off);
};
hold(ui.paddle, () => { audio.wake(); input.paddleBtn = true; ui.paddle.classList.add('down'); }, () => { input.paddleBtn = false; ui.paddle.classList.remove('down'); });
hold(ui.stall, () => { audio.wake(); input.stallBtn = true; ui.stall.classList.add('down'); }, () => { input.stallBtn = false; ui.stall.classList.remove('down'); });
// thumb: touch anywhere on the right half and drag; the spot you first touch is the centre.
// Left/right turns the board left/right, like leaning on a real board: lying, it points you where you paddle; standing, it carves.
let padTouch = null, padX = 0, padY = 0, lastPadTouch = undefined, lastKnob = '', steerF = 0, stickY = 0, lastStickMode = null;
const PAD_R = 80;                                                   // thumb travel (px) for a full lean
const padMove = (x, y) => { if (!padTouch) return; padX = Math.max(-1, Math.min(1, (x - padTouch.x0) / PAD_R)); padY = Math.max(-1, Math.min(1, (y - padTouch.y0) / PAD_R)); };
ui.pad.addEventListener('touchstart', (e) => { e.preventDefault(); audio.wake(); if (padTouch) return; const t = e.changedTouches[0]; padTouch = { id: t.identifier, x0: t.clientX, y0: t.clientY }; padX = padY = 0; }, { passive: false });
ui.pad.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (padTouch && t.identifier === padTouch.id) padMove(t.clientX, t.clientY); }, { passive: false });
const padEnd = (e) => { e.preventDefault(); for (const t of e.changedTouches) if (padTouch && t.identifier === padTouch.id) padTouch = null; };
ui.pad.addEventListener('touchend', padEnd, { passive: false }); ui.pad.addEventListener('touchcancel', padEnd, { passive: false });
ui.pad.addEventListener('mousedown', (e) => { padTouch = { id: 'm', x0: e.clientX, y0: e.clientY }; padX = padY = 0; });
addEventListener('mousemove', (e) => { if (padTouch && padTouch.id === 'm') padMove(e.clientX, e.clientY); });
addEventListener('mouseup', () => { if (padTouch && padTouch.id === 'm') padTouch = null; });
function readInput(dt) {
  if (!padTouch) { padX *= Math.max(0, 1 - dt * 10); padY *= Math.max(0, 1 - dt * 10); }   // let go and the board runs straight
  const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  // thumb feel: a small dead zone (a resting thumb wobbles), fine control near the centre, full lean at the edge,
  // and a light filter so the board answers smoothly instead of twitching with every pixel
  const shape = (v) => { const a = Math.abs(v); return a < 0.08 ? 0 : Math.sign(v) * Math.pow((a - 0.08) / 0.92, 1.35); };
  const ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  const sx = input.stick ? input.stick.x : kx || shape(padX), sy = input.stick ? input.stick.y : ky || shape(padY);
  steerF += (sx - steerF) * Math.min(1, dt * 14);
  stickY += (sy - stickY) * Math.min(1, dt * 14);
  input.steer = input.test != null ? input.test : steerF;   // input.test: scripted steering for automated checks
  input.up = input.test != null ? 0 : stickY;              // thumb up (-) / down (+): where on the face you want to be
  input.paddle = !!input.paddleBtn || keys.has('Space');
  const riding = !!(rider && rider.standing && (rider.state === 'RIDE' || rider.state === 'POP'));
  if (riding !== lastStickMode) { document.body.classList.toggle('riding', riding); lastStickMode = riding; }
  if (padTouch !== lastPadTouch) {
    ui.touch.classList.toggle('live', !!padTouch);
    if (padTouch) { ui.touch.style.left = padTouch.x0 + 'px'; ui.touch.style.top = padTouch.y0 + 'px'; }
    lastPadTouch = padTouch;
  }
  const kt = `translate(${Math.round(padX * PAD_R)}px,0px)`; if (kt !== lastKnob) { ui.knob.style.transform = kt; lastKnob = kt; }
  return { paddle: input.paddle, pump: input.paddle, steer: input.steer, up: input.up };    // same button: paddle lying down, pump once standing; steer + = turn right
}

// Riding, "steer and pedals" (his pick), seamless like a simulator: no modes, no hidden steering.
//   right thumb slider = lean the board left / right, as far and as long as you like (the camera is behind you, so
//                        left/right always match the screen; keep turning and you carve round into a cutback)
//   left thumb PUMP    = speed    STALL = brake (back foot + trailing hand dragged in the face, the barrel catches you)
function surfSteer(sx, stall) {
  return { steer: sx, stall: stall ? 1 : 0 };
}

// your best ride per level, kept on this phone (quietly does nothing if storage is blocked)
const bestFor = (m) => { try { return +localStorage.getItem('balisurf.best3.' + m) || 0; } catch (e) { return 0; } };
const saveBest = (m, v) => { try { localStorage.setItem('balisurf.best3.' + m, String(v)); } catch (e) {} showBests(); };
function showBests() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    let el = b.querySelector('.best'); const v = bestFor(b.dataset.mode);
    if (!el) { el = document.createElement('em'); el.className = 'best'; b.appendChild(el); }
    el.textContent = v ? `Best wave ${v.toFixed(1)}` : '';
  }
}
showBests();
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => start(b.dataset.mode));
let starting = false;
// back to the level select: stop the game behind the menu (you pick a level again to restart)
function toMenu() {
  starting = false; audio.pause(true);
  // clear the session: the menu gets its slow drifting wave behind it again (and nothing of the old ride keeps running)
  if (surfer) endWipe(); rider = null; rig.visible = false; endT = -1;
  for (const w of waves) w.dispose(scene); waves = [];
  setWeather('medium'); ui.cond.textContent = '';
  underK = 0; underEl.style.opacity = 0; underEl.style.display = 'none'; setText(ui.speed, ''); setText(ui.score, ''); setText(ui.hint, ''); ui.tube.style.opacity = 0;
  input.paddleBtn = false; input.stallBtn = false; input.stick = null; padTouch = null; padX = padY = 0;
  keys.clear(); steerF = stickY = 0; ui.paddle.classList.remove('down'); ui.stall.classList.remove('down');
  document.body.classList.remove('playing', 'riding'); ui.msg.style.display = 'none';
  ui.start.style.display = ''; showBests();
}
document.getElementById('menu').addEventListener('touchstart', (e) => { e.preventDefault(); toMenu(); }, { passive: false });
document.getElementById('menu').addEventListener('click', toMenu);
async function start(m) {
  if (starting) return; starting = true; if (window.__g) window.__g.paused = false;
  mode = m; setWeather(m); audio.start();
  // fullscreen + landscape lock must be asked for inside the tap, before any waiting (Android); iOS ignores both safely
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch (e) {}
  ui.load.textContent = surfer ? '' : 'Loading...';
  try { await ready; } catch (e) { starting = false; return; }
  ui.load.textContent = '';
  ui.start.style.display = 'none'; document.body.classList.add('playing');
  session = { waves: 0, total: 0, best: 0, scores: [] };
  setLeft = 0; setPos = 0;
  for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 15;   // a calm start: time to look around and find the set
  updateWaves(0); spawnRider();
  ui.cond.textContent = mode === 'random' ? 'Random' : CONDITIONS[mode].name;
}
if (Q.get('mode')) start(Q.get('mode'));

// ---------- camera: a chase camera over your shoulder, looking where you're going; tight and low in the barrel
const lookDir = new THREE.Vector3(), _cv = new THREE.Vector3(), _lk = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 2, 10), camLook = new THREE.Vector3(), pose = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3() };
let camYaw = 0, lookYaw = 0, lookBackK = 0, wipeCut = false;
const cam = { a: 0, r: 3, y: 1.3, va: 0, vr: 0, vy: 0, vl: new THREE.Vector3() };
const camOff = new THREE.Vector3(0, 1.3, 3), lookOff = new THREE.Vector3(), _anc = new THREE.Vector3(), anchorS = new THREE.Vector3(), anchorV = new THREE.Vector3();
const smooth01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const _wq2 = {};
// how high the wave reaches at a point for sight-line purposes, including a lip overhanging in front of the face
const _sq = {};
function solidAt(x, z) {
  const q = waterAt(waves, x, z, _sq);
  if (!q.w) return q.y;
  const sl = q.w.prof.slice(q.s);
  if (q.zl > sl.topZ - 0.5 && q.zl < Math.max(sl.lipZ, sl.topZ) + 0.6) return Math.max(q.y, sl.top * (q.w.fade || 1));
  return q.y;
}
let camStandK = 0, tubeK = 0; const CAM = { back: 4.8, h: 1.4, lookY: 1.1, lead: 1.3, level: true };   // riding camera: distance, height, aim height, look-ahead; level = no lift over the crest while riding
const _wT = new THREE.Vector3(), _lT = new THREE.Vector3();
// ---------- first-person view (his call: the game is played from the surfer's eyes)
// Eyes at the head, looking where you're going and a little down so the board's nose and the wave ahead are in view.
// A real surfer's head is steady: the eye point is smoothed, the horizon stays level with only a slight lean into turns,
// and the view swings smoothly (never snaps) as you turn. Your own head is hidden so the camera never sees inside it.
const POVCAM = { fwd: 0.1, up: 0.14, pitch: -0.5, drop: 0.08 };   // eye point ahead of/above the head bone, head pitch riding, extra pitch at the take-off
const _pq2 = new THREE.Quaternion(); let tubeLook = 0;
const pov = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.2, roll: 0, ready: false }, _eye = new THREE.Vector3(), _pe = new THREE.Euler(0, 0, 0, 'YXZ');
function povCamera(dt) {
  if (!bones.head && surfer) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const standing = rider.standing, st = rider.state;
  // the eye point: just in front of the head, where the eyes are
  if (bones.head) bones.head.getWorldPosition(_eye); else _eye.copy(pose.pos).y += standing ? 1.4 : 0.35;
  const moving = rider.v > (standing ? 2 : 0.6);
  const travel = moving ? Math.atan2(rider.vz, rider.vx) : rider.th;
  // look mostly where you're travelling, partly where the board points (you see the nose swing in a turn/drift)
  const dh = Math.atan2(Math.sin(rider.th - travel), Math.cos(rider.th - travel));
  let yawT = travel + dh * (standing ? 0.7 : 0.8);
  // in the barrel look down the tube toward the exit (along the line), not out through the open side at the beach
  tubeLook += ((rider.inBarrel && standing ? 1 : 0) - tubeLook) * Math.min(1, dt * 3);
  if (tubeLook > 0.01) yawT += Math.atan2(Math.sin(-0.15 - yawT), Math.cos(-0.15 - yawT)) * 0.65 * tubeLook;   // (more of the board heading: in a snap the board stays in view instead of swinging out of shot)
  const ef = standing ? POVCAM.fwd : -0.05, eu = standing ? POVCAM.up : 0.2;   // lying: eyes at the head, a bit up, so your paddling hands pass below them
  _eye.x += Math.cos(yawT) * ef; _eye.z += Math.sin(yawT) * ef; _eye.y += eu;   // camera just in front of the face, like a surfer's mouth-mounted camera
  // smooth the eye's position relative to the board (not in the world, or at speed it would trail behind your head)
  _eye.sub(rig.position);
  // eyes never lower than this above the board; during the pop it rises with you instead of snapping up in one frame
  const popT = st === 'POP' ? Math.min(1, rider.stateT / 0.4) : standing ? 1 : 0, eyeFloor = 0.25 + 0.35 * popT * popT * (3 - 2 * popT);
  if (_eye.y < eyeFloor) _eye.y = eyeFloor;
  // pop-up: the clip throws the head out over the rail; a real pop keeps your head over the stringer, eyes on the
  // board between your hands, so the camera stays over the middle of the board while you come up
  if (st === 'POP' || (st === 'RIDE' && rider.stateT < 0.4)) {
    const k = st === 'POP' ? 0.8 : 0.8 * (1 - rider.stateT / 0.4);
    _pq2.copy(rig.quaternion).invert(); _eye.applyQuaternion(_pq2); _eye.x *= 1 - k; _eye.applyQuaternion(rig.quaternion);
  }
  if (!pov.ready || snapCam) { pov.pos.copy(_eye); pov.vel.set(0, 0, 0); pov.yaw = yawT; pov.ready = true; }
  else {
    // (a plain exponential follow: stays glued to your head through the pop-up, just takes the jitter off; the old
    // spring was so over-damped it closed only ~2% of the gap a frame and left the camera inside your chest)
    const k = st === 'POP' ? 8 + 50 * Math.min(1, rider.stateT / 0.35) : st === 'RIDE' && rider.stateT < 0.5 ? 30 : 16;   // (eases into the pop instead of snapping to the new eye height in one frame)
    pov.pos.lerp(_eye, 1 - Math.exp(-k * dt));
    const dy = Math.atan2(Math.sin(yawT - pov.yaw), Math.cos(yawT - pov.yaw)), maxY = 3.2 * dt;
    pov.yaw += Math.max(-maxY, Math.min(maxY, dy * Math.min(1, dt * 7)));
  }
  snapCam = false;
  // head pitch: riding, look down the line and at the nose; lying, look ahead over the nose; at the drop, look down the face
  const dropK = st === 'POP' ? 4 : st === 'RIDE' ? 4 * Math.max(0, 1 - rider.stateT / 0.5) : 0;   // the pop: eyes down on the board between your hands, then back up to the line
  let pitchLook = -9, pitchT = standing ? POVCAM.pitch - POVCAM.drop * dropK : sitting ? -0.53 : -0.4;   // sitting: tipped down enough to see your knees and hands on the board   // take-off: look down at the board and the face; lying: down enough to see your arms paddling
  // sitting or lying facing out to sea: look up at a wave that's coming (a 15 m wave's crest is well above the horizon)
  if (!standing) {
    const inc = incoming();
    if (inc.w && inc.t < 14 && inc.t > -1 && Math.sin(rider.th) < 0.3) {
      const dist = Math.max(4, inc.t * inc.w.cond.speed + 6), up = Math.atan2(inc.w.cond.H * 0.9 - 0.8, dist);
      pitchLook = Math.max(pitchLook, up - 0.3);
    }
  }
  if (pitchLook > pitchT) pitchT = pitchLook;
  pitchT += 0.14 * tubeLook;   // and up a little: the lip over your head
  pov.pitch += (pitchT - pov.pitch) * Math.min(1, dt * (st === 'POP' ? 4 + 20 * Math.min(1, rider.stateT / 0.3) : 5));   // (the pop: eyes snap down to the board between your hands)
  pov.roll += ((standing ? -rider.lean * 0.28 : 0) - pov.roll) * Math.min(1, dt * 6);   // you feel the lean: the horizon tips as you lay into a carve
  // three.js cameras look down -z: turn our heading (angle in x/z) into a yaw about y
  _pe.set(pov.pitch, -pov.yaw - Math.PI / 2, pov.roll);
  camera.quaternion.setFromEuler(_pe);
  camera.position.copy(pov.pos).add(rig.position);
  // feel the water: small quick bumps through the board (chop under you), stronger with speed and chop, and a
  // rattle when the tail slides; tiny, so it reads as texture, never as shake
  if (standing && st === 'RIDE') {
    const chop = ENV.weather ? ENV.weather.chop : 1, sp = Math.min(1, rider.v / 9), rattle = Math.min(1, (rider.slide || 0) * 2.5 + rider.skid);
    const t = T, n1 = Math.sin(t * 11.3) * 0.6 + Math.sin(t * 17.9 + 1.3) * 0.4, n2 = Math.sin(t * 23.7 + 0.7) * 0.5 + Math.sin(t * 31.1 + 2.1) * 0.5;
    const amp = (0.006 + 0.006 * chop) * sp + 0.008 * rattle;
    camera.position.y += n1 * amp; camera.rotateX(n2 * amp * 0.6); camera.rotateZ(n1 * amp * 0.4);
  }
  // the eyes are always above your own board (never ask the water height here: under a lip or in the barrel the
  // 'surface' overhead is the lip, and pushing above it would lift you out of the tube)
  const minY = rig.position.y + (st === 'RIDE' ? 0.5 : 0.22); if (camera.position.y < minY) camera.position.y = minY;
}

// underwater: the screen goes murky green-blue (the water surface can't be seen from below, so this is the whole look)
const underEl = document.createElement('div');
underEl.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:5;opacity:0;background:radial-gradient(ellipse at 50% 0%,rgba(150,225,220,.75),rgba(30,110,125,.9) 45%,rgba(6,40,55,.985))';
document.body.appendChild(underEl);
// under the whitewater: swirling churned foam and bubbles racing up past you (plain CSS: cheap, and drawn over the tint)
{ const st = document.createElement('style');
  st.textContent = `@keyframes bub{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:.9}100%{transform:translate(var(--dx),-115vh) scale(1.15);opacity:.2}}
  @keyframes churn{0%{background-position:0 0,0 0,0 0}100%{background-position:-240px -900px,180px -600px,-90px -760px}}
  .bub{position:absolute;bottom:-6vh;border-radius:50%;border:1.5px solid rgba(235,250,250,.75);background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.7),rgba(255,255,255,.08) 55%,transparent 70%);animation:bub linear infinite}
  .churn{position:absolute;inset:-20%;opacity:.55;animation:churn 2.6s linear infinite;
    background-image:radial-gradient(ellipse 60px 34px at 30% 40%,rgba(240,250,250,.5),transparent 70%),radial-gradient(ellipse 120px 60px at 70% 20%,rgba(220,240,240,.32),transparent 70%),radial-gradient(ellipse 90px 140px at 15% 80%,rgba(230,245,245,.28),transparent 70%);
    background-size:173px 211px,263px 337px,389px 293px;transform:rotate(-17deg);filter:blur(5px)}`;
  document.head.appendChild(st);
  const ch = document.createElement('div'); ch.className = 'churn'; underEl.appendChild(ch);
  for (let i = 0; i < 46; i++) { const b = document.createElement('div'); b.className = 'bub'; const sz = 4 + Math.random() * Math.random() * 26;
    b.style.cssText = `left:${Math.random() * 100}%;width:${sz}px;height:${sz}px;--dx:${(Math.random() - .5) * 120}px;animation-duration:${0.9 + Math.random() * 1.6}s;animation-delay:${-Math.random() * 2.5}s`;
    underEl.appendChild(b); } }
let underK = 0;
function setUnder(k, dt) { underK += (k - underK) * Math.min(1, dt * (k > underK ? 14 : 5)); underEl.style.opacity = underK.toFixed(3); underEl.style.display = underK > 0.01 ? '' : 'none'; }   // (hidden = the bubbles stop animating)
// wiping out, in first person: thrown, rolled under the whitewater (the view tumbles, but damped so it doesn't make
// you sick), then you surface, the view levels out and you look for your board
const _wiq = new THREE.Quaternion(), _wm = new THREE.Matrix4();
function povWipe(dt) {
  if (bones.head) bones.head.getWorldPosition(_eye); else surfer.getWorldPosition(_eye);
  if (!W.cam) { W.cam = camera.position.clone(); W.q = camera.quaternion.clone(); W.up = false; }
  surfer.visible = false;   // you ARE the camera: your own body tumbling past the lens only looks broken
  if (W.t < 1.4) W.cam.lerp(_eye, Math.min(1, dt * 30)); else { W.cam.x += (_eye.x - W.cam.x) * Math.min(1, dt * 4); W.cam.z += (_eye.z - W.cam.z) * Math.min(1, dt * 4); W.cam.y += (Math.min(_eye.y, heightAt(waves, W.cam.x, W.cam.z) + 0.3) - W.cam.y) * Math.min(1, dt * 3); }
  const water = heightAt(waves, W.cam.x, W.cam.z);
  if (W.t < 1.4) {
    // roll with your body, at 40% of its spin
    _dq.setFromEuler(_e.set(W.rw.z * 0.35 * dt, W.rw.y * 0.3 * dt, W.rw.x * 0.4 * dt)); W.q.multiply(_dq);   // head over heels: the body's forward roll pitches the view
  } else {
    // surfaced: head up, looking for your board
    // (looking level toward it: your eyes are at the water line, the horizon stays put)
    _wm.lookAt(W.cam, _cv.set(rig.position.x, W.cam.y - 0.15, rig.position.z), WORLD_UP); _wiq.setFromRotationMatrix(_wm);
    W.q.slerp(_wiq, Math.min(1, dt * 2.5));
    W.cam.y += Math.max(0, water + 0.25 - W.cam.y) * Math.min(1, dt * 5);   // float up to the surface, don't pop
  }
  camera.position.copy(W.cam); camera.quaternion.copy(W.q);
  const depth = water - W.cam.y;
  setUnder(depth > 0.02 ? Math.min(1, 0.55 + depth * 0.6) : 0, dt);
  if (depth <= 0.02 && W.t > 1.2 && !W.up) { W.up = true; audio.burst(0.22, 700, 0.35); audio.splash(0.4); }   // the gasp as you break the surface
}

function updateCamera(dt) {
  const p = pose.pos, st = rider.state;
  if (bones.head) bones.head.scale.setScalar(0.001);   // hide your own head from your own eyes
  setHfov(55);
  tubeK = 0;
  if (st === 'WIPE' && W.on && surfer) { povWipe(dt); return; }
  setUnder(0, dt);
  povCamera(dt);
}

// ---------- surfer pose on the board
const WORLD_UP = new THREE.Vector3(0, 1, 0), INTO_WAVE = new THREE.Vector3(0, 0, -1), tmpM = new THREE.Matrix4(), xAxis = new THREE.Vector3(), bodyUp = new THREE.Vector3(), bodyFwd = new THREE.Vector3(), bodyX = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0), _up = new THREE.Vector3(), _tq = new THREE.Quaternion(), _yq = new THREE.Quaternion(), bodyQ = new THREE.Quaternion(), stanceQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), invQ = new THREE.Quaternion();
// the rider's world orientation (bodyQ, plus side-on stance) expressed in the board's frame
const setStance = () => { invQ.copy(rig.quaternion).invert(); surfer.quaternion.copy(invQ).multiply(bodyQ).multiply(stanceQ); };
function updateRig(dt, t) {
  if (rider.state === 'WIPE' && W.on) { wipeout(dt); return; }
  rider.pose(pose);
  const standing = rider.standing;
  // standing, the board rides on its rail (partway between the face and level) and rolls into the carve
  if (standing) {
    pose.up.lerp(WORLD_UP, 0.45).normalize();
    const roll = rider.lean * 0.8;                                      // the board on its rail: the lean you're carving with
    pose.up.applyAxisAngle(pose.fwd, roll);   // (+lean turns right, toward +z; rolling up toward +z puts the right rail in the water)
  }
  pose.up.addScaledVector(pose.fwd, -pose.up.dot(pose.fwd)).normalize();
  xAxis.crossVectors(pose.up, pose.fwd).normalize();
  const up = _up.crossVectors(pose.fwd, xAxis).normalize();
  tmpM.makeBasis(xAxis, up, pose.fwd);
  _tq.setFromRotationMatrix(tmpM);
  // the water surface kinks where the face bends; ease the board's tilt so it rides over those instead of snapping
  // the sitting tilt eases in and out too; smoothing runs on its own copy so extra tilts never pile up
  const sitK = rider.state === 'LIE' && !rider.paddling || rider.state === 'OUT' ? 1 : 0;
  sitTilt += (sitK - sitTilt) * Math.min(1, dt * 4);
  _tq.multiply(_yq.setFromAxisAngle(_xAxis, -0.4 * sitTilt));   // ~23 deg: your weight on the tail lifts the nose clear of the water
  if (snapCam) rigQ.copy(_tq);
  else { const ang = rigQ.angleTo(_tq); rigQ.rotateTowards(_tq, Math.min(ang * Math.min(1, dt * (rider.state === 'POP' ? 9 : 16)), 6 * dt)); }   // eased, and never faster than ~340 deg/s
  rig.quaternion.copy(rigQ);
  rig.position.copy(pose.pos);
  rig.position.y += 0.1 * sitTilt;                                     // the rider's weight sinks the tail
  if (standing || (rider.state === 'WIPE' && rider.stateT < 0.1)) {
    // the rider stands on the deck, leaning into the turn and a little toward the wave
    const lean = 0.15 + (rider.inBarrel ? 0.12 : 0);
    // stand over the board but closer to upright than the deck (legs absorb the tilt), leaning into the wave
    bodyUp.copy(pose.up).lerp(WORLD_UP, 0.4).addScaledVector(INTO_WAVE, Math.tan(lean * 0.6)).normalize();
    bodyFwd.set(pose.fwd.x, 0, pose.fwd.z).normalize();
    bodyUp.addScaledVector(bodyFwd, -bodyUp.dot(bodyFwd)).normalize();
    bodyX.crossVectors(bodyUp, bodyFwd);
    tmpM.makeBasis(bodyX, bodyUp, bodyFwd);
    bodyQ.setFromRotationMatrix(tmpM);
  }
  // bob on the water while lying
  if (!standing) rig.position.y += Math.sin(t * 1.6) * 0.04;
  if (!surfer) return;
  const st = rider.state;
  sitting = false;
  surfer.position.set(0, 0, 0); surfer.rotation.set(0, 0, 0);
  if (st === 'LIE' || st === 'OUT') {
    if (rider.paddling && st === 'LIE') { play('paddle', { speed: 0.7 + rider.v / 3 }); surfer.position.set(0, -0.93, -0.5); }   // chest mid-board, feet at the tail
    else {
      // sitting astride: weight over the tail sinks it, nose tips up ~14 deg, legs hang in the water either side
      play('sit'); surfer.position.set(0, -0.36, -0.25);
      sitting = true;
    }
  } else if (st === 'POP') {
    // pop-up: from flat on the board, hands push, feet swing under, straight into the crouch (no jump)
    const u = Math.min(1, rider.stateT / 0.35), e = u * u * (3 - 2 * u);
    if (curClip !== clips.crouch) { play('crouch', { fade: 0.18 }); clips.stand.reset().play(); }
    clips.crouch.weight = 0.8; clips.stand.weight = 0.2;
    setStance();
    if (e < 1) surfer.quaternion.slerp(_yq.identity(), 1 - e);          // rotate up from lying along the board to standing side-on
    surfer.position.set(0, -0.45 * (1 - e) - 0.04, -0.1);
  } else if (st === 'RIDE') {
    // crouch: deeper at speed and in the barrel; pumping compresses the legs, letting go extends them
    pumpC += ((input.paddle ? 1 : 0) - pumpC) * Math.min(1, dt * 7);
    // knees: deeper at speed, in the barrel and when pumping; they compress under the load of a hard turn and extend out of it
    const deep = Math.min(0.85, (rider.inBarrel ? 0.62 : 0.4 + 0.1 * Math.min(1, rider.v / 10)) + 0.28 * pumpC + 0.3 * gLoad + 0.25 * (rider.stalling || 0));
    if (curClip !== clips.crouch) { play('crouch', { fade: 0.3 }); clips.stand.reset().play(); }
    clips.crouch.weight = deep; clips.stand.weight = 1 - deep;
    setStance();
    surfer.position.set(0, 0.0 - 0.04 * deep, -0.1);                  // hips drop a little as the feet spread
  } else if (st === 'WIPE') {
    setStance(); surfer.position.set(0, 0, -0.1);
    wipeout(dt);
  }
}

// ---------- rail spray: water thrown off the board's edge when you carve, skid or pop up; a big burst when you wipe out
const SPRAY_N = 1600;
const railSpray = (() => {
  const pos = new Float32Array(SPRAY_N * 3), vel = new Float32Array(SPRAY_N * 3), life = new Float32Array(SPRAY_N).fill(-1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(cv);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xf6f1ea, size: 0.055, map: tex, transparent: true, opacity: 0.75, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  let next = 0, acc = 0, fanAcc = 0;
  const emit = (p, v, n, spread) => {
    for (let k = 0; k < n; k++) {
      const i = next; next = (next + 1) % SPRAY_N;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      vel[i * 3] = v.x + (Math.random() - .5) * spread; vel[i * 3 + 1] = v.y + Math.random() * spread; vel[i * 3 + 2] = v.z + (Math.random() - .5) * spread;
      life[i] = 0.5 + Math.random() * 0.6;
    }
  };
  const _p = new THREE.Vector3(), _v = new THREE.Vector3();
  return {
    burst(p, n = 120, up = 3) { emit(p, _v.set(0, up, 0), n, 3.5); },
    update(dt) {
      // how much water the rail is throwing: carving load, skidding, and a little at speed
      if (rider && rider.standing) {
        const load = Math.min(1.3, Math.abs(rider.turn) * rider.v / 14 + rider.skid * 1.2 + (rider.state === 'POP' ? 0.5 : 0) + Math.max(0, rider.v - 6) * 0.03);
        acc += load * 900 * dt;
        if (acc >= 1) {
          const n = Math.floor(acc); acc -= n;
          // from the tail, thrown out of the face and back
          _p.copy(rig.position).addScaledVector(pose.fwd, -0.55).addScaledVector(pose.up, 0.05);
          // a fan: along the rail from mid-board to tail, thrown out of the face, up, and back
          for (let k = 0; k < n; k++) {
            _p.copy(rig.position).addScaledVector(pose.fwd, -0.15 - Math.random() * 0.6).addScaledVector(pose.up, 0.04);
            _v.copy(pose.up).multiplyScalar(0.8 + load * 1.6 + Math.random() * 0.6).addScaledVector(pose.fwd, -rider.v * (0.25 + Math.random() * 0.3)).add(_cv.set(0, 0.4 + Math.random() * 0.8, 0));   // a fan off the tail, a metre or two, not a fountain
            emit(_p, _v, 1, 0.6);
          }
        }
        // drifting: the tail sprays a big fan to the outside of the slide
        const snapK = rider.trick && rider.trick.name.endsWith('SNAP') && rider.trick.t < 0.3 ? 1 : 0;   // a snap throws a sheet of spray off the lip
        const slideK = Math.max(rider.skid, Math.min(1, ((rider.slide || 0) - 0.12) * 2.2));   // tail hanging out ~7 deg+ starts to spray
        if (slideK > 0.05 || snapK) {
          fanAcc += (Math.max(slideK, 0.3 * snapK) + 1.5 * snapK) * rider.v * 55 * dt;
          const side = Math.sign(rider.lean) || 1;                     // spray goes to the outside of the turn
          while (fanAcc >= 1) {
            fanAcc--;
            _p.copy(rig.position).addScaledVector(pose.fwd, -0.7 + Math.random() * 0.25);
            _v.set(Math.sin(rider.th) * side, 0, -Math.cos(rider.th) * side).multiplyScalar(2.5 + Math.random() * 3.5 * rider.skid)
              .addScaledVector(pose.fwd, -rider.v * 0.25).add(_cv.set(0, 1.4 + Math.random() * 2.2, 0));
            emit(_p, _v, 1, 0.9);
          }
        } else fanAcc = 0;
      } else acc = 0;
      for (let i = 0; i < SPRAY_N; i++) {
        if (life[i] <= 0) { if (life[i] > -1) { pos[i * 3 + 1] = -50; life[i] = -1; } continue; }
        life[i] -= dt;
        vel[i * 3 + 1] -= 9.8 * dt;
        const k = Math.exp(-dt * 1.2);
        vel[i * 3] *= k; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
})();

// ---------- wake: a trail of white water behind the board that sits on the surface, drifts with the wave and fades
const WAKE_N = 900;
const wake = (() => {
  const pos = new Float32Array(WAKE_N * 3), a = new Float32Array(WAKE_N), life = new Float32Array(WAKE_N), sz = new Float32Array(WAKE_N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(a, 1)); g.setAttribute('aS', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 1 }, uMax: { value: 8 } },
    vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float uScale; uniform float uMax; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = min(aS * uScale / -mv.z, uMax); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.; if (r > 1.) discard; gl_FragColor = vec4(vec3(.96, .95, .93), vA * (1. - r) * .7); }',
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  let next = 0, acc = 0, frame = 0;
  for (let i = 0; i < WAKE_N; i++) pos[i * 3 + 1] = -99;
  const _p = new THREE.Vector3();
  return {
    update(dt) {
      m.uniforms.uScale.value = renderer.domElement.height * 0.9; m.uniforms.uMax.value = 7 * renderer.getPixelRatio();   // flecks, never blobs
      if (rider && rider.standing && rider.y > -1) {
        // lay foam at the fins as fast as the board moves, a little wider when carving
        acc += (40 + rider.v * 9) * dt;
        while (acc >= 1) {
          acc--; const i = next; next = (next + 1) % WAKE_N;
          _p.copy(rig.position).addScaledVector(pose.fwd, -0.7 - Math.random() * 0.2);
          const side = (Math.random() - .5) * (0.25 + Math.abs(rider.turn) * 0.25);
          pos[i * 3] = _p.x - Math.sin(rider.th) * side; pos[i * 3 + 1] = _p.y; pos[i * 3 + 2] = _p.z + Math.cos(rider.th) * side;
          life[i] = 0.6 + Math.random() * 0.4; sz[i] = 0.06 + Math.random() * 0.06 + rider.skid * 0.08;
        }
      }
      // age, drift shoreward with the wave's water, stay on the surface (heights refreshed every other frame)
      frame++;
      for (let i = 0; i < WAKE_N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt / 2.2; a[i] = Math.max(0, life[i]); sz[i] *= 1 + dt * 0.5;
        if (life[i] <= 0) { pos[i * 3 + 1] = -99; continue; }
        pos[i * 3 + 2] += 1.2 * dt;
        if ((i + frame) % 2 === 0) pos[i * 3 + 1] = heightAt(waves, pos[i * 3], pos[i * 3 + 2]) + 0.03;
      }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; g.attributes.aS.needsUpdate = true;
    },
  };
})();

// ---------- wipeout: the rider is thrown off, goes under, comes back up; the board tumbles away on its own
const W = { on: false, bv: new THREE.Vector3(), bw: new THREE.Vector3(), rv: new THREE.Vector3(), rw: new THREE.Vector3(), under: 0 };
const _e = new THREE.Euler(), _dq = new THREE.Quaternion();
function startWipe() {
  W.on = true; W.t = 0; W.under = 0; W.cam = null;
  const v = rider.v, lip = /lip|falls|closed|whitewater|broke/i.test(rider.why);
  // body: carried by its own speed, pitched forward; the lip throws you down toward the flats
  surfer.getWorldPosition(W.bp = new THREE.Vector3()); surfer.getWorldQuaternion(W.bq = new THREE.Quaternion());
  scene.attach(surfer);
  W.rv.copy(pose.fwd).multiplyScalar(v * 0.75).add(new THREE.Vector3(0, lip ? -1 : 2.2, lip ? 3.5 : 1.2));
  W.rw.set((Math.random() - .5) * 3, (Math.random() - .5) * 2, lip ? -6 : -3.5);
  // board: skips off along its line, spinning
  W.bv.copy(pose.fwd).multiplyScalar(v * 0.9).add(new THREE.Vector3(0, 1 + Math.random(), lip ? 2 : 0.5));
  W.bw.set(Math.random() * 6 - 3, Math.random() * 8 - 4, Math.random() * 10 - 5);
  play('fall', { once: true, fade: 0.08 });
  audio.splash(0.6); W.hit = false; railSpray.burst(rig.position, 90, 2.5);
}
function wipeout(dt) {
  if (!W.on) startWipe();
  W.t += dt;
  for (const [obj, vel, spin, isBody] of [[surfer, W.rv, W.rw, true], [rig, W.bv, W.bw, false]]) {
    const p = obj.position, water = heightAt(waves, p.x, p.z);
    const depth = water - p.y;
    if (depth > 0) {
      // in the water: heavy drag, the broken wave drags you shoreward, buoyancy brings you back up
      vel.multiplyScalar(Math.exp(-dt * (isBody ? 3.5 : 2.5)));
      vel.z += (isBody ? 2.5 : 3.5) * dt; vel.x += 1.2 * dt;
      vel.y += (isBody ? (W.t < 1.4 ? -2 : 6) : 14) * Math.min(1, depth + 0.3) * dt;
      spin.multiplyScalar(Math.exp(-dt * (isBody ? 2 : 3)));
      if (isBody) { W.under += dt; if (!W.hit) { W.hit = true; audio.splash(1.2); railSpray.burst(p, 160, 3.5); } }
    } else vel.y -= 9.8 * dt;
    p.addScaledVector(vel, dt);
    _dq.setFromEuler(_e.set(spin.x * dt, spin.y * dt, spin.z * dt)); obj.quaternion.premultiply(_dq);
    if (isBody && W.t > 1.4) {
      // back at the surface: head up, treading water
      p.y += (water - 1.35 - p.y) * Math.min(1, dt * 3);
      _dq.setFromEuler(_e.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0)); obj.quaternion.slerp(_dq, Math.min(1, dt * 3));
      vel.multiplyScalar(Math.exp(-6.3 * dt)); spin.set(0, 0, 0);
    }
    if (!isBody && depth > -0.05 && W.t > 1.2) { p.y += (water + 0.03 - p.y) * Math.min(1, dt * 4); _dq.setFromEuler(_e.set(0, obj.rotation.y, 0)); obj.quaternion.slerp(_dq, dt * 2); }
  }
  if (W.t > 1.4) play('tread', { fade: 0.4 });
}
function endWipe() { if (surfer) surfer.visible = true; if (!W.on) return; W.on = false; rig.add(surfer); surfer.position.set(0, 0, 0); surfer.quaternion.identity(); }

// ---------- surf stance on top of the clips: feet wide along the board, arms out for balance
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
const bones = {}, _rq = new THREE.Quaternion(), _bf = new THREE.Vector3(), _bs = new THREE.Vector3();
function aimBone(bone, child, target, w) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, target); _q.slerp(_wq.identity(), 1 - w);          // world-space turn toward the target, partly
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
// paddling: alternating crawl strokes. Each arm reaches far forward over the water, digs in and pulls back under the
// board, comes out by the hip and swings forward elbow-high; the other arm half a stroke behind. (The stock clip is a
// breaststroke that keeps both hands under the board, where your own eyes can never see them.)
let paddlePh = 0, paddleW = 0; const _pf = new THREE.Vector3(), _pr = new THREE.Vector3(), _ps = new THREE.Vector3();
function paddleArms(dt) {
  const want = rider.state === 'LIE' && rider.paddling ? 1 : 0;
  paddleW += (want - paddleW) * Math.min(1, dt * 6);
  if (paddleW < 0.02 || rider.standing) return;
  if (!bones.upperarm_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  paddlePh += dt * Math.PI * 2 * 0.75;                              // each arm ~1.3 s a stroke: a pull every ~0.67 s
  _pf.set(Math.cos(rider.th), 0, Math.sin(rider.th)); _pr.set(-_pf.z, 0, _pf.x);
  for (const [sd, off] of [['l', 0], ['r', Math.PI]]) {
    const ua = bones['upperarm_' + sd], la = bones['lowerarm_' + sd], hd = bones['hand_' + sd];
    if (!ua || !la || !hd) continue;
    ua.getWorldPosition(_ps); const side = Math.sign(_ps.sub(rig.position).dot(_pr)) || 1;
    const a = -paddlePh + off, c = Math.cos(a), sn = Math.sin(a);   // 0 reach, -pi/2 pull, -pi out by the hip, -3pi/2 recovery
    _t.copy(_pf).multiplyScalar(0.3 + 0.7 * c).addScaledVector(WORLD_UP, sn > 0 ? 0.55 * sn : 0.95 * sn).addScaledVector(_pr, side * (0.3 + 0.3 * Math.max(0, sn))).normalize();
    aimBone(ua, la, _t, 0.9 * paddleW); aimBone(la, hd, _t, 0.8 * paddleW);
  }
}
// two-bone arm reach: put the hand on T (or as close as the arm allows), elbow bending toward the pole direction
const _ik1 = new THREE.Vector3(), _ik2 = new THREE.Vector3(), _ik3 = new THREE.Vector3(), _ik4 = new THREE.Vector3();
function reachArm(ua, la, hd, T, pole, w) {
  ua.getWorldPosition(_ik1); la.getWorldPosition(_ik2); hd.getWorldPosition(_ik3);
  const a = _ik1.distanceTo(_ik2), b = _ik2.distanceTo(_ik3);
  const toT = _ik4.subVectors(T, _ik1); let d = toT.length(); d = Math.min(Math.max(d, Math.abs(a - b) + 0.01), (a + b) * 0.94); toT.normalize();   // a soft bend always stays in the elbow (a locked-straight arm looks wrong)
  // elbow: along the reach by a*cos, out toward the pole by a*sin (law of cosines)
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const pp = _ik2.copy(pole).addScaledVector(toT, -pole.dot(toT)).normalize();
  const elbow = _ik3.copy(_ik1).addScaledVector(toT, a * ca).addScaledVector(pp, a * sa);
  // set both bones' full orientation (not just their aim), so the elbow is a true hinge: this rig's bones run along
  // their local +Y and the elbow folds the forearm toward the upper arm's local +Z. Aiming alone left the arm's roll to
  // chance, and the elbow crease could face in (it read as a twisted, inward elbow). Here the elbow point faces the pole.
  const Y = _hY.subVectors(elbow, _ik1).normalize();
  const tgt = _hT.copy(_ik1).addScaledVector(toT, d), f = _hF.subVectors(tgt, elbow).normalize();
  const Z = _hZ.copy(f).addScaledVector(Y, -f.dot(Y)); if (Z.lengthSq() < 1e-6) Z.copy(pp).negate(); Z.normalize();
  const X = _hX.crossVectors(Y, Z).normalize();
  setWorldBasis(ua, X, Y, Z, w);
  const Z2 = _hZ.crossVectors(X, f).normalize();
  setWorldBasis(la, X, f, Z2, w);
  hd.quaternion.slerp(_hQ.identity(), 0.8 * w); hd.updateMatrixWorld(true);   // wrist in line with the forearm, relaxed (the clip's wrist bend on a re-posed arm reads as a flexed-back 'stop' hand)
  // then roll the hand about its own length so the palm faces the water (this rig's palm is the hand's local +X on the
  // left, -X on the right), relaxed a little inward
  hd.getWorldQuaternion(_hQ);
  const ay = _hY.set(0, 1, 0).applyQuaternion(_hQ), palm = _hX.set(hd.name.endsWith('_l') ? 1 : -1, 0, 0).applyQuaternion(_hQ);
  const want = _hZ.set(0, -1, 0).addScaledVector(ay, ay.y); if (want.lengthSq() > 1e-4) {
    want.normalize(); palm.addScaledVector(ay, -palm.dot(ay)).normalize();
    const ang = Math.atan2(_hF.crossVectors(palm, want).dot(ay), palm.dot(want));
    hd.quaternion.multiply(_hP.setFromAxisAngle(_hT.set(0, 1, 0), ang * 0.85 * w)); hd.updateMatrixWorld(true);
  }
  // fingers relaxed and open (the clip curls them into a fist)
  hd.traverse((f) => { if (f !== hd && f.isBone) f.quaternion.slerp(_hQ.identity(), 0.75 * w); });
}
const _hX = new THREE.Vector3(), _hY = new THREE.Vector3(), _hZ = new THREE.Vector3(), _hF = new THREE.Vector3(), _hT = new THREE.Vector3(), _hM = new THREE.Matrix4(), _hQ = new THREE.Quaternion(), _hP = new THREE.Quaternion();
function setWorldBasis(bone, X, Y, Z, w) {
  _hQ.setFromRotationMatrix(_hM.makeBasis(X, Y, Z));
  bone.parent.getWorldQuaternion(_hP); _hQ.premultiply(_hP.invert());
  bone.quaternion.slerp(_hQ, w); bone.updateMatrixWorld(true);
}
// swing a leg sideways (about the axis the rider faces) so its foot moves toward sgn * board-forward; keeps the knee bend
const _ax = new THREE.Vector3();
function swingBone(bone, end, sgn, ang) {
  _ax.crossVectors(bodyUp, bodyFwd).normalize();
  bone.getWorldPosition(_a); end.getWorldPosition(_b); _d.subVectors(_b, _a);
  const dir = Math.sign(_t.crossVectors(_ax, _d).dot(bodyFwd) * sgn) || 1;
  _q.setFromAxisAngle(_ax, ang * dir);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
let stanceW = 0, pumpC = 0, sitting = false, sitTilt = 0;
const rigQ = new THREE.Quaternion();
function straddle() {
  // the sit clip is a chair pose (thighs forward); on a board the thighs go down either side and the shins hang in the water
  if (!bones.thigh_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  rig.getWorldQuaternion(_rq); _bf.set(0, 0, 1).applyQuaternion(_rq); _bs.set(1, 0, 0).applyQuaternion(_rq);
  for (const [s, sg] of [['l', 1], ['r', -1]]) {
    const side = bones['thigh_' + s].getWorldPosition(_a).sub(rig.getWorldPosition(_b)).dot(_bs) > 0 ? 1 : -1;
    // thighs forward and down either side of the rails (your knees are what you see below you), shins hanging
    _t.set(0, -0.3, 0).addScaledVector(_bs, side * 0.32).addScaledVector(_bf, 1.1).normalize();   // thighs along the rails, knees at the rail edge
    aimBone(bones['thigh_' + s], bones['calf_' + s], _t, 0.9);
    _t.set(0, -1, 0).addScaledVector(_bf, 0.1).addScaledVector(_bs, side * 0.1).normalize();
    aimBone(bones['calf_' + s], bones['foot_' + s], _t, 0.8);
  }
  // hands resting on the deck in front of you, either side of the stringer: from your own eyes you see your
  // knees, your hands and the board you're sitting on (without them the board looks like it floats away from you)
  bones.pelvis.getWorldPosition(_sp);
  const deckY = rig.getWorldPosition(_b).y + 0.07;
  for (const s of ['l', 'r']) {
    const ua = bones['upperarm_' + s], side = ua.getWorldPosition(_a).sub(_b).dot(_bs) > 0 ? 1 : -1;
    _sT.copy(_sp).addScaledVector(_bf, 0.85).addScaledVector(_bs, side * 0.2); _sT.y = deckY;   // hands on the rails just ahead of your knees
    reachArm(ua, bones['lowerarm_' + s], bones['hand_' + s], _sT, _t.set(0, 0, 0).addScaledVector(_bs, side).addScaledVector(_bf, -0.3), 0.9);
  }
}
const _sp = new THREE.Vector3(), _sT = new THREE.Vector3();
// turn a bone about a world axis (keeps everything below it attached)
function turnBone(bone, axis, ang) {
  if (!bone || Math.abs(ang) < 1e-4) return;
  _q.setFromAxisAngle(axis, ang);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
const _in = new THREE.Vector3(), _fw = new THREE.Vector3();
let bodyT = 0, gLoad = 0; const STOOP = 0.25; const ARM = { ff: 0.62, fd: 0.32, bf: 0.5, bd: 0.4 };   // hand targets ahead of / below the eyes (front hand, back hand), vetted in first-person
const _af = new THREE.Vector3(), _ar = new THREE.Vector3(), _ah = new THREE.Vector3(), _ap = new THREE.Vector3(), _aq = new THREE.Vector3(); const _sideAx = new THREE.Vector3();
function surfStance() {
  if (sitting) straddle();
  const st = rider.state, want = st === 'RIDE' ? 1 : st === 'POP' ? Math.min(1, rider.stateT / 0.45) : 0;
  stanceW += (want - stanceW) * (1 - Math.exp(-13 * dtArm));
  if ((stanceW < 0.02 && st !== 'POP') || (st === 'WIPE' && W.on)) return;   // (never pose a body that's been thrown off)
  if (!bones.thigh_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  bodyT += dtArm;
  // which way along the board each side of the body sits
  bones.thigh_l.getWorldPosition(_a); bones.thigh_r.getWorldPosition(_b);
  const side = Math.sign(_d.subVectors(_a, _b).dot(bodyFwd)) || 1;
  const w = stanceW, deep = rider.inBarrel ? 1 : 0;
  // how hard the turn is loading the legs (sideways g), smoothed; which way is the inside of the turn
  gLoad += (Math.min(1.4, Math.abs(rider.turn) * rider.v / 9.8) - gLoad) * (1 - Math.exp(-10 * dtArm));
  const leanN = Math.max(-1, Math.min(1, rider.lean / RIDE.leanMax));
  _in.crossVectors(bodyFwd, bodyUp).normalize().multiplyScalar(Math.sign(leanN) || 1);   // toward the inside of the carve (forward x up = your right; +lean turns right)
  for (const [s, sgn] of [['l', side], ['r', -side]]) {
    // legs: feet about shoulder-and-a-half apart, front foot toward the nose
    swingBone(bones['thigh_' + s], bones['foot_' + s], sgn, (0.36 + 0.06 * deep) * w);
  }
  // upper body: shoulders twist into the turn and the chest bends toward the inside; a slow balance sway on top
  const twist = (leanN * 0.45 + Math.sin(bodyT * 1.1) * 0.05) * w;
  turnBone(bones.spine_02, bodyUp, twist * 0.5); turnBone(bones.spine_03, bodyUp, twist * 0.5);
  _fw.copy(bodyFwd);
  turnBone(bones.spine_01, _fw, -leanN * 0.18 * w * side);
  // an athletic stance: chest a little forward over the knees, not standing up straight
  _sideAx.crossVectors(bodyFwd, bodyUp).normalize(); turnBone(bones.spine_02, _sideAx, STOOP * w);
  // head: look ahead along your line (surfers always look where they're going)
  turnBone(bones.head, bodyUp, side * 0.55 * w - twist * 0.6);
  // arms last (after the torso has twisted and leaned), from surf-coaching descriptions of each moment, measured from
  // your eyes (F = where you look, R = right, "wave" = toward the face). Frontside = chest to the wave.
  //   trim:        front hand low and ahead over the rail, palm down, pointing where you go; back hand low by the hip
  //   bottom turn: frontside the front arm reaches to the lip and the inside (back) hand drops to the water;
  //                backside the front hand drops to the water as the pivot
  //   top turn / cutback: the front arm leads round and points down the face, the back arm comes across low
  //   stall:       the trailing hand drags in the face;  barrel: compact, front hand toward the wall
  //   pop-up:      hands flat on the deck under your shoulders, then the front arm opens forward and low
  // arms never go above the shoulders, and they lead the board: the lean you ask for (not the board's heading) drives them
  const F = _af.set(Math.cos(pov.yaw), 0, Math.sin(pov.yaw)), R = _ar.set(-F.z, 0, F.x);
  // which side the wave is on, with a dead band: heading straight at the beach or the wave it would flip every frame
  { const d = INTO_WAVE.dot(R); if (Math.abs(d) > 0.25) waveSide = Math.sign(d); }
  const ws = waveSide, stallK = Math.min(1, (rider.stalling || 0) * 1.3);
  const popK = st === 'POP' ? 1 : st === 'RIDE' ? Math.max(0, 1 - rider.stateT / 0.5) : 0;
  // frontside or backside: which way your chest faces
  bones.upperarm_l.getWorldPosition(_ik1); bones.upperarm_r.getWorldPosition(_ik2);
  const chest = _cv.crossVectors(WORLD_UP, _ik3.subVectors(_ik2, _ik1)).dot(INTO_WAVE) > 0 ? 1 : 0;   // up x (right - left shoulder) = chest
  const leanW = Math.abs(leanN) * (Math.sign(_in.dot(R) * ws) || 0);   // + = leaning toward the wave (bottom turn), - = away (top turn / cutback)
  const bt = Math.max(0, leanW), tt = Math.max(0, -leanW), pumpUp = rider.pumping ? Math.sin(bodyT * 6.5) * 0.06 : 0;
  // your eyes this frame (the camera itself is placed after the pose, a frame behind: at 10 m/s that's 17 cm)
  const eye = bones.head.getWorldPosition(_eyeA).addScaledVector(F, POVCAM.fwd).addScaledVector(WORLD_UP, POVCAM.up);
  // a target in eye space: f forward, d down, x toward the wave (negative = open side)
  const at = (out, f, d, x) => out.copy(eye).addScaledVector(F, f).addScaledVector(WORLD_UP, -d).addScaledVector(R, x * ws);
  // the front arm is whichever shoulder is further ahead along your line (worked out, not assumed from the stance)
  const frontArm = _cv.subVectors(_ik1, eye).dot(F) > _ik4.subVectors(_ik2, eye).dot(F) ? 'l' : 'r';
  for (const s of ['l', 'r']) {
    const front = s === frontArm, sway = Math.sin(bodyT * 1.7 + (front ? 0 : 1.3)) * 0.03;
    const P = _ap;
    if (front) {
      at(P, chest ? 0.5 : 0.46, (chest ? 0.5 : 0.48) - sway - pumpUp, chest ? 0.36 : -0.36);   // out over the rail, beside the board                       // trim
      if (bt) P.lerp(chest ? at(_aq, 0.6, 0.26, 0.26) : at(_aq, 0.45, 0.7, 0.34), bt);                               // bottom turn
      if (tt) P.lerp(at(_aq, 0.55, 0.5, -0.32), tt);                                                                  // top turn / cutback: leads round, points down the face
      if (deep) P.lerp(chest ? at(_aq, 0.48, 0.55, 0.48) : at(_aq, 0.38, 0.7, -0.4), deep);                           // barrel (backside pigdog: low, grabbing the outside rail)
    } else {
      at(P, -0.22, 0.62 - sway, -0.25);                                                                                // trim: by the back hip
      if (bt) P.lerp(chest ? at(_aq, -0.08, 0.92, 0.35) : at(_aq, -0.2, 0.62, -0.25), bt);
      if (tt) P.lerp(at(_aq, 0.3, 0.75, -0.15), tt);                                                                  // comes across low
      if (deep) P.lerp(chest ? at(_aq, -0.15, 0.7, 0.2) : at(_aq, -0.3, 0.6, 0.4), deep);                             // barrel (backside: trailing arm along the face)
    }
    // a hand never reaches across your body (a whole arm across the view reads as broken): if its pose asks for the
    // other side, it goes to its own side instead; in a stall the drag is done by the hand on the wave side
    bones['upperarm_' + s].getWorldPosition(_ik4);
    if (stallK) { if ((chest ? !front : front)) P.lerp(at(_aq, 0.55, 0.62, 0.46), stallK); else P.lerp(at(_aq, -0.15, 0.6, -0.3), stallK); }   // frontside the back hand drags, backside the front hand; ahead enough to see it trail through the face
    // pop-up: flat on the deck under your shoulders, beside your ribs
    // pop-up: hands flat on the deck either side of the stringer, just ahead of your chest (placed on the board itself)
    if (popK > 0) { const sideSign = Math.sign(_cv.subVectors(bones['upperarm_' + s].getWorldPosition(_ik4), bones.spine_03.getWorldPosition(_ik1)).dot(_ik2.set(1, 0, 0).applyQuaternion(rig.quaternion))) || 1;
      P.lerp(rig.localToWorld(_aq.set(0.17 * sideSign, 0.1, 0.35)), popK); }
    // smooth each hand's path (the pose blends above can jump between frames when the lean changes side)
    // (smoothed relative to your eyes: smoothing in the world would leave the hands trailing behind you at speed)
    const sm = armSm[s]; P.sub(eye); if (!sm.ok || snapCam) { sm.p.copy(P); sm.ok = true; } else sm.p.lerp(P, Math.min(1, dtArm * 14)); P.copy(sm.p).add(eye);
    // never into the lens
    const cd = P.distanceTo(eye); if (cd < 0.45) P.addScaledVector(F, 0.45 - cd);
    const ua = bones['upperarm_' + s], la = bones['lowerarm_' + s], hd = bones['hand_' + s], cl = bones['clavicle_' + s];
    // the shoulder follows the reach (collarbone rolls forward/down toward the hand), so the upper arm doesn't have to
    // twist to an extreme angle and stretch the skin at the shoulder into a fin
    if (cl) { cl.getWorldPosition(_ik1); aimBone(cl, ua, _ik3.subVectors(P, _ik1).normalize(), 0.8 * w); }
    // elbows flare OUT, away from your body (and a little down): from the chest through this shoulder is 'out'
    ua.getWorldPosition(_ik1); bones.spine_03.getWorldPosition(_ik2);
    const outv = _ik3.subVectors(_ik1, _ik2); outv.y = 0; outv.normalize();
    reachArm(ua, la, hd, P, _aq.copy(outv).multiplyScalar(0.85).addScaledVector(WORLD_UP, -0.5), st === 'POP' ? 0.95 : 0.92 * w);
  }
}
let waveSide = -1; const _eyeA = new THREE.Vector3(); const armSm = { l: { p: new THREE.Vector3(), ok: false }, r: { p: new THREE.Vector3(), ok: false } }, _hq = new THREE.Quaternion();
let dtArm = 1 / 60;

// ---------- HUD + end of ride
const setText = (el, t) => { if (el && el._t !== t) { el._t = t; el.textContent = t; } };   // only touch the page when the text changes
let endT = -1, snapCam = true;
function updateHUD(dt) {
  const st = rider.state;
  setText(ui.speed, rider.standing ? `${Math.round(rider.v * 3.6)} km/h` : '');
  if (mode === 'random') setText(ui.cond, rider.wave && rider.standing ? `Random: ${rider.wave.cond.name.toLowerCase()} wave` : 'Random');
  ui.paddle.style.visibility = st === 'WIPE' || st === 'OUT' ? 'hidden' : 'visible';
  const lbl = rider.standing ? 'PUMP' : 'PADDLE'; if (ui.paddle.textContent !== lbl) ui.paddle.textContent = lbl;
  // coaching for the first few waves: read the sea like a surfer would
  let hint = '';
  if (st === 'LIE') {
    const inc = incoming(), facingIn = Math.sin(rider.th) > 0.5;
    const onWave = rider.y > 0.3 && rider.onFace;
    if (rider.washed) hint = 'Caught inside! Hold on, paddle back out';
    else if (onWave) hint = rider.paddling ? 'Keep paddling!' : 'Paddle now!';
    else if (inc.w && inc.t < 7 && inc.t > -0.5) hint = !facingIn ? 'Wave coming: turn to face the beach' : inc.t < 2.5 ? 'Paddle hard!' : 'Wave coming... get ready';
    else if (session.waves < 2 && inc.t >= 7) hint = 'Watch the horizon for the next set';
    else if (rider.z > 12) hint = 'Too far in: paddle back out past the break';
  } else if (st === 'POP') hint = session.waves < 5 ? 'Up! Go LEFT along the wave, hold PUMP for speed' : 'Up!';
  else if (st === 'RIDE' && rider.inBarrel && (rider.foamT || 0) > 0.4) hint = 'Too deep! PUMP and steer up the face to get out';
  else if (st === 'RIDE' && rider.stateT < 7.5 && session.waves < 3) hint = rider.stateT < 2.5 ? 'Slide your thumb left and right to carve, like a steering wheel' : rider.stateT < 5 ? 'Hold PUMP for speed, STALL to brake and let the barrel catch you' : 'Let go and the board just glides straight';
  else if (st === 'RIDE' && rider.stateT > 8 && rider.stateT < 12 && session.waves < 5 && !rider.ride.cutbacks) hint = 'Cutback: keep turning right till you face the breaking wave, then turn back';
  setText(ui.hint, session.waves < 5 || st === 'POP' ? hint : '');
  // the callout: BARREL while you're in it, or the move you just landed
  const call = st !== 'RIDE' ? '' : rider.inBarrel ? 'BARREL' : rider.trick ? rider.trick.name : '';
  if (call) setText(ui.tube, call);
  ui.tube.style.opacity = call ? 1 : 0;
  setText(ui.score, st === 'RIDE' ? rider.liveScore().toFixed(1) : '');
  if ((st === 'WIPE' || st === 'OUT') && endT < 0) {
    endT = 0;
    const r = rider.ride;
    const prevBest = bestFor(mode), newBest = r.t > 0 && r.score > prevBest && prevBest > 0;
    if (r.t > 0 && r.score > prevBest) saveBest(mode, r.score);
    if (r.t > 0 || st === 'WIPE') { session.waves++; session.total += r.score; session.best = Math.max(session.best, r.score); session.scores.push(r.score); }
    // heat total, like a contest: your best two waves count
    const two = [...session.scores].sort((a, b) => b - a).slice(0, 2), heat = two.reduce((a, b) => a + b, 0);
    ui.msgT.textContent = rider.why;
    ui.msgN.innerHTML = r.t > 0 ? `${r.score.toFixed(1)}${newBest ? '<small>NEW BEST</small>' : ''}` : '';
    const stat = (v, l) => `<div>${v}<span>${l}</span></div>`;
    ui.msgS.innerHTML = r.t > 0 ? stat(`${r.t.toFixed(1)}s`, 'RIDE') + stat(`${Math.round(r.top)}`, 'TOP KM/H') + stat(r.turns, 'TURNS') + (r.cutbacks ? stat(r.cutbacks, r.cutbacks > 1 ? 'CUTBACKS' : 'CUTBACK') : '') + (r.snaps ? stat(r.snaps, r.snaps > 1 ? 'SNAPS' : 'SNAP') : '') + (r.barrel > 0.2 ? stat(`${r.barrel.toFixed(1)}s`, 'BARREL') : '') : '';
    ui.sess.textContent = session.waves ? `Heat ${heat.toFixed(2)} / 20 ${session.waves > 1 ? `(your best two of ${session.waves} waves)` : '(your best two waves count)'}  ·  best wave ever ${Math.max(bestFor(mode), r.score).toFixed(1)}` : '';
  }
  // a wipeout plays out first (you see yourself go over), then the summary fades in
  if (endT >= 0) {
    endT += dt;
    const showAt = st === 'WIPE' ? 1.4 : 0.2;
    if (endT >= showAt && ui.msg.style.display !== 'flex') { ui.msg.style.opacity = 0; ui.msg.style.display = 'flex'; requestAnimationFrame(() => (ui.msg.style.opacity = 1)); }
    if (endT > showAt + (st === 'WIPE' ? 3.4 : 2.6)) spawnRider();
  }
}

// ---------- automatic quality
let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0, refFps = 30;
function autoQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  fit();
  // compare against what this screen can actually do (60, 120, or 30 in iPhone Low Power Mode), not a fixed number
  refFps = Math.max(Math.min(fps, 125), refFps - 2);
  if (fps < refFps * 0.82) { lowT++; highT = 0; } else if (fps > refFps * 0.95) { highT++; lowT = 0; }
  if (lowT >= 2 && pr > 0.75) { pr = Math.max(0.75, pr - 0.15); renderer.setPixelRatio(pr); lowT = 0; }
  if (highT >= 6 && pr < MAX_PR) { pr = Math.min(MAX_PR, pr + 0.1); renderer.setPixelRatio(pr); highT = 0; }
  if (Q.has('debug')) document.getElementById('fps').textContent = `${Math.round(fps)} fps · pr ${pr.toFixed(2)}`;
}

// ---------- loop
const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)');
let last = performance.now(), T = 0, strokeT = 0, lastState = '', lastTrick = null, crashT = 1, lastPump = false;
function tick(dt) {
  T += dt;
  ENV.uTime.value += dt;
  const inp = readInput(dt);
  // (in the barrel view the camera looks back at you, so left/right are flipped to match the screen)
  if (rider && rider.standing && input.test == null) {
    // (scripted checks drive a virtual stick: y down = STALL held, y up = PUMP held)
    const stallOn = !!input.stallBtn || keys.has('ArrowDown') || !!(input.stick && input.stick.y > 0.5);
    const pumpOn = inp.pump || !!(input.stick && input.stick.y < -0.3);
    const o = surfSteer(tubeK > 0.5 ? -inp.steer : inp.steer, stallOn);
    inp.steer = o.steer; inp.pump = pumpOn; inp.stall = o.stall;
  }
  if (rider) {
    updateWaves(dt);
    rider.update(dt, inp, waves);
    // drifting too far inside or out wide on a lie: bring the surfer back to the lineup
    if (rider.state === 'LIE' && (rider.z > 40 || Math.abs(rider.x - 5) > 70 || rider.z < -60)) { rider.out('Drifted out of the lineup'); }
    updateRig(dt, T);
    if (mixer) { mixer.update(dt); paddleArms(dt); dtArm = dt; surfStance(); }
    updateLeash(); updateScenery(dt); updateLocals(dt);
    railSpray.update(dt);
    wake.update(dt);
    updateCamera(dt);
    updateHUD(dt);
    // sound follows what's happening: the breaking wave is loud near the curl
    const st = rider.state, w = rider.wave;
    let near = 0;
    for (const v of waves) { const s = rider.x - v.peelX, zl = rider.z - v.zW; if (zl > -20 && zl < 25) near = Math.max(near, Math.max(0, 1 - Math.hypot(s < 0 ? s * 0.4 : s, zl) / (7 * v.cond.H))); }
    let underwater = false;
    if (st === 'WIPE' && W.on && surfer) { const b = surfer.position; underwater = W.t < 1.4 && b.y < heightAt(waves, b.x, b.z) - 0.2; }
    audio.update({ H: w ? w.cond.H : 1.5, near, barrel: rider.inBarrel && st === 'RIDE', riding: rider.standing, v: rider.v, turn: rider.turn, lean: rider.lean, slide: Math.max(rider.skid, (rider.slide || 0) * 2.5), stall: !!(inp.stall), dt, chop: ENV.weather ? ENV.weather.chop : 1, storm: ENV.weather ? ENV.weather.chop / 2.4 : 0, rain: ENV.weather ? ENV.weather.rain : 0, underwater });
    // the nearest breaking wave thumps each time a new stretch of lip lands (every second or two, faster in big surf)
    crashT -= dt;
    if (crashT <= 0) {
      let best = null, bd = 1e9;
      for (const v of waves) { if (v.peelX < -5) continue; const lx = v.peelX - 1.5 * v.cond.H, lz = v.zW + 1.5 * v.cond.H; const d = Math.hypot(rider.x - lx, rider.z - lz); if (d < bd) { bd = d; best = v; } }
      if (best) audio.crash(best.cond.H * (best.size || 1), bd);
      crashT = 1.1 + Math.random() * 0.9 - (best ? best.cond.H * 0.1 : 0);
    }
    if (st === 'LIE' && rider.paddling) { strokeT -= dt * 1.6; if (strokeT <= 0) { strokeT = 0.55; audio.paddle(); } }
    if (st !== lastState) {
      if (st === 'POP') audio.splash(0.35);
      lastState = st;
    }
    // a snap or cutback rips spray off the rail: a sharp tearing hiss
    if (rider.trick && rider.trick !== lastTrick) { audio.burst(0.3, 3200, 0.45, 'highpass'); audio.burst(0.2, 1300, 0.35); }
    lastTrick = rider.trick;
    const pumpNow = !!(rider.standing && st === 'RIDE' && inp.pump); if (pumpNow && !lastPump) audio.pump(); lastPump = pumpNow;

    sunLight.position.copy(camera.position).addScaledVector(ENV.uSun.value, 30); sunLight.target.position.copy(camera.position);
  } else {
    // behind the start screen: a slow drift along a peeling wave
    if (!tick.demo) { tick.demo = new Wave(scene, CONDITIONS.medium); tick.demo.peelX = -30; }
    tick.demo.update(dt);
    railSpray.update(dt); wake.update(dt);   // (let any spray left from the last ride fall and fade)
    rig.visible = false; leash.visible = false; jukung.visible = false; for (const L of locals) L.grp.visible = false; for (const b of birds) b.visible = false;   // the menu shows only the sea
    const px = tick.demo.peelX;
    camera.position.set(px + 14, 2.2, 13); camera.lookAt(px - 2, 1.2, 0);
  }
  if (rider && tick.demo) { tick.demo.dispose(scene); tick.demo = null; }
  fx.update(dt, camera.position);
}
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!(window.__g && window.__g.paused) && !portrait.matches) tick(dt);   // turned upright: the game waits
  renderer.render(scene, camera); autoQuality(dt);
});
window.__g = { paused: false, cutaway, CUT, audio, renderer, scene, camera, rig, get surfer() { return surfer; }, get rider() { return rider; }, get waves() { return waves; }, incoming, input, keys, setMode: (m) => { mode = m; setWeather(m); ui.cond.textContent = m === 'random' ? 'Random' : CONDITIONS[m].name; for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 15; updateWaves(0); }, step: (sec, dt = 1 / 30, draw = true) => { for (let t = 0; t < sec; t += dt) tick(dt); if (draw) renderer.render(scene, camera); }, spawnRider, get T() { return T; }, want: () => _want };
