"""A transparent expected-points 4th-down model.

For every 4th down we compare the expected points (EP) of going for it,
kicking a field goal and punting, using curves fitted on 2018-2025 regular
season play-by-play:

* EP of a fresh 1st down at each yard line (from nflverse's own `ep`).
* Conversion rate by yards to go.
* Field-goal make rate by kick distance (logistic fit).
* Where the opponent starts after a punt from each yard line.

EP ignores the score and the clock, so we only grade situations where those
matter little: quarters 1-3, or the 4th quarter with more than five minutes
left and a one-to-two-score game. Late, close-game decisions need a
win-probability model and are left out rather than graded badly.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import polars as pl
from sklearn.linear_model import LogisticRegression

from . import fetch

REG = pl.col("season_type") == "REG"
MAX_FG = 63  # longest attempt we consider (yards)


def _smooth(x: np.ndarray, y: np.ndarray, grid: np.ndarray, w: np.ndarray | None = None, bw: float = 3.0) -> np.ndarray:
    """Gaussian-kernel smoother: a weighted local mean at each grid point."""
    w = np.ones_like(y, dtype=float) if w is None else w
    out = np.empty(len(grid))
    for i, g in enumerate(grid):
        k = np.exp(-0.5 * ((x - g) / bw) ** 2) * w
        out[i] = (k * y).sum() / k.sum()
    return out


@dataclass
class Model:
    ep1: np.ndarray  # EP of 1st down at yardline_100 = index (1..99)
    conv: np.ndarray  # P(convert) by ydstogo = index (1..20, 20 means 20+)
    gain_over: float  # average yards past the line to gain on a conversion
    fg: LogisticRegression
    punt_opp: np.ndarray  # opponent's yardline_100 after a punt from yardline_100 = index

    def ep_first(self, y: float) -> float:
        y = int(round(min(max(y, 1), 99)))
        return float(self.ep1[y])

    @property
    def ep_td(self) -> float:
        # 7 points (with the extra point) minus what the opponent gets from the kickoff.
        return 7.0 - self.ep_first(75)

    @property
    def ep_fg(self) -> float:
        return 3.0 - self.ep_first(75)

    def p_convert(self, togo: int) -> float:
        return float(self.conv[int(min(max(togo, 1), 20))])

    def p_fg(self, y: float) -> float:
        dist = y + 17
        if dist > MAX_FG:
            return 0.0
        return float(self.fg.predict_proba([[dist]])[0, 1])

    def values(self, y: float, togo: int) -> dict[str, float]:
        """EP of each option on 4th-and-`togo` at `y` yards from the opponent's end zone."""
        p = self.p_convert(togo)
        land = y - togo - self.gain_over
        ep_success = self.ep_td if land <= 0 else self.ep_first(land)
        ep_fail = -self.ep_first(100 - y)  # opponent takes over at the spot
        go = p * ep_success + (1 - p) * ep_fail

        q = self.p_fg(y)
        miss_spot = min(100 - (y + 7), 80)  # opponent gets the ball at the kick spot, or their 20
        fg = q * self.ep_fg + (1 - q) * -self.ep_first(miss_spot) if q > 0 else float("nan")

        # The opponent's starting position after a punt from here. Their EP counts against us.
        opp = float(self.punt_opp[int(min(max(round(y), 1), 99))])
        punt = -self.ep_first(opp) if y >= 35 else float("nan")  # nobody punts from inside the opponent's 35
        return {"go": go, "fg": fg, "punt": punt}

    def best(self, y: float, togo: int) -> tuple[str, dict[str, float]]:
        v = self.values(y, togo)
        options = {k: x for k, x in v.items() if not np.isnan(x)}
        return max(options, key=options.get), v


