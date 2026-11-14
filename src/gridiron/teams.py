"""Team profiles for one season, straight from nflverse play-by-play.

Everything here is a plain average over real plays. There are no letter
grades and no curves: a team's rank is its position on the measure.
"""

from __future__ import annotations

import polars as pl

from . import fetch

# Real offensive snaps: passes (incl. sacks and scrambles) and runs, regular season.
SCRIMMAGE = (pl.col("season_type") == "REG") & pl.col("play_type").is_in(["pass", "run"]) & pl.col("epa").is_not_null()

# "Neutral" situations for play-calling tendencies: early downs, game still in
# doubt, not the end of a half. This is the standard way to read pass-rate
# tendency without garbage time or two-minute drills.
NEUTRAL = (
    pl.col("down").cast(pl.Int32).is_in([1, 2])
    & pl.col("wp").is_between(0.2, 0.8)
    & (pl.col("half_seconds_remaining") > 120)
)


def _record(season: int) -> pl.DataFrame:
    s = fetch.schedules().filter((pl.col("season") == season) & (pl.col("game_type") == "REG") & pl.col("result").is_not_null())
    home = s.select(team="home_team", pf="home_score", pa="away_score")
    away = s.select(team="away_team", pf="away_score", pa="home_score")
    g = pl.concat([home, away])
    return g.group_by("team").agg(
        games=pl.len(),
        wins=(pl.col("pf") > pl.col("pa")).sum(),
        losses=(pl.col("pf") < pl.col("pa")).sum(),
        ties=(pl.col("pf") == pl.col("pa")).sum(),
        points_for=pl.col("pf").sum(),
        points_against=pl.col("pa").sum(),
    )


def profiles(season: int) -> pl.DataFrame:
    p = fetch.pbp(season).filter(SCRIMMAGE)

    off = p.group_by("posteam").agg(
        plays=pl.len(),
        off_epa=pl.col("epa").mean(),
        off_success=pl.col("success").mean(),
        pass_epa=pl.col("epa").filter(pl.col("pass") == 1).mean(),
        rush_epa=pl.col("epa").filter(pl.col("rush") == 1).mean(),
        explosive=((pl.col("pass") == 1) & (pl.col("yards_gained") >= 20) | (pl.col("rush") == 1) & (pl.col("yards_gained") >= 10)).mean(),
        sacks_taken=pl.col("sack").sum(),
        neutral_pass_rate=pl.col("pass").filter(NEUTRAL).mean(),
        proe=pl.col("pass_oe").filter(NEUTRAL).mean(),
    ).rename({"posteam": "team"})

    de = p.group_by("defteam").agg(
        def_epa=pl.col("epa").mean(),
        def_success=pl.col("success").mean(),
        def_pass_epa=pl.col("epa").filter(pl.col("pass") == 1).mean(),
        def_rush_epa=pl.col("epa").filter(pl.col("rush") == 1).mean(),
        sacks=pl.col("sack").sum(),
        takeaways=(pl.col("interception") + pl.col("fumble_lost")).sum(),
    ).rename({"defteam": "team"})

    df = off.join(de, on="team").join(_record(season), on="team", how="left")
    df = df.with_columns(net_epa=pl.col("off_epa") - pl.col("def_epa"))
    # Ranks: 1 = best. For defense, lower EPA allowed is better.
    for col, desc in [("net_epa", True), ("off_epa", True), ("def_epa", False), ("off_success", True), ("def_success", False)]:
        df = df.with_columns(pl.col(col).rank("ordinal", descending=desc).cast(pl.Int32).alias(f"{col}_rank"))
    return df.sort("net_epa_rank")


def swing_plays(season: int, n: int = 5) -> dict[str, list[dict]]:
    """The plays that moved each team's win probability the most, for and against."""
    p = fetch.pbp(season).filter((pl.col("season_type") == "REG") & pl.col("wpa").is_not_null() & pl.col("desc").is_not_null() & (pl.col("play_type") != "no_play"))
    cols = ["game_id", "week", "posteam", "defteam", "qtr", "time", "desc", "wpa"]
    out: dict[str, list[dict]] = {}
    for team in sorted(set(p["posteam"].drop_nulls().to_list())):
        for_ = p.filter(pl.col("posteam") == team).with_columns(gain=pl.col("wpa"))
        against = p.filter(pl.col("defteam") == team).with_columns(gain=-pl.col("wpa"))
        both = pl.concat([for_.select(cols + ["gain"]), against.select(cols + ["gain"])])
        top = both.sort(pl.col("gain").abs(), descending=True).head(n)
        out[team] = top.to_dicts()
    return out
