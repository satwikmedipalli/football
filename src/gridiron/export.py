"""Run every analysis and write the JSON the website reads (web/public/data/)."""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

import numpy as np
import polars as pl

from . import draft, fetch, fourth, teams

OUT = Path(__file__).resolve().parents[2] / "web" / "public" / "data"


def _clean(o):
    if isinstance(o, float):
        return None if math.isnan(o) or math.isinf(o) else round(o, 4)
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items() if not k.startswith("_")}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, np.generic):
        return _clean(o.item())
    return o


def _write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(_clean(obj), separators=(",", ":")))


def _through_week(season: int) -> int:
    p = fetch.pbp(season).filter(pl.col("season_type") == "REG")
    return int(p["week"].max())


def run() -> None:
    meta_teams = fetch.teams().select("team_abbr", "team_name", "team_nick", "team_conf", "team_division", "team_color", "team_color2").to_dicts()
    model = fourth.fit()

    seasons = []
    for s in fetch.TEAM_SEASONS:
        prof = teams.profiles(s)
        decisions, fd = fourth.grade(model, s)
        swings = teams.swing_plays(s)
        worst = (
            decisions.filter(pl.col("margin") >= fourth.CLEAR)
            .filter(pl.col("did") != pl.col("rec"))
            .sort("ep_lost", descending=True)
        )
        examples = {t: worst.filter(pl.col("posteam") == t).head(4).to_dicts() for t in prof["team"].to_list()}
        week = _through_week(s)
        seasons.append({"season": s, "through_week": week})
        _write(
            f"teams_{s}.json",
            {
                "season": s,
                "through_week": week,
                "teams": prof.to_dicts(),
                "fourth": fd.to_dicts(),
                "fourth_examples": examples,
                "swings": swings,
            },
        )

    # A small table of the model's recommendations, for the explainer chart.
    grid = []
    for y in range(5, 96, 5):
        for togo in (1, 2, 3, 4, 5, 7, 10):
            rec, v = model.best(y, togo)
            grid.append({"y": y, "togo": togo, "rec": rec, **v})
    _write(
        "fourth_model.json",
        {
            "fit_seasons": fourth.fetch.MODEL_SEASONS,
            "conversion": [{"togo": t, "p": float(model.conv[t])} for t in range(1, 21)],
            "fg": [{"distance": d, "p": float(model.fg.predict_proba([[d]])[0, 1])} for d in range(18, 64)],
            "grid": grid,
            "clear_margin": fourth.CLEAR,
        },
    )

    # Draft study + the 2026 class.
    st = draft.study()
    _write("draft_study.json", st)
    m_slot, _ = st["_models"]
    df = draft.dataset()
    train = df.filter(pl.col("season").is_between(*draft.TRAIN))
    pool = draft._standardise(df.filter(pl.col("season").is_between(2000, 2020)), train)
    latest = int(df["season"].max())
    cls = draft._standardise(df.filter(pl.col("season") == latest), train)
    cls = cls.with_columns(slot_p=pl.Series(m_slot.predict_proba(draft._design(cls, False))[:, 1]))
    comps = draft.comps(cls, pool)
    keep = ["pick", "round", "team", "pfr_player_id", "pfr_player_name", "position", "group", "college", "slot_p", *[f"z_{k}" for k in draft.DRILLS], *draft.DRILLS]
    rows = []
    for r in cls.select(keep).iter_rows(named=True):
        r["comps"] = comps.get(r["pfr_player_id"] or r["pfr_player_name"], [])
        rows.append(r)
    _write("draft_class.json", {"season": latest, "players": rows})

    # Historical board: every drafted player 2000-2020 with outcome, for search.
    hist = df.filter(pl.col("season").is_between(2000, 2020)).select("season", "pick", "round", "team", "pfr_player_name", "position", "group", "seasons_started", "w_av", "probowls", "starter")
    _write("draft_history.json", hist.to_dicts())

    _write("meta.json", {"built": date.today().isoformat(), "seasons": seasons, "teams": meta_teams, "draft_class": latest})
