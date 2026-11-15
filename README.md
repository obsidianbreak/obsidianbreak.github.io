# Obsidian Break: Latte vs Roast

Play it at **https://obsidianbreak.github.io/**. Source: https://github.com/obsidianbreak/obsidianbreak.github.io

A mobile first territory duel. You play **Latte** (cream tiles, dark balls). An adaptive AI plays **Roast** (brown tiles, gold balls). Balls bounce around your own land and flip every enemy tile they touch. Drag to pull your balls toward the front line, grab gift tiles, spend energy on cards, and own more of the board when time runs out.

The visual layer is a small TouchDesigner style operator network (Voronoi, Feedback, Level) running in WebGL2. The difficulty layer is a director made of a PID flow controller, a JSON rules engine, a contextual bandit and a simulation based level generator.

## Play and control

| Action | Touch | Mouse |
| --- | --- | --- |
| Steer your balls | Drag anywhere on the board | Hover or drag |
| Cast a card | Tap a lit card under the bars | Click |
| Pause | Top right of the board | Same button |

## What is in the box

* **Dynamic duels, no fixed level list.** Every match is generated: board size, mirror symmetric layout, mutators, opponent persona and opponent skill. See `docs/ARCHITECTURE.md`.
* **Adaptive difficulty you can see.** The hub shows the predicted win chance for the next duel, produced by simulating it first. Adaptive difficulty can be switched off in settings.
* **Rules engine and experiments.** `public/rules/rules.json` changes game rules and experiments without a code change.
* **Near miss done honestly.** Photo finish slow motion and exact "tiles short" feedback, based on the real result.
* **Daily Roast.** One seeded board for everyone, with a Wordle style emoji share.
* **Generative audio.** Every flipped tile is a pentatonic note, pitched by where it happened.

## Install on iPhone

Open the site in Safari, tap Share, then **Add to Home Screen**. It launches full screen with the game icon, no browser bars. On Android, Chrome offers Install, and the game also asks for full screen when a duel starts.

Zoom, text selection, long press menus and pull to refresh are disabled so nothing interrupts play. Steering uses the first finger only, and the guide sits above your fingertip so your hand never hides it.

## Run it

```bash
npm ci
npm run dev        # local
npm run typecheck
npm run build      # outputs dist/ for GitHub Pages
```

Deployment: `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. In the repo go to Settings, Pages, and set Source to **GitHub Actions**. This is a user site, so it is served from the domain root and the Vite base path is `/`. Override it with `VITE_BASE_PATH` only if you move the game to a subpath.

## Optional: anonymous experiment telemetry

Set `VITE_TELEMETRY_URL` at build time to a collector endpoint. Events are only sent when a player opts in under Settings. See `docs/ARCHITECTURE.md` for a collector sketch that turns many players into one large experiment.

## Developer tools

`tools/simtest.ts` runs headless balance checks of the simulation and the opponent calibrator:

```bash
npx tsx tools/simtest.ts
```

## Docs

* `docs/ARCHITECTURE.md` how the engine, director and visuals fit together
* `docs/ALGORITHMS.md` every technique, where it lives, and what was deliberately left out
* `docs/ART_DIRECTION.md` the Day and Night palettes and their contrast ratios
* `docs/TOUCHDESIGNER.md` how the TouchDesigner approach maps to the web build
