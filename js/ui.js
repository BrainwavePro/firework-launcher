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

    for (const t of types) {
      const btn = document.createElement('button');
      btn.className = 'fw-btn';
      btn.style.setProperty('--c', `hsl(${t.hue} 95% 65%)`);
      btn.dataset.type = t.id;
      btn.innerHTML =
        `<span class="fw-dot"></span>` +
        `<span class="fw-name">${t.name}</span>` +
        `<span class="fw-ammo"></span>`;
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        onSelect(t.id);
      });
      this.selectorEl.appendChild(btn);
      this.buttons[t.id] = btn;
    }
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

  showMenu(high, onStart) {
    this.overlayEl.innerHTML = `
      <h1>FIREWORK<br>LAUNCHER</h1>
      <p>Missiles are falling on your cities.<br>
      Fight back with <strong>fireworks</strong>.</p>
      <p>Tap the sky to intercept. Pick your firework from the bar below —
      each bursts differently. Survive the waves.</p>
      ${high > 0 ? `<p>Best score: <strong>${high}</strong></p>` : ''}
      <button class="big-btn" id="btn-start">DEFEND</button>`;
    this.overlayEl.classList.remove('hidden');
    document.getElementById('btn-start')
      .addEventListener('pointerdown', onStart, { once: true });
  }

  showGameOver(score, high, isRecord, onRestart) {
    this.overlayEl.innerHTML = `
      <h2>THE SKY GOES DARK</h2>
      <p>All cities have fallen.</p>
      <div class="score-big">${score}</div>
      <p>${isRecord ? '★ New best score! ★' : `Best: ${high}`}</p>
      <button class="big-btn" id="btn-restart">RELIGHT</button>`;
    this.overlayEl.classList.remove('hidden');
    document.getElementById('btn-restart')
      .addEventListener('pointerdown', onRestart, { once: true });
  }

  hideOverlay() {
    this.overlayEl.classList.add('hidden');
    this.overlayEl.innerHTML = '';
  }
}
