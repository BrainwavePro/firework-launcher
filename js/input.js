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

/**
 * Keyboard shortcuts: 1-7 select a firework, ←/Q and →/E cycle through
 * unlocked types, M cycles the music track.
 */
export function bindKeyboard({ selectIndex, cycle, cycleMusic }) {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // typing initials
    const k = e.key.toLowerCase();
    if (e.key >= '1' && e.key <= '9') selectIndex(Number(e.key) - 1);
    else if (e.key === 'ArrowLeft' || k === 'q') cycle(-1);
    else if (e.key === 'ArrowRight' || k === 'e') cycle(1);
    else if (k === 'm') cycleMusic();
    else return;
    e.preventDefault();
  });
}
