import test from 'node:test';
import assert from 'node:assert/strict';
import { inCircle, inRing, segCircle, segRing } from '../js/collision.js';

test('inCircle: inside, edge, outside', () => {
  assert.equal(inCircle(0, 0, 0, 0, 1), true);
  assert.equal(inCircle(3, 4, 0, 0, 5), true);      // exactly on the edge
  assert.equal(inCircle(3.01, 4, 0, 0, 5), false);
});

test('inRing: only the band hits', () => {
  assert.equal(inRing(100, 0, 0, 0, 100, 5), true);  // on the ring
  assert.equal(inRing(94, 0, 0, 0, 100, 5), false);  // inside the band
  assert.equal(inRing(96, 0, 0, 0, 100, 5), true);   // band inner edge
  assert.equal(inRing(105, 0, 0, 0, 100, 5), true);  // band outer edge
  assert.equal(inRing(106, 0, 0, 0, 100, 5), false);
});

test('segCircle: stationary point degenerates to inCircle', () => {
  assert.equal(segCircle(3, 4, 3, 4, 0, 0, 5), true);
  assert.equal(segCircle(6, 0, 6, 0, 0, 0, 5), false);
});

test('segCircle: segment passing through the circle hits', () => {
  // Both endpoints outside, path crosses the middle.
  assert.equal(inCircle(-10, 0, 0, 0, 5), false);
  assert.equal(inCircle(10, 0, 0, 0, 5), false);
  assert.equal(segCircle(-10, 0, 10, 0, 0, 0, 5), true);
});

test('segCircle: closest approach beyond radius misses', () => {
  assert.equal(segCircle(-10, 6, 10, 6, 0, 0, 5), false);
});

test('segRing: fast target leaping the whole band is still caught', () => {
  // Ring of radius 93±24 around (0,0); target jumps from d=150 to d=50 in
  // one frame. Neither endpoint is in the band — the old point test missed.
  assert.equal(inRing(150, 0, 0, 0, 93, 24), false);
  assert.equal(inRing(50, 0, 0, 0, 93, 24), false);
  assert.equal(segRing(150, 0, 50, 0, 0, 0, 93, 93, 24), true);
});

test('segRing: expanding radius is interpolated along the step', () => {
  // Target sits still at d=100 while the ring sweeps 60→140 across it.
  assert.equal(segRing(100, 0, 100, 0, 0, 0, 60, 140, 10), true);
  // Ring stays far away the whole frame.
  assert.equal(segRing(100, 0, 100, 0, 0, 0, 10, 30, 10), false);
});
