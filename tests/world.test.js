import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyMissile, waveConfig } from '../js/world.js';

test('waveConfig: difficulty is monotone on non-boss waves', () => {
  const waves = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 21, 31, 51].map(waveConfig);
  for (let i = 1; i < waves.length; i++) {
    assert.ok(waves[i].speedFrac >= waves[i - 1].speedFrac, `speed drops at index ${i}`);
    assert.ok(waves[i].interval <= waves[i - 1].interval, `interval rises at index ${i}`);
    assert.ok(waves[i].count >= waves[i - 1].count, `count drops at index ${i}`);
  }
});

test('waveConfig: keeps scaling past the old wave-15 plateau', () => {
  assert.ok(waveConfig(30).speedFrac > waveConfig(16).speedFrac);
  assert.ok(waveConfig(50).speedFrac > waveConfig(30).speedFrac);
});

test('waveConfig: special-spawn chances stay under 0.9 combined', () => {
  for (let n = 1; n <= 100; n++) {
    const c = waveConfig(n);
    const sum = c.mirvChance + c.smartChance + c.armorChance + c.bomberChance;
    assert.ok(sum < 0.9, `chance sum ${sum} at wave ${n}`);
  }
});

test('waveConfig: sane bounds far out', () => {
  const c = waveConfig(200);
  assert.ok(c.speedFrac < 0.3);
  assert.ok(c.interval >= 0.25);
  assert.ok(c.count <= 50);
});

test('waveConfig: boss every 5th wave, scaling hp', () => {
  assert.equal(waveConfig(4).boss, null);
  assert.equal(waveConfig(5).boss.hp, 8);
  assert.equal(waveConfig(10).boss.hp, 12);
  assert.ok(waveConfig(10).boss.value > waveConfig(5).boss.value);
});

const missile = (over = {}) =>
  new EnemyMissile({
    sx: 0, sy: 0,
    target: { x: 300, y: 400, ref: null },
    speed: 100,
    kind: 'normal',
    ...over,
  });

test('EnemyMissile: tracks previous-frame position for swept hits', () => {
  const m = missile();
  const x0 = m.x, y0 = m.y;
  m.update(0.1);
  assert.equal(m.px, x0);
  assert.equal(m.py, y0);
  assert.notEqual(m.x, x0);
});

test('EnemyMissile: impacts at the target', () => {
  const m = missile({ speed: 10000 });
  m.update(0.1);
  assert.equal(m.impacted, true);
  assert.equal(Math.round(m.x), 300);
  assert.equal(Math.round(m.y), 400);
});

test('EnemyMissile: mirv signals split exactly once', () => {
  const m = missile({ kind: 'mirv' });
  let splits = 0;
  for (let i = 0; i < 200 && !m.impacted; i++) {
    if (m.update(1 / 30) === 'split') {
      splits++;
      m.splitAt = -1; // what main.js does after handling the split
    }
  }
  assert.equal(splits, 1);
});

test('EnemyMissile: bomber signals three drops, then crosses without ground hit flag', () => {
  const m = missile({ kind: 'bomber' });
  let drops = 0;
  for (let i = 0; i < 400 && !m.impacted; i++) {
    if (m.update(1 / 30) === 'drop') drops++;
  }
  assert.equal(drops, 3);
  assert.equal(m.kind, 'bomber'); // main.js skips impact() for escaped bombers
});

test('EnemyMissile: retarget follows the structure to a new screen size', () => {
  const ref = { f: 0.4, alive: true, kind: 'city' };
  const m = missile({ target: { x: 0.4 * 500, y: 400, ref } });
  m.retarget(1000, 800);
  assert.equal(m.target.x, 400);
  assert.equal(m.target.y, 800);
  // Targets without a structure (bomber fly-through) stay as aimed.
  const b = missile({ kind: 'bomber' });
  const tx = b.target.x;
  b.retarget(1000, 800);
  assert.equal(b.target.x, tx);
});
