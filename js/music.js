// Procedural retro chiptune engine — square lead (doubled, detuned, echoed),
// triangle bass, noise percussion — driven by a lookahead step sequencer on
// the shared AudioContext from AudioFX. No audio assets.

// Patterns are arrays of 16th-note steps indexed with modulo, so channels can
// have different lengths. Notes are MIDI numbers, null = rest.
// Drums: 'k' kick, 'h' hat, 's' snare, null = rest.
// `accent` is a per-step velocity multiplier cycled over the lead.

export const TRACKS = [
  { id: 'off', name: 'Off' },
  {
    // Driving A-minor loop: Am F C G, answered by Am F C E so the G#
    // leading tone pulls the phrase back home. Octave-pumped bass.
    id: 'neon', name: 'Neon Siege', bpm: 118,
    echo: 0.22, detune: 7,
    accent: [1, 0.6, 0.75, 0.6, 0.9, 0.6, 0.75, 0.6],
    lead: [
      // Am              F                 C                 G
      69, null, 72, null, 76, null, 72, null, 69, null, 76, null, 74, null, 72, null,
      72, null, null, null, 69, null, 65, null, 69, null, 72, null, 74, null, 76, null,
      76, null, null, null, 79, null, 76, null, 74, null, 72, null, 71, null, 72, null,
      74, null, 71, null, 67, null, 71, null, 74, null, 76, null, 74, null, 71, null,
      // Am              F                 C                 E (G# pulls to Am)
      69, null, 72, null, 76, null, 72, null, 69, null, 76, null, 74, null, 72, null,
      72, null, null, null, 69, null, 65, null, 69, null, 72, null, 74, null, 76, null,
      76, null, 79, null, 81, null, 79, null, 76, null, 74, null, 72, null, 74, null,
      71, null, 74, null, 76, null, 74, null, 71, null, 68, null, 64, null, null, null,
    ],
    leadVol: 0.042, leadDur: 0.14,
    bass: [
      45, null, 57, null, 45, null, 57, null, 45, null, 57, null, 45, null, 57, null,
      41, null, 53, null, 41, null, 53, null, 41, null, 53, null, 41, null, 53, null,
      48, null, 60, null, 48, null, 60, null, 48, null, 60, null, 48, null, 60, null,
      43, null, 55, null, 43, null, 55, null, 43, null, 55, null, 43, null, 55, null,
      45, null, 57, null, 45, null, 57, null, 45, null, 57, null, 45, null, 57, null,
      41, null, 53, null, 41, null, 53, null, 41, null, 53, null, 41, null, 53, null,
      48, null, 60, null, 48, null, 60, null, 48, null, 60, null, 48, null, 60, null,
      40, null, 52, null, 40, null, 52, null, 40, null, 52, null, 47, null, 52, null,
    ],
    bassVol: 0.085, bassDur: 0.2,
    drums: [
      'k', null, 'h', null, 's', null, 'h', null, 'k', null, 'h', 'h', 's', null, 'h', null,
      'k', null, 'h', null, 's', null, 'h', null, 'k', null, 'h', 'h', 's', null, 's', 's',
    ],
  },
  {
    // Bouncy C-major arcade: C F G C with an F-G-A-B walk-up turnaround
    // and a scale run into the repeat.
    id: 'quarter', name: 'Quarter Muncher', bpm: 150,
    echo: 0.16, detune: 5,
    accent: [1, 0.55, 0.7, 0.55],
    lead: [
      // C                F                 G                 C
      72, null, 76, null, 79, null, 76, null, 77, null, 76, null, 74, null, 72, null,
      69, null, 72, null, 77, null, 72, null, 69, null, 74, null, 72, null, 69, null,
      67, null, 71, null, 74, null, 71, null, 79, null, 77, null, 74, null, 71, null,
      72, null, 76, null, 79, null, 76, null, 72, null, null, null, 72, null, null, null,
      72, null, 76, null, 79, null, 76, null, 77, null, 76, null, 74, null, 72, null,
      69, null, 72, null, 77, null, 72, null, 69, null, 74, null, 72, null, 69, null,
      67, null, 71, null, 74, null, 71, null, 79, null, 77, null, 74, null, 71, null,
      67, null, 71, null, 74, null, 77, null, 79, null, 81, null, 83, null, 84, null,
    ],
    leadVol: 0.045, leadDur: 0.09,
    bass: [
      36, null, 43, null, 48, null, 43, null, 36, null, 43, null, 48, null, 43, null,
      41, null, 48, null, 53, null, 48, null, 41, null, 48, null, 53, null, 48, null,
      43, null, 50, null, 55, null, 50, null, 43, null, 50, null, 55, null, 50, null,
      36, null, 43, null, 48, null, 43, null, 41, null, 43, null, 45, null, 47, null,
    ],
    bassVol: 0.085, bassDur: 0.15,
    drums: [
      'k', null, 'h', null, 's', null, 'h', 'h', 'k', null, 'h', null, 's', null, 'h', null,
      'k', null, 'h', null, 's', null, 'h', 'h', 'k', 'k', 'h', null, 's', null, 's', 'h',
    ],
  },
  {
    // Slow circle-of-fifths lullaby: Am Dm G C, then Am F E E — long echoed
    // tones over root-and-fifth pedal bass, barely-there percussion.
    id: 'starlight', name: 'Starlight Vigil', bpm: 76,
    echo: 0.4, detune: 4,
    accent: [1, 0.7, 0.8, 0.7],
    lead: [
      // Am                          Dm
      69, null, null, null, 72, null, null, null, 76, null, null, null, 72, null, null, null,
      74, null, null, null, 69, null, null, null, 65, null, null, null, 69, null, null, null,
      // G                           C
      71, null, null, null, 67, null, null, null, 74, null, null, null, 71, null, null, null,
      72, null, null, null, 76, null, null, null, 79, null, null, null, 76, null, null, null,
      // Am                          F
      81, null, null, null, 76, null, null, null, 72, null, null, null, 76, null, null, null,
      77, null, null, null, 72, null, null, null, 69, null, null, null, 72, null, null, null,
      // E                           E (resolve, breathe)
      68, null, null, null, 71, null, null, null, 76, null, null, null, 71, null, null, null,
      68, null, null, null, 64, null, null, null, null, null, null, null, null, null, null, null,
    ],
    leadVol: 0.038, leadDur: 0.55,
    bass: [
      33, null, null, null, null, null, null, null, 40, null, null, null, null, null, null, null,
      38, null, null, null, null, null, null, null, 45, null, null, null, null, null, null, null,
      43, null, null, null, null, null, null, null, 38, null, null, null, null, null, null, null,
      36, null, null, null, null, null, null, null, 43, null, null, null, null, null, null, null,
      33, null, null, null, null, null, null, null, 40, null, null, null, null, null, null, null,
      41, null, null, null, null, null, null, null, 48, null, null, null, null, null, null, null,
      40, null, null, null, null, null, null, null, 47, null, null, null, null, null, null, null,
      40, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    bassVol: 0.08, bassDur: 1.7,
    drums: [
      null, null, null, null, 'h', null, null, null, null, null, null, null, 'h', null, null, null,
      'k', null, null, null, 'h', null, null, null, null, null, null, null, 'h', null, null, null,
    ],
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
    this.delay = null;
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
      // Dotted-eighth feedback echo; the lead sends into it per note.
      this.delay = ctx.createDelay(1);
      const feedback = ctx.createGain();
      feedback.gain.value = 0.35;
      this.delay.connect(feedback).connect(this.delay);
      this.delay.connect(this.gain);
    }
    this.track = TRACKS.find((t) => t.id === this.trackId);
    const stepDur = 60 / this.track.bpm / 4;
    this.delay.delayTime.value = stepDur * 3;
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
      if (lead !== null) {
        const vel = t.accent ? t.accent[this.step % t.accent.length] : 1;
        this._note('square', lead, this.nextTime, t.leadDur, t.leadVol * vel, {
          detune: t.detune, echo: t.echo,
        });
      }
      if (bass !== null) this._note('triangle', bass, this.nextTime, t.bassDur, t.bassVol);
      if (drum) this._drum(drum, this.nextTime);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  _note(type, midi, t, dur, vol, opts = {}) {
    const ctx = this.audio.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.gain);
    if (opts.echo && this.delay) {
      const send = ctx.createGain();
      send.gain.value = opts.echo;
      g.connect(send).connect(this.delay);
    }
    const detunes = opts.detune ? [-opts.detune, opts.detune] : [0];
    for (const cents of detunes) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = midiHz(midi);
      osc.detune.value = cents;
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
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
