// Pooled particle system. All positions are in CSS pixels.

const POOL_MAX = 5000;
const TAU = Math.PI * 2;

export class ParticleSystem {
  constructor() {
    this.parts = [];
  }

  /**
   * Spawn one particle.
   * @param {object} p x, y, vx, vy, life, size, hue, sat, lum,
   *   gravity, drag, flicker (0..1), streak (draw as motion line),
   *   glow (extra halo), fade (alpha falloff exponent)
   */
  spawn(p) {
    if (this.parts.length >= POOL_MAX) return;
    this.parts.push({
      x: p.x, y: p.y,
      vx: p.vx || 0, vy: p.vy || 0,
      life: p.life || 1, age: 0,
      size: p.size || 2,
      hue: p.hue ?? 40, sat: p.sat ?? 100, lum: p.lum ?? 60,
      gravity: p.gravity ?? 60,
      drag: p.drag ?? 0.1,
      flicker: p.flicker ?? 0,
      streak: p.streak ?? false,
      glow: p.glow ?? false,
      fade: p.fade ?? 1.6,
    });
  }

  /** Radial burst helper: n particles from (x,y) with speeds in [minV,maxV]. */
  burst(n, x, y, minV, maxV, props) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = minV + Math.random() * (maxV - minV);
      this.spawn({ ...props, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    }
  }

  update(dt) {
    const parts = this.parts;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) {
        parts[i] = parts[parts.length - 1];
        parts.pop();
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const t = p.age / p.life;
      let a = Math.pow(1 - t, p.fade);
      if (p.flicker) a *= (1 - p.flicker) + p.flicker * Math.random();
      if (a <= 0.02) continue;
      ctx.globalAlpha = Math.min(1, a);
      const color = `hsl(${p.hue} ${p.sat}% ${p.lum}%)`;
      if (p.streak) {
        const k = 0.05;
        ctx.strokeStyle = color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * k, p.y - p.vy * k);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      if (p.glow) {
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.min(1, a) * 0.22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  get count() {
    return this.parts.length;
  }

  clear() {
    this.parts.length = 0;
  }
}
