// Surf physics. The rider lives on the wave's front face, in the wave's own frame:
//   x  = position along the wave (world metres; the break peels toward +x at cond.peel m/s)
//   a  = where on the face: 0 = the trough/toe, 1 = the top of the rideable face (just under the lip)
//   v  = board speed (m/s), psi = heading on the face: 0 = straight down the line (+x), + = up the face, - = down it
// Each frame: gravity pulls you down the slope, the pocket (just ahead of the curl) drives you forward,
// water drag slows you, and the moving face slowly lifts you toward the lip. Falls come from real mistakes.
import * as THREE from 'three';

export const RIDE = {
  g: 9.8,
  pocket: 6.5,            // forward push in the pocket (m/s^2), scaled per condition
  drag: 0.22, drag2: 0.018,
  lift: 0.16,             // how fast the face carries you up toward the lip if you ride straight (per second, in a)
  gripBase: 20,           // how hard you can carve before the rail lets go (m/s^2 sideways); lower in heavy surf
  turnSlow: 2.6, turnFast: 1.6,    // turn rate (rad/s) at low / high speed
  maxAngle: 0.85,         // steepest lean up or down the face (radians)
  lineSpan: 0.38,         // full thumb moves your line this far from mid-face (0.5 +/- this)
  lineGain: 3.2,          // how eagerly you lean toward your line
  skidLoss: 4,             // speed lost per second while the tail is skidding
  stall: 1.4,             // below this speed the wave leaves you
  stallHigh: 3.2,         // extra drag high on the face
  pump: 0.45,             // share of the drop you add by pumping
  paddleMax: 2.1, paddleAcc: 1.6,
  slide: 0.35,            // how much of the face's slope turns into speed while it lifts you (board still flat in the water)
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Samples the face of the slice at distance s ahead of the break. Returns height y, depth z and slope angle th
// at face position a (0..1). Cached per 0.2 m of s because the wave shape is fixed for a condition.
export class Face {
  constructor(wave) { this.wave = wave; this.cache = new Map(); }
  slice(s) {
    const key = Math.round(s * 5);
    let c = this.cache.get(key);
    if (c) return c;
    const out = new Float32Array(64 * 4); this.wave.section(key / 5, out);
    // the rideable face runs from the toe (sample ~6 of 64) up to the upper face (sample ~22); find it by index
    const pts = [];
    for (let j = 5; j <= 24; j++) pts.push([out[j * 4], out[j * 4 + 1]]);
    let L = 0; const acc = [0];
    for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(L); }
    c = { pts, acc, L: Math.max(L, 0.3), ...this.wave.shapeAt(key / 5) };
    if (this.cache.size > 4000) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }
  // water height at (s, z) on the front of the wave (the face and the flat water in front of it)
  surfaceY(s, z) {
    const c = this.slice(s), P = c.pts;
    if (z >= P[0][0]) return Math.max(0, P[0][1]);
    for (let i = 1; i < P.length; i++) if (z >= P[i][0]) { const t = (z - P[i][0]) / (P[i - 1][0] - P[i][0] || 1e-6); return P[i][1] + (P[i - 1][1] - P[i][1]) * t; }
    const top = P[P.length - 1];                    // past the top of the face: the back of the wave slopes away
    return Math.max(0, top[1] - (top[0] - z) * 0.55);
  }
  // depth (z) of the front of the wave at height y: anything shoreward of this is open air in front of the face
  zAtHeight(s, y) {
    const P = this.slice(s).pts;
    for (let i = 1; i < P.length; i++) if (P[i][1] >= y) { const t = (y - P[i - 1][1]) / Math.max(1e-6, P[i][1] - P[i - 1][1]); return P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t; }
    return P[P.length - 1][0];
  }
  at(s, a) {
    const c = this.slice(s), target = Math.min(1, Math.max(0, a)) * c.L;
    let i = 1; while (i < c.acc.length - 1 && c.acc[i] < target) i++;
    const t = (target - c.acc[i - 1]) / Math.max(1e-6, c.acc[i] - c.acc[i - 1]);
    const p0 = c.pts[i - 1], p1 = c.pts[i];
    const z = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t;
    const th = Math.atan2(p1[1] - p0[1], Math.abs(p1[0] - p0[0]) + 1e-6);   // face angle from horizontal
    return { z, y, th, L: c.L, curl: c.curl, broken: c.broken };
  }
}

