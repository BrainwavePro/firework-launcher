// Firework type definitions, player shells, and bursts (blast zones).
// A Burst is a set of timed zones; enemy missiles inside an active zone die.

import { inCircle, inRing, segCircle, segRing } from './collision.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------
// Type catalogue
// Each type: hue (UI + particles), radius-ish stats, cooldown (s between
// launches), ammo (per wave, Infinity = unlimited), unlockWave, zones()
// building the blast shape, and onZone() spawning the visual for a zone.
// ---------------------------------------------------------------------------

export const FIREWORK_TYPES = {
  peony: {
    id: 'peony', name: 'Peony', hue: 330,
    cooldown: 0.25, ammo: Infinity, unlockWave: 1, sound: 'boom',
    desc: 'Classic sphere burst',
    zones(x, y) {
      return [zone('circle', x, y, { r: 80, delay: 0, life: 0.9 })];
    },
    onZone(ps, z) {
      ps.burst(80, z.x, z.y, 40, 290, {
        hue: this.hue, life: rand(0.8, 1.1), size: 2.2,
        gravity: 55, drag: 0.9, glow: true,
      });
      ps.burst(20, z.x, z.y, 20, 90, {
        hue: this.hue, sat: 30, lum: 90, life: 0.55, size: 2.6, gravity: 30, drag: 0.6,
      });
    },
  },

  willow: {
    id: 'willow', name: 'Willow', hue: 45,
    cooldown: 0.6, ammo: 5, unlockWave: 1, sound: 'boom',
    desc: 'Golden curtain that guards a column of sky',
    zones(x, y) {
      return [
        zone('circle', x, y, { r: 90, delay: 0, life: 3.0 }),
        // The drooping trails keep killing below the burst point.
        zone('circle', x, y + 55, { r: 70, delay: 0.9, life: 2.0, tag: 'curtain' }),
      ];
    },
    onZone(ps, z) {
      if (z.tag === 'curtain') {
        // Gold shimmer marking the falling curtain.
        ps.burst(22, z.x, z.y, 5, 45, {
          hue: this.hue, sat: 70, lum: 78, life: 1.7, size: 1.5,
          gravity: 65, drag: 0.4, flicker: 0.65,
        });
        return;
      }
      ps.burst(110, z.x, z.y, 30, 260, {
        hue: this.hue, life: rand(2.6, 3.4), size: 1.9,
        gravity: 130, drag: 0.95, streak: true, flicker: 0.35, fade: 1.1,
      });
      ps.burst(25, z.x, z.y, 15, 80, {
        hue: this.hue, sat: 35, lum: 92, life: 0.6, size: 2.4, gravity: 40, drag: 0.6,
      });
    },
  },

  ring: {
    id: 'ring', name: 'Ring', hue: 190,
    cooldown: 0.8, ammo: 5, unlockWave: 2, sound: 'ring',
    desc: 'Expanding shockwave — kills along the edge',
    zones(x, y) {
      return [zone('ring', x, y, { r0: 12, r1: 165, halfWidth: 24, delay: 0, life: 0.85 })];
    },
    onZone(ps, z) {
      const speed = (z.r1 - z.r0) / z.life;
      const n = 90;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rand(-0.02, 0.02);
        ps.spawn({
          x: z.x + Math.cos(a) * z.r0, y: z.y + Math.sin(a) * z.r0,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          hue: this.hue, life: z.life + 0.25, size: 2.2,
          gravity: 8, drag: 0, glow: true, fade: 2.2,
        });
      }
    },
  },

  palm: {
    id: 'palm', name: 'Palm', hue: 105,
    cooldown: 0.9, ammo: 4, unlockWave: 3, sound: 'boom',
    desc: 'Comet that splits into five bursts',
    zones(x, y) {
      const zs = [zone('circle', x, y, { r: 42, delay: 0, life: 0.6 })];
      const fan = [-162, -126, -90, -54, -18];
      for (const deg of fan) {
        const a = (deg * Math.PI) / 180;
        zs.push(zone('circle', x + Math.cos(a) * 100, y + Math.sin(a) * 100 - 12, {
          r: 46, delay: 0.35, life: 0.8, frond: a,
        }));
      }
      return zs;
    },
    onZone(ps, z, origin) {
      if (z.frond === undefined) {
        // Center pop + comets streaking out to where the fronds will burst.
        ps.burst(28, z.x, z.y, 30, 130, {
          hue: this.hue, life: 0.6, size: 2, gravity: 40, drag: 0.8, glow: true,
        });
        return;
      }
      // Frond burst at the comet's destination.
      ps.burst(45, z.x, z.y, 30, 200, {
        hue: this.hue, life: rand(0.8, 1.2), size: 2,
        gravity: 95, drag: 0.9, streak: true, glow: true,
      });
    },
    // Comet trails drawn continuously while fronds are in flight.
    tick(ps, burst, dt) {
      for (const z of burst.zones) {
        if (z.frond === undefined || burst.age >= z.delay) continue;
        const t = burst.age / z.delay;
        const cx = burst.x + (z.x - burst.x) * t;
        const cy = burst.y + (z.y - burst.y) * t;
        ps.spawn({
          x: cx, y: cy, vx: rand(-15, 15), vy: rand(-15, 15),
          hue: this.hue, sat: 60, lum: 80, life: 0.4, size: 2.6,
          gravity: 20, drag: 0.5, glow: true,
        });
      }
    },
  },

  crackle: {
    id: 'crackle', name: 'Crackle', hue: 55,
    cooldown: 0.7, ammo: 4, unlockWave: 4, sound: 'crackle',
    desc: 'Strobing micro-bursts across a huge footprint',
    zones(x, y) {
      const zs = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * TAU;
        const d = i === 0 ? 0 : rand(25, 150);
        zs.push(zone('circle', x + Math.cos(a) * d, y + Math.sin(a) * d, {
          r: 36, delay: i * 0.1, life: 0.35,
        }));
      }
      return zs;
    },
    onZone(ps, z) {
      ps.burst(18, z.x, z.y, 20, 150, {
        hue: this.hue, sat: 60, lum: 88, life: rand(0.25, 0.5), size: 1.8,
        gravity: 60, drag: 0.5, flicker: 0.8, glow: true,
      });
    },
  },

  chrys: {
    id: 'chrys', name: 'Chrys', hue: 265,
    cooldown: 1.6, ammo: 2, unlockWave: 5, sound: 'chrysboom', power: 2,
    desc: 'Giant layered bloom — huge radius',
    zones(x, y) {
      return [zone('circle', x, y, { r: 135, delay: 0, life: 1.25 })];
    },
    onZone(ps, z) {
      // Pressure-wave glow ring racing ahead of the bloom.
      ps.burst(12, z.x, z.y, 280, 320, {
        hue: this.hue, sat: 40, lum: 85, life: 0.45, size: 6,
        gravity: 0, drag: 0.2, glow: true, fade: 2.6,
      });
      // Main shell with hue drift: violet core → magenta rim.
      for (let i = 0; i < 140; i++) {
        const a = Math.random() * TAU;
        const v = rand(60, 330);
        ps.spawn({
          x: z.x, y: z.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          hue: 250 + (v / 330) * 65, life: rand(1.1, 1.5), size: 2.3,
          gravity: 45, drag: 1.0, streak: true, glow: true,
        });
      }
      // Gold pistil ring inside the bloom.
      ps.burst(45, z.x, z.y, 40, 115, {
        hue: 48, life: rand(0.9, 1.3), size: 2, gravity: 55, drag: 0.8, streak: true,
      });
      // White core flash.
      ps.burst(30, z.x, z.y, 10, 90, {
        hue: this.hue, sat: 15, lum: 96, life: 0.5, size: 3, gravity: 20, drag: 0.6, glow: true,
      });
      // Lingering sparkle strobes that outlive the main shell.
      for (let i = 0; i < 25; i++) {
        const a = Math.random() * TAU;
        const d = rand(20, 125);
        ps.spawn({
          x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d,
          vx: rand(-15, 15), vy: rand(-5, 25),
          hue: 55, sat: 50, lum: 90, life: rand(1.5, 2.3), size: 1.6,
          gravity: 35, drag: 0.5, flicker: 0.85,
        });
      }
    },
  },

  curtain: {
    id: 'curtain', name: 'Curtain', hue: 150,
    cooldown: 1.1, ammo: 3, unlockWave: 6, sound: 'curtain',
    desc: 'Horizontal wall of strobing green fire',
    zones(x, y, bounds) {
      const W = bounds?.W ?? 900;
      const zs = [];
      // Seven cells rippling outward from the tap point, clamped on-screen.
      for (let i = -3; i <= 3; i++) {
        const zx = Math.min(W - 30, Math.max(30, x + i * 56));
        zs.push(zone('circle', zx, y, { r: 36, delay: Math.abs(i) * 0.09, life: 1.5 }));
      }
      return zs;
    },
    onZone(ps, z) {
      ps.burst(20, z.x, z.y, 15, 130, {
        hue: this.hue, life: rand(0.9, 1.4), size: 1.8,
        gravity: 30, drag: 0.7, flicker: 0.7, glow: true,
      });
    },
  },

  seeker: {
    id: 'seeker', name: 'Seeker', hue: 215,
    cooldown: 1.2, ammo: 3, unlockWave: 8, sound: 'seeker',
    desc: 'Three homing motes hunt down missiles',
    zones(x, y) {
      return [0, 1, 2].map((i) =>
        zone('circle', x, y, { r: 24, delay: i * 0.12, life: 2.4 }));
    },
    onZone(ps, z) {
      ps.burst(14, z.x, z.y, 20, 90, {
        hue: this.hue, life: 0.4, size: 2, gravity: 20, drag: 0.6, glow: true,
      });
    },
    // Each active zone steers toward the nearest live target at ≤250 px/s.
    tick(ps, burst, dt) {
      const targets = burst.bounds?.getTargets?.() ?? [];
      for (const z of burst.zones) {
        if (!burst.zoneActive(z)) continue;
        let best = null;
        let bd = Infinity;
        for (const m of targets) {
          const d = Math.hypot(m.x - z.x, m.y - z.y);
          if (d < bd) { bd = d; best = m; }
        }
        if (best && bd > 0.5) {
          const k = Math.min(1, (250 * dt) / bd);
          z.x += (best.x - z.x) * k;
          z.y += (best.y - z.y) * k;
        } else if (!best) {
          z.y -= 40 * dt; // empty sky: drift up and fizzle
        }
        ps.spawn({
          x: z.x, y: z.y, vx: rand(-10, 10), vy: rand(-10, 10),
          hue: this.hue, sat: 70, lum: 80, life: 0.35, size: 2.2,
          gravity: 0, drag: 0.5, glow: true,
        });
      }
    },
  },

  diablo: {
    id: 'diablo', name: 'Diablo', hue: 12,
    cooldown: 2, ammo: 1, unlockWave: 10, sound: 'boom', power: 4,
    desc: 'A tiny boom. Then the sun.',
    zones(x, y, bounds) {
      const W = bounds?.W ?? 900;
      const H = bounds?.H ?? 900;
      const rMax = Math.hypot(W, H) * 1.05;
      return [
        zone('circle', x, y, { r: 24, delay: 0, life: 0.25, sound: 'diabloPop', tag: 'pop' }),
        zone('grow', x, y, { r0: 30, r1: rMax, delay: 0.95, life: 1.1, sound: 'diabloBoom', tag: 'nuke' }),
        // Zero-radius zone only keeps the burst alive for the ember plume.
        zone('circle', x, y, { r: 0, delay: 2.05, life: 1.1, sound: null, tag: 'plume' }),
      ];
    },
    onZone(ps, z) {
      if (z.tag === 'pop') {
        ps.burst(14, z.x, z.y, 30, 120, {
          hue: this.hue, sat: 30, lum: 95, life: 0.3, size: 2, gravity: 20, drag: 0.5, glow: true,
        });
        return;
      }
      if (z.tag === 'plume') {
        for (let i = 0; i < 45; i++) {
          ps.spawn({
            x: z.x + rand(-70, 70), y: z.y + rand(-30, 30),
            vx: rand(-25, 25), vy: rand(-90, -20),
            hue: rand(8, 35), life: rand(1.0, 2.0), size: rand(2, 4),
            gravity: -25, drag: 0.8, flicker: 0.5, glow: true,
          });
        }
        return;
      }
      // Detonation core.
      ps.burst(120, z.x, z.y, 100, 700, {
        hue: 18, life: rand(0.8, 1.4), size: 3,
        gravity: -20, drag: 1.6, streak: true, glow: true,
      });
      ps.burst(60, z.x, z.y, 30, 220, {
        hue: 45, sat: 40, lum: 92, life: 0.7, size: 4, gravity: -40, drag: 1.2, glow: true,
      });
    },
    // Fire riding the expanding shock front, plus interior churn.
    tick(ps, burst) {
      const z = burst.zones[1];
      const t = (burst.age - z.delay) / z.life;
      if (t <= 0 || t >= 1) return;
      const r = z.r0 + (z.r1 - z.r0) * t;
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * TAU;
        const d = r * rand(0.85, 1);
        ps.spawn({
          x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d,
          vx: Math.cos(a) * 130, vy: Math.sin(a) * 130 - 30,
          hue: rand(8, 32), life: rand(0.4, 0.9), size: rand(2.5, 4.5),
          gravity: -30, drag: 1.0, glow: true, flicker: 0.3,
        });
      }
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * TAU;
        const d = r * Math.random() * 0.8;
        ps.spawn({
          x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d,
          vx: rand(-40, 40), vy: rand(-60, 10),
          hue: rand(15, 45), sat: 80, lum: rand(60, 90),
          life: rand(0.3, 0.7), size: rand(2, 5), gravity: -20, drag: 0.8, glow: true,
        });
      }
    },
  },
};

