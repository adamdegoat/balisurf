// Bali surf: session loop, controls, camera, surfer model, HUD, automatic quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Wave, CONDITIONS, skyDome, ocean, setWeather, WeatherFX, ENV } from './wave.js?v=21';
import { Rider, Profile, waterAt, heightAt } from './surf.js?v=35';
import { makeBoard } from './board.js?v=1';
import { SurfAudio } from './audio.js?v=2';

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
const ready = new Promise((res, rej) => new GLTFLoader().load('surfer.glb?v=1', (g) => {
  surfer = g.scene; rig.add(surfer);
  surfer.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (o.material.name === 'hair') o.material.side = THREE.DoubleSide; } });
  mixer = new THREE.AnimationMixer(surfer);
  for (const c of g.animations) { c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale')); clips[c.name] = mixer.clipAction(c); }
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
let mode = null, rider = null, waves = [], session = { waves: 0, total: 0, best: 0 }, nextBreak = 0;
const REEF = { xEnd: 150, zBeach: 120 };
function condFor(m) { return m === 'random' ? ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] : m; }
function addWave(tBreak) {
  const cond = CONDITIONS[condFor(mode)];
  const w = new Wave(scene, cond);
  w.tBreak = tBreak; w.prof = new Profile(w); w.xEnd = REEF.xEnd; w.zBeach = REEF.zBeach; w.seed = Math.random() * 100;
  waves.push(w);
  return w;
}
function updateWaves(dt) {
  // keep the next wave lined up out to sea; a swell period apart, give or take
  while (nextBreak - T < 150 / 6) {
    const w = addWave(nextBreak);
    nextBreak += w.cond.period * (0.85 + Math.random() * 0.3);
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], C = w.cond, t = T - w.tBreak;
    w.place(C.peel * t, C.speed * t);
    w.fade = Math.min(1, Math.max(0, 1 - (w.peelX - REEF.xEnd) / 40)) * Math.min(1, Math.max(0.15, 1 + (w.zW + 160) / 60));   // far out it's a small swell; past the end of the reef it backs off
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
  if (surfer) endWipe();
  pumpC = 0; stanceW = 0; lastState = ''; endT = -1; snapCam = true;
  rider = rider || new Rider();
  // in the lineup: just outside and a little down the line from the peak, sitting up facing the sets
  rider.reset(2 + Math.random() * 4, -7 - Math.random() * 3, -Math.PI / 2);
  // don't drop a wave on your head as you arrive
  const inc = incoming(); if (inc.t < 5) nextBreak = Math.max(nextBreak, T + 9);
  ui.msg.style.display = 'none';
}

// ---------- controls: PADDLE/PUMP (hold, left) and a thumb pad (right half). Keyboard for testing.
const input = { paddle: false, steer: 0 };
const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code));
const ui = {
  paddle: document.getElementById('paddle'), pad: document.getElementById('pad'), guide: document.getElementById('guide'), knob: document.querySelector('#guide b'),
  speed: document.getElementById('speed'), score: document.getElementById('score'), cond: document.getElementById('cond'),
  msg: document.getElementById('msg'), msgT: document.getElementById('msg-t'), msgS: document.getElementById('msg-s'),
  tube: document.getElementById('tube'), hint: document.getElementById('hint'), load: document.getElementById('load'), start: document.getElementById('start'), sess: document.getElementById('sess'),
};
const hold = (el, on, off) => {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); on(e); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('touchcancel', (e) => { e.preventDefault(); if (e.targetTouches.length === 0) off(e); }, { passive: false });
  el.addEventListener('mousedown', on); addEventListener('mouseup', off);
};
hold(ui.paddle, () => { audio.wake(); input.paddleBtn = true; ui.paddle.classList.add('down'); }, () => { input.paddleBtn = false; ui.paddle.classList.remove('down'); });
// thumb pad: touch anywhere on the right half; the spot you first touch is the centre.
// Left/right turns the board left/right, like leaning on a real board: lying, it points you where you paddle; standing, it carves.
let padTouch = null, padX = 0, padY = 0, lastPadTouch = undefined, lastKnob = 1e9;
const PAD_R = 55;
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
  const v = kx || padX;
  input.steer = input.test != null ? input.test : v;   // input.test: scripted steering for automated checks
  input.paddle = !!input.paddleBtn || keys.has('Space');
  if (padTouch !== lastPadTouch) { ui.guide.classList.toggle('live', !!padTouch); lastPadTouch = padTouch; }
  const kt = Math.round(input.steer * 45); if (kt !== lastKnob) { ui.knob.style.transform = `translateX(${kt}px)`; lastKnob = kt; }
  return { paddle: input.paddle, pump: input.paddle, steer: input.steer };    // same button: paddle lying down, pump once standing; steer + = turn right
}

