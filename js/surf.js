// Surf physics: a board on the real water surface.
// World: x runs along the reef (the break peels toward +x, a right-hander), z points to the beach, y is up.
// Waves roll in along +z at their speed c and break along the reef at the peel rate. The board moves freely in x/z;
// its height is the water surface under it. Forces: gravity down whatever slope you're on, the water moving with the
// wave, drag (low along the board, very high sideways once you're standing: that's the fins), paddling, pumping.
// Catching, stalling, barrels, kick-outs and wipeouts all come out of that, not out of scripts.

export const RIDE = {
  g: 9.8,
  // lying on the board
  paddleThrust: 2.6, paddleMax: 2.4,   // arms: thrust (m/s^2) fading to nothing at paddleMax (m/s); a good paddler holds ~1.8 m/s
  lieDrag: 0.25, lieDrag2: 0.3, lieLat: 2.2,   // a lying board sits in the water: the moving water grabs it
  lieTurn: 1.5, paddleTurn: 1.1,       // rad/s turning while sitting / paddling
  lieGravity: 0.9,                     // a lying board is half in the water: less of the slope turns into speed
  // standing
  drag: 0.09, drag2: 0.013,            // planing drag along the board
  // carving works like a skier or a leaning bike: you tip the board onto its rail and the lean makes the turn,
  // turn rate = g * tan(lean) / speed. The fins hold up to gripMax sideways; lean past that and the tail drifts out.
  leanMax: 1.15, leanRate: 4.5, leanEase: 9, yawLag: 0.1,        // full thumb = ~66 deg on the rail (a ~2.3 g carve); how fast you can roll the board over (rad/s)
  finGrip: 4.2, gripMax: 20,            // sideways: fins kill sliding at this rate, up to this much force (m/s^2): a buried rail holds ~2 g
  skidLoss: 0.16,                      // share of the excess sideways force lost as speed while the tail drifts
  pump: 0.5,                           // pumping adds this share of the downhill pull (and costs 1.2x that when climbing)
  popTime: 0.35,                       // seconds from lying to standing
  waterPush: 1.0,                      // how much the wave's moving water carries you
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The surface of one wave, slice by slice (cached per 20 cm of s): the front (flat water in front, up the face to the top)
// and the back (from behind the wave up to the crest). Heights in the wave's own frame: zl = z - wave.zW.
export class Profile {
  constructor(wave) { this.w = wave; this.cache = new Map(); this.buf = new Float32Array(256); }
  slice(s) {
    const key = Math.round(s * 5);
    let c = this.cache.get(key);
    if (c) return c;
    const w = this.w, o = this.buf, H = w.cond.H, sk = key / 5; w.section(sk, o);
    const F = [[o[0], o[1]]];
    let j = 1;
    for (; j < 64; j++) { const z = o[j * 4], y = o[j * 4 + 1], p = F[F.length - 1]; if (z >= p[0] - 1e-4 || y < p[1] - 1e-3) break; F.push([z, y]); }
    const B = [[o[63 * 4], o[63 * 4 + 1]]];
    for (let k = 62; k > j; k--) { const z = o[k * 4], y = o[k * 4 + 1], p = B[B.length - 1]; if (z <= p[0] + 1e-4 || y < p[1] - 1e-3) break; B.push([z, y]); }
    const sh = w.shapeAt(sk), amp = sk > 0 ? 1 - 0.55 * smooth(8, 70, sk) : 1 - 0.15 * smooth(0, 40, -sk);
    c = { F, B, top: Math.max(F[F.length - 1][1], B[B.length - 1][1]), topZ: F[F.length - 1][0], broken: sh.broken, curl: sh.curl,
      lipY: sh.P[7][1] * H * amp, lipZ: sh.P[7][0] * H };
    if (this.cache.size > 6000) this.cache.clear();
    this.cache.set(key, c);
    return c;
  }
  // work out the shape a little at a time in quiet frames, so the first time a wave reaches you there's no hitch
  warm(n) {
    if (this.warmK === undefined) this.warmK = -50 * 5;
    for (let i = 0; i < n && this.warmK <= 66 * 5; i++, this.warmK++) this.slice(this.warmK / 5);
  }
  // height blended between the two nearest slices, so the surface is continuous along the wave (no 20 cm steps)
  height(s, zl) {
    const k = s * 5, k0 = Math.floor(k), t = k - k0;
    const h0 = this.heightSlice(this.slice(k0 / 5), zl);
    return t < 1e-3 ? h0 : h0 + (this.heightSlice(this.slice((k0 + 1) / 5), zl) - h0) * t;
  }
  heightSlice(c, zl) {
    const F = c.F, B = c.B;
    if (zl >= F[0][0]) return 0;
    if (zl >= F[F.length - 1][0]) {
      for (let i = 1; i < F.length; i++) if (zl >= F[i][0]) { const t = (zl - F[i][0]) / (F[i - 1][0] - F[i][0] || 1e-6); return F[i][1] + (F[i - 1][1] - F[i][1]) * t; }
    }
    if (zl <= B[0][0]) return 0;
    if (zl <= B[B.length - 1][0]) {
      for (let i = 1; i < B.length; i++) if (zl <= B[i][0]) { const t = (zl - B[i][0]) / (B[i - 1][0] - B[i][0] || 1e-6); return B[i][1] + (B[i - 1][1] - B[i][1]) * t; }
    }
    return c.top;                                     // over the crest
  }
  // how far toward the beach the face reaches at height y (anything shoreward of this is open air in front of the wave)
  frontZAt(s, y) {
    const F = this.slice(s).F;
    for (let i = 1; i < F.length; i++) if (F[i][1] >= y) { const t = (y - F[i - 1][1]) / Math.max(1e-6, F[i][1] - F[i - 1][1]); return F[i - 1][0] + (F[i][0] - F[i - 1][0]) * t; }
    return F[F.length - 1][0];
  }
}

// Everything the rider needs to know about the water at a point: which wave, where on it, how high
const SPAN_LO = -50, SPAN_HI = 66;                    // the wave mesh covers s from -55 to 70
export function waterAt(waves, x, z, out) {
  out.y = 0; out.w = null;
  for (const w of waves) {
    const s = x - w.peelX; if (s < SPAN_LO || s > SPAN_HI) continue;
    const zl = z - w.zW; if (zl > 20 || zl < -14) continue;
    const y = w.prof.height(s, zl) * w.fade;
    if (y > out.y || !out.w) { out.y = y; out.w = w; out.s = s; out.zl = zl; }
  }
  return out;
}
const _q = {}, _c = {}, IDLE = { paddle: false, pump: false, steer: 0 };
export function heightAt(waves, x, z) { return waterAt(waves, x, z, _q).y; }

export class Rider {
  constructor() { this.reset(0, -6, -Math.PI / 2); }
  reset(x, z, th) {
    this.x = x; this.z = z; this.y = 0; this.vx = 0; this.vz = 0; this.th = th;
    this.state = 'LIE'; this.stateT = 0; this.why = ''; this.washed = false;
    this.paddling = false; this.paddleT = 0; this.catchT = 0;
    this.turn = 0; this.lean = 0; this.skid = 0; this.v = 0; this.hx = 0; this.hz = 0; this.gAlong = 0;
    this.wave = null; this.s = 99; this.zl = 99; this.inBarrel = false; this.onFace = false; this.lowT = 0;
    this.pumpHold = 0; this.pumping = false;
    this.ride = { t: 0, top: 0, barrel: 0, pocket: 0, turns: 0, cutbacks: 0, snaps: 0, speed: 0, end: 0, score: 0 }; this.turnSign = 0; this.cbArmed = false; this.snapArm = 0; this.trick = null;
  }
  set(state) { this.state = state; this.stateT = 0; }
  get standing() { return this.state === 'POP' || this.state === 'RIDE'; }
  get active() { return this.state !== 'OUT' && this.state !== 'WIPE'; }

  update(dt, inp, waves) {
    this.stateT += dt;
    if (this.state === 'WIPE') return;
    // after a ride ends you sit on your board and the wave rolls on under you: keep the water physics going, no control
    const idle = this.state === 'OUT', use = idle ? IDLE : inp;
    const n = dt > 0.02 ? 3 : 2, h = dt / n;
    for (let i = 0; i < n && this.state !== 'WIPE' && (idle || this.state !== 'OUT'); i++) this.step(h, use, waves);
  }

  step(h, inp, waves) {
    const P = RIDE, g = P.g;
    // the water here: height, slope (finite differences), which wave
    const q = waterAt(waves, this.x, this.z, _c), e = 0.15;
    const hx = (heightAt(waves, this.x + e, this.z) - heightAt(waves, this.x - e, this.z)) / (2 * e);
    const hz = (heightAt(waves, this.x, this.z + e) - heightAt(waves, this.x, this.z - e)) / (2 * e);
    this.y = q.y; this.hx = hx; this.hz = hz; this.wave = q.w; this.s = q.w ? q.s : 99; this.zl = q.w ? q.zl : 99;
    const w = q.w, C = w ? w.cond : null, H = C ? C.H : 1, cw = C ? C.speed : 0;
    const dx = Math.cos(this.th), dz = Math.sin(this.th);
    const slope2 = hx * hx + hz * hz;
    this.gAlong = hx * dx + hz * dz;                                   // rise per metre in the direction the board points
    // the water itself moves with the wave (shoreward, strongest under the crest), and the whitewater is a moving bore
    // (shallow-water flow c*y/(d+y) on a gentle swell; on a steep face near breaking the water at the crest moves at nearly c,
    //  which is exactly why it breaks: that's what picks a paddling surfer up)
    const sl = w ? w.prof.slice(q.s) : null;
    const d = H / 0.78, slopeNow = Math.sqrt(hx * hx + hz * hz);
    const steep = smooth(0.35, 1.2, slopeNow), hRel = sl ? Math.min(1, q.y / Math.max(0.3, sl.top)) : 0;
    let uz = w ? cw * Math.max(q.y / (d + q.y), Math.pow(hRel, 1.3) * (0.35 + 0.55 * steep)) * P.waterPush : 0;
    if (sl && sl.broken > 0.3 && q.zl > sl.topZ - 1.5 && q.y > 0.05) uz = Math.max(uz, cw * 0.85 * sl.broken);
    // Gravity along the surface, plus the push of the face itself. Work in the wave's own frame (moving along with the
    // peel and in toward the beach), where its shape stands still: a board sliding over a curved surface is pressed
    // against it by the curvature (the w.Hess.w term), so a face rising under you shoves you forward and down it.
    let curv = 0;
    if (w) {
      const wx = this.vx - C.peel, wz = this.vz - cw, ws = Math.hypot(wx, wz);
      if (ws > 0.05) {
        const ux = wx / ws, uz2 = wz / ws, ee = 0.3;
        const d2 = (heightAt(waves, this.x + ux * ee, this.z + uz2 * ee) - 2 * q.y + heightAt(waves, this.x - ux * ee, this.z - uz2 * ee)) / (ee * ee);
        curv = Math.max(-30, Math.min(30, ws * ws * d2));
      }
    }
    const gs = (this.standing ? 1 : P.lieGravity) * Math.max(0, g + curv) / (1 + slope2);
    let ax = -gs * hx, az = -gs * hz;
    // board velocity relative to the water: along the board and sideways
    const rx = this.vx, rz = this.vz - uz;
    const along = rx * dx + rz * dz, lx = rx - along * dx, lz = rz - along * dz;
    if (!this.standing) {
      // lying: slow hull, sitting up is a brake, arms push you along
      this.paddling = inp.paddle;
      this.paddleT = inp.paddle ? this.paddleT + h : 0;
      this.recentPaddle = inp.paddle ? 0.6 : Math.max(0, (this.recentPaddle || 0) - h);   // you only get into a wave by paddling for it
      const k = (P.lieDrag + P.lieDrag2 * Math.abs(along)) * (inp.paddle ? 1 : 1.8);
      ax += -k * along * dx - P.lieLat * lx; az += -k * along * dz - P.lieLat * lz;
      if (inp.paddle) { const f = P.paddleThrust * Math.max(0, 1 - (along / P.paddleMax) ** 2); ax += f * dx; az += f * dz; }
      this.th += inp.steer * (inp.paddle ? P.paddleTurn : P.lieTurn) * h;
      this.turn = 0; this.lean = 0; this.skid = 0;
    } else {
      // standing: planing drag along the board, fins stop it sliding sideways (up to their grip), carving turns the board
      const pop = this.state === 'POP' ? 0.4 : 1;
      const speed = Math.hypot(this.vx, this.vz);
      // roll the board toward the lean your thumb asks for (weight shifts take a moment), then the lean carves the turn
      const wantLean = inp.steer * P.leanMax * pop, dl = wantLean - this.lean, maxRoll = P.leanRate * h;
      this.lean += Math.max(-maxRoll, Math.min(maxRoll, dl * Math.min(1, h * P.leanEase)));
      // the board has momentum: its turning builds up and flows out over a fraction of a second, it doesn't switch on and off
      const wantTurn = P.g * Math.tan(this.lean) / Math.max(speed, 3.2);
      this.turn += (wantTurn - this.turn) * Math.min(1, h / P.yawLag);
      this.th += this.turn * h;
      // the tail can swing out, but the fins drag the nose back toward where the board is going through the water:
      // slip past ~17 deg is resisted, and it never passes ~35 deg (a drift, not a spin-out)
      this.slide = 0;
      if (Math.hypot(rx, rz) > 1.5) {
        // measured against the water the board is sliding on, not the ground
        const vd = Math.atan2(rz, rx); let slip = this.th - vd; slip = Math.atan2(Math.sin(slip), Math.cos(slip));
        const a = Math.abs(slip), soft = 0.3, hard = 0.62;
        this.slide = a;   // how far the tail is hanging out (rad): drives the spray fan and the hiss
        if (a > soft) { const na = a > hard ? hard : a - (a - soft) * Math.min(1, h * 6); this.th = vd + Math.sign(slip) * na; }
      }
      const dr = P.drag * along + P.drag2 * along * Math.abs(along);
      ax += -dr * dx; az += -dr * dz;
      // the harder you lay the rail over, the more the tail lets go: a little slide in an easy turn, a full drift at full thumb
      const release = 1 - 0.6 * smooth(0.3 * P.leanMax, P.leanMax, Math.abs(this.lean));   // the tail lets go gradually as you lean harder
      const latA = P.finGrip * Math.hypot(lx, lz), lim = P.gripMax * pop * release;
      this.skid = latA > lim ? Math.min(1, latA / lim - 1) : 0;
      const sc = latA > lim ? lim / latA : 1;
      ax += -P.finGrip * lx * sc; az += -P.finGrip * lz * sc;
      if (this.skid) { const loss = P.skidLoss * (latA - lim) * Math.sign(along); ax += -loss * dx; az += -loss * dz; }
      // pumping: weight the board on the way down, stay light going up. Legs only push for so long.
      this.pumpHold = inp.pump ? this.pumpHold + h : 0;
      const legs = 1 - smooth(0.45, 1.1, this.pumpHold);
      if (inp.pump) {
        const pull = g * Math.abs(this.gAlong) / (1 + slope2) * P.pump;
        const f = this.gAlong < 0 ? pull * legs : -pull * 1.2;
        ax += f * dx; az += f * dz;
      }
      this.pumping = inp.pump && this.gAlong < 0 && legs > 0.2;
      // popping up, the surfer throws their weight over the nose and drives the board down the face (the drop)
      if (this.state === 'POP') { const gl = Math.hypot(hx, hz) || 1, push = 3.2 * Math.min(1, gl); ax += -hx / gl * push; az += -hz / gl * push; }
    }
    this.vx += ax * h; this.vz += az * h;
    this.x += this.vx * h; this.z += this.vz * h;
    this.v = Math.hypot(this.vx, this.vz);
    this.judge(h, w, sl, q);
  }

  // what the wave does to you from here: catching, the barrel, the lip, the whitewater, kicking out, losing it
  judge(h, w, sl, q) {
    const P = RIDE;
    if (this.state === 'OUT') { this.inBarrel = false; this.onFace = false; return; }
    this.inBarrel = false; this.washed = false;
    if (!w) { this.onFace = false; if (this.standing) this.lostSpeed(h); return; }
    const C = w.cond, H = C.H, s = q.s, zl = q.zl, y = q.y, slope = Math.hypot(this.hx, this.hz);
    const lipDown = C.hollow > 0.5 && sl.lipY < 0.45 * H;
    const onFront = zl > sl.topZ - 0.3;                               // on the face side of the wave, not behind it
    this.onFace = onFront && slope > 0.22 && this.hz < -0.1;          // downhill is toward the beach
    // the lip lands on anyone under it
    if (lipDown && s < -0.3 * H && s > -4.5 * H && Math.abs(zl - sl.lipZ) < 0.45 + 0.1 * H && y < 0.55 * H) return this.wipe('The lip landed on you');
    if (!this.standing) {
      // caught inside: the whitewater rolls you toward the beach (you hang on to the board)
      if (sl.broken > 0.35 && onFront && y > 0.1 * H) this.washed = true;
      // pulled over the falls: lying at the top of a wave that's pitching
      if (onFront && y > 0.8 * sl.top && s < 0.6 * H && s > -2 * H && zl < sl.topZ + 0.4) return this.wipe('Too late: it pulled you over the falls');
      // the catch: on the face, heading for the beach, and going as fast as the wave
      // (once you're sliding down a steep enough face at a good share of its speed, it has you: you pop up and gravity does the rest)
      if (this.onFace && this.recentPaddle > 0 && Math.sin(this.th) > 0.2 && this.vz > C.speed * 0.5 && slope > 0.4) { this.catchT += h; if (this.catchT > 0.1) { this.set('POP'); this.catchT = 0; } }
      else this.catchT = 0;
      return;
    }
    if (this.state === 'POP' && this.stateT >= P.popTime) this.set('RIDE');
    const riding = this.state === 'RIDE';
    if (riding) this.ride.t += h;
    // falling out of the whitewater
    if (sl.broken > 0.4 && onFront && y > 0.12 * H) return this.wipe(C.hollow > 0.5 ? 'The whitewater caught you' : 'The whitewater knocked you off');
    // too high while it's throwing
    // (only a wave that pitches can throw you; a soft, crumbly one just breaks around you and the whitewater rule decides)
    if (C.hollow > 0.5 && onFront && y > 0.86 * sl.top && s < 0.6 * H && s > -2.2 * H && zl < sl.topZ + 0.35 && this.hz > -0.05) return this.wipe('Too high: the lip threw you over the falls');
    this.inBarrel = lipDown && s < -0.4 * H && s > -4.5 * H && zl < sl.lipZ - 0.25 && y < 0.62 * H && onFront;
    // over the back
    if (!onFront && y < 0.4 * Math.max(sl.top, 0.3)) return this.out('Kicked out over the back');
    const kmh = this.v * 3.6; this.ride.top = Math.max(this.ride.top, kmh);
    if (riding) {
      if (this.inBarrel) this.ride.barrel += h;
      if (onFront && s > -0.5 * H && s < 3 * H && y > 0.2 * H) this.ride.pocket += h;
      this.ride.speed += Math.max(0, this.v - C.peel) * h;
      // a turn counts when the carve swings hard one way and then hard the other at speed
      if (Math.abs(this.turn) > 0.9 && this.v > C.peel * 0.8) {
        const sg = Math.sign(this.turn);
        if (sg !== this.turnSign) { if (this.turnSign !== 0) this.ride.turns++; this.turnSign = sg; }
      }
      // a cutback: from running down the line, turn right round to face the breaking part, still with speed
      const hd = Math.cos(this.th);
      if (hd > 0.5) this.cbArmed = true;
      else if (this.cbArmed && hd < -0.5 && this.v > 0.45 * C.speed) { this.cbArmed = false; this.ride.cutbacks++; this.trick = { name: 'CUTBACK', t: 0 }; }
      // a snap (top turn): climb hard up to the lip, then whip the board back down the face from up there
      const relVz = this.vz - C.speed, hTop = y / Math.max(sl.top, 0.3);
      if (relVz < -1.2 && hTop > 0.6) this.snapArm = 1.2; else this.snapArm = Math.max(0, this.snapArm - h);
      if (this.snapArm > 0 && relVz > 0.8 && hTop > 0.5 && Math.abs(this.turn) > 0.9 && !(this.trick && this.trick.name === 'SNAP')) {
        this.snapArm = 0; this.ride.snaps++; this.trick = { name: 'SNAP', t: 0 };
      }
      if (this.trick) { this.trick.t += h; if (this.trick.t > 1.4) this.trick = null; }
      if (w.peelX > w.xEnd) { this.ride.end = 1; return this.out('Made it to the end of the reef'); }
      if (this.z > w.zBeach) { this.ride.end = 1; return this.out('Rode it all the way in'); }
    }
    this.lostSpeed(h);
  }
  lostSpeed(h) {
    this.lowT = (this.v < 2.2 || (!this.onFace && this.v < 3.2)) ? this.lowT + h : 0;
    if (this.lowT > 0.6) this.out(this.ride.t > 0 ? 'Lost speed: the wave left you' : 'Missed it');
  }

  // like a contest judge: turns, speed, time in the barrel and in the pocket; just riding along earns little
  liveScore() { const r = this.ride; return Math.round(r.t * 2 + r.pocket * 4 + r.turns * 25 + r.cutbacks * 60 + r.snaps * 40 + r.speed * 6 + r.barrel * 80 + r.end * 100); }
  wipe(why) { this.why = why; this.set('WIPE'); this.ride.score = Math.round(this.liveScore() * (this.ride.t > 0 ? 0.8 : 1)); }
  out(why) { this.why = why; this.set('OUT'); this.ride.score = this.liveScore(); }

  // world pose of the board: position, forward along the board, up out of the deck
  pose(out) {
    const dx = Math.cos(this.th), dz = Math.sin(this.th);
    out.pos.set(this.x, this.y + (this.standing ? 0.04 : 0.02), this.z);
    // a board never pitches past ~50 deg standing (nose and rail bite the water); lying or sitting it floats flatter, ~25 deg
    const lim = this.standing ? 1.25 : this.onFace ? 0.85 : 0.47;   // catching, it follows the face more
    out.fwd.set(dx, Math.max(-lim, Math.min(lim, this.gAlong)), dz).normalize();
    const k = Math.min(1, (this.standing ? 2.2 : 0.8) / Math.max(0.01, Math.hypot(this.hx, this.hz)));   // same limit for how far the deck tips
    out.up.set(-this.hx * k, 1, -this.hz * k).normalize();
    return out;
  }
}
