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
   *   ('normal' | 'mirv' | 'smart'), hue
   */
  constructor(o) {
    this.sx = o.sx; this.sy = o.sy;
    this.target = o.target;
    this.speed = o.speed;
    this.kind = o.kind || 'normal';
    this.hue = o.hue ?? (this.kind === 'smart' ? 285 : this.kind === 'mirv' ? 20 : 0);
    this.x = o.sx; this.y = o.sy;
    this.dist = Math.max(1, Math.hypot(o.target.x - o.sx, o.target.y - o.sy));
    this.traveled = 0;
    this.age = 0;
    this.splitAt = this.kind === 'mirv' ? rand(0.3, 0.55) : -1;
    this.trail = [{ x: this.x, y: this.y }];
    this.dead = false;
    this.impacted = false;
  }

  update(dt) {
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
      if (this.trail.length > 70) this.trail.shift();
    }
    if (s >= 1) this.impacted = true;
    return s >= this.splitAt && this.splitAt > 0;
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
    // Glowing warhead
    ctx.fillStyle = `hsl(${this.hue} 100% 82%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `hsla(${this.hue} 100% 65% / 0.35)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

export function waveConfig(n) {
  return {
    count: 6 + n * 2,
    speedFrac: Math.min(0.22, 0.055 + n * 0.011), // × screen height px/s
    interval: Math.max(0.4, 2.3 - n * 0.16),
    mirvChance: n >= 3 ? Math.min(0.35, 0.1 + (n - 3) * 0.07) : 0,
    smartChance: n >= 5 ? Math.min(0.3, 0.1 + (n - 5) * 0.05) : 0,
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
