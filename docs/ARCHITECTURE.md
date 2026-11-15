# Architecture

```
src/
  duel/        pure game logic with no DOM, also runs headless
    Sim.ts          cells, balls, gifts, black holes, colonies, cards, win rules
    Brain.ts        AI opponent and six personas
    Generator.ts    dynamic boards, mutators, match planning
    Calibrator.ts   automated playtests and opponent tuning
    Rating.ts       Elo style skill and tiers
  director/    the "game director"
    Flow.ts         PID flow controller
    RulesEngine.ts  JSON rules and experiment definitions
    Bandit.ts       Thompson sampling contextual bandit
    Director.ts     plans each match from facts, rules, arms and simulation
    Progress.ts     applies results to skill, streaks, shield, goals, daily
    Goals.ts, Context.ts, Telemetry.ts
  game/DuelEngine.ts   fixed timestep loop, input, audio, haptics, live rules
  render/BoardRenderer.ts   flat tile renderer on Canvas 2D
  td/          TouchDesigner style WebGL2 network (Voronoi, Feedback, Level) and signals
  screens/, components/, hooks/   React UI
```

## Dynamic levels instead of a level list

Each match is a `MatchSpec` produced on demand:

1. **Facts** about you (rating, streaks, device, session length) go into the rules engine.
2. The **flow controller** sets a target win probability.
3. The **bandit** picks experiment arms (win threshold, gift cadence, card cost).
4. The **generator** builds a mirror symmetric board with 0 to 2 mutators and picks a persona. Mirror symmetry makes both sides identical in tile counts, so the board itself never favors anyone.
5. The **calibrator** simulates the duel dozens of times with a stand in for you and tunes the opponent to the target.
6. The hub shows the board name, persona, mutators and predicted win chance.

Boards are seeded, so a rematch replays the same board and the Daily Roast is identical for everyone.

## The simulation

Cells are `0` latte, `1` roast, `2` wall. Each ball lives in its own land and flips any enemy tile it touches, bouncing off it. Steering rotates a ball's heading toward the finger (or the AI's target) at a limited turn rate. The player never changes ball speed, only direction. Everything advances with a fixed 60 Hz step, and the headless calibrator uses 30 Hz.

## Experiments at scale

On one device the bandit already adapts to one player. To make it a real large scale system:

1. Set `VITE_TELEMETRY_URL` to a tiny collector, for example a Cloudflare Worker.
2. The collector stores `match_start` and `match_end` counts per `(experiment, segment, arm)` and serves a JSON of aggregated Beta parameters.
3. Fetch that JSON on start and add it to the local priors in `Bandit.ts`.

Players must opt in, and events carry no personal data.

## Rules file

`public/rules/rules.json` is fetched on start (cache busted) with an embedded fallback in `RulesEngine.ts`. Changing it needs a re deploy but no code change. A rule looks like:

```json
{ "id": "catch-up", "phase": "live",
  "when": { "all": [ { "fact": "deficit", "op": ">", "value": 0.08 }, { "fact": "timeFrac", "op": ">", "value": 0.35 } ] },
  "then": [ { "mul": "playerTurnMul", "value": 1.15 } ] }
```
