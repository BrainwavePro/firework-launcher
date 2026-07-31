// Procedural Web Audio sound effects — no audio assets needed.

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;      // SFX-only bus (music has its own gain into master)
    this.sfxVol = 1;
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
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxVol;
      this.sfx.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** SFX volume 0..1 (music is controlled by MusicEngine.setVolume). */
  setSfxVolume(v) {
    this.sfxVol = v;
    if (this.sfx) this.sfx.gain.value = v;
  }

  _noise(dur, filterType, f0, f1, vol, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
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
    src.connect(filt).connect(g).connect(this.sfx);
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
    osc.connect(g).connect(this.sfx);
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
      case 'chrysboom':
        this._noise(0.9, 'lowpass', 1400, 90, 0.5);
        this._tone(0.7, 'sine', 90, 32, 0.4);
        // Crackle tail as the sparkles strobe.
        for (let i = 0; i < 8; i++) {
          this._noise(0.07, 'highpass', 2500, 4000, 0.12, 0.35 + i * 0.13 + Math.random() * 0.05);
        }
        break;
      case 'diabloPop':
        this._noise(0.08, 'bandpass', 1400, 500, 0.5);
        this._tone(0.1, 'square', 420, 180, 0.15);
        break;
      case 'diabloBoom':
        this._noise(2.6, 'lowpass', 900, 30, 0.9);
        this._tone(2.2, 'sine', 55, 22, 0.6);
        this._tone(1.4, 'sawtooth', 42, 20, 0.2, 0.1);
        break;
      case 'ring':
        this._noise(0.5, 'lowpass', 1000, 120, 0.3);
        this._tone(0.8, 'sine', 1400, 220, 0.09);
        break;
      case 'crackle':
        this._noise(0.09, 'highpass', 2500, 4000, first ? 0.3 : 0.18);
        if (first) this._tone(0.3, 'sine', 120, 50, 0.2);
        break;
      case 'curtain':
        if (first) this._noise(0.5, 'lowpass', 900, 100, 0.3);
        this._noise(0.08, 'highpass', 1800, 3200, 0.12);
        break;
      case 'seeker':
        this._tone(0.3, 'sawtooth', 500, 1400, 0.07);
        this._noise(0.25, 'bandpass', 800, 2200, 0.06);
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

  /** Metallic "it didn't die" clank when a blast fails to crack armor. */
  armorClank() {
    this._noise(0.12, 'bandpass', 2600, 700, 0.3);
    this._tone(0.15, 'square', 220, 90, 0.15);
  }

  bombDrop() {
    this._tone(0.6, 'sine', 1500, 400, 0.05);
  }

  bossAlarm() {
    [392, 523, 392, 523].forEach((f, i) => this._tone(0.26, 'square', f, f, 0.12, i * 0.3));
  }

  bossHit() {
    this._noise(0.2, 'lowpass', 700, 120, 0.3);
    this._tone(0.15, 'triangle', 160, 70, 0.18);
  }

  bossDown() {
    this._noise(2.0, 'lowpass', 1000, 40, 0.8);
    this._tone(1.6, 'sine', 60, 24, 0.5);
    // Victory arpeggio once the rumble fades.
    [659, 784, 1047].forEach((f, i) => this._tone(0.2, 'triangle', f, f, 0.12, 0.9 + i * 0.12));
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
