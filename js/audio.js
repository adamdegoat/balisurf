// All sound is made on the fly from filtered noise (no audio files to download):
// the sea, the breaking wave, the board hissing across the face, wind and rain, thunder, splashes, going under.
export class SurfAudio {
  constructor() { this.ok = false; }
  start() {
    if (this.ok) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(); this.ok = true;
    // 4 s of pink-ish noise, looped by every layer
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.03; b1 = 0.96 * b1 + w * 0.3; b2 = 0.6 * b2 + w; d[i] = (b0 * 3 + b1 + b2 * 0.3) * 0.25; }
    this.noise = buf;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.under = ctx.createBiquadFilter(); this.under.type = 'lowpass'; this.under.frequency.value = 18000;   // muffles everything underwater
    this.master.connect(this.under).connect(ctx.destination);
    const layer = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random() * 3;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(fl).connect(g).connect(this.master); src.start(0, Math.random() * 3);
      return { fl, g };
    };
    this.sea = layer('lowpass', 500, 0.5);        // distant surf, always there
    this.roar = layer('bandpass', 260, 0.7);      // the breaking wave, loud near the curl
    this.tube = layer('lowpass', 180, 2.5);       // hollow boom inside the barrel
    this.hiss = layer('highpass', 1800, 0.6);     // board rail through the water
    this.wind = layer('bandpass', 700, 0.4);      // wind, stronger in the storm
    this.rain = layer('highpass', 4000, 0.3);     // rain on the water
  }
  set(p, v, t = 0.12) { if (this.ok) p.setTargetAtTime(v, this.ctx.currentTime, t); }
  // one-off burst of filtered noise: splashes, paddle strokes, thunder
  burst(gain, freq, dur, type = 'bandpass', delay = 0) {
    if (!this.ok) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = type === 'lowpass' ? 0.5 : 1;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.04, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(g).connect(this.master); src.start(t0, Math.random() * 3); src.stop(t0 + dur + 0.05);
  }
  // called every frame with what's going on
  update(o) {
    if (!this.ok) return;
    this.set(this.sea.g.gain, 0.22 + 0.1 * o.H);
    this.set(this.roar.g.gain, Math.min(0.9, (0.08 + 0.55 * o.near) * (0.6 + 0.2 * o.H)));
    this.set(this.roar.fl.frequency, 200 + 160 * o.near);
    this.set(this.tube.g.gain, o.barrel ? 0.9 : 0, 0.25);
    this.set(this.hiss.g.gain, o.riding ? Math.min(0.45, 0.015 * o.v + 0.05 * Math.abs(o.turn) * o.v / 5) : 0, 0.06);
    this.set(this.hiss.fl.frequency, 1200 + 90 * o.v);
    this.set(this.wind.g.gain, 0.04 + 0.2 * o.storm + 0.006 * o.v);
    this.set(this.rain.g.gain, 0.25 * o.rain);
    this.set(this.under.frequency, o.underwater ? 420 : 18000, o.underwater ? 0.05 : 0.3);
  }
  paddle() { this.burst(0.18, 900 + Math.random() * 400, 0.25); }
  splash(size = 1) { this.burst(0.5 * size, 700, 0.9 * size); this.burst(0.35 * size, 2500, 0.5 * size, 'highpass'); }
  thunder(dist = 1) { this.burst(0.9, 90, 3.5, 'lowpass', 0.4 + dist * 1.5); this.burst(0.4, 260, 1.2, 'lowpass', 0.35 + dist * 1.5); }
  pause(on) { if (!this.ok) return; on ? this.ctx.suspend() : this.ctx.resume(); }
}