export class Rider {
  constructor(wave) {
    this.wave = wave; this.face = new Face(wave);
    this.reset();
  }
  reset() {
    this.state = 'WAIT';            // WAIT -> PADDLE -> POPUP -> RIDE -> (WIPE | DONE)
    this.stateT = 0;
    this.x = 0; this.a = 0; this.v = 0; this.psi = 0; this.turn = 0;
    this.zRel = 36;                 // while waiting/paddling: metres in front of the wave's toe
    this.paddleV = 0; this.heading = 0;   // paddling heading: 0 = toward the beach, + = angled toward +x (down the line)
    this.ride = { t: 0, top: 0, barrel: 0, pocket: 0, turns: 0, speed: 0, end: 0, score: 0 }; this.skid = 0; this.lastSide = 0; this.lifting = false; this.u = 0; this.paddleT = 0; this.pumpHold = 0; this.pumping = false; this.inBarrel = false; this.why = '';
  }
  get s() { return this.x - this.wave.peelX; }
  set(state) { this.state = state; this.stateT = 0; }

  update(dt, inp) {
    const C = this.wave.cond, H = C.H;
    this.stateT += dt;
    if (this.state === 'WAIT' || this.state === 'PADDLE') {
      // lying on the board: hold PADDLE to move toward the beach; the wheel angles you along the wave
      if (inp.paddle && this.state === 'WAIT') this.state = 'PADDLE';
      if (inp.paddle) this.paddleT += dt;
      this.paddleV += ((inp.paddle ? RIDE.paddleMax : 0) - this.paddleV) * Math.min(1, dt * (inp.paddle ? RIDE.paddleAcc : 0.6));
      this.heading = Math.max(-1.1, Math.min(1.1, this.heading + inp.steer * 1.4 * dt));
      this.x += Math.sin(this.heading) * this.paddleV * dt;
      // the wave rolls in at its own speed; you close the gap only as fast as the wave outruns your paddling
      if (!this.lifting) this.zRel -= (C.speed - Math.cos(this.heading) * this.paddleV) * dt;
      const s = this.s;
      if (this.zRel <= 0 && !this.lifting) {
        // the face reaches you: if it's already broken here you get hit, otherwise it starts lifting you
        if (s < -0.3 * H) return this.wipe(s < -4.5 * H ? 'The whitewater ran you over' : this.paddleT > 4 ? 'Paddled too early: you ended up inside it' : 'Caught inside: it broke right on you');
        if (this.state === 'WAIT') this.state = 'PADDLE';   // the wave picks you up: you're lying down and facing in now
        this.lifting = true; this.a = 0.03; this.u = Math.max(0, Math.cos(this.heading) * this.paddleV);
      }
      if (this.lifting) {
        // on the face: you slide down it (gravity), your paddling adds a little, the water drags;
        // the wave keeps moving under you. Match its speed before it passes and you're on.
        const f = this.face.at(s, this.a);
        this.u += (RIDE.g * Math.sin(f.th) * RIDE.slide + (inp.paddle ? RIDE.paddleAcc * 1.2 : 0) - 0.35 * this.u) * dt;
        this.a = Math.max(0, this.a + (C.speed - this.u) / f.L * dt);
        if (s < -0.3 * H) return this.wipe('Too late: it broke on top of you');
        if (this.u >= C.speed * 0.82) {
          if (this.heading < -0.3) return this.done('Went left: this reef only peels right');
          this.set('POPUP'); this.v = this.u + 0.8 + 0.1 * C.peel; this.psi = -0.25 * C.forgive;   // pop up angled slightly down the line
          return;
        }
        if (this.a > 0.97) return this.done(this.paddleV > RIDE.paddleMax * 0.6 ? 'It rolled under you: start paddling earlier' : 'Not enough speed: hold PADDLE as it comes');
      }
      return;
    }
    if (this.state === 'POPUP') {
      this.physics(dt, { steer: 0 }, 0.6);
      if (this.stateT > 0.45) this.set('RIDE');
      return;
    }
    if (this.state === 'RIDE') { this.physics(dt, inp, 1); this.ride.t += dt; return; }
  }

