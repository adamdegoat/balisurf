// Bali surf: session loop, controls, camera, surfer model, HUD, automatic quality.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Wave, CONDITIONS, skyDome, ocean, coast, setWeather, WeatherFX, ENV } from './wave.js?v=33';
import { Rider, Profile, waterAt, heightAt, RIDE } from './surf.js?v=58';
import { makeBoard } from './board.js?v=1';
import { SurfAudio } from './audio.js?v=4';

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
skyDome(scene); ocean(scene); coast(scene);
const fx = new WeatherFX(scene);
const audio = new SurfAudio();
fx.onFlash = () => audio.thunder(Math.random());
addEventListener('visibilitychange', () => audio.pause(document.hidden));
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
let mode = null, rider = null, waves = [], session = { waves: 0, total: 0, best: 0 }, nextBreak = 0, setLeft = 0, setPos = 0;
const REEF = { xEnd: 150, zBeach: 120 }, PROFILES = new Map();
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
    nextBreak += setLeft > 0 ? w.cond.period * (0.9 + Math.random() * 0.2) : w.cond.period * (1.8 + Math.random() * 0.8);
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], C = w.cond, t = T - w.tBreak;
    // the break doesn't peel at one steady speed: sections race ahead and slow down (more so in heavy surf), so a tube
    // opens and pinches and you have to keep adjusting. Integrated so it stays smooth.
    const sg = C.name === 'Hard' ? 0.3 : C.name === 'Medium' ? 0.18 : 0.06;
    const rate = C.peel * (1 + sg * (0.6 * Math.sin(t * 0.55 + w.seed) + 0.4 * Math.sin(t * 1.3 + w.seed * 2.1)));
    w.px = (w.px === undefined ? C.peel * t : w.px + rate * dt);
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
// thumb pad: touch anywhere on the right half; the spot you first touch is the centre.
// Left/right turns the board left/right, like leaning on a real board: lying, it points you where you paddle; standing, it carves.
let padTouch = null, padX = 0, padY = 0, lastPadTouch = undefined, lastKnob = 1e9, steerF = 0;
const PAD_R = 62;                                                   // thumb travel (px) for a full lean
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
  const ax = Math.abs(padX), shaped = ax < 0.08 ? 0 : Math.sign(padX) * Math.pow((ax - 0.08) / 0.92, 1.35);
  const raw = kx || shaped;
  steerF += (raw - steerF) * Math.min(1, dt * 14);
  input.steer = input.test != null ? input.test : steerF;   // input.test: scripted steering for automated checks
  input.paddle = !!input.paddleBtn || keys.has('Space');
  if (padTouch !== lastPadTouch) { ui.guide.classList.toggle('live', !!padTouch); lastPadTouch = padTouch; }
  const kt = Math.round(padX * 45); if (kt !== lastKnob) { ui.knob.style.transform = `translateX(${kt}px)`; lastKnob = kt; }
  return { paddle: input.paddle, pump: input.paddle, steer: input.steer };    // same button: paddle lying down, pump once standing; steer + = turn right
}

