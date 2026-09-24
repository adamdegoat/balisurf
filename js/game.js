// Bali surf: session loop, controls, camera, surfer model, HUD, automatic quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Wave, CONDITIONS, skyDome, ocean, setWeather, WeatherFX, ENV } from './wave.js?v=16';
import { Rider } from './surf.js?v=18';
import { makeBoard } from './board.js?v=1';
import { SurfAudio } from './audio.js?v=1';

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
// keep roughly 80-85 degrees across the screen whatever the shape, so a wide phone doesn't push everything into the distance
const fitFov = () => { camera.aspect = innerWidth / innerHeight; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(39)) / Math.min(camera.aspect, 1.9))); camera.updateProjectionMatrix(); };
fitFov();
skyDome(scene); ocean(scene);
const fx = new WeatherFX(scene);
const audio = new SurfAudio();
fx.onFlash = () => audio.thunder(Math.random());
addEventListener('visibilitychange', () => audio.pause(document.hidden));
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a4a48, 1.3); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff0dd, 2.0); scene.add(sunLight); scene.add(sunLight.target);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fitFov(); });

// ---------- surfer on a board
const rig = new THREE.Group(); scene.add(rig);           // board frame: +z along the board, +y out of the deck
const board = makeBoard(); rig.add(board);
let surfer = null, mixer = null, clips = {}, curClip = null;
const ready = new Promise((res) => new GLTFLoader().load('surfer.glb?v=1', (g) => {
  surfer = g.scene; rig.add(surfer);
  surfer.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material.name === 'hair') o.material.side = THREE.DoubleSide; } });
  mixer = new THREE.AnimationMixer(surfer);
  for (const c of g.animations) { c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale')); clips[c.name] = mixer.clipAction(c); }
  res();
}));
function play(name, { fade = 0.25, once = false, speed = 1, weight = 1 } = {}) {
  const a = clips[name]; if (!a) return;
  a.timeScale = speed; a.weight = weight;
  if (curClip === a) return;
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = true;
  if (curClip) a.crossFadeFrom(curClip, fade, false);
  a.play(); curClip = a;
}

// ---------- session: pick conditions, one wave at a time
let mode = null, wave = null, rider = null, session = { waves: 0, total: 0, best: 0 };
function condFor(m) { return m === 'random' ? ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] : m; }
function newWave() {
  if (wave) { scene.remove(wave.mesh); scene.remove(wave.spray); }
  if (surfer) endWipe();
  const c = condFor(mode);
  wave = new Wave(scene, CONDITIONS[c]); wave.seed = Math.random() * 100;
  rider = new Rider(wave);
  // time the peak so it reaches roughly where you are (you can paddle sideways to line it up better)
  // you arrive a few metres ahead of the peak (in the pocket zone), with some variety; paddling along the line fixes it
  rider.zRel = wave.cond.speed * 6;                                   // about 6 s before the wave reaches you
  // Where you meet the wave depends on how long you paddle (paddling in means meeting it later, further along the peel).
  // Aim so that paddling for the last ~2.5 s puts you about 5 m ahead of the peak; earlier drifts inside, later onto the shoulder.
  const T = (rider.zRel + 4.2) / wave.cond.speed;
  // plus the peel keeps coming while the wave lifts you (about 0.6 s), so meet it with room to spare
  wave.peelX = -wave.cond.peel * T - (1.5 * wave.cond.H + 0.6 * wave.cond.peel + 1.8 + Math.random() * 2);
  faceSea = 1;
  wave.reefEnd = wave.peelX + wave.cond.peel * T + 110 + 30 * wave.cond.H;   // the reef section ends; ride it all the way for a bonus
  wave.mesh.position.x = wave.peelX;
  ui.cond.textContent = wave.cond.name + (mode === 'random' ? ' (random)' : '');
  ui.msg.style.display = 'none';
  endT = -1; snapCam = true;
}

