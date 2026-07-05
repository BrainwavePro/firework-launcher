// Procedural Web Audio sound effects — no audio assets needed.

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  /** Must be called from a user gesture before any sound will play. */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noise(dur, filterType, f0, f1, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  _tone(dur, type, f0, f1, vol, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  launch() {
    this._noise(0.45, 'bandpass', 500, 2400, 0.12);
    this._tone(0.4, 'sine', 300, 900, 0.05);
  }

  /** One blast-zone activation. `first` = the primary detonation of a burst. */
  zone(kind, first) {
    switch (kind) {
      case 'bigboom':
        this._noise(0.9, 'lowpass', 1400, 90, 0.5);
        this._tone(0.7, 'sine', 90, 32, 0.4);
        break;
      case 'ring':
        this._noise(0.5, 'lowpass', 1000, 120, 0.3);
        this._tone(0.8, 'sine', 1400, 220, 0.09);
        break;
      case 'crackle':
        this._noise(0.09, 'highpass', 2500, 4000, first ? 0.3 : 0.18);
        if (first) this._tone(0.3, 'sine', 120, 50, 0.2);
        break;
      case 'pop':
        this._noise(0.12, 'bandpass', 900, 300, 0.15);
        break;
      default: // 'boom'
        if (!first) break;
        this._noise(0.55, 'lowpass', 1100, 110, 0.35);
        this._tone(0.5, 'sine', 110, 40, 0.28);
    }
  }

  cityHit() {
    this._noise(1.0, 'lowpass', 400, 40, 0.55);
    this._tone(0.9, 'sawtooth', 70, 24, 0.22);
  }

  waveClear() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this._tone(0.22, 'triangle', f, f, 0.14, i * 0.11));
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => this._tone(0.4, 'triangle', f, f * 0.97, 0.16, i * 0.22));
  }
}
