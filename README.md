# Football

**Live site:** https://football.satwikmedipalli.dev

Two questions, answered with public nflverse data:

1. **How good is each team, really?** Offense and defense by expected points added (EPA)
   per play, success rate, play-calling tendency, and a transparent 4th-down model.
2. **Does the NFL combine tell you anything the draft slot doesn't?**

## Findings

- **The combine adds nothing beyond draft slot.** Predicting which drafted players become
  multi-year starters (3+ seasons as a primary starter), a model using only draft pick and
  position scores a held-out AUC of 0.794 on the 2013–2020 classes. Adding
  position-standardised height, weight and all six drills scores 0.791
  (change −0.003, 95% interval −0.007 to +0.001). Teams already price the combine into the pick.
- **Draft slot itself is a strong signal.** 74% of first-round picks in the held-out classes
  became multi-year starters; 7% of seventh-rounders did.

Numbers on the site are regenerated from the pipeline; nothing is typed in by hand.

## How it works

**Teams.** Regular-season passes and runs from nflverse play-by-play. EPA, success and
win probability are nflverse's own models. Pass rate over expected uses nflverse's
`pass_oe` on early downs with win probability between 20% and 80% outside the last two
minutes of a half. Ranks are positions on each measure; there are no letter grades.

**4th downs.** For each 4th down the model compares the expected points of going for it,
kicking and punting, using curves fitted on 2018–2025: EP of a first down by yard line,
conversion rate by distance, field-goal make rate by kick distance, and where the
opponent starts after a punt. Expected points ignore the score and clock, so only
quarters 1–3 and the 4th quarter with more than five minutes left in a game within 16
points are graded. A call counts as "clear" when the best option beats the next by 0.5 EP
or more. Unit tests check the obvious cases (punt on 4th and 10 from your own 20, go on
4th and 1 near midfield, and so on).

**Draft.** Drafted players 2000–2020 joined to their combine results. Models are fitted
on the 2000–2012 classes and scored on 2013–2020 (every held-out player has had 6+
seasons). Regularisation is chosen on a time split inside the training classes.
"Athletic comps" for the newest class are the closest combine profiles among drafted
players from finished classes, measured in standard deviations on the tests both took.

## What this can't tell you

- EPA per play doesn't adjust for opponents, and partial seasons are noisy.
- The 4th-down model is expected-points only; it ignores the score, clock and team
  strength, and doesn't grade late close-game decisions at all.
- "Seasons started" is a coarse outcome and depends on the team that drafted the player.
- Skipping combine drills became far more common after 2015, so "skipped a test" flags
  learned on older classes don't transfer; they're left out of the main model.

## Reproduce it

Requires [uv](https://docs.astral.sh/uv/). Downloads about 120 MB from nflverse.

```bash
uv sync
uv run python -m gridiron build   # fetch data, run everything, write web/public/data/
uv run pytest
```

Data from [nflverse](https://github.com/nflverse) via `nflreadpy`. Delete `data/raw/` to
refresh an in-progress season.
