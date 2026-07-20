// Firework Launcher — mobile Missile Command with fireworks.
// Game loop, state machine, and glue between all modules.

import { ParticleSystem } from './particles.js';
import { FIREWORK_TYPES, TYPE_ORDER, POP_TYPE, Shell, Burst } from './fireworks.js';
import {
  makeStructures, EnemyMissile, Boss, waveConfig, drawGround,
} from './world.js';
import { AudioFX } from './audio.js';
import { MusicEngine, TRACKS } from './music.js';
import { loadScores, qualifies, insertScore, best } from './scores.js';
import { UI } from './ui.js';
import { bindInput, bindKeyboard } from './input.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const MUSIC_KEY = 'fw-launcher-music';
const VOL_SFX_KEY = 'fw-launcher-vol-sfx';
const VOL_MUSIC_KEY = 'fw-launcher-vol-music';

// Wave-break banner subtitles the first time an enemy kind appears.
const ENEMY_INTROS = {
  3: 'NEW THREAT: MIRV',
  4: 'NEW THREAT: ARMORED',
  5: 'NEW THREAT: SMART',
  6: 'NEW THREAT: BOMBER',
};

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ps = new ParticleSystem();
    this.audio = new AudioFX();
    this.types = TYPE_ORDER.map((id) => FIREWORK_TYPES[id]);
    this.ui = new UI(this.types, (id) => this.select(id));

    this.state = 'menu';
    this.score = 0;
    this.wave = 1;
    this.scores = loadScores();
    this.music = new MusicEngine(this.audio);
    this.musicId = localStorage.getItem(MUSIC_KEY) || 'neon';
    this.vols = {
      sfx: this._loadVol(VOL_SFX_KEY),
      music: this._loadVol(VOL_MUSIC_KEY),
    };
    this.audio.setSfxVolume(this.vols.sfx);
    this.music.setVolume(this.vols.music);
    this.pausedFrom = null;
    this.wakeLock = null;
    this.selected = 'peony';
    this.ammo = {};
    for (const t of this.types) this.ammo[t.id] = t.ammo;
    this.lastFire = {};
    this.structures = makeStructures();
    this.shells = [];
    this.bursts = [];
    this.missiles = [];
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.waveCfg = waveConfig(1);
    this.breakTimer = 0;
    this.boss = null;
    this.bossPending = 0;
    this.stats = { fired: 0, kills: 0 };
    this.combo = 0;
    this.comboMult = 1;
    this.waveDamage = false;
    this.shake = 0;
    this.flash = 0;
    this.whiteFlash = 0;
    this.nukeTimer = 0;
    this.stars = [];

    this.resize();
    // Mobile browsers fire resize with transient dimensions (toolbar hide,
    // rotation); re-measure once more after the events settle.
    window.addEventListener('resize', () => {
      this.resize();
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.resize(), 250);
    });
    bindInput(canvas, (x, y) => this.tap(x, y));
    bindKeyboard({
      selectIndex: (i) => this.select(TYPE_ORDER[i]),
      cycle: (dir) => this.cycleType(dir),
      cycleMusic: () => this.cycleMusic(),
      pause: () => this.togglePause(),
    });
    document.addEventListener('pointerdown', () => this.audio.ensure(), { capture: true });
    document.getElementById('btn-pause').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.togglePause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing' || this.state === 'wavebreak') this.pause();
        else this.music.stop(); // don't serenade a background tab
      } else {
        if (this.state === 'menu') this.music.resume();
        this._updateWakeLock();
      }
    });

    this.ui.setHigh(best(this.scores));
    this.ui.setScore(0);
    this.ui.updateSelector(this.types, this.selState());
    this.showMenu();

    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------- layout

  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const selH = document.getElementById('selector').offsetHeight || 80;
    this.groundY = this.H - selH - 18;
    // Re-aim in-flight missiles at their targets' new screen positions.
    for (const m of this.missiles) m.retarget(this.W, this.groundY);
    this.stars = [];
    const n = Math.floor((this.W * this.H) / 6500);
    for (let i = 0; i < n; i++) {
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.groundY,
        r: rand(0.4, 1.3),
        tw: Math.random() * TAU,
      });
    }
  }

  selState() {
    return { wave: this.wave, ammo: this.ammo, selected: this.selected };
  }

  // ------------------------------------------------------------- flow

  showMenu() {
    this.ui.showMenu({
      scores: this.scores,
      tracks: TRACKS,
      musicId: this.musicId,
      vols: this.vols,
      onStart: () => this.startGame(),
      onMusic: (id) => this.setMusic(id),
      onVolume: (kind, v) => this.setVolume(kind, v),
    });
  }

  _loadVol(key) {
    const v = parseFloat(localStorage.getItem(key));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  }

  setVolume(kind, v) {
    this.vols[kind] = v;
    localStorage.setItem(kind === 'sfx' ? VOL_SFX_KEY : VOL_MUSIC_KEY, String(v));
    this.audio.ensure();
    if (kind === 'sfx') {
      this.audio.setSfxVolume(v);
      this.audio.zone('pop', true); // audible feedback while sliding
    } else {
      this.music.setVolume(v);
    }
  }

  togglePause() {
    if (this.state === 'paused') this.unpause();
    else if (this.state === 'playing' || this.state === 'wavebreak') this.pause();
  }

  pause() {
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.music.stop();
    this.ui.showPause({ onResume: () => this.unpause() });
    this._updateWakeLock();
  }

  unpause() {
    this.state = this.pausedFrom || 'playing';
    this.pausedFrom = null;
    this.ui.hideOverlay();
    this.music.resume();
    this.last = performance.now(); // don't integrate the paused time
    this._updateWakeLock();
  }

  async _updateWakeLock() {
    const want =
      (this.state === 'playing' || this.state === 'wavebreak') && !document.hidden;
    if (want && !this.wakeLock && navigator.wakeLock) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      } catch { this.wakeLock = null; }
    } else if (!want && this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  setMusic(id) {
    this.musicId = id;
    localStorage.setItem(MUSIC_KEY, id);
    this.audio.ensure();
    this.music.setTrack(id);
  }

  cycleMusic() {
    const i = TRACKS.findIndex((t) => t.id === this.musicId);
    const next = TRACKS[(i + 1) % TRACKS.length];
    this.setMusic(next.id);
    this.ui.banner(next.id === 'off' ? 'MUSIC OFF' : `♪ ${next.name.toUpperCase()}`, '', 1.2);
  }

  cycleType(dir) {
    const unlocked = TYPE_ORDER.filter(
      (id) => this.wave >= FIREWORK_TYPES[id].unlockWave
    );
    const i = unlocked.indexOf(this.selected);
    this.select(unlocked[(i + dir + unlocked.length) % unlocked.length]);
  }

  startGame() {
    this.audio.ensure();
    this.music.setTrack(this.musicId);
    this.score = 0;
    this.structures = makeStructures();
    this.shells = [];
    this.bursts = [];
    this.missiles = [];
    this.boss = null;
    this.bossPending = 0;
    this.stats = { fired: 0, kills: 0 };
    this.combo = 0;
    this.comboMult = 1;
    this.ui.setCombo(1);
    this.ps.clear();
    this.selected = 'peony';
    this.ui.setScore(0);
    this.ui.hideOverlay();
    this.ui.setPauseVisible(true);
    this.startWave(1);
    this._updateWakeLock();
  }

  startWave(n) {
    this.wave = n;
    this.waveCfg = waveConfig(n);
    this.spawnLeft = this.waveCfg.count;
    this.spawnTimer = 0.8;
    this.waveDamage = false;
    for (const t of this.types) this.ammo[t.id] = t.ammo;
    this.lastFire = {};
    // Batteries are rebuilt between waves; fallen cities stay fallen.
    for (const s of this.structures) if (s.kind === 'battery') s.alive = true;
    this.state = 'playing';
    this.ui.setWave(n);
    this.ui.updateSelector(this.types, this.selState());
    const unlockedNow = this.types.find((t) => t.unlockWave === n && n > 1);
    let sub = unlockedNow
      ? `NEW FIREWORK UNLOCKED: ${unlockedNow.name.toUpperCase()}`
      : ENEMY_INTROS[n] || '';
    if (this.waveCfg.boss) {
      sub = sub ? `MOTHERSHIP DETECTED · ${sub}` : 'MOTHERSHIP DETECTED';
      this.bossPending = 2;
      this.audio.bossAlarm();
    }
    this.ui.banner(`WAVE ${n}`, sub);
  }

  waveCleared() {
    this.state = 'wavebreak';
    this.breakTimer = 3;
    const cities = this.structures.filter((s) => s.kind === 'city' && s.alive);
    const bonus = cities.length * 50 * this.wave;
    this.addScore(bonus);
    let sub = `CITY BONUS +${bonus}`;
    if (!this.waveDamage) {
      const perfect = 100 * this.wave;
      this.addScore(perfect);
      sub = `PERFECT +${perfect} · ${sub}`;
    }
    this.audio.waveClear();
    this.ui.banner(`WAVE ${this.wave} CLEARED`, sub, 2.6);
  }

  // Combo: kills build a score multiplier; losing any structure resets it.
  _bumpCombo(n) {
    this.combo += n;
    const mult = this.combo >= 45 ? 4 : this.combo >= 25 ? 3 : this.combo >= 10 ? 2 : 1;
    if (mult !== this.comboMult) {
      this.comboMult = mult;
      this.ui.setCombo(mult);
      this.ui.banner(`COMBO ×${mult}`, '', 1.0);
    }
  }

  _resetCombo() {
    this.combo = 0;
    if (this.comboMult !== 1) {
      this.comboMult = 1;
      this.ui.setCombo(1);
    }
  }

  gameOver() {
    this.state = 'gameover';
    this.music.stop();
    this.audio.gameOver();
    this.ui.setPauseVisible(false);
    this._updateWakeLock();
    setTimeout(() => {
      this.ui.showGameOver({
        score: this.score,
        wave: this.wave,
        scores: this.scores,
        stats: this.stats,
        canEnter: qualifies(this.scores, this.score),
        onSave: (initials) => {
          const entry = {
            initials, score: this.score, wave: this.wave, date: Date.now(),
          };
          this.scores = insertScore(this.scores, entry);
          this.ui.setHigh(best(this.scores));
          return { list: this.scores, rank: this.scores.indexOf(entry) };
        },
        onRestart: () => this.startGame(),
      });
    }, 900);
  }

  addScore(n) {
    this.score += n;
    this.ui.setScore(this.score);
  }

  // ------------------------------------------------------------- input

  select(id) {
    const t = FIREWORK_TYPES[id];
    if (!t || this.wave < t.unlockWave) return;
    this.selected = id;
    this.ui.updateSelector(this.types, this.selState());
  }

  tap(x, y) {
    if (this.state !== 'playing' && this.state !== 'wavebreak') return;
    const type = FIREWORK_TYPES[this.selected];
    const now = performance.now() / 1000;
    if (now - (this.lastFire[type.id] || -1e9) < type.cooldown) return;
    if (this.ammo[type.id] <= 0) return;
    const battery = this.nearestBattery(x);
    if (!battery) {
      this.ui.banner('BATTERIES DOWN', 'REBUILT NEXT WAVE', 1.2);
      return;
    }
    const ty = Math.min(Math.max(y, 30), this.groundY - 40);
    this.lastFire[type.id] = now;
    this.ammo[type.id] -= 1;
    this.stats.fired += 1;
    this.shells.push(
      new Shell(type, battery.x, this.groundY - 15, x, ty, this.H * 1.05)
    );
    this.audio.launch();
    this.ui.updateSelector(this.types, this.selState());
  }

  nearestBattery(x) {
    let best = null;
    let bd = Infinity;
    for (const s of this.structures) {
      if (s.kind !== 'battery' || !s.alive) continue;
      const d = Math.abs(s.x - x);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ------------------------------------------------------------- enemy

  spawnMissile() {
    const targets = this.structures.filter((s) => s.alive);
    if (!targets.length) return;
    const c = this.waveCfg;
    const roll = Math.random();
    let acc = 0;
    const kind =
      roll < (acc += c.smartChance) ? 'smart'
      : roll < (acc += c.mirvChance) ? 'mirv'
      : roll < (acc += c.armorChance) ? 'armor'
      : roll < (acc += c.bomberChance) ? 'bomber'
      : 'normal';
    if (kind === 'bomber') {
      // Bombers cross the top of the screen and escape out the far side.
      const fromLeft = Math.random() < 0.5;
      const sy = rand(0.10, 0.20) * this.H;
      this.missiles.push(
        new EnemyMissile({
          sx: fromLeft ? -30 : this.W + 30,
          sy,
          target: { x: fromLeft ? this.W + 30 : -30, y: sy, ref: null },
          speed: c.speedFrac * this.H * 0.75,
          kind,
        })
      );
      return;
    }
    const target = targets[Math.floor(Math.random() * targets.length)];
    this.missiles.push(
      new EnemyMissile({
        sx: rand(20, this.W - 20),
        sy: -10,
        target: { x: target.f * this.W, y: this.groundY, ref: target },
        speed: c.speedFrac * this.H * (kind === 'armor' ? 0.8 : 1),
        kind,
      })
    );
  }

  splitMirv(m) {
    m.splitAt = -1;
    m.kind = 'normal';
    m.hue = 0;
    const others = this.structures.filter((s) => s.alive && s !== m.target.ref);
    const n = 2;
    for (let i = 0; i < n && others.length; i++) {
      const t = others.splice(Math.floor(Math.random() * others.length), 1)[0];
      this.missiles.push(
        new EnemyMissile({
          sx: m.x, sy: m.y,
          target: { x: t.f * this.W, y: this.groundY, ref: t },
          speed: m.speed * 1.15,
          kind: 'normal',
        })
      );
    }
    this.ps.burst(10, m.x, m.y, 20, 80, {
      hue: 20, life: 0.4, size: 1.6, gravity: 40, drag: 0.4,
    });
  }

  dropBomb(m) {
    // Aim at a structure roughly below the bomber; fall back to any alive one.
    const near = this.structures.filter(
      (s) => s.alive && Math.abs(s.f * this.W - m.x) < this.W * 0.3
    );
    const pool = near.length ? near : this.structures.filter((s) => s.alive);
    if (!pool.length) return;
    const t = pool[Math.floor(Math.random() * pool.length)];
    this.missiles.push(
      new EnemyMissile({
        sx: m.x, sy: m.y,
        target: { x: t.f * this.W, y: this.groundY, ref: t },
        speed: this.waveCfg.speedFrac * this.H * 1.2,
        kind: 'normal',
        hue: 50,
      })
    );
    this.audio.bombDrop();
  }

  bossSalvo(boss) {
    const targets = this.structures.filter((s) => s.alive);
    if (!targets.length) return;
    for (let i = 0; i < boss.salvoSize; i++) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      const smart = this.wave >= 10 && Math.random() < 0.5;
      this.missiles.push(
        new EnemyMissile({
          sx: boss.x + rand(-20, 20),
          sy: boss.y + 14,
          target: { x: t.f * this.W, y: this.groundY, ref: t },
          speed: this.waveCfg.speedFrac * this.H * 1.1,
          kind: smart ? 'smart' : 'normal',
        })
      );
    }
    this.audio.launch();
  }

  bossDown(boss) {
    this.boss = null;
    this.stats.kills += 1;
    this._bumpCombo(5);
    const bounty = boss.value * this.comboMult;
    this.addScore(bounty);
    this.audio.bossDown();
    this.whiteFlash = 0.7;
    this.shake = 0.8;
    if (navigator.vibrate) navigator.vibrate(200);
    this.ps.burst(150, boss.x, boss.y, 60, 420, {
      hue: 350, life: rand(0.8, 1.6), size: 2.6, gravity: 60, drag: 0.8,
      streak: true, glow: true,
    });
    this.ps.burst(40, boss.x, boss.y, 20, 150, {
      hue: 48, sat: 40, lum: 92, life: 0.6, size: 3, gravity: 30, drag: 0.6, glow: true,
    });
    this.ui.banner('MOTHERSHIP DOWN', `+${bounty}`, 2.2);
  }

  impact(m) {
    const ref = m.target.ref;
    if (ref && ref.alive) {
      ref.alive = false;
      this.waveDamage = true;
      this._resetCombo();
      this.audio.cityHit();
      this.shake = Math.max(this.shake, 0.55);
      this.flash = Math.max(this.flash, 0.5);
      if (navigator.vibrate) navigator.vibrate(ref.kind === 'city' ? 120 : 60);
      this.ps.burst(60, m.x, this.groundY, 40, 260, {
        hue: 18, life: rand(0.6, 1.2), size: 2.4, gravity: 140, drag: 0.6,
        streak: true, glow: true,
      });
    } else {
      this.ps.burst(18, m.x, this.groundY, 20, 110, {
        hue: 18, life: 0.5, size: 1.8, gravity: 90, drag: 0.5,
      });
    }
    if (!this.structures.some((s) => s.kind === 'city' && s.alive)) {
      this.gameOver();
    }
  }

  killMissile(i, burst) {
    const m = this.missiles[i];
    this.missiles.splice(i, 1);
    this.stats.kills += 1;
    this._bumpCombo(1);
    const pts = m.value + (burst ? burst.kills * 50 : 0);
    if (burst) burst.kills += 1;
    this.addScore(pts * this.wave * this.comboMult);
    // Sympathetic pop: chain reactions off a destroyed warhead.
    this.bursts.push(new Burst(POP_TYPE, m.x, m.y, this.ps, this.audio));
  }

  // ------------------------------------------------------------- loop

  frame(t) {
    let dt = (t - this.last) / 1000;
    this.last = t;
    dt = Math.min(dt, 0.1); // background-tab clamp
    this.update(dt);
    this.draw();
    requestAnimationFrame((t2) => this.frame(t2));
  }

  update(dt) {
    if (this.state === 'paused') return;
    this.ps.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 0.9);
    if (this.nukeTimer > 0) {
      this.nukeTimer -= dt;
      if (this.nukeTimer <= 0) {
        this.whiteFlash = 1.3;
        this.shake = 0.9;
        if (navigator.vibrate) navigator.vibrate(250);
      }
    }

    // Shells → bursts
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.update(dt, this.ps);
      if (sh.arrived) {
        this.shells.splice(i, 1);
        this.bursts.push(
          new Burst(sh.type, sh.tx, sh.ty, this.ps, this.audio, {
            W: this.W,
            H: this.H,
            getTargets: () =>
              this.boss ? [...this.missiles, this.boss] : this.missiles,
          })
        );
        // Nuke screen effects fire when the delayed blast zone goes off.
        if (sh.type.id === 'diablo') this.nukeTimer = 0.95;
      }
    }

    // Bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.update(dt);
      if (b.done) this.bursts.splice(i, 1);
    }

    if (this.state === 'playing') {
      // Spawning
      if (this.spawnLeft > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = this.waveCfg.interval * rand(0.6, 1.4);
          this.spawnLeft -= 1;
          this.spawnMissile();
        }
      }

      // Boss: descend, strafe, salvo, take damage
      if (this.bossPending > 0) {
        this.bossPending -= dt;
        if (this.bossPending <= 0) {
          this.boss = new Boss({ ...this.waveCfg.boss, W: this.W, H: this.H });
        }
      }
      if (this.boss) {
        const boss = this.boss;
        if (boss.update(dt, this.W) === 'salvo') this.bossSalvo(boss);
        for (const b of this.bursts) {
          if (boss.hitBursts.has(b) || !b.hitsCircle(boss.x, boss.y, boss.r)) continue;
          boss.hitBursts.add(b);
          boss.hp -= b.type.power ?? 1;
          if (boss.hp <= 0) {
            this.bossDown(boss);
            break;
          }
          boss.hitFlash = 0.15;
          this.audio.bossHit();
          this.ps.burst(16, boss.x, boss.y + 10, 40, 160, {
            hue: 350, sat: 60, lum: 80, life: 0.35, size: 1.8, gravity: 80, drag: 0.5,
          });
        }
      }

      // Missiles: move, split/drop, collide, impact
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        const act = m.update(dt);
        if (act === 'split') this.splitMirv(m);
        else if (act === 'drop') this.dropBomb(m);
        let killed = false;
        for (const b of this.bursts) {
          // Each burst damages a given missile at most once, so lingering
          // blast zones don't melt armored targets in a single frame.
          if (m.hitBursts.has(b) || !b.hits(m)) continue;
          m.hitBursts.add(b);
          m.hp -= b.type.power ?? 1;
          if (m.hp <= 0) {
            this.killMissile(i, b);
            killed = true;
            break;
          }
          m.damaged = true;
          this.audio.armorClank();
          this.ps.burst(12, m.x, m.y, 30, 140, {
            hue: 210, sat: 30, lum: 85, life: 0.3, size: 1.6, gravity: 60, drag: 0.5,
          });
        }
        if (killed) continue;
        if (m.impacted) {
          this.missiles.splice(i, 1);
          if (m.kind === 'bomber') continue; // escaped off-screen, no ground hit
          this.impact(m);
          if (this.state !== 'playing') return;
        }
      }

      // Wave cleared?
      if (
        this.spawnLeft === 0 &&
        this.missiles.length === 0 &&
        this.shells.length === 0 &&
        this.bursts.length === 0 &&
        !this.boss &&
        this.bossPending <= 0
      ) {
        this.waveCleared();
      }
    } else if (this.state === 'wavebreak') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.startWave(this.wave + 1);
    }
  }

  // ------------------------------------------------------------- render

  draw() {
    const { ctx, W, H } = this;
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake * 9;
      ctx.translate(rand(-s, s), rand(-s, s));
    }

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#040614');
    sky.addColorStop(0.65, '#0a0e24');
    sky.addColorStop(1, '#141a38');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Stars + moon
    const t = performance.now() / 1000;
    ctx.fillStyle = '#cfd8ff';
    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(t * 0.7 + s.tw));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.13, 16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a0e24';
    ctx.beginPath();
    ctx.arc(W * 0.82 - 7, H * 0.13 - 4, 14, 0, TAU);
    ctx.fill();

    // Entities
    for (const m of this.missiles) m.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    for (const sh of this.shells) sh.draw(ctx);
    this.ps.draw(ctx);
    drawGround(ctx, W, H, this.groundY, this.structures);

    ctx.restore();

    // Boss health bar (below the DOM HUD, unaffected by screen shake).
    if (this.boss) {
      const bw = Math.min(320, W * 0.72);
      const bx = (W - bw) / 2;
      const by = 58;
      const bh = 8;
      ctx.fillStyle = 'rgba(10, 14, 36, 0.8)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = 'hsl(350 90% 60%)';
      ctx.fillRect(bx, by, bw * (this.boss.hp / this.boss.maxHp), bh);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 1; i < this.boss.maxHp; i++) {
        const x = Math.round(bx + (bw * i) / this.boss.maxHp) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x, by + bh);
        ctx.stroke();
      }
    }

    // Damage flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 40, ${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Nuke flash
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255, 250, 235, ${Math.min(1, this.whiteFlash) * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

const game = new Game(document.getElementById('game'));

// Debug/testing hook.
window.__fw = { game, types: FIREWORK_TYPES };

// PWA
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
