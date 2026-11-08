// Synthesised sound effects (WebAudio) – no audio files needed.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('giggabike.muted') === '1'; } catch (e) { /* ignore */ }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(ctx.destination);

    this.eng = ctx.createOscillator(); this.eng.type = 'sawtooth';
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square';
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 600;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.eng.connect(this.engFilter); this.eng2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.eng.frequency.value = 50; this.eng2.frequency.value = 26;
    this.eng.start(); this.eng2.start();

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('giggabike.muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  engine(on, speed, turbo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 42 + speed * 0.5 + (turbo ? 22 : 0);
    this.eng.frequency.setTargetAtTime(f, t, 0.04);
    this.eng2.frequency.setTargetAtTime(f * 0.5 + 2, t, 0.04);
    this.engFilter.frequency.setTargetAtTime(400 + speed * 5 + (turbo ? 700 : 0), t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.05 + speed / 3000 : 0, t, 0.08);
  }

  tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  countdown(final) { this.tone(final ? 880 : 440, final ? 0.5 : 0.18, 'square', 0.12); }
  crash() { this.noise(0.6, 0.35, 900); this.tone(180, 0.4, 'sawtooth', 0.1, 50); }
  land() { this.noise(0.12, 0.18, 400); }
  perfect() { this.tone(660, 0.08, 'square', 0.08); this.tone(990, 0.12, 'square', 0.08, null, 0.07); }
  cool() { this.tone(1200, 0.1, 'triangle', 0.1, 600); }
  boost() { this.noise(0.35, 0.15, 3000); this.tone(300, 0.35, 'sawtooth', 0.07, 900); }
  overheat() { for (let i = 0; i < 4; i++) this.tone(i % 2 ? 520 : 760, 0.14, 'square', 0.1, null, i * 0.15); }
  select() { this.tone(700, 0.06, 'square', 0.08); }
  finish() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.1, null, i * 0.12)); }
}
