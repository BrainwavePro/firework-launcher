import test from 'node:test';
import assert from 'node:assert/strict';
import { FIREWORK_TYPES, POP_TYPE, Burst } from '../js/fireworks.js';

// Particles are visual-only; a burst under test just needs the interface.
const stubPs = { spawn() {}, burst() {} };
const mk = (type, x = 0, y = 0, bounds) => new Burst(type, x, y, stubPs, null, bounds);
const target = (x, y, px = x, py = y, r = 0) => ({ x, y, px, py, r });

test('Burst: zones activate after their delay and expire after life', () => {
  const b = mk(POP_TYPE); // one circle r30, delay 0, life 0.28
  b.update(0.01);
  assert.equal(b.hits(target(10, 10)), true);
  b.update(0.28);
  assert.equal(b.hits(target(10, 10)), false);
  assert.equal(b.done, true);
});

test('Burst: delayed willow curtain only kills once it starts', () => {
  const b = mk(FIREWORK_TYPES.willow, 0, 0);
  const inCurtain = target(0, 100); // curtain zone: (0, 55) r70, delay 0.9
  b.update(0.05);
  assert.equal(b.hits(inCurtain), false);
  for (let i = 0; i < 20; i++) b.update(0.05); // past the 0.9s delay
  assert.equal(b.hits(inCurtain), true);
});

test('Burst: body radius turns a near miss into a hit', () => {
  const b = mk(POP_TYPE); // r 30
  b.update(0.01);
  assert.equal(b.hits(target(33, 0, 33, 0, 0)), false);
  assert.equal(b.hits(target(33, 0, 33, 0, 4)), true);
});

test('Burst: swept segment catches a missile crossing a ring edge in one frame', () => {
  const b = mk(FIREWORK_TYPES.ring, 0, 0); // r0 12 → r1 165 over 0.85s
  for (let i = 0; i < 25; i++) b.update(1 / 60); // radius ≈ 87
  // From d=150 to d=50 in a single frame: endpoints outside the band.
  const leap = target(50, 0, 150, 0, 0);
  assert.equal(b.hits(leap), true);
  // The same frame, standing still outside the band: no hit.
  assert.equal(b.hits(target(150, 0)), false);
});

test('Burst: diablo grow zone eventually covers the far corner', () => {
  const b = mk(FIREWORK_TYPES.diablo, 100, 100, { W: 400, H: 800 });
  const corner = target(390, 790);
  b.update(0.5);
  assert.equal(b.hits(corner), false); // still the tiny pop
  for (let i = 0; i < 28; i++) b.update(0.05); // age 1.9: front ≈ 815px out
  assert.equal(b.hits(corner), true); // nuke front reached everything
});

test('Burst: hitsCircle inflates zones by the target radius (boss)', () => {
  const b = mk(POP_TYPE); // r 30
  b.update(0.01);
  assert.equal(b.hitsCircle(60, 0, 10), false);
  assert.equal(b.hitsCircle(60, 0, 35), true);
});
