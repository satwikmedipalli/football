"""Download nflverse data once and cache it as parquet under data/raw/."""

from __future__ import annotations

from pathlib import Path

import nflreadpy as nfl
import polars as pl

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"

# Seasons used to fit the 4th-down model's building blocks (EP curve,
# conversion rates, field-goal and punt curves). Team pages cover the
# seasons in TEAM_SEASONS.
MODEL_SEASONS = list(range(2018, 2026))
TEAM_SEASONS = [2025, 2026]


def _cached(name: str, load) -> pl.DataFrame:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / f"{name}.parquet"
    if path.exists():
        return pl.read_parquet(path)
    df = load()
    df.write_parquet(path)
    return df


def pbp(season: int) -> pl.DataFrame:
    return _cached(f"pbp_{season}", lambda: nfl.load_pbp([season]))


def schedules() -> pl.DataFrame:
    return _cached("schedules", lambda: nfl.load_schedules())


def draft_picks() -> pl.DataFrame:
    return _cached("draft_picks", lambda: nfl.load_draft_picks())


def combine() -> pl.DataFrame:
    return _cached("combine", lambda: nfl.load_combine())


def teams() -> pl.DataFrame:
    return _cached("teams", lambda: nfl.load_teams())


def fetch_all() -> None:
    for s in sorted(set(MODEL_SEASONS + TEAM_SEASONS)):
        pbp(s)
    schedules()
    draft_picks()
    combine()
    teams()
