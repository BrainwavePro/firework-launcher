// Blast-zone hit tests. All coordinates in CSS pixels.
//
// Swept variants treat the target's frame movement (x1,y1)→(x2,y2) as a
// segment so fast missiles can't tunnel through a thin zone between frames.

export function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

export function inRing(px, py, cx, cy, r, halfWidth) {
  const d = Math.hypot(px - cx, py - cy);
  return Math.abs(d - r) <= halfWidth;
}

/** True if the segment (x1,y1)→(x2,y2) passes within r of (cx,cy). */
export function segCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const px = x1 + dx * t - cx;
  const py = y1 + dy * t - cy;
  return px * px + py * py <= r * r;
}

/**
 * True if the segment (x1,y1)→(x2,y2) crosses an expanding ring centered on
 * (cx,cy) whose radius grows ra→rb over the same frame. Sampled: exact enough
 * for game-sized steps, and robust where a closed form would be fussy.
 */
export function segRing(x1, y1, x2, y2, cx, cy, ra, rb, halfWidth) {
  const steps = Math.max(2, Math.min(8, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6) + 1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const d = Math.hypot(x1 + (x2 - x1) * t - cx, y1 + (y2 - y1) * t - cy);
    if (Math.abs(d - (ra + (rb - ra) * t)) <= halfWidth) return true;
  }
  return false;
}