def fit(seasons: list[int] | None = None) -> Model:
    seasons = seasons or fetch.MODEL_SEASONS
    p = pl.concat([fetch.pbp(s).select(_COLS) for s in seasons], how="vertical_relaxed").filter(REG)

    # EP of 1st-and-10 (or 1st-and-goal) by yard line.
    first = p.filter((pl.col("down") == 1) & pl.col("ep").is_not_null() & (pl.col("ydstogo") == pl.min_horizontal(pl.lit(10), pl.col("yardline_100"))))
    grid = np.arange(0, 101)
    ep1 = _smooth(first["yardline_100"].to_numpy().astype(float), first["ep"].to_numpy(), grid, bw=2.5)

    # Conversion rate on real 4th-down attempts (3rd downs add sample at short yardage).
    tries = p.filter(pl.col("down").cast(pl.Int32).is_in([3, 4]) & pl.col("play_type").is_in(["pass", "run"]) & pl.col("ydstogo").is_not_null())
    tries = tries.with_columns(made=(pl.col("yards_gained") >= pl.col("ydstogo")).cast(pl.Float64), togo=pl.col("ydstogo").clip(1, 20).cast(pl.Int64))
    conv_df = tries.group_by("togo").agg(rate=pl.col("made").mean(), n=pl.len()).sort("togo")
    conv = np.zeros(21)
    conv[conv_df["togo"].to_numpy()] = _smooth(conv_df["togo"].to_numpy().astype(float), conv_df["rate"].to_numpy(), conv_df["togo"].to_numpy().astype(float), conv_df["n"].to_numpy().astype(float), bw=1.0)
    made = tries.filter(pl.col("made") == 1)
    gain_over = float((made["yards_gained"] - made["ydstogo"]).clip(0, 15).mean())

    fga = p.filter((pl.col("play_type") == "field_goal") & pl.col("kick_distance").is_not_null())
    fg = LogisticRegression().fit(fga["kick_distance"].to_numpy().reshape(-1, 1), (fga["field_goal_result"] == "made").to_numpy())

    # Punts: opponent's start = 100 - (where the ball ends up from the kicking team's view).
    pu = p.filter((pl.col("play_type") == "punt") & pl.col("kick_distance").is_not_null() & (pl.col("punt_blocked") == 0))
    pu = pu.with_columns(
        opp_y=pl.when(pl.col("touchback") == 1)
        .then(pl.lit(80.0))
        .otherwise(100 - (pl.col("yardline_100") - pl.col("kick_distance") + pl.col("return_yards").fill_null(0)))
        .clip(1, 99)
    )
    punt_opp = _smooth(pu["yardline_100"].to_numpy().astype(float), pu["opp_y"].to_numpy(), grid, bw=3.0)
    return Model(ep1=ep1, conv=conv, gain_over=gain_over, fg=fg, punt_opp=punt_opp)


_COLS = [
    "season_type", "down", "ydstogo", "yardline_100", "ep", "play_type", "yards_gained",
    "kick_distance", "field_goal_result", "touchback", "return_yards", "punt_blocked",
]

GRADED = (
    REG
    & (pl.col("down") == 4)
    & pl.col("play_type").is_in(["pass", "run", "field_goal", "punt"])
    & (pl.col("qb_kneel") == 0)
    & ((pl.col("qtr") <= 3) | ((pl.col("qtr") == 4) & (pl.col("game_seconds_remaining") > 300)))
    & (pl.col("score_differential").abs() <= 16)
)

ACTUAL = {"pass": "go", "run": "go", "field_goal": "fg", "punt": "punt"}
CLEAR = 0.5  # EP margin for a call to count as "clear"


def grade(model: Model, season: int) -> tuple[pl.DataFrame, pl.DataFrame]:
    p = fetch.pbp(season).filter(GRADED).select(["game_id", "week", "posteam", "defteam", "qtr", "time", "yardline_100", "ydstogo", "score_differential", "play_type", "desc"])
    rows = []
    for r in p.iter_rows(named=True):
        rec, v = model.best(r["yardline_100"], r["ydstogo"])
        did = ACTUAL[r["play_type"]]
        options = sorted((x for x in v.values() if not np.isnan(x)), reverse=True)
        margin = options[0] - options[1] if len(options) > 1 else 0.0
        lost = v[rec] - v[did] if not np.isnan(v[did]) else v[rec] - min(options)
        rows.append({**r, "did": did, "rec": rec, "margin": margin, "ep_lost": max(lost, 0.0), **{f"ep_{k}": v[k] for k in v}})
    d = pl.DataFrame(rows)
    clear = d.filter(pl.col("margin") >= CLEAR)
    team = (
        d.group_by("posteam")
        .agg(decisions=pl.len(), go=(pl.col("did") == "go").sum(), ep_lost=pl.col("ep_lost").sum())
        .join(
            clear.group_by("posteam").agg(
                clear_calls=pl.len(),
                agreed=(pl.col("did") == pl.col("rec")).sum(),
                should_go=((pl.col("rec") == "go") & (pl.col("did") != "go")).sum(),
                went_should_kick=((pl.col("rec") != "go") & (pl.col("did") == "go")).sum(),
            ),
            on="posteam",
            how="left",
        )
        .with_columns(agree_rate=pl.col("agreed") / pl.col("clear_calls"))
        .rename({"posteam": "team"})
        .with_columns(pl.col("ep_lost").rank("ordinal").cast(pl.Int32).alias("ep_lost_rank"))
        .sort("ep_lost")
    )
    return d, team