// ---------- controls: PADDLE/PUMP (hold, left) and a thumb pad (right half). Keyboard for testing.
const input = { paddle: false, steer: 0 };
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code));
const ui = {
  paddle: document.getElementById('paddle'), pad: document.getElementById('pad'), guide: document.getElementById('guide'), knob: document.querySelector('#guide b'),
  speed: document.getElementById('speed'), score: document.getElementById('score'), cond: document.getElementById('cond'),
  msg: document.getElementById('msg'), msgT: document.getElementById('msg-t'), msgS: document.getElementById('msg-s'),
  tube: document.getElementById('tube'), hint: document.getElementById('hint'), start: document.getElementById('start'), sess: document.getElementById('sess'),
};
const hold = (el, on, off) => {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); on(e); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); off(e); }, { passive: false });
  el.addEventListener('touchcancel', (e) => { e.preventDefault(); off(e); }, { passive: false });
  el.addEventListener('mousedown', on); addEventListener('mouseup', off);
};
hold(ui.paddle, () => { input.paddleBtn = true; ui.paddle.classList.add('down'); }, () => { input.paddleBtn = false; ui.paddle.classList.remove('down'); });
// thumb pad: touch anywhere on the right half; the spot you first touch is the centre.
// Riding: slide up = climb the face, down = drop. Paddling: slide left/right to angle along the wave.
let padTouch = null, padX = 0, padY = 0;
const PAD_R = 55;
const padMove = (x, y) => { if (!padTouch) return; padX = Math.max(-1, Math.min(1, (x - padTouch.x0) / PAD_R)); padY = Math.max(-1, Math.min(1, (y - padTouch.y0) / PAD_R)); };
ui.pad.addEventListener('touchstart', (e) => { e.preventDefault(); if (padTouch) return; const t = e.changedTouches[0]; padTouch = { id: t.identifier, x0: t.clientX, y0: t.clientY }; padX = padY = 0; }, { passive: false });
ui.pad.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (padTouch && t.identifier === padTouch.id) padMove(t.clientX, t.clientY); }, { passive: false });
const padEnd = (e) => { e.preventDefault(); for (const t of e.changedTouches) if (padTouch && t.identifier === padTouch.id) padTouch = null; };
ui.pad.addEventListener('touchend', padEnd, { passive: false }); ui.pad.addEventListener('touchcancel', padEnd, { passive: false });
ui.pad.addEventListener('mousedown', (e) => { padTouch = { id: 'm', x0: e.clientX, y0: e.clientY }; padX = padY = 0; });
addEventListener('mousemove', (e) => { if (padTouch && padTouch.id === 'm') padMove(e.clientX, e.clientY); });
addEventListener('mouseup', () => { if (padTouch && padTouch.id === 'm') padTouch = null; });
function readInput(dt) {
  if (!padTouch) { padX *= Math.max(0, 1 - dt * 10); padY *= Math.max(0, 1 - dt * 10); }   // let go and the board runs straight
  const lying = !rider || rider.state === 'WAIT' || rider.state === 'PADDLE';
  // keys: up/down (W/S) while riding, left/right (A/D) while paddling
  const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  // internal steer: + = down the face (riding) / toward screen-right (paddling)
  const v = lying ? (kx || padX) : (ky || padY);
  input.steer = input.test != null ? input.test : v;   // input.test: scripted steering for automated checks
  input.paddle = !!input.paddleBtn || keys.has('Space');
  ui.guide.classList.toggle('side', lying); ui.guide.classList.toggle('live', !!padTouch);
  ui.knob.style.transform = lying ? `translateX(${input.steer * 45}px)` : `translateY(${input.steer * 45}px)`;
  return { paddle: input.paddle, pump: input.paddle, steer: -input.steer };   // same button: paddle lying down, pump once standing
}

for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => start(b.dataset.mode));
async function start(m) {
  mode = m; setWeather(m); audio.start(); await ready;
  ui.start.style.display = 'none'; document.body.classList.add('playing');
  document.documentElement.requestFullscreen?.().catch(() => {}); screen.orientation?.lock?.('landscape').catch(() => {});
  session = { waves: 0, total: 0, best: 0 };
  newWave();
}
if (Q.get('mode')) start(Q.get('mode'));

