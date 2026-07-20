# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-first Missile Command variant played with fireworks: plain HTML5 Canvas + vanilla JavaScript ES modules, **zero dependencies, zero build step** (deliberate — keep it that way). Installable as a PWA, deployed to GitHub Pages.

## Commands

```sh
python -m http.server 8000         # run locally, then open http://localhost:8000
node --test "tests/*.test.js"      # unit tests (pure-module geometry/score/wave math)
```

- Best tested in a mobile viewport. The service worker registers only on https, so local dev never caches — no cache-busting needed while developing.
- Deploy = merge to `main`; `.github/workflows/pages.yml` publishes the repo as-is to GitHub Pages (custom domain via `CNAME`).
- Debug hook: the console exposes `window.__fw = { game, types }`. Jump waves with `__fw.game.startWave(10)`, inspect state, force spawns — this is the main manual-testing lever.

## Architecture

`js/main.js` owns the `Game` class: the rAF loop, the state machine (`menu` / `playing` / `wavebreak` / `gameover`), scoring, wave flow, boss orchestration, and screen effects. Every other module is glued together here.

The core design idea: **gameplay hitboxes and visuals are decoupled.**

- `js/fireworks.js` is a data-driven catalogue (`FIREWORK_TYPES`). Each type declares `zones()` — timed blast hitboxes (circle / expanding `grow` / `ring`) — plus `onZone()` for the particle visuals when a zone activates, and an optional per-frame `tick()` (used for comet trails, Seeker homing, Diablo shock front). A `Burst` is the live set of zones; `Burst.hits()` / `hitsCircle()` are what actually kill things. Particles are never consulted for collisions.
- Adding a firework = new catalogue entry + `TYPE_ORDER` + README table row. `power` (default 1) is damage per burst against multi-hp targets; each burst damages a given target at most once (`hitBursts` sets).
- `js/world.js` — cities/batteries laid out by `GROUND_LAYOUT` screen-width fractions; `EnemyMissile` kinds (`normal`/`mirv`/`smart`/`armor`/`bomber` — `update()` returns `'split'`/`'drop'`/`null` action requests that `main.js` fulfills); the `Boss` (Mothership, every 5th wave); `waveConfig(n)` is the single source of difficulty scaling.
- `js/particles.js` — pooled additive-blend particle system (POOL_MAX 5000), visual-only.
- `js/audio.js` + `js/music.js` — 100% procedural Web Audio, no audio files anywhere. `MusicEngine` shares `AudioFX`'s context/noise buffer. `AudioFX.ensure()` must be called from a user gesture before anything plays.
- `js/ui.js` — everything DOM: HUD, selector bar, overlay screens (gameplay itself renders only to the canvas). `js/input.js` pointer + keyboard. `js/scores.js` localStorage top-10 leaderboard.

## Gotchas

- **Bump the `sw.js` cache name** (`fw-launcher-v5` → `v6`, …) in every shipped change, and add any new files to its `ASSETS` list — otherwise players keep running stale code offline-first.
- All game coordinates are **CSS pixels**; devicePixelRatio is handled once via `ctx.setTransform` in `Game.resize()`. Never multiply by dpr elsewhere.
- `groundY` is derived from the selector bar's rendered DOM height, so canvas layout depends on the DOM having settled.
- The README's firework table and code-layout block are kept in sync with the code by convention — update them when player-facing behavior changes.
- Wave-clear detection requires all shells, bursts, missiles, boss, and pending boss to be gone; a long-lived zone (Willow's 3s curtain) legitimately delays it.
- localStorage keys follow the `fw-launcher-*` prefix (`fw-launcher-scores`, `fw-launcher-music`).
