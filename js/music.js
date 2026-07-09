// Procedural retro chiptune engine — three channels (square lead, triangle
// bass, noise percussion) driven by a lookahead step sequencer on the shared
// AudioContext from AudioFX. No audio assets.

// Patterns are arrays of 16th-note steps indexed with modulo, so channels can
// have different lengths. Notes are MIDI numbers, null = rest.
// Drums: 'k' kick, 'h' hat, 's' snare, null = rest.

export const TRACKS = [
  { id: 'off', name: 'Off' },
  {
    id: 'neon', name: 'Neon Siege', bpm: 112,
    lead: [69, 72, 76, 81, 69, 72, 76, 79, 67, 72, 76, 81, 69, 72, 77, 81,
           69, 72, 76, 81, 69, 72, 76, 79, 67, 71, 74, 79, 67, 71, 76, 79],
    leadVol: 0.05, leadDur: 0.12,
    bass: [45, null, 45, null, 40, null, 40, null, 41, null, 41, null, 43, null, 43, null],
    bassVol: 0.09, bassDur: 0.22,
    drums: ['k', null, 'h', null, 'k', null, 'h', null, 'k', null, 'h', null, 'k', 'h', 'h', null],
  },
  {
    id: 'quarter', name: 'Quarter Muncher', bpm: 140,
    lead: [72, 74, 76, 72, 76, null, 72, null, 74, 76, 77, 74, 79, null, 76, null,
           72, 74, 76, 72, 76, null, 79, null, 77, 76, 74, 76, 72, null, null, null],
    leadVol: 0.055, leadDur: 0.1,
    bass: [48, null, 43, null, 48, null, 43, null, 45, null, 43, null, 41, null, 43, null],
    bassVol: 0.09, bassDur: 0.16,
    drums: ['k', null, 'h', null, 's', null, 'h', null, 'k', null, 'h', 'k', 's', null, 'h', 'h'],
  },
  {
    id: 'starlight', name: 'Starlight Vigil', bpm: 70,
    lead: [57, 60, 64, null, 69, null, 64, null, 60, null, 64, 67, 72, null, 67, null,
           57, 60, 64, null, 69, null, 71, null, 72, null, 71, 67, 64, null, 60, null],
    leadVol: 0.04, leadDur: 0.45,
    bass: [33, null, null, null, null, null, null, null, 36, null, null, null, null, null, null, null,
           31, null, null, null, null, null, null, null, 33, null, null, null, null, null, null, null],
    bassVol: 0.08, bassDur: 1.6,
    drums: [null, null, null, null, 'h', null, null, null, null, null, null, null, 'h', null, null, null],
  },
];

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class MusicEngine {
  /** @param {import('./audio.js').AudioFX} audio shared FX engine (for ctx + noise buffer) */
  constructor(audio) {
    this.audio = audio;
    this.trackId = 'off';
    this.timer = null;
    this.gain = null;
    this.step = 0;
    this.nextTime = 0;
  }

  get playing() {
    return this.timer !== null;
  }

  /** Switch track. Starts immediately if the AudioContext exists (user gesture). */
  setTrack(id) {
    this.trackId = id;
    this._stopScheduler();
    if (id !== 'off') this._start();
  }

  stop() {
    this._stopScheduler();
  }

  /** (Re)start the current track, e.g. when gameplay resumes. */
  resume() {
    if (this.trackId !== 'off' && !this.playing) this._start();
  }

  _start() {
    this.audio.ensure();
    const ctx = this.audio.ctx;
    if (!ctx) return;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 1;
      this.gain.connect(this.audio.master);
    }
    this.track = TRACKS.find((t) => t.id === this.trackId);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._tick(), 25);
  }

  _stopScheduler() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _tick() {
    const ctx = this.audio.ctx;
    const t = this.track;
    if (!ctx || !t) return;
    const stepDur = 60 / t.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.16) {
      const lead = t.lead[this.step % t.lead.length];
      const bass = t.bass[this.step % t.bass.length];
      const drum = t.drums[this.step % t.drums.length];
      if (lead !== null) this._note('square', lead, this.nextTime, t.leadDur, t.leadVol);
      if (bass !== null) this._note('triangle', bass, this.nextTime, t.bassDur, t.bassVol);
      if (drum) this._drum(drum, this.nextTime);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  _note(type, midi, t, dur, vol) {
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = midiHz(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _drum(kind, t) {
    const ctx = this.audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.audio.noiseBuf;
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    let dur = 0.05;
    if (kind === 'k') {
      filt.type = 'lowpass';
      filt.frequency.value = 120;
      g.gain.setValueAtTime(0.5, t);
      dur = 0.1;
    } else if (kind === 's') {
      filt.type = 'bandpass';
      filt.frequency.value = 1800;
      g.gain.setValueAtTime(0.18, t);
      dur = 0.08;
    } else {
      filt.type = 'highpass';
      filt.frequency.value = 6000;
      g.gain.setValueAtTime(0.1, t);
      dur = 0.04;
    }
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt).connect(g).connect(this.gain);
    src.start(t);
    src.stop(t + dur);
  }
}