// ---------- camera: in front while you wait for the wave, behind once you're up, tight and low in the barrel
const lookDir = new THREE.Vector3(), _cv = new THREE.Vector3();
let faceSea = 1;                                                     // 1 = sitting up facing the incoming sets, 0 = turned to the beach
const camPos = new THREE.Vector3(0, 2, 10), camLook = new THREE.Vector3(), pose = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3() };
function updateCamera(dt) {
  const p = pose.pos, st = rider.state, H = wave.cond.H;
  let want, look;
  if (st === 'WAIT' || st === 'PADDLE' || (st === 'DONE' && rider.ride.t === 0)) {
    // over your shoulder, looking where you look: out at the sets while you wait, toward the beach once you paddle
    const d = lookDir.set(Math.sin(rider.heading), 0, Math.cos(rider.heading)).applyAxisAngle(WORLD_UP, Math.PI * faceSea);
    want = p.clone().addScaledVector(d, -3.1).add(_cv.set(0.35, 1.25, 0));
    if (rider.lifting && st === 'PADDLE') {
      // take-off: swing out beside you on the face (up the line, a bit toward the beach) and look down the drop
      want = p.clone().add(_cv.set(-2.9, 1.5, 0.8));
      look = p.clone().add(_cv.set(0.9, 0.1, 1.1));
    }
    const wy = rider.face.surfaceY(want.x - wave.peelX, want.z);
    want.y = Math.max(want.y, wy + 0.9);                               // the wave lifts the camera with you
    if (!(rider.lifting && st === 'PADDLE')) look = p.clone().addScaledVector(d, 6).add(_cv.set(0, 0.35, 0));
  } else if (st === 'WIPE') {
    // follow the body from the beach side; never below the water
    const b = surfer ? surfer.getWorldPosition(new THREE.Vector3()) : p;
    const wy = rider.face.surfaceY(b.x + 3 - wave.peelX, b.z + 5);
    want = new THREE.Vector3(b.x + 3, Math.max(wy + 0.8, b.y + 1.3), b.z + 5);
    look = new THREE.Vector3(b.x, Math.max(b.y + (W.t > 1.4 ? 1.3 : 0.4), wy), b.z);
  } else {
    const tube = rider.inBarrel ? 1 : 0;
    const back = 3.6 - 1.6 * tube + 0.06 * rider.v, height = 1.35 - 0.6 * tube;
    // behind your heading, a little out toward the beach so the wall stays in shot
    want = p.clone().addScaledVector(pose.fwd, -back).add(new THREE.Vector3(0, height, 0.9 - 0.5 * tube));
    want.y = Math.max(want.y, 0.35);
    // never inside the water: stay in front of the face, and inside the tube stay behind the curtain and under the ceiling
    // the tube collapses into whitewater behind -4.5H: the camera can't sit back there
    if (want.x - wave.peelX < -4.1 * H) want.x = wave.peelX - 4.1 * H;
    const cs = want.x - wave.peelX, lip = wave.lipAt(cs);
    if (rider.inBarrel || (wave.cond.hollow > 0.5 && cs < -0.5 * H && cs > -4.5 * H && lip[1] < 0.45 * H)) {
      want.z = Math.min(want.z, lip[2] - 0.45);
      want.y = Math.min(Math.max(want.y, p.y + 0.45), 0.62 * H);
    }
    want.y = Math.max(want.y, rider.face.surfaceY(cs, want.z) + 0.3);
    look = p.clone().addScaledVector(pose.fwd, 3).add(new THREE.Vector3(0, 0.6, 0));
    if (tube) look.y = p.y + 0.55;                                     // level gaze down the tube toward the opening
  }
  const k = snapCam ? 1 : Math.min(1, dt * (st === 'RIDE' ? 5 : st === 'WIPE' ? 3.5 : 7));   // lying down the target itself swings round smoothly snapCam = false;
  camPos.lerp(want, k); camLook.lerp(look, k);
  camera.position.copy(camPos);
  if (st === 'WIPE') { const sh = 0.12 * Math.exp(-(W.t || 0) * 2.5); camera.position.add(new THREE.Vector3((Math.random() - .5) * sh, (Math.random() - .5) * sh, 0)); }
  camera.lookAt(camLook);
}

