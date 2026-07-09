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
  | 🌿 **Willow** | Big golden bloom whose drooping trails form a lingering *curtain* below — guards a column of sky for 3 seconds | Wave 1 |
  | 💠 **Ring** | Expanding shockwave — huge reach, but only kills along the edge | Wave 2 |
  | 🌴 **Palm** | Comet that splits into five far-reaching secondary bursts | Wave 3 |
  | ✨ **Crackle** | Strobing micro-bursts scattered across a Ring-sized footprint | Wave 4 |
  | 🌌 **Chrysanthemum** | Giant layered bloom — violet-to-magenta shell, gold pistil, lingering sparkles | Wave 5 |
  | 😈 **El Diablo** | A tiny loud boom… then a nuclear blast that wipes the whole screen. One per wave | Wave 10 |

- Destroyed missiles pop with a small **sympathetic burst** — chain them!
- Combo kills from a single burst score bonus points; surviving cities pay a
  bonus every wave.
- Watch out for **MIRVs** that split mid-air (wave 3+) and weaving **smart
  missiles** (wave 5+). Batteries are rebuilt between waves; cities are not.
- Game over when every city has fallen. Make the **top-10 leaderboard** and
  enter your initials, arcade style — scores persist on your device.
- **Keyboard shortcuts** (desktop): **1–7** select a firework, **←/→** (or
  **Q/E**) cycle through unlocked types, **M** cycles the music.
- **Retro music**: three procedurally generated chiptune tracks — *Neon
  Siege*, *Quarter Muncher*, *Starlight Vigil* — pick one (or silence) from
  the menu. Synthesized live with Web Audio; no audio files.

## Run it

Any static file server works:

```sh
python -m http.server 8000
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
js/music.js         procedural chiptune engine + track data
js/scores.js        persistent top-10 leaderboard (localStorage)
js/ui.js            HUD, selector, menus, leaderboard, music picker
js/input.js         pointer/touch + keyboard shortcuts
sw.js               offline cache (PWA)
```