  physics(dt, inp, control) {
    const C = this.wave.cond, H = C.H;
    const s = this.s, f = this.face.at(s, this.a);
    const sinTh = Math.sin(f.th);
    // steering: the wheel sets how hard you turn; fast boards carve wider arcs
    const rate = RIDE.turnSlow + (RIDE.turnFast - RIDE.turnSlow) * smooth(3, 11, this.v);
    // the thumb sets how far you lean the board up (+) or down (-) the face; let go and it runs straight along the line.
    // The board can only swing round so fast (slower at speed, gentler on small faces).
    // The thumb picks the line you want to ride: far left = high line (slow, the stall), middle = mid-face trim,
    // far right = low line (fast). You lean the board toward that line, looking a moment ahead like a real surfer,
    // limited by how fast the board can turn and how much the fins can hold.
    const line = 0.5 + RIDE.lineSpan * inp.steer * control;   // inp.steer + = up the face (thumb left)
    const ahead = this.a + Math.sin(this.psi) * this.v / f.L * 0.3;
    const target = Math.max(-RIDE.maxAngle, Math.min(RIDE.maxAngle, (line - ahead) * RIDE.lineGain));
    const maxRate = rate * (0.6 + 0.4 * smooth(1, 2.5, f.L));
    let wantTurn = Math.max(-maxRate, Math.min(maxRate, (target - this.psi) * 5));
    // the fins can only hold so much sideways load (less in heavy surf): ask for more and the tail skids out, scrubbing speed
    const grip = RIDE.gripBase * (1.1 - 0.08 * H);
    const gripRate = grip / Math.max(this.v, 1);
    this.skid = Math.abs(wantTurn) > gripRate ? Math.min(1, (Math.abs(wantTurn) - gripRate) / gripRate) : 0;
    if (this.skid) wantTurn = Math.sign(wantTurn) * gripRate;
    this.turn += (wantTurn - this.turn) * Math.min(1, dt * 10);
    this.psi += this.turn * dt;
    this.psi = Math.max(-1.3, Math.min(1.3, this.psi));
    // forces along the board
    const down = -Math.sin(this.psi);                               // 1 = pointing straight down the face
    const grav = RIDE.g * sinTh * down;
    // the pocket: power right ahead of the curl, fading out along the shoulder; mid-face best
    // out on the flat shoulder there is almost no push: you slow down and the curl catches back up to you
    const pocketAlong = s > -4.5 * H ? (s < 0 ? 1 : 1 - smooth(0.5 * H, 4 * H, s)) : 0;
    // the stall line: high on the face bleeds speed. Inside a hollow tube it starts lower (riding high in the barrel = hand-drag stall)
    const tubeZone = C.hollow > 0.5 ? smooth(-0.2 * H, -0.7 * H, s) * (1 - smooth(-4 * H, -4.5 * H, s)) : 0;
    const hi0 = 0.68 - 0.2 * tubeZone;
    const pocketHigh = (0.2 + 0.8 * smooth(0.1, 0.35, this.a)) * (1 - 0.75 * smooth(hi0, hi0 + 0.27, this.a));
    const push = RIDE.pocket * (0.7 + 0.25 * C.H) * pocketAlong * pocketHigh * Math.max(0, Math.cos(this.psi));
    // flats are slow; riding high near the lip stalls you (that's how you let the curl catch up for a barrel)
    const drag = RIDE.drag * this.v + RIDE.drag2 * this.v * this.v + (this.a < 0.05 ? 1.2 : 0) + RIDE.stallHigh * C.forgive * smooth(hi0, hi0 + 0.27, this.a) * Math.min(1, this.v / 3);
    // pumping: push the board into the face on the way down (more speed out of the drop), stay light going up.
    // Pushing while climbing just bogs you down, and legs can only push for so long before they're fully compressed.
    this.pumpHold = inp.pump ? this.pumpHold + dt : 0;
    const legs = 1 - smooth(0.45, 1.1, this.pumpHold);
    const pump = inp.pump ? RIDE.pump * RIDE.g * sinTh * down * (down > 0 ? legs : 1.3) : 0;
    this.pumping = inp.pump && down > 0 && legs > 0.2;
    this.v = Math.max(0, this.v + (grav + push + pump - drag) * dt);
    // move: along the wave and up/down the face; the face also carries you up toward the lip
    this.x += Math.cos(this.psi) * this.v * dt;
    this.a += (Math.sin(this.psi) * this.v / f.L + RIDE.lift * C.forgive * (0.4 + 0.6 * pocketAlong) * (0.5 + f.curl)) * dt;
    this.a = Math.max(0, this.a);
    // bookkeeping
    if (this.skid) this.v = Math.max(0, this.v - RIDE.skidLoss * this.skid * dt);
    const kmh = this.v * 3.6; this.ride.top = Math.max(this.ride.top, kmh);
    if (this.state === 'RIDE') this.ride.speed += Math.max(0, this.v - C.peel) * dt;   // outrunning the peel = real speed
    const s2 = this.s;
    // inside the tube = behind where the lip lands and under the ceiling; out on the flats in front of it is where the lip lands
    const fz = this.face.at(s2, this.a).z, lip = this.wave.lipAt(s2), lipDown = C.hollow > 0.5 && lip[1] < 0.45 * H;
    this.inBarrel = lipDown && s2 < -0.4 * H && s2 > -4.5 * H && fz < lip[2] - 0.25 && this.a < 0.75;
    this.underLip = lipDown && s2 < -0.3 * H && s2 > -4.5 * H && Math.abs(fz - lip[2]) < 0.45 + 0.1 * H;
    if (this.inBarrel && this.state === 'RIDE') this.ride.barrel += dt;
    if (this.state === 'RIDE' && s2 > -0.5 * H && s2 < 3 * H) this.ride.pocket += dt;   // surfing close to the curl
    // turns: a swing from climbing to dropping (or back) at speed counts as a real top or bottom turn
    if (this.state === 'RIDE') {
      if (this.psi > 0.35 && this.lastSide !== 1) { if (this.lastSide === -1 && this.v > C.peel * 0.9) this.ride.turns++; this.lastSide = 1; }
      else if (this.psi < -0.35 && this.lastSide !== -1) { if (this.lastSide === 1 && this.v > C.peel * 0.9) this.ride.turns++; this.lastSide = -1; }
    }
    if (this.state !== 'RIDE') return;
    // mistakes
    if (this.a > 1.02 + 0.15 * (1 - C.forgive) && s2 < 1.2 * H) return this.wipe('Too high: the lip threw you over the falls');
    if (this.a > 1.12) return this.done('Kicked out over the back');
    if (s2 < -4.5 * H) return this.wipe(C.hollow > 0.5 ? 'The barrel closed on you' : 'The whitewater caught you');
    if (s2 < -0.3 * H && this.a > 0.8) return this.wipe('The lip landed on you');
    if (this.underLip) return this.wipe('The lip landed on you');
    if (this.v < RIDE.stall && this.ride.t > 1) return this.done('Lost speed: the wave left you');
    if (s2 > 60) return this.done('Rode it out to the end of the wave');
    if (this.wave.peelX > this.wave.reefEnd) { this.ride.end = 1; return this.done('Made it to the end of the reef'); }
  }

