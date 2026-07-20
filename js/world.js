// Ground structures (cities, batteries) and enemy missiles / wave logic.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

// Layout fractions across the screen width: B = battery, C = city.
export const GROUND_LAYOUT = [
  { kind: 'B', f: 0.07 },
  { kind: 'C', f: 0.18 },
  { kind: 'C', f: 0.29 },
  { kind: 'C', f: 0.40 },
  { kind: 'B', f: 0.50 },
  { kind: 'C', f: 0.60 },
  { kind: 'C', f: 0.71 },
  { kind: 'C', f: 0.82 },
  { kind: 'B', f: 0.93 },
];

export class City {
  constructor(f, seed) {
    this.kind = 'city';
    this.f = f;          // x as fraction of screen width
    this.seed = seed;
    this.alive = true;
    this.x = 0;          // set by layout()
  }
}

export class Battery {
  constructor(f) {
    this.kind = 'battery';
    this.f = f;
    this.alive = true;
    this.x = 0;
  }
}

export function makeStructures() {
  return GROUND_LAYOUT.map((s, i) =>
    s.kind === 'B' ? new Battery(s.f) : new City(s.f, i * 7919)
  );
}

// ---------------------------------------------------------------------------
// Enemy missiles
// ---------------------------------------------------------------------------

export class EnemyMissile {
  /**
   * @param {object} o sx, sy, target {x, y, ref}, speed, kind
   *   ('normal' | 'mirv' | 'smart' | 'armor' | 'bomber'), hue
   */
  constructor(o) {
    this.sx = o.sx; this.sy = o.sy;
    this.target = o.target;
    this.speed = o.speed;
    this.kind = o.kind || 'normal';
    this.hue = o.hue ?? (
      this.kind === 'smart' ? 285
      : this.kind === 'mirv' ? 20
      : this.kind === 'armor' ? 210
      : this.kind === 'bomber' ? 58
      : 0);
    this.hp = o.hp ?? (this.kind === 'armor' || this.kind === 'bomber' ? 2 : 1);
    this.value = o.value ?? (this.kind === 'armor' ? 200 : this.kind === 'bomber' ? 300 : 100);
    this.hitBursts = new Set(); // bursts that already damaged this missile
    this.damaged = false;
    // Body radius for hit tests, matching the drawn warhead size.
    this.r = this.kind === 'bomber' ? 8 : this.kind === 'armor' ? 4.5 : 3;
    this.x = o.sx; this.y = o.sy;
    this.px = o.sx; this.py = o.sy; // position last frame (for swept hits)
    this.dist = Math.max(1, Math.hypot(o.target.x - o.sx, o.target.y - o.sy));
    this.traveled = 0;
    this.age = 0;
    this.splitAt = this.kind === 'mirv' ? rand(0.3, 0.55) : -1;
    // Bombers release a bomb at each of these progress fractions.
    this.drops = this.kind === 'bomber' ? [0.25, 0.5, 0.75] : [];
    this.trail = [{ x: this.x, y: this.y }];
    this.dead = false;
    this.impacted = false;
  }

