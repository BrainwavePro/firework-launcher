import test from 'node:test';
import assert from 'node:assert/strict';

// scores.js touches localStorage at call time; give Node a minimal stand-in.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadScores, qualifies, insertScore, best } = await import('../js/scores.js');

test('loadScores: empty storage gives empty list', () => {
  store.clear();
  assert.deepEqual(loadScores(), []);
});

test('loadScores: corrupt JSON gives empty list', () => {
  store.clear();
  store.set('fw-launcher-scores', '{nope');
  assert.deepEqual(loadScores(), []);
});

test('loadScores: migrates the pre-V3 single high score once', () => {
  store.clear();
  store.set('fw-launcher-high', '4200');
  const list = loadScores();
  assert.equal(list.length, 1);
  assert.equal(list[0].score, 4200);
  assert.equal(list[0].initials, 'AAA');
  assert.equal(store.has('fw-launcher-high'), false);   // consumed
  assert.equal(loadScores().length, 1);                 // and not re-imported
});

test('qualifies: any positive score on a short list; beat the tail on a full one', () => {
  assert.equal(qualifies([], 100), true);
  assert.equal(qualifies([], 0), false);
  const full = Array.from({ length: 10 }, (_, i) => ({ score: 1000 - i * 50 }));
  assert.equal(qualifies(full, 551), true);   // tail is 550
  assert.equal(qualifies(full, 550), false);
});

test('insertScore: sorted, capped at 10, persisted', () => {
  store.clear();
  let list = [];
  for (let i = 1; i <= 12; i++) {
    list = insertScore(list, { initials: 'AAA', score: i * 100, wave: i, date: i });
  }
  assert.equal(list.length, 10);
  assert.equal(list[0].score, 1200);
  assert.equal(list[9].score, 300);           // 100 and 200 fell off
  assert.deepEqual(JSON.parse(store.get('fw-launcher-scores')).length, 10);
  assert.equal(best(list), 1200);
});
