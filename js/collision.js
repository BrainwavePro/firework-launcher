// Blast-zone hit tests. All coordinates in CSS pixels.

export function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

export function inRing(px, py, cx, cy, r, halfWidth) {
  const d = Math.hypot(px - cx, py - cy);
  return Math.abs(d - r) <= halfWidth;
}