  update(dt) {
    this.px = this.x;
    this.py = this.y;
    this.age += dt;
    this.traveled += this.speed * dt;
    const s = Math.min(1, this.traveled / this.dist);
    let x = this.sx + (this.target.x - this.sx) * s;
    let y = this.sy + (this.target.y - this.sy) * s;
    if (this.kind === 'smart') {
      // Weave perpendicular to the flight line; amplitude dies out on approach
      // so the missile still homes in on its target.
      const px = -(this.target.y - this.sy) / this.dist;
      const py = (this.target.x - this.sx) / this.dist;
      const w = Math.sin(this.age * 4.2) * 42 * (1 - s);
      x += px * w;
      y += py * w;
    }
    this.x = x; this.y = y;
    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > 5) {
      this.trail.push({ x, y });
      if (this.trail.length > (this.kind === 'bomber' ? 30 : 70)) this.trail.shift();
    }
    if (s >= 1) this.impacted = true;
    if (this.splitAt > 0 && s >= this.splitAt) return 'split';
    if (this.drops.length && s >= this.drops[0]) {
      this.drops.shift();
      return 'drop';
    }
    return null;
  }

  /** Re-aim at the target structure's current position after a resize. */
  retarget(W, groundY) {
    if (!this.target.ref) return;
    this.target.x = this.target.ref.f * W;
    this.target.y = groundY;
    this.dist = Math.max(1, Math.hypot(this.target.x - this.sx, this.target.y - this.sy));
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const t = this.trail;
    ctx.strokeStyle = `hsla(${this.hue} 95% 58% / 0.7)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(t[0].x, t[0].y);
    for (let i = 1; i < t.length; i++) ctx.lineTo(t[i].x, t[i].y);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    if (this.kind === 'armor') {
      // Heavy warhead; the hex plating drops away once cracked.
      ctx.fillStyle = `hsl(${this.hue} ${this.damaged ? 90 : 50}% ${this.damaged ? 85 : 72}%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3.6, 0, TAU);
      ctx.fill();
      if (!this.damaged) {
        ctx.strokeStyle = `hsla(${this.hue} 70% 85% / 0.9)`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU - Math.PI / 2;
          const px = this.x + Math.cos(a) * 7;
          const py = this.y + Math.sin(a) * 7;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.fillStyle = `hsla(${this.hue} 100% 65% / 0.35)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 9, 0, TAU);
      ctx.fill();
    } else if (this.kind === 'bomber') {
      // Wide chevron hull with a blinking belly light.
      const dir = this.target.x > this.sx ? 1 : -1;
      ctx.fillStyle = `hsl(${this.hue} 80% 70%)`;
      ctx.beginPath();
      ctx.moveTo(this.x + 11 * dir, this.y);
      ctx.lineTo(this.x - 7 * dir, this.y - 5);
      ctx.lineTo(this.x - 3 * dir, this.y);
      ctx.lineTo(this.x - 7 * dir, this.y + 5);
      ctx.closePath();
      ctx.fill();
      if (Math.sin(this.age * 8) > 0) {
        ctx.fillStyle = 'hsl(0 90% 65%)';
        ctx.beginPath();
        ctx.arc(this.x, this.y + 6, 2, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = `hsla(${this.hue} 100% 65% / 0.25)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 12, 0, TAU);
      ctx.fill();
    } else {
      // Glowing warhead
      ctx.fillStyle = `hsl(${this.hue} 100% 82%)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `hsla(${this.hue} 100% 65% / 0.35)`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Boss: the Mothership that arrives every fifth wave.
// ---------------------------------------------------------------------------

export class Boss {
  /** @param {object} o W, H, hp, salvoEvery, salvoSize, value */
  constructor(o) {
    this.hp = o.hp;
    this.maxHp = o.hp;
    this.salvoEvery = o.salvoEvery;
    this.salvoSize = o.salvoSize;
    this.value = o.value;
    this.age = 0;
    this.x = o.W * 0.5;
    this.y = -60;
    this.targetY = o.H * 0.16;
    this.salvoTimer = o.salvoEvery * 0.9;
    this.hitBursts = new Set(); // bursts that already damaged the boss
    this.hitFlash = 0;
    this.r = 40; // collision radius
  }

  /** Returns 'salvo' when it's time to fire, else null. */
  update(dt, W) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    // Descend over ~2s (cubic ease-out), then bob while strafing.
    const ease = Math.min(1, this.age / 2);
    const baseY = -60 + (this.targetY + 60) * (1 - Math.pow(1 - ease, 3));
    this.y = baseY + (ease >= 1 ? Math.sin(this.age * 1.7) * 6 : 0);
    this.x = W * (0.5 + 0.33 * Math.sin(this.age * 0.35));
    if (ease >= 1) {
      this.salvoTimer -= dt;
      if (this.salvoTimer <= 0) {
        this.salvoTimer = this.salvoEvery;
        return 'salvo';
      }
    }
    return null;
  }

  draw(ctx) {
    ctx.save();
    const flash = this.hitFlash > 0;
    // Engine glow under the hull.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `hsla(190 100% 70% / ${0.16 + 0.08 * Math.sin(this.age * 6)})`;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 14, 40, 13, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Saucer hull + dome.
    ctx.fillStyle = flash ? '#ffffff' : '#3a4370';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 55, 16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#5a6ba8';
    ctx.beginPath();
    ctx.arc(this.x, this.y - 8, 18, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'hsla(350 90% 65% / 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, 55, 16, 0, 0, TAU);
    ctx.stroke();
    // Chasing light row.
    for (let i = -2; i <= 2; i++) {
      const on = Math.sin(this.age * 5 + i * 1.3) > 0;
      ctx.fillStyle = on ? 'hsl(350 95% 65%)' : 'hsla(350 60% 40% / 0.5)';
      ctx.beginPath();
      ctx.arc(this.x + i * 20, this.y + 6, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

export function waveConfig(n) {
  const bossIndex = n % 5 === 0 ? n / 5 : 0;
  const count = 6 + n * 2;
  return {
    // Boss waves thin out the regular rain so the fight has room to breathe.
    count: bossIndex ? Math.round(count * 0.7) : count,
    speedFrac: Math.min(0.22, 0.055 + n * 0.011), // × screen height px/s
    interval: Math.max(0.4, 2.3 - n * 0.16),
    mirvChance: n >= 3 ? Math.min(0.35, 0.1 + (n - 3) * 0.07) : 0,
    smartChance: n >= 5 ? Math.min(0.3, 0.1 + (n - 5) * 0.05) : 0,
    armorChance: n >= 4 ? Math.min(0.18, 0.06 + (n - 4) * 0.03) : 0,
    bomberChance: n >= 6 ? Math.min(0.08, 0.04 + (n - 6) * 0.01) : 0,
    boss: bossIndex ? {
      hp: 8 + 4 * (bossIndex - 1),
      salvoEvery: Math.max(2.6, 4.6 - 0.5 * (bossIndex - 1)),
      salvoSize: Math.min(5, 1 + bossIndex),
      value: 2000 * bossIndex,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Drawing the ground strip
// ---------------------------------------------------------------------------

export function drawGround(ctx, W, H, groundY, structures) {
  // Soil
  const g = ctx.createLinearGradient(0, groundY, 0, H);
  g.addColorStop(0, '#141a30');
  g.addColorStop(1, '#080a16');
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.strokeStyle = 'rgba(120, 150, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 0.5);
  ctx.lineTo(W, groundY + 0.5);
  ctx.stroke();

  for (const s of structures) {
    s.x = s.f * W;
    if (s.kind === 'city') drawCity(ctx, s, groundY);
    else drawBattery(ctx, s, groundY);
  }
}

function drawCity(ctx, city, groundY) {
  const x = city.x;
  if (!city.alive) {
    ctx.fillStyle = '#1a1424';
    ctx.beginPath();
    ctx.moveTo(x - 16, groundY);
    ctx.lineTo(x - 8, groundY - 5);
    ctx.lineTo(x - 2, groundY - 2);
    ctx.lineTo(x + 6, groundY - 6);
    ctx.lineTo(x + 16, groundY);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // Three-tower skyline, deterministic per city.
  const r = mulberry(city.seed);
  ctx.fillStyle = '#232c52';
  const towers = [
    { dx: -14, w: 9, h: 14 + r() * 8 },
    { dx: -3, w: 10, h: 20 + r() * 10 },
    { dx: 8, w: 8, h: 12 + r() * 8 },
  ];
  for (const t of towers) ctx.fillRect(x + t.dx, groundY - t.h, t.w, t.h);
  // Lit windows
  ctx.fillStyle = 'rgba(255, 214, 130, 0.9)';
  for (const t of towers) {
    for (let wy = groundY - t.h + 3; wy < groundY - 3; wy += 5) {
      for (let wx = x + t.dx + 2; wx < x + t.dx + t.w - 1; wx += 4) {
        if (r() > 0.45) ctx.fillRect(wx, wy, 1.6, 2.2);
      }
    }
  }
}

function drawBattery(ctx, b, groundY) {
  const x = b.x;
  if (!b.alive) {
    ctx.fillStyle = '#241621';
    ctx.beginPath();
    ctx.arc(x, groundY, 12, Math.PI, 0);
    ctx.fill();
    return;
  }
  ctx.fillStyle = '#2c3a6e';
  ctx.beginPath();
  ctx.arc(x, groundY, 13, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#9fc0ff';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 6);
  ctx.lineTo(x, groundY - 15);
  ctx.stroke();
  ctx.fillStyle = '#cfe2ff';
  ctx.beginPath();
  ctx.arc(x, groundY - 15, 2.2, 0, TAU);
  ctx.fill();
}

// Tiny deterministic PRNG so city skylines don't reshuffle every frame.
function mulberry(seed) {
  let a = seed >>> 0 || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
