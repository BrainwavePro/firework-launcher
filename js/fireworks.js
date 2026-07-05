// Firework type definitions, player shells, and bursts (blast zones).
// A Burst is a set of timed zones; enemy missiles inside an active zone die.

import { inCircle, inRing } from './collision.js';

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
    cooldown: 0.5, ammo: 6, unlockWave: 1, sound: 'boom',
    desc: 'Drooping golden trails that linger',
    zones(x, y) {
      return [zone('circle', x, y, { r: 60, delay: 0, life: 2.3 })];
    },
    onZone(ps, z) {
      ps.burst(70, z.x, z.y, 30, 190, {
        hue: this.hue, life: rand(2.0, 2.6), size: 1.8,
        gravity: 120, drag: 0.95, streak: true, flicker: 0.35, fade: 1.1,
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
        zs.push(zone('circle', x + Math.cos(a) * 82, y + Math.sin(a) * 82, {
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
    desc: 'Strobing cluster of micro-bursts',
    zones(x, y) {
      const zs = [];
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * TAU;
        const d = i === 0 ? 0 : rand(20, 95);
        zs.push(zone('circle', x + Math.cos(a) * d, y + Math.sin(a) * d, {
          r: 32, delay: i * 0.11, life: 0.35,
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
    cooldown: 1.6, ammo: 2, unlockWave: 5, sound: 'bigboom',
    desc: 'Giant slow bloom — huge radius',
    zones(x, y) {
      return [zone('circle', x, y, { r: 135, delay: 0, life: 1.25 })];
    },
    onZone(ps, z) {
      ps.burst(130, z.x, z.y, 60, 330, {
        hue: this.hue, life: rand(1.1, 1.5), size: 2.3,
        gravity: 45, drag: 1.0, streak: true, glow: true,
      });
      ps.burst(50, z.x, z.y, 20, 140, {
        hue: this.hue, sat: 25, lum: 92, life: 0.8, size: 2.2, gravity: 30, drag: 0.7,
      });
    },
  },
};

export const TYPE_ORDER = ['peony', 'willow', 'ring', 'palm', 'crackle', 'chrys'];

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
  constructor(type, x, y, ps, audio) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.ps = ps;
    this.audio = audio;
    this.age = 0;
    this.zones = type.zones(x, y);
    this.kills = 0;
    this.done = false;
  }

  update(dt) {
    this.age += dt;
    if (this.type.tick) this.type.tick(this.ps, this, dt);
    let alive = false;
    for (const z of this.zones) {
      if (!z.started && this.age >= z.delay) {
        z.started = true;
        this.type.onZone(this.ps, z, this);
        if (this.audio) this.audio.zone(this.type.sound, z === this.zones[0]);
      }
      if (this.age < z.delay + z.life) alive = true;
    }
    if (!alive) this.done = true;
  }

  zoneActive(z) {
    return z.started && this.age < z.delay + z.life;
  }

  hits(px, py) {
    for (const z of this.zones) {
      if (!this.zoneActive(z)) continue;
      if (z.kind === 'circle') {
        if (inCircle(px, py, z.x, z.y, z.r)) return true;
      } else if (z.kind === 'ring') {
        const t = (this.age - z.delay) / z.life;
        const r = z.r0 + (z.r1 - z.r0) * t;
        if (inRing(px, py, z.x, z.y, r, z.halfWidth)) return true;
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