for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => start(b.dataset.mode));
let starting = false;
async function start(m) {
  if (starting) return; starting = true;
  mode = m; setWeather(m); audio.start();
  // fullscreen + landscape lock must be asked for inside the tap, before any waiting (Android); iOS ignores both safely
  try { document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch (e) {}
  ui.load.textContent = surfer ? '' : 'Loading...';
  try { await ready; } catch (e) { starting = false; return; }
  ui.load.textContent = '';
  ui.start.style.display = 'none'; document.body.classList.add('playing');
  session = { waves: 0, total: 0, best: 0 };
  for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 9;
  updateWaves(0); spawnRider();
  ui.cond.textContent = mode === 'random' ? 'Random' : CONDITIONS[mode].name;
}
if (Q.get('mode')) start(Q.get('mode'));

// ---------- camera: a chase camera over your shoulder, looking where you're going; tight and low in the barrel
const lookDir = new THREE.Vector3(), _cv = new THREE.Vector3(), _lk = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 2, 10), camLook = new THREE.Vector3(), pose = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3() };
let camYaw = 0, lookBackK = 0;
const camOff = new THREE.Vector3(0, 1.3, 3), lookOff = new THREE.Vector3(), _anc = new THREE.Vector3();
const smooth01 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const _wq2 = {};
function updateCamera(dt) {
  const p = pose.pos, st = rider.state;
  const want = _want, look = _look;
  if (st === 'WIPE' && W.on && surfer) {
    // follow the body from the beach side; never below the water
    const b = surfer.getWorldPosition(_cv);
    const wy = heightAt(waves, b.x + 3, b.z + 5);
    want.set(b.x + 3, Math.max(wy + 0.8, b.y + 1.3), b.z + 5);
    look.set(b.x, Math.max(b.y + (W.t > 1.4 ? 1.3 : 0.4), wy), b.z);
  } else {
    // follow the direction you're travelling when you're up and moving, the way the board points when you're lying
    const standing = rider.standing, moving = rider.v > 2.5 && standing;
    // standing, stay behind you along the wave: never straight behind when you point down the face (that's up inside the wall)
    let yaw = moving || rider.state === 'POP' ? Math.atan2(rider.vz, rider.vx) : rider.th;
    if (standing) yaw = Math.cos(yaw) >= -0.2 ? Math.max(-0.5, Math.min(0.55, yaw)) : Math.PI - Math.max(-0.5, Math.min(0.55, Math.PI - (yaw < 0 ? yaw + 2 * Math.PI : yaw)));
    let dy = yaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    camYaw += dy * Math.min(1, dt * (standing ? 4 : 5)); if (snapCam) camYaw = yaw;
    const dx = Math.cos(camYaw), dz = Math.sin(camYaw);
    const tube = rider.inBarrel ? 1 : 0;
    const back = standing ? 3.9 - 1.6 * tube + 0.05 * rider.v : 3.0, height = standing ? 1.55 - 0.7 * tube : 1.2;
    want.set(p.x - dx * back, p.y + height, p.z - dz * back + (standing ? 1.5 - 0.9 * tube : 0));   // a little out toward the beach so the wall frames the shot
    look.set(p.x + dx * 5, p.y + (standing ? 0.85 : 0.4), p.z + dz * 5);
    // lying and facing the beach with a wave coming: look back over your shoulder at it; on the face, swing beside you for the drop
    if (!standing && st === 'LIE') {
      const inc = incoming(), facingIn = Math.sin(rider.th) > 0.4;
      const onWave = rider.y > 0.25 * (rider.wave ? rider.wave.cond.H : 1);
      const lookBack = facingIn && inc.w && inc.t < 5 ? smooth01(1 - (inc.t - 1) / 3) : 0;
      lookBackK += ((onWave ? 2 : lookBack) - lookBackK) * Math.min(1, dt * 3);
      if (lookBackK > 0.01) {
        const k1 = Math.min(1, lookBackK), k2 = Math.max(0, lookBackK - 1);
        // stage 1: in front of you (shoreward), a little to the side, looking back past you at the wave
        _cv.set(p.x + 1.4, p.y + 1.25, p.z + 4.4); want.lerp(_cv, k1);
        _lk.set(p.x - 0.4, p.y + 0.55, p.z - 4); look.lerp(_lk, k1);
        // stage 2: in front of you and down the line (where a filmer in the channel would be), looking back up at the drop
        _cv.set(p.x + 2.6, p.y + 0.9, p.z + 3.6); want.lerp(_cv, k2);
        _lk.set(p.x - 0.3, p.y + 0.6, p.z - 0.5); look.lerp(_lk, k2);
      }
    } else if (standing && lookBackK > 0.01) {
      // just up: ease from the filmer's view into the riding camera
      lookBackK = Math.max(0, lookBackK - dt * 1.6);
      const k2 = Math.min(1, lookBackK);
      _cv.set(p.x + 2.6, p.y + 0.9, p.z + 3.6); want.lerp(_cv, k2);
      _lk.set(p.x - 0.3, p.y + 0.6, p.z - 0.5); look.lerp(_lk, k2);
    } else lookBackK = 0;
    // stay out of the water: above the surface here, in front of the face at the camera's height, inside the tube in the barrel
    const q = waterAt(waves, want.x, want.z, _wq2);
    if (q.w) {
      const sl = q.w.prof.slice(q.s), H = q.w.cond.H;
      if (tube) { want.z = Math.min(want.z, sl.lipZ + q.w.zW - 0.45); want.y = Math.min(Math.max(want.y, p.y + 0.45), 0.62 * H); }
      else if (q.zl > sl.topZ - 0.3 && want.y < sl.top + 0.3) {
        const fz = q.w.prof.frontZAt(q.s, want.y) + q.w.zW;
        if (want.z < fz + 0.7) want.z = fz + 0.7;                  // pushed out in front of the wall, never inside it
      }
    }
    want.y = Math.max(want.y, heightAt(waves, want.x, want.z) + 0.45);
    if (tube) look.y = p.y + 0.55;                                     // level gaze down the tube toward the opening
  }
  // smooth the camera's offset from whoever it follows, not its absolute position: no lag when the surfer is flying along
  const anchor = st === 'WIPE' && W.on && surfer ? surfer.getWorldPosition(_anc) : p;
  const k = snapCam ? 1 : Math.min(1, dt * (st === 'WIPE' ? 3.5 : 5));
  snapCam = false;
  // swing round the surfer in an arc (angle, distance, height), never cut through them
  _cv.subVectors(want, anchor);
  const ta = Math.atan2(_cv.z, _cv.x), tr = Math.hypot(_cv.x, _cv.z);
  let ca = Math.atan2(camOff.z, camOff.x), cr = Math.hypot(camOff.x, camOff.z);
  ca += Math.atan2(Math.sin(ta - ca), Math.cos(ta - ca)) * k; cr += (tr - cr) * k;
  camOff.set(Math.cos(ca) * cr, camOff.y + (_cv.y - camOff.y) * k, Math.sin(ca) * cr);
  lookOff.lerp(_lk.subVectors(look, anchor), k);
  camPos.addVectors(anchor, camOff); camLook.addVectors(anchor, lookOff);
  camPos.y = Math.max(camPos.y, heightAt(waves, camPos.x, camPos.z) + 0.3);
  camera.position.copy(camPos);
  if (st === 'WIPE') { const sh = 0.12 * Math.exp(-(W.t || 0) * 2.5); camera.position.x += (Math.random() - .5) * sh; camera.position.y += (Math.random() - .5) * sh; }
  camera.lookAt(camLook);
}

