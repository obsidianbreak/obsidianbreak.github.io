# Algorithms and design theory

This maps the techniques in `Game_Theories_Algorithms_Analysis.txt` and some extra research to the code. A few techniques in that file work by exploiting players, and those were left out on purpose. The reasons are listed at the end.

## Implemented

| Technique | What it does here | Where |
| --- | --- | --- |
| **Dynamic Difficulty Adjustment** (flow channel) | A PID controller turns recent results into a target win probability for the next duel. The opponent is then built to hit that target. Small in match help appears only when you are clearly behind late in the match. All of it can be disabled. | `director/Flow.ts`, `director/Director.ts`, `director/RulesEngine.ts` |
| **Simulation based difficulty tuning** | The same headless simulation that runs the game plays about 40 automated duels per opponent, and a bisection search picks the opponent skill that gives the target win rate. This is automated playtesting inside procedural content generation. | `duel/Calibrator.ts` |
| **Player skill model (Elo style)** | A hidden skill from 0 to 1 moves after every match, using the expected result and the margin. The visible rating is derived from it. | `duel/Rating.ts` |
| **Near miss effect, honest version** | When the margin is under 3 percent late in the match the game enters a photo finish with slow motion. The result shows the exact number of tiles that would have flipped it. Nothing is rigged. | `game/DuelEngine.ts`, `screens/Match.tsx` |
| **Loss aversion, kind version** | Win streaks earn a **shield** at five wins that absorbs one loss. It rewards you, it never threatens you. | `director/Progress.ts` |
| **Rules engine** | JSON rules with `all`, `any`, `not`, comparisons and actions `set`, `add`, `mul`, `tag`. Pre match rules and live rules. Editable in `public/rules/rules.json`. | `director/RulesEngine.ts` |
| **Large scale experiments** | A contextual bandit using Thompson sampling chooses experiment arms per segment (tier and input type). Reward is whether the player starts another match within two minutes. | `director/Bandit.ts` |
| **Opt in telemetry** | Anonymous event queue and beacon uploader. A collector can pool bandit statistics across players. | `director/Telemetry.ts` |
| **On device context awareness** | Reads battery, data saver, reduced motion and pointer type locally. Measures frame time and lowers visual quality with hysteresis. After 45 minutes it shows a gentle break note. | `director/Context.ts` |
| **Procedural level generation** | Mirror symmetric boards so both sides are always fair, plus seven mutators. Mutators unlock progressively so new players start simple. | `duel/Generator.ts` |
| **Variable rewards** | Gift tiles appear at jittered times with weighted random kinds. Nine gifts with distinct effects. | `duel/Sim.ts`, `duel/gifts.ts` |
| **Goal gradient and daily goals** | Three seeded daily goals and the percent of the board you took are always visible. | `director/Goals.ts`, `screens/Hub.tsx` |
| **Boss cadence** | Every fifth duel is a boss with the strongest persona and a lower target win rate. | `director/Director.ts` |
| **Shareable daily seed** | Everyone gets the same Daily Roast, and the result shares as an emoji grid. | `director/Progress.ts` |
| **Generative audio feedback** | Flips play pentatonic notes pitched by board position, so progress is audible. | `engine/AudioEngine.ts` |

## Not implemented on purpose

| Technique | Why it was left out |
| --- | --- |
| **Engineered frustration and rigged near misses** (Candy Crush style "Past Proximity" boosts, "Boost then Kill", death algorithms) | These secretly change outcomes to keep people playing. That is deception, and it is close to slot machine design. The honest near miss above gives the same emotional lift without lying. |
| **Personalized dynamic pricing and price discrimination** | There is no store here, and charging people more because they have paid before is exploitative. |
| **LTV prediction that tunes difficulty or loss timing for revenue** | Difficulty here is tuned for fairness and enjoyment, not for extracting spend or ad views. |
| **Streak loss threats before exit** | Replaced by the streak shield. |
| **Desirability scoring and paywall triggers** | Not relevant to this game. |

If you later add monetization, a fair starting point is fixed, visible prices and cosmetics only.

## Research notes for tuning

* Flow theory suggests a target win rate between 50 and 65 percent for casual players. The default target is 58 percent, the first three matches use 78 percent, and bosses use 42 percent.
* The PID gains in `Flow.ts` are conservative. Raise `kp` only if you see slow adaptation in the experiment data.
* Calibration uses 8 runs and 5 bisection steps. That is about 100 ms on a desktop. Raise `runs` for steadier targets and lower it for slower phones.