// ---------- surfer pose on the board
const WORLD_UP = new THREE.Vector3(0, 1, 0), INTO_WAVE = new THREE.Vector3(0, 0, -1), tmpM = new THREE.Matrix4(), xAxis = new THREE.Vector3(), bodyUp = new THREE.Vector3(), bodyFwd = new THREE.Vector3(), bodyX = new THREE.Vector3();
const _yq = new THREE.Quaternion(), bodyQ = new THREE.Quaternion(), stanceQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), invQ = new THREE.Quaternion();
// the rider's world orientation (bodyQ, plus side-on stance) expressed in the board's frame
const setStance = () => { invQ.copy(rig.quaternion).invert(); surfer.quaternion.copy(invQ).multiply(bodyQ).multiply(stanceQ); };
function updateRig(dt, t) {
  if (rider.state === 'WIPE' && W.on) { wipeout(dt); return; }
  rider.pose(pose);
  // the board rides on its rail: tilted partway toward the face, not lying flat against a steep wall
  if (rider.state !== 'WAIT' && rider.state !== 'PADDLE') { pose.up.lerp(WORLD_UP, 0.45).normalize(); pose.up.addScaledVector(pose.fwd, -pose.up.dot(pose.fwd)).normalize(); }
  xAxis.crossVectors(pose.up, pose.fwd).normalize();
  const up = new THREE.Vector3().crossVectors(pose.fwd, xAxis).normalize();
  tmpM.makeBasis(xAxis, up, pose.fwd);
  rig.quaternion.setFromRotationMatrix(tmpM);
  rig.position.copy(pose.pos);
  // sitting you face the sea; when you start paddling you swing the board round to the beach
  faceSea += ((rider.state === 'WAIT' || (rider.state === 'DONE' && rider.ride.t === 0) ? 1 : 0) - faceSea) * Math.min(1, dt * 3.5);
  if (faceSea > 0.001) rig.quaternion.premultiply(_yq.setFromAxisAngle(WORLD_UP, Math.PI * faceSea));
  const upright = rider.state === 'POPUP' || rider.state === 'RIDE' || (rider.state === 'WIPE' && rider.stateT < 0.8);
  if (upright) {
    // on a steep wall the board lies on the face, but the rider stays near vertical, leaning into the wave
    const lean = 0.22 + 0.2 * Math.max(0, rider.turn) + (rider.inBarrel ? 0.12 : 0);
    bodyUp.copy(pose.up).addScaledVector(INTO_WAVE, Math.tan(lean * 0.6)).normalize();   // stand on the deck, leaning into the wave
    bodyFwd.set(pose.fwd.x, 0, pose.fwd.z).normalize();
    bodyUp.addScaledVector(bodyFwd, -bodyUp.dot(bodyFwd)).normalize();
    bodyX.crossVectors(bodyUp, bodyFwd);
    tmpM.makeBasis(bodyX, bodyUp, bodyFwd);
    bodyQ.setFromRotationMatrix(tmpM);
  }
  // bob on the water while waiting
  if (rider.state === 'WAIT' || rider.state === 'PADDLE') rig.position.y += Math.sin(t * 1.6) * 0.05;
  if (!surfer) return;
  const st = rider.state;
  surfer.position.set(0, 0, 0); surfer.rotation.set(0, 0, 0);
  if (st === 'WAIT') { play('sit'); surfer.position.set(0, -0.36, -0.15); }
  else if (st === 'PADDLE') { play('paddle', { speed: 0.6 + rider.paddleV / 2 }); surfer.position.set(0, -0.93, -0.25); }
  else if (st === 'POPUP') { play('popup', { once: true, fade: 0.12, speed: 1.6 }); setStance(); surfer.position.set(0, 0.03, -0.1); }
  else if (st === 'RIDE') {
    // stance: half crouch, deeper in the barrel and at speed; lean into the turn
    // crouch: deeper at speed and in the barrel; pumping compresses the legs, letting go extends them
    pumpC += ((input.paddle ? 1 : 0) - pumpC) * Math.min(1, dt * 7);
    const deep = Math.min(0.8, (rider.inBarrel ? 0.62 : 0.3 + 0.15 * Math.min(1, rider.v / 10)) + 0.3 * pumpC);
    if (curClip !== clips.crouch) { play('crouch', { fade: 0.3 }); clips.stand.reset().play(); }
    clips.crouch.weight = deep; clips.stand.weight = 1 - deep;
    setStance();
    surfer.position.set(0, 0.0 - 0.04 * deep, -0.1);                  // hips drop a little as the feet spread
  } else if (st === 'WIPE') {
    setStance(); surfer.position.set(0, 0, -0.1);
    wipeout(dt);
  } else if (st === 'DONE') { play('sit'); surfer.position.set(0, -0.36, -0.15); }
}

