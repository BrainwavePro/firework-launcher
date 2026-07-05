// Firework Launcher — mobile Missile Command with fireworks.
// Game loop, state machine, and glue between all modules.

import { ParticleSystem } from './particles.js';
import { FIREWORK_TYPES, TYPE_ORDER, POP_TYPE, Shell, Burst } from './fireworks.js';
import {
  makeStructures, EnemyMissile, waveConfig, drawGround,
} from './world.js';
import { AudioFX } from './audio.js';
import { UI } from './ui.js';
import { bindInput } from './input.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const HIGH_KEY = 'fw-launcher-high';

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
    this.high = Number(localStorage.getItem(HIGH_KEY) || 0);
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
    this.shake = 0;
    this.flash = 0;
    this.stars = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
    bindInput(canvas, (x, y) => this.tap(x, y));
    document.addEventListener('pointerdown', () => this.audio.ensure(), { capture: true });

    this.ui.setHigh(this.high);
    this.ui.setScore(0);
    this.ui.updateSelector(this.types, this.selState());
    this.ui.showMenu(this.high, () => this.startGame());

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

  startGame() {
    this.audio.ensure();
    this.score = 0;
    this.structures = makeStructures();
    this.shells = [];
    this.bursts = [];
    this.missiles = [];
    this.ps.clear();
    this.selected = 'peony';
    this.ui.setScore(0);
    this.ui.hideOverlay();
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    this.waveCfg = waveConfig(n);
    this.spawnLeft = this.waveCfg.count;
    this.spawnTimer = 0.8;
    for (const t of this.types) this.ammo[t.id] = t.ammo;
    this.lastFire = {};
    // Batteries are rebuilt between waves; fallen cities stay fallen.
    for (const s of this.structures) if (s.kind === 'battery') s.alive = true;
    this.state = 'playing';
    this.ui.setWave(n);
    this.ui.updateSelector(this.types, this.selState());
    const unlockedNow = this.types.find((t) => t.unlockWave === n && n > 1);
    this.ui.banner(
      `WAVE ${n}`,
      unlockedNow ? `NEW FIREWORK UNLOCKED: ${unlockedNow.name.toUpperCase()}` : ''
    );
  }

  waveCleared() {
    this.state = 'wavebreak';
    this.breakTimer = 3;
    const cities = this.structures.filter((s) => s.kind === 'city' && s.alive);
    const bonus = cities.length * 50 * this.wave;
    this.addScore(bonus);
    this.audio.waveClear();
    this.ui.banner(`WAVE ${this.wave} CLEARED`, `CITY BONUS +${bonus}`, 2.6);
  }

  gameOver() {
    this.state = 'gameover';
    this.audio.gameOver();
    const isRecord = this.score > this.high;
    if (isRecord) {
      this.high = this.score;
      localStorage.setItem(HIGH_KEY, String(this.high));
      this.ui.setHigh(this.high);
    }
    setTimeout(() => {
      this.ui.showGameOver(this.score, this.high, isRecord, () => this.startGame());
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
    const target = targets[Math.floor(Math.random() * targets.length)];
    const roll = Math.random();
    const kind =
      roll < this.waveCfg.smartChance ? 'smart'
      : roll < this.waveCfg.smartChance + this.waveCfg.mirvChance ? 'mirv'
      : 'normal';
    this.missiles.push(
      new EnemyMissile({
        sx: rand(20, this.W - 20),
        sy: -10,
        target: { x: target.f * this.W, y: this.groundY, ref: target },
        speed: this.waveCfg.speedFrac * this.H,
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

  impact(m) {
    const ref = m.target.ref;
    if (ref && ref.alive) {
      ref.alive = false;
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
    const pts = 100 + (burst ? burst.kills * 50 : 0);
    if (burst) burst.kills += 1;
    this.addScore(pts * this.wave);
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
    this.ps.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 1.4);

    // Shells → bursts
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.update(dt, this.ps);
      if (sh.arrived) {
        this.shells.splice(i, 1);
        this.bursts.push(new Burst(sh.type, sh.tx, sh.ty, this.ps, this.audio));
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

      // Missiles: move, split, collide, impact
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        const wantsSplit = m.update(dt);
        if (wantsSplit) this.splitMirv(m);
        let killed = false;
        for (const b of this.bursts) {
          if (b.hits(m.x, m.y)) {
            this.killMissile(i, b);
            killed = true;
            break;
          }
        }
        if (killed) continue;
        if (m.impacted) {
          this.missiles.splice(i, 1);
          this.impact(m);
          if (this.state !== 'playing') return;
        }
      }

      // Wave cleared?
      if (
        this.spawnLeft === 0 &&
        this.missiles.length === 0 &&
        this.shells.length === 0 &&
        this.bursts.length === 0
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
    for (const sh of this.shells) sh.draw(ctx);
    this.ps.draw(ctx);
    drawGround(ctx, W, H, this.groundY, this.structures);

    ctx.restore();

    // Damage flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 40, ${this.flash * 0.35})`;
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