export const TYPE_ORDER = [
  'peony', 'willow', 'ring', 'palm', 'crackle', 'chrys', 'curtain', 'seeker', 'diablo',
];

// Small sympathetic pop left behind by a destroyed missile (chain reactions).
export const POP_TYPE = {
  id: 'pop', name: 'Pop', hue: 25,
  sound: 'pop',
  zones(x, y) {
    return [zone('circle', x, y, { r: 30, delay: 0, life: 0.28 })];
  },
  onZone(ps, z) {
    ps.burst(16, z.x, z.y, 30, 130, {
      hue: this.hue, life: 0.35, size: 1.8, gravity: 50, drag: 0.5, glow: true,
    });
  },
};

function zone(kind, x, y, props) {
  return { kind, x, y, started: false, ...props };
}

// ---------------------------------------------------------------------------
// Burst: live blast made of timed zones.
// ---------------------------------------------------------------------------

export class Burst {
  constructor(type, x, y, ps, audio, bounds) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.ps = ps;
    this.audio = audio;
    this.age = 0;
    this.prevAge = 0;
    this.bounds = bounds;
    this.zones = type.zones(x, y, bounds);
    this.kills = 0;
    this.done = false;
  }

  update(dt) {
    this.prevAge = this.age;
    this.age += dt;
    if (this.type.tick) this.type.tick(this.ps, this, dt);
    let alive = false;
    for (const z of this.zones) {
      if (!z.started && this.age >= z.delay) {
        z.started = true;
        this.type.onZone(this.ps, z, this);
        const snd = z.sound !== undefined ? z.sound : this.type.sound;
        if (this.audio && snd) this.audio.zone(snd, z === this.zones[0]);
      }
      if (this.age < z.delay + z.life) alive = true;
    }
    if (!alive) this.done = true;
  }

  zoneActive(z) {
    return z.started && this.age < z.delay + z.life;
  }

  /** Radius of a grow/ring zone at burst-age t, clamped to its span. */
  _radiusAt(z, t) {
    const k = Math.min(1, Math.max(0, (t - z.delay) / z.life));
    return z.r0 + (z.r1 - z.r0) * k;
  }

  /**
   * Swept test against a missile-like target {x, y, px, py, r}: the target's
   * frame movement px,py → x,y is a segment, so fast missiles can't tunnel
   * through a thin zone (a Ring edge) between frames.
   */
  hits(m) {
    const pr = m.r || 0;
    for (const z of this.zones) {
      if (!this.zoneActive(z)) continue;
      if (z.kind === 'circle') {
        if (segCircle(m.px, m.py, m.x, m.y, z.x, z.y, z.r + pr)) return true;
      } else if (z.kind === 'grow') {
        if (segCircle(m.px, m.py, m.x, m.y, z.x, z.y, this._radiusAt(z, this.age) + pr)) {
          return true;
        }
      } else if (z.kind === 'ring') {
        if (segRing(m.px, m.py, m.x, m.y, z.x, z.y,
          this._radiusAt(z, this.prevAge), this._radiusAt(z, this.age),
          z.halfWidth + pr)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Like hits(), but for a static circular target of radius pr (the boss). */
  hitsCircle(px, py, pr) {
    for (const z of this.zones) {
      if (!this.zoneActive(z)) continue;
      if (z.kind === 'circle') {
        if (inCircle(px, py, z.x, z.y, z.r + pr)) return true;
      } else if (z.kind === 'grow') {
        if (inCircle(px, py, z.x, z.y, this._radiusAt(z, this.age) + pr)) return true;
      } else if (z.kind === 'ring') {
        if (inRing(px, py, z.x, z.y, this._radiusAt(z, this.age), z.halfWidth + pr)) return true;
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shell: the interceptor rocket flying from a battery to the tap point.
// ---------------------------------------------------------------------------

export class Shell {
  constructor(type, sx, sy, tx, ty, speed) {
    this.type = type;
    this.sx = sx; this.sy = sy;
    this.tx = tx; this.ty = ty;
    this.x = sx; this.y = sy;
    const d = Math.max(1, Math.hypot(tx - sx, ty - sy));
    this.dur = d / speed;
    this.t = 0;
    this.arrived = false;
  }

  update(dt, ps) {
    this.t += dt;
    const s = Math.min(1, this.t / this.dur);
    this.x = this.sx + (this.tx - this.sx) * s;
    this.y = this.sy + (this.ty - this.sy) * s;
    // Sparky exhaust
    ps.spawn({
      x: this.x + rand(-1.5, 1.5), y: this.y + rand(-1.5, 1.5),
      vx: rand(-20, 20), vy: rand(10, 50),
      hue: this.type.hue, sat: 50, lum: 80,
      life: 0.35, size: 1.6, gravity: 40, drag: 0.4,
    });
    if (s >= 1) this.arrived = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Faint guide from battery
    ctx.strokeStyle = `hsla(${this.type.hue} 80% 70% / 0.22)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.sx, this.sy);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    // Bright head
    ctx.fillStyle = `hsl(${this.type.hue} 60% 90%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.6, 0, TAU);
    ctx.fill();
    // Target marker
    ctx.strokeStyle = `hsla(${this.type.hue} 90% 75% / 0.8)`;
    ctx.lineWidth = 1.5;
    const m = 5;
    ctx.beginPath();
    ctx.moveTo(this.tx - m, this.ty - m); ctx.lineTo(this.tx + m, this.ty + m);
    ctx.moveTo(this.tx + m, this.ty - m); ctx.lineTo(this.tx - m, this.ty + m);
    ctx.stroke();
    ctx.restore();
  }
}
