// Pointer input: a tap on the canvas fires the currently selected firework.

export function bindInput(canvas, onTap) {
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      onTap(e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false }
  );
  // Kill any residual scroll/zoom gestures on the page.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