// ---------- wipeout: the rider is thrown off, goes under, comes back up; the board tumbles away on its own
const W = { on: false, bv: new THREE.Vector3(), bw: new THREE.Vector3(), rv: new THREE.Vector3(), rw: new THREE.Vector3(), under: 0 };
const _e = new THREE.Euler(), _dq = new THREE.Quaternion();
function startWipe() {
  W.on = true; W.t = 0; W.under = 0;
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
  audio.splash(0.6); W.hit = false;
}
function wipeout(dt) {
  if (!W.on) startWipe();
  W.t += dt;
  const s = (x) => x - wave.peelX;
  for (const [obj, vel, spin, isBody] of [[surfer, W.rv, W.rw, true], [rig, W.bv, W.bw, false]]) {
    const p = obj.position, water = rider.face.surfaceY(s(p.x), p.z);
    const depth = water - p.y;
    if (depth > 0) {
      // in the water: heavy drag, the broken wave drags you shoreward, buoyancy brings you back up
      vel.multiplyScalar(Math.exp(-dt * (isBody ? 3.5 : 2.5)));
      vel.z += (isBody ? 2.5 : 3.5) * dt; vel.x += wave.cond.peel * 0.3 * dt;
      vel.y += (isBody ? (W.t < 1.4 ? -2 : 6) : 14) * Math.min(1, depth + 0.3) * dt;
      spin.multiplyScalar(Math.exp(-dt * (isBody ? 2 : 3)));
      if (isBody) { W.under += dt; if (!W.hit) { W.hit = true; audio.splash(1.2); } }
    } else vel.y -= 9.8 * dt;
    p.addScaledVector(vel, dt);
    _dq.setFromEuler(_e.set(spin.x * dt, spin.y * dt, spin.z * dt)); obj.quaternion.premultiply(_dq);
    if (isBody && W.t > 1.4) {
      // back at the surface: head up, treading water
      p.y += (water - 1.35 - p.y) * Math.min(1, dt * 3);
      _dq.setFromEuler(_e.set(0, Math.atan2(camera.position.x - p.x, camera.position.z - p.z), 0)); obj.quaternion.slerp(_dq, Math.min(1, dt * 3));
      vel.multiplyScalar(0.9); spin.set(0, 0, 0);
    }
    if (!isBody && depth > -0.05 && W.t > 1.2) { p.y += (water + 0.03 - p.y) * Math.min(1, dt * 4); _dq.setFromEuler(_e.set(0, obj.rotation.y, 0)); obj.quaternion.slerp(_dq, dt * 2); }
  }
  if (W.t > 1.4) play('tread', { fade: 0.4 });
}
function endWipe() { if (!W.on) return; W.on = false; rig.add(surfer); surfer.position.set(0, 0, 0); surfer.quaternion.identity(); }

