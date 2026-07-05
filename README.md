# 🎆 Firework Launcher

**Missile Command, reimagined with fireworks.** Enemy missiles rain down on
your neon cities — fight back by tapping the sky to intercept them with
spectacular, hand-picked fireworks.

A mobile-first web game: plain HTML5 Canvas + vanilla JavaScript, zero
dependencies, zero build step. Installable to your home screen as a PWA.

## How to play

- **Tap the sky** — a shell launches from the nearest battery and bursts at
  your fingertip as the selected firework.
- **Pick your firework** from the bar at the bottom. Each bursts differently:

  | Firework | Behavior | Unlocks |
  |---|---|---|
  | 🌸 **Peony** | Classic sphere burst, unlimited ammo | Wave 1 |
  | 🌿 **Willow** | Golden drooping trails that *linger* — catches missiles flying through | Wave 1 |
  | 💠 **Ring** | Expanding shockwave — huge reach, but only kills along the edge | Wave 2 |
  | 🌴 **Palm** | Comet that splits into five secondary bursts | Wave 3 |
  | ✨ **Crackle** | Strobing cluster of random micro-bursts | Wave 4 |
  | 🌌 **Chrysanthemum** | Giant slow bloom — the biggest radius, scarce ammo | Wave 5 |

- Destroyed missiles pop with a small **sympathetic burst** — chain them!
- Combo kills from a single burst score bonus points; surviving cities pay a
  bonus every wave.
- Watch out for **MIRVs** that split mid-air (wave 3+) and weaving **smart
  missiles** (wave 5+). Batteries are rebuilt between waves; cities are not.
- Game over when every city has fallen. Best score is saved on your device.

## Run it

Any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000 (best on a phone / mobile viewport)
```

Or host the repo on GitHub Pages — it's fully static and works offline once
loaded (service worker).

## Code layout

```
index.html          shell + HUD DOM
css/style.css       layout, selector bar, overlays
js/main.js          game loop, state machine, scoring, waves
js/fireworks.js     the six firework types, shells, blast-zone bursts
js/world.js         cities, batteries, enemy missiles, wave difficulty
js/particles.js     pooled additive-blend particle system
js/collision.js     circle / ring hit tests
js/audio.js         procedural Web Audio SFX (no assets)
js/ui.js            HUD, selector, menu/game-over screens
js/input.js         pointer/touch handling
sw.js               offline cache (PWA)
```