// your best ride per level, kept on this phone (quietly does nothing if storage is blocked)
const bestFor = (m) => { try { return +localStorage.getItem('balisurf.best.' + m) || 0; } catch (e) { return 0; } };
const saveBest = (m, v) => { try { localStorage.setItem('balisurf.best.' + m, String(v)); } catch (e) {} showBests(); };
function showBests() {
  for (const b of document.querySelectorAll('[data-mode]')) {
    let el = b.querySelector('.best'); const v = bestFor(b.dataset.mode);
    if (!el) { el = document.createElement('em'); el.className = 'best'; b.appendChild(el); }
    el.textContent = v ? `Best ${v}` : '';
  }
}
showBests();
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
let camStandK = 0, tubeK = 0;
const _wT = new THREE.Vector3(), _lT = new THREE.Vector3();
function updateCamera(dt) {
  const p = pose.pos, st = rider.state;
  const want = _want, look = _look;
  if (st === 'WIPE' && W.on && surfer) {
    // wiping out: the same camera, behind you, pulling back and up so you see yourself go over and the board fly
    const b = surfer.getWorldPosition(_cv);
    const dx = Math.cos(camYaw), dz = Math.sin(camYaw);
    let wy = heightAt(waves, b.x - dx * 5, b.z - dz * 5);
    want.set(b.x - dx * 5, Math.max(wy + 1.2, Math.min(b.y, 2) + 2.2), b.z - dz * 5);
    look.set(b.x, Math.max(b.y + (W.t > 1.4 ? 1.1 : 0.3), 0.3), b.z);
  } else {
    // follow the direction you're travelling when you're up and moving, the way the board points when you're lying
    const standing = rider.standing, moving = rider.v > 2.5 && standing;
    // ease from the lying camera to the riding camera over ~0.8 s after you pop up, so standing never jolts the view
    camStandK = standing ? Math.min(1, camStandK + dt / 0.8) : 0; if (snapCam && standing) camStandK = 1;
    const ks = camStandK * camStandK * (3 - 2 * camStandK);
    // a chase camera locked behind you: it points where you're going, level horizon, lightly smoothed
    // (placed behind you, but the seaward part is halved so it stays on the face side and the wave never hides you)
    const yaw = standing && (moving || rider.state === 'POP') ? Math.atan2(rider.vz * 0.5, rider.vx) : rider.th;
    const travel = standing && moving ? Math.atan2(rider.vz, rider.vx) : yaw;
    lookYaw += Math.atan2(Math.sin(travel - lookYaw), Math.cos(travel - lookYaw)) * Math.min(1, dt * 12); if (snapCam) lookYaw = travel;
    let dy = yaw - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const maxTurn = (1.3 + 3.7 * ks) * dt;
    camYaw += Math.max(-maxTurn, Math.min(maxTurn, dy * Math.min(1, dt * (3 + 8 * ks)))); if (snapCam) camYaw = yaw;   // stays right behind you through a carve
    const dx = Math.cos(camYaw), dz = Math.sin(camYaw);
    // the barrel framing blends in and out over ~0.35 s instead of switching in one frame
    const tubeWant = rider.inBarrel ? 1 : 0;
    tubeK += (tubeWant - tubeK) * Math.min(1, dt / 0.35); if (snapCam) tubeK = tubeWant;
    // heading toward the beach (the drop), come in close over your shoulder so you stay on the same face as the surfer;
    // turning along the wave, ease back out to the normal chase distance
    // chase distance: far enough to read the wave ahead (surfer ~a third of the screen), a little closer in the tube
    // standing up: no dive in close (it read as a zoom); the distance just eases from the lying 3.6 m to the riding 5.2 m
    const dropK = st === 'POP' ? 1 : st === 'RIDE' ? Math.max(0, 1 - Math.max(0, rider.stateT - 0.25) / 0.9) : 0;
    const frame = (tube, want, look) => {
      const back = standing ? 3.6 + (1.6 - 2.1 * tube) * ks : 3.6, height = standing ? 1.4 + (0.25 - 0.6 * tube) * ks + 1.6 * dropK : 1.4;   // during the drop: lift over the crest, don't move in   // at the drop: just behind your head
      want.set(p.x - dx * back, p.y + height, p.z - dz * back);
      // look just ahead of you (from the side or front during the drop, at you)
      const ol = Math.hypot(camOff.x, camOff.z) || 1, behind = Math.max(0, Math.min(1, -(camOff.x * dx + camOff.z * dz) / ol));
      const lead = standing ? 1 + 3.5 * behind : 0.5 + 4.5 * behind * behind;   // look down your line so you can read what's coming
      const lx = standing ? Math.cos(lookYaw) : dx, lz = standing ? Math.sin(lookYaw) : dz;   // look where you're actually going
      look.set(p.x + lx * (lead + 3 * dropK), p.y + (standing ? 0.95 - 1.1 * dropK : 0.4), p.z + lz * (lead + 3 * dropK));   // surfer in the lower middle; at the drop, looking down the face
      lookBackK = 0;                                                     // one camera, always behind you, like being the surfer
      // stay out of the water: above the surface here, in front of the face at the camera's height, inside the tube in the barrel
      const q = waterAt(waves, want.x, want.z, _wq2);
      if (q.w) {
        const sl = q.w.prof.slice(q.s), H = q.w.cond.H;
        if (tube) {
          // inside the tube: under the ceiling, off the wall, behind the falling lip
          want.y = Math.min(Math.max(want.y, p.y + 0.45), 0.6 * H);
          const wall = q.w.prof.frontZAt(q.s, want.y) + q.w.zW;
          want.z = Math.max(wall + 0.5, Math.min(want.z, sl.lipZ + q.w.zW - 0.5));
        }
        // behind you is up the wave (you're dropping toward the beach): rise over the crest and look down over your
        // shoulder, a bit closer, so the wave never blocks your view of yourself
        if (!tube && q.zl < sl.topZ + 1.5 && q.y > 0.15) {
          const top = sl.top * (q.w.fade || 1);
          want.y = Math.max(want.y, top + 1.1 + 0.3 * q.w.cond.H);   // bigger wave, more margin: the camera sits metres back
  
        }
      }
      // stay above the water that's here now and the water that's about to arrive (a wave passing under shouldn't shove the camera)
      let wy = heightAt(waves, want.x, want.z);
      if (!standing) for (const w of waves) { const zl = want.z - w.zW; if (zl > -3 && zl < 16) for (const ta of [0.3, 0.6, 1.0]) wy = Math.max(wy, heightAt(waves, want.x, want.z - w.cond.speed * ta)); }
      if (!tube) want.y = Math.max(want.y, wy + 0.45);
      if (tube) look.y = p.y + 0.55;                                     // level gaze down the tube toward the opening
      // keep a clear line of sight to the surfer: if water sits between the camera and them, lift the camera until it clears
      if (!tube) for (let k = 0; k < 14; k++) {
        let blocked = false;
        for (let j = 1; j < 7; j++) {
          const f = j / 7, sx = want.x + (p.x - want.x) * f, sy = want.y + (p.y + 0.9 - want.y) * f, sz = want.z + (p.z - want.z) * f;
          if (solidAt(sx, sz) > sy) { blocked = true; break; }
        }
        if (!blocked) break;
          if (k < 8) { want.z += 0.3; want.y += 0.1; }                // out in front of the lip first (a curl behind you blocks the view)
        else { want.x += (p.x - want.x) * 0.12; want.z += (p.z - want.z) * 0.12; want.y += 0.3; }   // then closer and up
      }
      // whenever the camera sits well above you, aim at you so you never drop out of the bottom of the screen
      { const above = want.y - p.y; if (above > 1.3) { const k = Math.min(1, (above - 1.3) / 1.1);   // the higher the camera, the more it aims at you
          look.x += (p.x + lx * 1.5 - look.x) * k; look.z += (p.z + lz * 1.5 - look.z) * k; look.y += (p.y + 0.4 - look.y) * k; } }
    };
    if (tubeK < 0.02) frame(0, want, look); else if (tubeK > 0.98) frame(1, want, look);
    else { frame(0, want, look); frame(1, _wT, _lT); want.lerp(_wT, tubeK); look.lerp(_lT, tubeK); }
  }
  // the camera follows a smoothed version of the surfer (a spring about 0.15 s behind): the board's little hops never shake it
  const tgt = st === 'WIPE' && W.on && surfer ? surfer.getWorldPosition(_anc) : p;
  if (snapCam) { anchorS.copy(tgt); anchorV.set(0, 0, 0); }
  else { const w0 = 11; anchorV.addScaledVector(_cv.subVectors(tgt, anchorS), w0 * w0 * dt).multiplyScalar(Math.max(0, 1 - 2 * w0 * dt)); anchorS.addScaledVector(anchorV, dt); }
  const anchor = anchorS;
  if (wipeCut && W.on) { snapCam = true; wipeCut = false; }
  const snap = snapCam;
  snapCam = false;
  // swing round the surfer in an arc (angle, distance, height) on critically damped springs: it eases in and out,
  // never jumps, never cuts through the surfer, and its speed is capped
  _cv.subVectors(want, anchor);
  const ta = Math.atan2(_cv.z, _cv.x), tr = Math.hypot(_cv.x, _cv.z);
  if (snap) { cam.a = ta; cam.r = tr; cam.y = _cv.y; cam.va = cam.vr = cam.vy = 0; lookOff.subVectors(look, anchor); cam.vl.set(0, 0, 0); }
  else {
    const w0 = st === 'WIPE' ? 3.2 : rider.standing && lookBackK < 0.01 ? 9.5 : 3.6, damp = Math.max(0, 1 - 2 * w0 * dt), w2 = w0 * w0 * dt;
    // coming in close at the pop-up is quick (the wave must not get between you), but swinging round is eased in
    const wa = st === 'WIPE' || !rider.standing ? w0 : 3.6 + 5.9 * camStandK * camStandK * (3 - 2 * camStandK), wa2 = wa * wa * dt, dampA = Math.max(0, 1 - 2 * wa * dt);
    cam.va = (cam.va + Math.atan2(Math.sin(ta - cam.a), Math.cos(ta - cam.a)) * wa2) * dampA; cam.va = Math.max(-5, Math.min(5, cam.va)); cam.a += cam.va * dt;
    cam.vr = (cam.vr + (tr - cam.r) * w2) * damp; cam.vr = Math.max(-3, Math.min(3, cam.vr)); cam.r += cam.vr * dt;
    { const wy0 = 7, dy0 = Math.max(0, 1 - 2 * wy0 * dt);             // height follows faster: rise with the wave, never lag under a crest
      cam.vy = (cam.vy + (_cv.y - cam.y) * wy0 * wy0 * dt) * dy0; cam.vy = Math.max(-3, Math.min(9, cam.vy)); } cam.y += cam.vy * dt;
    // the point we look at: same kind of spring, a little quicker
    // being picked up by a wave: aim keeps up with the drop
    const l0 = rider.standing ? 8 : rider.onFace ? 7 : 4.2, ld = Math.max(0, 1 - 2 * l0 * dt);
    _lk.subVectors(look, anchor).sub(lookOff).multiplyScalar(l0 * l0 * dt);
    cam.vl.add(_lk).multiplyScalar(ld); if (cam.vl.length() > 8) cam.vl.setLength(8);
    lookOff.addScaledVector(cam.vl, dt);
  }
  camOff.set(Math.cos(cam.a) * cam.r, cam.y, Math.sin(cam.a) * cam.r);
  camPos.addVectors(anchor, camOff); camLook.addVectors(anchor, lookOff);
  { const sy = heightAt(waves, camPos.x, camPos.z) + 0.35; if (camPos.y < sy) { cam.y += sy - camPos.y; cam.vy = Math.max(cam.vy, 0); camPos.y = sy; } }   // never under the water
  camera.position.copy(camPos);
  if (st === 'WIPE') { const sh = 0.12 * Math.exp(-(W.t || 0) * 2.5); camera.position.x += (Math.random() - .5) * sh; camera.position.y += (Math.random() - .5) * sh; }
  camera.lookAt(camLook);
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
    pose.up.applyAxisAngle(pose.fwd, -roll);
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
  _tq.multiply(_yq.setFromAxisAngle(_xAxis, -0.25 * sitTilt));
  if (snapCam) rigQ.copy(_tq);
  else { const ang = rigQ.angleTo(_tq); rigQ.rotateTowards(_tq, Math.min(ang * Math.min(1, dt * (rider.state === 'POP' ? 9 : 16)), 6 * dt)); }   // eased, and never faster than ~340 deg/s
  rig.quaternion.copy(rigQ);
  rig.position.copy(pose.pos);
  rig.position.y -= 0.05 * sitTilt;                                    // the rider's weight sinks the tail
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
    const deep = Math.min(0.85, (rider.inBarrel ? 0.62 : 0.25 + 0.12 * Math.min(1, rider.v / 10)) + 0.28 * pumpC + 0.3 * gLoad);
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
        const snapK = rider.trick && rider.trick.name === 'SNAP' && rider.trick.t < 0.3 ? 1 : 0;   // a snap throws a sheet of spray off the lip
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
const bones = {}, _rq = new THREE.Quaternion(), _bf = new THREE.Vector3(), _bs = new THREE.Vector3();
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
let stanceW = 0, pumpC = 0, sitting = false, sitTilt = 0;
const rigQ = new THREE.Quaternion();
function straddle() {
  // the sit clip is a chair pose (thighs forward); on a board the thighs go down either side and the shins hang in the water
  if (!bones.thigh_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  rig.getWorldQuaternion(_rq); _bf.set(0, 0, 1).applyQuaternion(_rq); _bs.set(1, 0, 0).applyQuaternion(_rq);
  for (const [s, sg] of [['l', 1], ['r', -1]]) {
    const side = bones['thigh_' + s].getWorldPosition(_a).sub(rig.getWorldPosition(_b)).dot(_bs) > 0 ? 1 : -1;
    _t.set(0, -1, 0).addScaledVector(_bs, side * 0.55).addScaledVector(_bf, 0.35).normalize();
    aimBone(bones['thigh_' + s], bones['calf_' + s], _t, 0.85);
    _t.set(0, -1, 0).addScaledVector(_bf, -0.15).normalize();
    aimBone(bones['calf_' + s], bones['foot_' + s], _t, 0.8);
  }
}
// turn a bone about a world axis (keeps everything below it attached)
function turnBone(bone, axis, ang) {
  if (!bone || Math.abs(ang) < 1e-4) return;
  _q.setFromAxisAngle(axis, ang);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
const _in = new THREE.Vector3(), _fw = new THREE.Vector3();
let bodyT = 0, gLoad = 0;
function surfStance() {
  if (sitting) straddle();
  const st = rider.state, want = st === 'RIDE' ? 1 : st === 'POP' ? Math.min(1, rider.stateT / 0.45) : 0;
  stanceW += (want - stanceW) * 0.2;
  if (stanceW < 0.02) return;
  if (!bones.thigh_l) surfer.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  surfer.updateMatrixWorld(true);
  bodyT += 1 / 60;
  // which way along the board each side of the body sits
  bones.thigh_l.getWorldPosition(_a); bones.thigh_r.getWorldPosition(_b);
  const side = Math.sign(_d.subVectors(_a, _b).dot(bodyFwd)) || 1;
  const w = stanceW, deep = rider.inBarrel ? 1 : 0;
  // how hard the turn is loading the legs (sideways g), smoothed; which way is the inside of the turn
  gLoad += (Math.min(1.4, Math.abs(rider.turn) * rider.v / 9.8) - gLoad) * 0.15;
  const leanN = Math.max(-1, Math.min(1, rider.lean / RIDE.leanMax));
  _in.crossVectors(bodyFwd, bodyUp).normalize().multiplyScalar(-Math.sign(leanN) || 1);   // toward the inside of the carve
  for (const [s, sgn] of [['l', side], ['r', -side]]) {
    // legs: feet about shoulder-and-a-half apart, front foot toward the nose
    swingBone(bones['thigh_' + s], bones['foot_' + s], sgn, (0.36 + 0.06 * deep) * w);
    // arms: the front arm leads into the turn and points where you're going, the back arm swings out for balance;
    // both drop low and in when tucked in the barrel, and never sit still
    const sway = Math.sin(bodyT * 1.7 + (sgn > 0 ? 0 : 1.3)) * 0.08;
    if (sgn > 0) _t.copy(bodyFwd).multiplyScalar(0.85).addScaledVector(_in, 0.55 * Math.abs(leanN)).addScaledVector(bodyUp, (deep ? -0.35 : 0.05) + 0.2 * Math.abs(leanN) + sway);
    else _t.copy(bodyFwd).multiplyScalar(-0.7).addScaledVector(_in, -0.35 * Math.abs(leanN)).addScaledVector(bodyUp, (deep ? -0.3 : 0.25) + 0.35 * Math.abs(leanN) + sway);
    _t.addScaledVector(INTO_WAVE, 0.2).normalize();
    aimBone(bones['upperarm_' + s], bones['lowerarm_' + s], _t, 0.8 * w);
  }
  // upper body: shoulders twist into the turn and the chest bends toward the inside; a slow balance sway on top
  const twist = (leanN * 0.45 + Math.sin(bodyT * 1.1) * 0.05) * w;
  turnBone(bones.spine_02, bodyUp, twist * 0.5); turnBone(bones.spine_03, bodyUp, twist * 0.5);
  _fw.copy(bodyFwd);
  turnBone(bones.spine_01, _fw, -leanN * 0.18 * w * side);
  // head: look ahead along your line (surfers always look where they're going)
  turnBone(bones.head, bodyUp, side * 0.55 * w - twist * 0.6);
}

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
    else if (inc.w && inc.t < 7 && inc.t > -0.5) hint = !facingIn ? 'Wave coming: turn to face the beach' : inc.t < 3 ? 'Paddle hard!' : 'Wave coming...';
    else if (rider.z > 12) hint = 'Too far in: paddle back out past the break';
  } else if (st === 'POP') hint = 'Up!';
  else if (st === 'RIDE' && rider.stateT < 5 && session.waves < 3) hint = rider.stateT < 2.5 ? 'Lean with your thumb: a little to carve, all the way to drift' : 'Hold PUMP as you drop down the face for speed';
  else if (st === 'RIDE' && rider.stateT > 6 && rider.stateT < 10 && session.waves < 5 && !rider.ride.cutbacks) hint = 'Cutback: lean toward the beach and keep turning till you face the breaking wave';
  setText(ui.hint, session.waves < 5 || st === 'POP' ? hint : '');
  // the callout: BARREL while you're in it, or the move you just landed
  const call = st !== 'RIDE' ? '' : rider.inBarrel ? 'BARREL' : rider.trick ? rider.trick.name : '';
  if (call) setText(ui.tube, call);
  ui.tube.style.opacity = call ? 1 : 0;
  setText(ui.score, st === 'RIDE' ? '' + rider.liveScore() : '');
  if ((st === 'WIPE' || st === 'OUT') && endT < 0) {
    endT = 0;
    const r = rider.ride;
    const prevBest = bestFor(mode), newBest = r.t > 0 && r.score > prevBest && prevBest > 0;
    if (r.t > 0 && r.score > prevBest) saveBest(mode, r.score);
    if (r.t > 0 || st === 'WIPE') { session.waves++; session.total += r.score; session.best = Math.max(session.best, r.score); }
    ui.msgT.textContent = rider.why;
    ui.msgN.innerHTML = r.t > 0 ? `${r.score}${newBest ? '<small>NEW BEST</small>' : ''}` : '';
    const stat = (v, l) => `<div>${v}<span>${l}</span></div>`;
    ui.msgS.innerHTML = r.t > 0 ? stat(`${r.t.toFixed(1)}s`, 'RIDE') + stat(`${Math.round(r.top)}`, 'TOP KM/H') + stat(r.turns, 'TURNS') + (r.cutbacks ? stat(r.cutbacks, r.cutbacks > 1 ? 'CUTBACKS' : 'CUTBACK') : '') + (r.snaps ? stat(r.snaps, r.snaps > 1 ? 'SNAPS' : 'SNAP') : '') + (r.barrel > 0.2 ? stat(`${r.barrel.toFixed(1)}s`, 'BARREL') : '') : '';
    ui.sess.textContent = session.waves ? `Rides ${session.waves}  ·  session best ${session.best}  ·  all-time best ${Math.max(bestFor(mode), r.score)}` : '';
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
let last = performance.now(), T = 0, strokeT = 0, lastState = '', lastTrick = null, crashT = 1;
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
    wake.update(dt);
    updateCamera(dt);
    updateHUD(dt);
    // sound follows what's happening: the breaking wave is loud near the curl
    const st = rider.state, w = rider.wave;
    let near = 0;
    for (const v of waves) { const s = rider.x - v.peelX, zl = rider.z - v.zW; if (zl > -20 && zl < 25) near = Math.max(near, Math.max(0, 1 - Math.hypot(s < 0 ? s * 0.4 : s, zl) / (7 * v.cond.H))); }
    let underwater = false;
    if (st === 'WIPE' && W.on && surfer) { const b = surfer.position; underwater = W.t < 1.4 && b.y < heightAt(waves, b.x, b.z) - 0.2; }
    audio.update({ H: w ? w.cond.H : 1.5, near, barrel: rider.inBarrel && st === 'RIDE', riding: rider.standing, v: rider.v, turn: rider.turn + Math.max(rider.skid, (rider.slide || 0) * 2) * 2.5, storm: ENV.weather ? ENV.weather.chop / 2.4 : 0, rain: ENV.weather ? ENV.weather.rain : 0, underwater });
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
window.__g = { paused: false, audio, renderer, scene, camera, rig, get surfer() { return surfer; }, get rider() { return rider; }, get waves() { return waves; }, incoming, input, keys, setMode: (m) => { mode = m; setWeather(m); ui.cond.textContent = m === 'random' ? 'Random' : CONDITIONS[m].name; for (const w of waves) w.dispose(scene); waves = []; nextBreak = T + 9; updateWaves(0); }, step: (sec, dt = 1 / 30, draw = true) => { for (let t = 0; t < sec; t += dt) tick(dt); if (draw) renderer.render(scene, camera); }, spawnRider, get T() { return T; }, want: () => _want };