// ---------- surf stance on top of the clips: feet wide along the board, arms out for balance
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
const bones = {};
function aimBone(bone, child, target, w) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b); _d.subVectors(_b, _a).normalize();
  _q.setFromUnitVectors(_d, target); _q.slerp(_wq.identity(), 1 - w);          // world-space turn toward the target, partly
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
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
let stanceW = 0, pumpC = 0;
function surfStance() {
  const st = rider.state, want = st === 'RIDE' ? 1 : st === 'POPUP' ? Math.min(1, rider.stateT / 0.45) : 0;
  stanceW += (want - stanceW) * 0.2;
  if (stanceW < 0.02) return;
  if (!bones.thigh_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  // which way along the board each side of the body sits
  bones.thigh_l.getWorldPosition(_a); bones.thigh_r.getWorldPosition(_b);
  const side = Math.sign(_d.subVectors(_a, _b).dot(bodyFwd)) || 1;
  const w = stanceW, deep = rider.inBarrel ? 1 : 0;
  for (const [s, sgn] of [['l', side], ['r', -side]]) {
    // legs: feet about shoulder-and-a-half apart, front foot toward the nose
    swingBone(bones['thigh_' + s], bones['foot_' + s], sgn, (0.36 + 0.06 * deep) * w);
    // arms: out along the board, a little forward, lower when tucked in the barrel; the leading arm follows the turn
    const lift = (deep ? -0.2 : 0.15) + (sgn > 0 ? 0.25 * rider.turn : -0.15 * rider.turn);
    _t.copy(bodyFwd).multiplyScalar(sgn * 0.9).addScaledVector(bodyUp, lift - 0.25).addScaledVector(INTO_WAVE, 0.25).normalize();
    aimBone(bones['upperarm_' + s], bones['lowerarm_' + s], _t, 0.75 * w);
  }
}

// ---------- HUD + end of ride
let endT = -1, snapCam = true;
function updateHUD(dt) {
  const st = rider.state;
  ui.speed.textContent = st === 'RIDE' || st === 'POPUP' ? `${Math.round(rider.v * 3.6)} km/h` : '';
  ui.paddle.style.visibility = st === 'WIPE' || st === 'DONE' ? 'hidden' : 'visible';
  const lbl = st === 'WAIT' || st === 'PADDLE' ? 'PADDLE' : 'PUMP'; if (ui.paddle.textContent !== lbl) ui.paddle.textContent = lbl;
  // first waves: tell the player what to do while the set rolls in
  const hint = st === 'WAIT' ? (rider.zRel < wave.cond.speed * 2.6 ? 'Now! Hold PADDLE' : rider.zRel < wave.cond.speed * 5 ? 'Wave coming, get ready...' : '') : st === 'PADDLE' && rider.lifting ? 'It\'s lifting you, keep paddling!' : st === 'PADDLE' ? 'Wave behind you: keep paddling' : st === 'POPUP' ? 'Up!' : st === 'RIDE' && rider.stateT < 3.5 && session.waves < 2 ? 'Hold PUMP as you drop down the face' : '';
  ui.hint.textContent = session.waves < 3 || st === 'POPUP' ? hint : '';
  ui.tube.style.opacity = rider.inBarrel && st === 'RIDE' ? 1 : 0;
  ui.score.textContent = st === 'RIDE' ? Math.round(rider.ride.t * 5 + rider.ride.pocket * 10 + rider.ride.turns * 15 + rider.ride.top * 1.5 + rider.ride.barrel * 60) : '';
  if ((st === 'WIPE' || st === 'DONE') && endT < 0) {
    endT = 0; session.waves++; session.total += rider.ride.score; session.best = Math.max(session.best, rider.ride.score);
    ui.msgT.textContent = rider.why;
    const r = rider.ride;
    ui.msgS.textContent = r.t > 0 ? `${r.score} points  ·  ${r.t.toFixed(1)}s riding  ·  top ${Math.round(r.top)} km/h${r.barrel > 0.2 ? `  ·  ${r.barrel.toFixed(1)}s in the barrel` : ''}` : 'No ride';
    ui.sess.textContent = `Waves ${session.waves}  ·  best ${session.best}  ·  total ${session.total}`;
    ui.msg.style.display = 'flex';
  }
  if (endT >= 0) { endT += dt; if (endT > 3.2) newWave(); }
}

// ---------- automatic quality
let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0;
function autoQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  if (fps < 50) { lowT++; highT = 0; } else if (fps > 58) { highT++; lowT = 0; }
  if (lowT >= 2 && pr > 0.75) { pr = Math.max(0.75, pr - 0.15); renderer.setPixelRatio(pr); lowT = 0; }
  if (highT >= 6 && pr < MAX_PR) { pr = Math.min(MAX_PR, pr + 0.1); renderer.setPixelRatio(pr); highT = 0; }
  if (Q.has('debug')) document.getElementById('fps').textContent = `${Math.round(fps)} fps · pr ${pr.toFixed(2)}`;
}