// ---------- surfer pose on the board
const WORLD_UP = new THREE.Vector3(0, 1, 0), INTO_WAVE = new THREE.Vector3(0, 0, -1), tmpM = new THREE.Matrix4(), xAxis = new THREE.Vector3(), bodyUp = new THREE.Vector3(), bodyFwd = new THREE.Vector3(), bodyX = new THREE.Vector3();
const _up = new THREE.Vector3(), _yq = new THREE.Quaternion(), bodyQ = new THREE.Quaternion(), stanceQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), invQ = new THREE.Quaternion();
// the rider's world orientation (bodyQ, plus side-on stance) expressed in the board's frame
const setStance = () => { invQ.copy(rig.quaternion).invert(); surfer.quaternion.copy(invQ).multiply(bodyQ).multiply(stanceQ); };
function updateRig(dt, t) {
  if (rider.state === 'WIPE' && W.on) { wipeout(dt); return; }
  rider.pose(pose);
  const standing = rider.standing;
  // standing, the board rides on its rail (partway between the face and level) and rolls into the carve
  if (standing) {
    pose.up.lerp(WORLD_UP, 0.45).normalize();
    const roll = Math.atan(rider.turn * rider.v / 9.8) * 0.6;
    pose.up.applyAxisAngle(pose.fwd, -roll);
  }
  pose.up.addScaledVector(pose.fwd, -pose.up.dot(pose.fwd)).normalize();
  xAxis.crossVectors(pose.up, pose.fwd).normalize();
  const up = _up.crossVectors(pose.fwd, xAxis).normalize();
  tmpM.makeBasis(xAxis, up, pose.fwd);
  rig.quaternion.setFromRotationMatrix(tmpM);
  rig.position.copy(pose.pos);
  if (standing || (rider.state === 'WIPE' && rider.stateT < 0.1)) {
    // the rider stands on the deck, leaning into the turn and a little toward the wave
    const lean = 0.15 + (rider.inBarrel ? 0.12 : 0);
    bodyUp.copy(pose.up).addScaledVector(INTO_WAVE, Math.tan(lean * 0.6)).normalize();
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
  surfer.position.set(0, 0, 0); surfer.rotation.set(0, 0, 0);
  if (st === 'LIE' || st === 'OUT') {
    if (rider.paddling && st === 'LIE') { play('paddle', { speed: 0.7 + rider.v / 3 }); surfer.position.set(0, -0.93, -0.25); }
    else { play('sit'); surfer.position.set(0, -0.36, -0.15); }
  } else if (st === 'POP') { play('popup', { once: true, fade: 0.12, speed: 1.6 }); setStance(); surfer.position.set(0, 0.03, -0.1); }
  else if (st === 'RIDE') {
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
  let next = 0, acc = 0;
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
        const load = Math.abs(rider.turn) * rider.v / 12 + rider.skid * 1.5 + (rider.state === 'POP' ? 0.6 : 0) + Math.max(0, rider.v - 6) * 0.03;
        acc += load * 900 * dt;
        if (acc >= 1) {
          const n = Math.floor(acc); acc -= n;
          // from the tail, thrown out of the face and back
          _p.copy(rig.position).addScaledVector(pose.fwd, -0.55).addScaledVector(pose.up, 0.05);
          // a fan: along the rail from mid-board to tail, thrown out of the face, up, and back
          for (let k = 0; k < n; k++) {
            _p.copy(rig.position).addScaledVector(pose.fwd, -0.15 - Math.random() * 0.6).addScaledVector(pose.up, 0.04);
            _v.copy(pose.up).multiplyScalar(1.2 + load * 2.2 + Math.random()).addScaledVector(pose.fwd, -rider.v * (0.2 + Math.random() * 0.3)).add(_cv.set(0, 0.8 + Math.random() * 1.2, 0));
            emit(_p, _v, 1, 0.6);
          }
        }
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
  const st = rider.state, want = st === 'RIDE' ? 1 : st === 'POP' ? Math.min(1, rider.stateT / 0.45) : 0;
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
const setText = (el, t) => { if (el._t !== t) { el._t = t; el.textContent = t; } };   // only touch the page when the text changes
let endT = -1, snapCam = true;
function updateHUD(dt) {
  const st = rider.state;
  setText(ui.speed, rider.standing ? `${Math.round(rider.v * 3.6)} km/h` : '');
  ui.paddle.style.visibility = st === 'WIPE' || st === 'OUT' ? 'hidden' : 'visible';
  const lbl = rider.standing ? 'PUMP' : 'PADDLE'; if (ui.paddle.textContent !== lbl) ui.paddle.textContent = lbl;
  // coaching for the first few waves: read the sea like a surfer would
  let hint = '';
  if (st === 'LIE') {
    const inc = incoming(), facingIn = Math.sin(rider.th) > 0.5;
    if (rider.washed) hint = 'Caught inside! Hold on, paddle back out';
    else if (inc.w && inc.t < 7) hint = !facingIn ? 'Wave coming: turn to face the beach' : inc.t < 3 ? 'Paddle hard!' : 'Wave coming...';
    else if (rider.z > 12) hint = 'Too far in: paddle back out past the break';
  } else if (st === 'POP') hint = 'Up!';
  else if (st === 'RIDE' && rider.stateT < 4 && session.waves < 3) hint = 'Steer along the wave. Hold PUMP going down for speed';
  setText(ui.hint, session.waves < 4 || st === 'POP' ? hint : '');
  ui.tube.style.opacity = rider.inBarrel && st === 'RIDE' ? 1 : 0;
  setText(ui.score, st === 'RIDE' ? '' + rider.liveScore() : '');
  if ((st === 'WIPE' || st === 'OUT') && endT < 0) {
    endT = 0;
    const r = rider.ride;
    if (r.t > 0 || st === 'WIPE') { session.waves++; session.total += r.score; session.best = Math.max(session.best, r.score); }
    ui.msgT.textContent = rider.why;
    ui.msgS.textContent = r.t > 0 ? `${r.score} points  ·  ${r.t.toFixed(1)}s riding  ·  top ${Math.round(r.top)} km/h${r.barrel > 0.2 ? `  ·  ${r.barrel.toFixed(1)}s in the barrel` : ''}` : '';
    ui.sess.textContent = session.waves ? `Rides ${session.waves}  ·  best ${session.best}  ·  total ${session.total}` : '';
    ui.msg.style.display = 'flex';
  }
  if (endT >= 0) { endT += dt; if (endT > (st === 'WIPE' ? 3.4 : 2.6)) spawnRider(); }
}

// ---------- automatic quality
let fpsAcc = 0, fpsN = 0, lowT = 0, highT = 0, refFps = 30;
function autoQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 1) return;
  const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
  // compare against what this screen can actually do (60, 120, or 30 in iPhone Low Power Mode), not a fixed number
  refFps = Math.max(Math.min(fps, 125), refFps - 2);
  if (fps < refFps * 0.82) { lowT++; highT = 0; } else if (fps > refFps * 0.95) { highT++; lowT = 0; }
  if (lowT >= 2 && pr > 0.75) { pr = Math.max(0.75, pr - 0.15); renderer.setPixelRatio(pr); lowT = 0; }
  if (highT >= 6 && pr < MAX_PR) { pr = Math.min(MAX_PR, pr + 0.1); renderer.setPixelRatio(pr); highT = 0; }
  if (Q.has('debug')) document.getElementById('fps').textContent = `${Math.round(fps)} fps · pr ${pr.toFixed(2)}`;
}

// ---------- loop
const portrait = matchMedia('(orientation: portrait) and (max-width: 900px)');
let last = performance.now(), T = 0, strokeT = 0, lastState = '';
function tick(dt) {
  T += dt;
  ENV.uTime.value += dt;
  const inp = readInput(dt);
  if (rider) {
    updateWaves(dt);
    rider.update(dt, inp, waves);
    // drifting too far inside or out wide on a lie: bring the surfer back to the lineup
    if (rider.state === 'LIE' && (rider.z > 40 || Math.abs(rider.x - 5) > 70 || rider.z < -60)) { rider.out('Drifted out of the lineup'); }
    updateRig(dt, T);
    if (mixer) { mixer.update(dt); surfStance(); }
    railSpray.update(dt);
    updateCamera(dt);
    updateHUD(dt);
    // sound follows what's happening: the breaking wave is loud near the curl
    const st = rider.state, w = rider.wave;
    let near = 0;
    for (const v of waves) { const s = rider.x - v.peelX, zl = rider.z - v.zW; if (zl > -20 && zl < 25) near = Math.max(near, Math.max(0, 1 - Math.hypot(s < 0 ? s * 0.4 : s, zl) / (7 * v.cond.H))); }
    let underwater = false;
    if (st === 'WIPE' && W.on && surfer) { const b = surfer.position; underwater = W.t < 1.4 && b.y < heightAt(waves, b.x, b.z) - 0.2; }
    audio.update({ H: w ? w.cond.H : 1.5, near, barrel: rider.inBarrel && st === 'RIDE', riding: rider.standing, v: rider.v, turn: rider.turn, storm: ENV.weather ? ENV.weather.chop / 2.4 : 0, rain: ENV.weather ? ENV.weather.rain : 0, underwater });
    if (st === 'LIE' && rider.paddling) { strokeT -= dt * 1.6; if (strokeT <= 0) { strokeT = 0.55; audio.paddle(); } }
    if (st !== lastState) { if (st === 'POP') audio.splash(0.35); lastState = st; }
    sunLight.position.copy(camera.position).addScaledVector(ENV.uSun.value, 30); sunLight.target.position.copy(camera.position);
  } else {
    // behind the start screen: a slow drift along a peeling wave
    if (!tick.demo) { tick.demo = new Wave(scene, CONDITIONS.medium); tick.demo.peelX = -30; }
    tick.demo.update(dt);
    const px = tick.demo.peelX;
    camera.position.set(px + 14, 2.2, 13); camera.lookAt(px - 2, 1.2, 0);
  }
  if (rider && tick.demo) { tick.demo.dispose(scene); tick.demo = null; }
  fx.update(dt, camera.position);
}
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!window.__g.paused && !portrait.matches) tick(dt);   // turned upright: the game waits
  renderer.render(scene, camera); autoQuality(dt);
});
window.__g = { paused: false, audio, renderer, scene, camera, rig, get surfer() { return surfer; }, get rider() { return rider; }, get waves() { return waves; }, incoming, input, keys, setMode: (m) => { mode = m; setWeather(m); for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 9; updateWaves(0); }, step: (sec, dt = 1 / 30, draw = true) => { for (let t = 0; t < sec; t += dt) tick(dt); if (draw) renderer.render(scene, camera); }, spawnRider, get T() { return T; } };
