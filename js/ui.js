// DOM HUD: score/wave readouts, firework selector bar, overlay screens.

export class UI {
  /**
   * @param {object[]} types ordered firework type defs
   * @param {(id: string) => void} onSelect selector tap callback
   */
  constructor(types, onSelect) {
    this.scoreEl = document.getElementById('hud-score');
    this.waveEl = document.getElementById('hud-wave');
    this.highEl = document.getElementById('hud-high');
    this.bannerEl = document.getElementById('banner');
    this.overlayEl = document.getElementById('overlay');
    this.selectorEl = document.getElementById('selector');
    this.buttons = {};
    this.bannerTimer = 0;

    types.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'fw-btn';
      btn.style.setProperty('--c', `hsl(${t.hue} 95% 65%)`);
      btn.dataset.type = t.id;
      btn.innerHTML =
        `<span class="fw-key">${i + 1}</span>` +
        `<span class="fw-dot"></span>` +
        `<span class="fw-name">${t.name}</span>` +
        `<span class="fw-ammo"></span>`;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onSelect(t.id);
      });
      this.selectorEl.appendChild(btn);
      this.buttons[t.id] = btn;
    });
  }

  setScore(n) { this.scoreEl.textContent = String(n); }
  setWave(n) { this.waveEl.textContent = `WAVE ${n}`; }
  setHigh(n) { this.highEl.textContent = `BEST ${n}`; }

  updateSelector(types, state) {
    for (const t of types) {
      const btn = this.buttons[t.id];
      const unlocked = state.wave >= t.unlockWave;
      const ammo = state.ammo[t.id];
      btn.classList.toggle('locked', !unlocked);
      btn.classList.toggle('selected', state.selected === t.id);
      btn.classList.toggle('empty', unlocked && ammo <= 0);
      const ammoEl = btn.querySelector('.fw-ammo');
      if (!unlocked) ammoEl.textContent = `W${t.unlockWave}`;
      else ammoEl.textContent = ammo === Infinity ? '∞' : `×${ammo}`;
    }
  }

  banner(text, sub = '', seconds = 2.2) {
    this.bannerEl.innerHTML = sub
      ? `${text}<span class="sub">${sub}</span>`
      : text;
    this.bannerEl.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(
      () => this.bannerEl.classList.add('hidden'),
      seconds * 1000
    );
  }

  _scoreRows(scores, max = 5, highlight = -1) {
    if (!scores.length) return '';
    const rows = scores.slice(0, max).map((s, i) =>
      `<div class="score-row${i === highlight ? ' me' : ''}">
        <span class="sr-rank">${i + 1}</span>
        <span class="sr-init">${s.initials}</span>
        <span class="sr-score">${s.score}</span>
        <span class="sr-wave">W${s.wave || '–'}</span>
      </div>`).join('');
    return `<div class="scores"><div class="scores-title">HIGH SCORES</div>${rows}</div>`;
  }

  _musicRow(tracks, currentId) {
    const btns = tracks.map((t) =>
      `<button class="mus-btn${t.id === currentId ? ' selected' : ''}"
        data-music="${t.id}">${t.id === 'off' ? '✕' : '♪'} ${t.name}</button>`).join('');
    return `<div class="mus-row" id="mus-row">${btns}</div>`;
  }

  showMenu({ scores, tracks, musicId, onStart, onMusic }) {
    this.overlayEl.innerHTML = `
      <h1>FIREWORK<br>LAUNCHER</h1>
      <p>Missiles are falling on your cities.<br>
      Fight back with <strong>fireworks</strong>.</p>
      <p>Tap the sky to intercept. Keys 1–9 switch fireworks, M cycles music.</p>
      <button class="big-btn" id="btn-start">DEFEND</button>
      ${this._musicRow(tracks, musicId)}
      ${this._scoreRows(scores)}`;
    this.overlayEl.classList.remove('hidden');
    document.getElementById('btn-start')
      .addEventListener('pointerdown', onStart, { once: true });
    document.getElementById('mus-row').addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.mus-btn');
      if (!btn) return;
      onMusic(btn.dataset.music);
      for (const b of this.overlayEl.querySelectorAll('.mus-btn')) {
        b.classList.toggle('selected', b === btn);
      }
    });
  }

  showGameOver({ score, wave, scores, stats, canEnter, onSave, onRestart }) {
    const acc = stats && stats.fired ? Math.round((stats.kills / stats.fired) * 100) : 0;
    const statsLine = stats
      ? `<p>FIRED ${stats.fired} · KILLS ${stats.kills} · ACCURACY ${acc}%</p>`
      : '';
    const entry = canEnter
      ? `<div class="initials-row" id="initials-row">
          <input id="initials" maxlength="3" placeholder="AAA"
            autocomplete="off" autocapitalize="characters" spellcheck="false">
          <button class="save-btn" id="btn-save-score">SAVE</button>
        </div>
        <p class="entry-hint">You made the leaderboard — enter your initials!</p>`
      : this._scoreRows(scores);
    this.overlayEl.innerHTML = `
      <h2>THE SKY GOES DARK</h2>
      <p>All cities have fallen on wave ${wave}.</p>
      <div class="score-big">${score}</div>
      ${statsLine}
      ${entry}
      <button class="big-btn" id="btn-restart">RELIGHT</button>`;
    this.overlayEl.classList.remove('hidden');
    document.getElementById('btn-restart')
      .addEventListener('pointerdown', onRestart, { once: true });
    if (canEnter) {
      const input = document.getElementById('initials');
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });
      document.getElementById('btn-save-score').addEventListener('pointerdown', () => {
        const { list, rank } = onSave(input.value || 'AAA');
        document.getElementById('initials-row').outerHTML = this._scoreRows(list, 5, rank);
        const hint = this.overlayEl.querySelector('.entry-hint');
        if (hint) hint.remove();
      }, { once: true });
    }
  }

  hideOverlay() {
    this.overlayEl.classList.add('hidden');
    this.overlayEl.innerHTML = '';
  }
}