  // like a contest judge: turns, speed, time in the barrel and in the pocket; just riding along earns little
  liveScore() { const r = this.ride; return Math.round(r.t * 2 + r.pocket * 4 + r.turns * 25 + r.speed * 6 + r.barrel * 80 + r.end * 100); }
  wipe(why) { this.why = why; this.set('WIPE'); this.score(true); }
  done(why) {
    // from wherever you are on the face, the wave now rolls on under you (pose() follows zRel from here)
    if (this.lifting || this.state === 'POPUP' || this.state === 'RIDE') {
      const s = this.s; this.zRel = this.face.at(s, Math.min(this.a, 1.05)).z - this.face.at(s, 0).z - 0.6; this.lifting = false;
    }
    this.why = why; this.set('DONE'); this.score(false);
  }
  score(wiped) {
    const r = this.ride;
    r.score = Math.round(this.liveScore() * (wiped && r.t > 0 ? 0.8 : 1));
  }

  // world transform of the board: position on the face and orientation (forward along heading, up = face normal)
  pose(out) {
    const s = this.s;
    if (this.state === 'WAIT' || this.state === 'PADDLE' || this.state === 'DONE') {
      // lying on the water in front of the wave; as the face arrives it lifts you, and if you miss it, it rolls under you
      const toe = this.face.at(s, 0);
      if (this.lifting && this.state !== 'DONE') {
        const f = this.face.at(s, this.a), c = Math.cos(f.th), sn = Math.sin(f.th);
        out.pos.set(this.x, f.y + 0.05, f.z);
        out.fwd.set(Math.sin(this.heading) * c, -sn, Math.cos(this.heading) * c).normalize();   // nose pointing down the face
        out.up.set(0, c, sn);
        return out;
      }
      const zWorld = toe.z + this.zRel + 0.6;
      out.pos.set(this.x, 0.06 + this.face.surfaceY(s, zWorld), zWorld);
      out.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
      out.up.set(0, 1, 0);
      return out;
    }
    const f = this.face.at(s, Math.min(this.a, 1.05));
    const cth = Math.cos(f.th), sth = Math.sin(f.th);
    out.fwd.set(Math.cos(this.psi), sth * Math.sin(this.psi), -cth * Math.sin(this.psi)).normalize();   // along the line (+x) turned up/down the face
    out.up.set(0, cth, sth).normalize();                           // face normal (out of the wall, toward the beach/sky)
    out.pos.set(this.x, f.y + 0.04, f.z).addScaledVector(out.up, 0.03);
    return out;
  }
}