// ---------- loop
let last = performance.now(), T = 0, strokeT = 0;
function tick(dt) {
  T += dt;
  const inp = readInput(dt);
  if (wave) {
    // in heavier surf the peel speed surges: sections race ahead and you have to react
    const sg = rider.state === 'RIDE' ? wave.cond.surge : 0;   // steady while you line up the take-off
    wave.peelMul = 1 + sg * (Math.sin(T * 0.9 + wave.seed) * 0.6 + Math.sin(T * 2.3 + wave.seed * 3) * 0.4);
    wave.update(dt);
    if (rider.state !== 'WIPE' && rider.state !== 'DONE') rider.update(dt, inp);
    else { rider.stateT += dt; if (rider.state === 'DONE' && rider.ride.t === 0) rider.zRel -= wave.cond.speed * dt; }   // a missed wave keeps rolling past
    updateRig(dt, T);
    if (mixer) { mixer.update(dt); surfStance(); }
    updateCamera(dt);
    updateHUD(dt);
    // sound follows what's happening
    const H = wave.cond.H, rs = rider.s, st = rider.state;
    const near = st === 'WAIT' || st === 'PADDLE' ? Math.max(0, 1 - rider.zRel / 25) * Math.max(0, 1 - Math.abs(rs) / (8 * H)) : Math.max(0, 1 - Math.abs(rs) / (6 * H));
    let underwater = false;
    if (st === 'WIPE' && W.on && surfer) { const b = surfer.position; underwater = W.t < 1.4 && b.y < rider.face.surfaceY(b.x - wave.peelX, b.z) - 0.2; }
    audio.update({ H, near, barrel: rider.inBarrel && st === 'RIDE', riding: st === 'RIDE' || st === 'POPUP', v: rider.v, turn: rider.turn, storm: ENV.weather ? ENV.weather.chop / 2.4 : 0, rain: ENV.weather ? ENV.weather.rain : 0, underwater });
    if (st === 'PADDLE' && rider.paddleV > 0.3) { strokeT -= dt * (0.9 + rider.paddleV * 0.5); if (strokeT <= 0) { strokeT = 0.5; audio.paddle(); } }
    if (st === 'POPUP' && rider.stateT < dt * 1.5) audio.splash(0.35);
    sunLight.position.copy(camera.position).addScaledVector(ENV.uSun.value, 30); sunLight.target.position.copy(camera.position);
  } else {
    // behind the start screen: a slow drift along a peeling wave
    if (!tick.demo) { tick.demo = new Wave(scene, CONDITIONS.medium); tick.demo.peelX = -30; }
    tick.demo.update(dt);
    const px = tick.demo.peelX;
    camera.position.set(px + 14, 2.2, 13); camera.lookAt(px - 2, 1.2, 0);
  }
  if (wave && tick.demo) { scene.remove(tick.demo.mesh); scene.remove(tick.demo.spray); tick.demo = null; }
  fx.update(dt, camera.position);
}
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!window.__g.paused) tick(dt);
  renderer.render(scene, camera); autoQuality(dt);
});
window.__g = { paused: false, audio, renderer, scene, camera, rig, get surfer() { return surfer; }, get rider() { return rider; }, get wave() { return wave; }, input, keys, setMode: (m) => { mode = m; setWeather(m); }, step: (sec, dt = 1 / 30, draw = true) => { for (let t = 0; t < sec; t += dt) tick(dt); if (draw) renderer.render(scene, camera); }, newWave };
