"""Does the combine tell you anything the draft slot doesn't?

Outcome: a drafted player becomes a multi-year starter (3+ seasons as a
primary starter, per Pro Football Reference's `seasons_started`). That
counts linemen the same as skill players and doesn't depend on box-score
stats.

Two models, both fitted on the 2000-2012 classes and scored on the
held-out 2013-2020 classes (every held-out player has had 6+ seasons):

* Slot only: draft pick (log scale) and position group.
* Slot + combine: the same, plus position-standardised height, weight and
  the six drills, with a flag for each test the player skipped.

If adding the combine doesn't improve the held-out scores, the honest
answer is "the combine is already priced into the pick".
"""

from __future__ import annotations

import numpy as np
import polars as pl
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

from . import fetch

TRAIN = (2000, 2012)
TEST = (2013, 2020)
DRILLS = ["ht_in", "wt", "forty", "bench", "vertical", "broad_jump", "cone", "shuttle"]
# Lower is better for these; flip so a positive z always means "better".
LOWER_BETTER = {"forty", "cone", "shuttle"}

GROUPS = {
    "QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE",
    "T": "OL", "G": "OL", "C": "OL", "OL": "OL", "OT": "OL", "OG": "OL",
    "DE": "EDGE", "OLB": "EDGE", "EDGE": "EDGE",
    "DT": "DL", "NT": "DL", "DL": "DL",
    "ILB": "LB", "LB": "LB", "MLB": "LB",
    "CB": "DB", "S": "DB", "SAF": "DB", "FS": "DB", "SS": "DB", "DB": "DB",
}
GROUP_ORDER = ["QB", "RB", "WR", "TE", "OL", "EDGE", "DL", "LB", "DB"]


def dataset() -> pl.DataFrame:
    d = fetch.draft_picks().select(
        "season", "round", "pick", "team", "pfr_player_id", "pfr_player_name", "position", "college",
        "seasons_started", "w_av", "games", "probowls", "allpro",
    )
    c = fetch.combine().select("pfr_id", "ht", "wt", "forty", "bench", "vertical", "broad_jump", "cone", "shuttle")
    c = c.filter(pl.col("pfr_id").is_not_null()).unique("pfr_id")
    parts = pl.col("ht").str.split_exact("-", 1)
    c = c.with_columns(ht_in=parts.struct.field("field_0").cast(pl.Float64, strict=False) * 12 + parts.struct.field("field_1").cast(pl.Float64, strict=False)).drop("ht")
    df = d.join(c, left_on="pfr_player_id", right_on="pfr_id", how="left")
    df = df.with_columns(group=pl.col("position").replace_strict(GROUPS, default=None)).filter(pl.col("group").is_not_null())
    df = df.filter(pl.col("season") >= 2000)
    return df.with_columns(starter=(pl.col("seasons_started").fill_null(0) >= 3).cast(pl.Int8))


def _standardise(df: pl.DataFrame, ref: pl.DataFrame) -> pl.DataFrame:
    """z-score each drill within position group, using training-class means only."""
    stats = ref.group_by("group").agg(*[pl.col(k).mean().alias(f"{k}_mu") for k in DRILLS], *[pl.col(k).std().alias(f"{k}_sd") for k in DRILLS])
    df = df.join(stats, on="group", how="left")
    out = []
    for k in DRILLS:
        z = (pl.col(k) - pl.col(f"{k}_mu")) / pl.col(f"{k}_sd")
        if k in LOWER_BETTER:
            z = -z
        out += [z.alias(f"z_{k}"), pl.col(k).is_null().cast(pl.Int8).alias(f"miss_{k}")]
    return df.with_columns(out).drop([c for c in df.columns if c.endswith("_mu") or c.endswith("_sd")])


def _design(df: pl.DataFrame, combine: bool, flags: bool = False) -> np.ndarray:
    g = np.stack([(df["group"] == x).to_numpy() for x in GROUP_ORDER], axis=1).astype(float)
    lp = np.log(df["pick"].to_numpy().astype(float))[:, None]
    cols = [g, g * lp]  # each group gets its own slot curve
    if combine:
        z = np.nan_to_num(np.stack([df[f"z_{k}"].to_numpy() for k in DRILLS], axis=1).astype(float), nan=0.0).clip(-4, 4)
        cols.append(z)
        if flags:
            cols.append(np.stack([df[f"miss_{k}"].to_numpy() for k in DRILLS], axis=1).astype(float))
    return np.hstack(cols)


CS = [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3]


def _fit(train: pl.DataFrame, combine: bool, flags: bool = False) -> LogisticRegression:
    """Pick the regularisation strength on a time split inside the training classes
    (fit 2000-2008, validate 2009-2012), then refit on all training classes."""
    inner_tr = train.filter(pl.col("season") <= 2008)
    inner_va = train.filter(pl.col("season") > 2008)
    best = max(
        CS,
        key=lambda C: roc_auc_score(
            inner_va["starter"],
            LogisticRegression(C=C, max_iter=5000, fit_intercept=False)
            .fit(_design(inner_tr, combine, flags), inner_tr["starter"])
            .predict_proba(_design(inner_va, combine, flags))[:, 1],
        ),
    )
    return LogisticRegression(C=best, max_iter=5000, fit_intercept=False).fit(_design(train, combine, flags), train["starter"])


def _scores(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    return {"auc": float(roc_auc_score(y, p)), "brier": float(brier_score_loss(y, p)), "log_loss": float(log_loss(y, p)), "n": int(len(y)), "base_rate": float(y.mean())}


def study(boot: int = 1000, seed: int = 7) -> dict:
    df = dataset()
    train = df.filter(pl.col("season").is_between(*TRAIN))
    test = df.filter(pl.col("season").is_between(*TEST))
    train, test = _standardise(train, train), _standardise(test, train)
    y_tr, y_te = train["starter"].to_numpy(), test["starter"].to_numpy()

    m_slot = _fit(train, False)
    m_comb = _fit(train, True)
    m_flag = _fit(train, True, flags=True)
    p_slot = m_slot.predict_proba(_design(test, False))[:, 1]
    p_comb = m_comb.predict_proba(_design(test, True))[:, 1]
    p_flag = m_flag.predict_proba(_design(test, True, flags=True))[:, 1]

    # Paired bootstrap over held-out players for the improvement in AUC and Brier.
    rng = np.random.default_rng(seed)
    d_auc, d_brier = [], []
    for _ in range(boot):
        i = rng.integers(0, len(y_te), len(y_te))
        if y_te[i].min() == y_te[i].max():
            continue
        d_auc.append(roc_auc_score(y_te[i], p_comb[i]) - roc_auc_score(y_te[i], p_slot[i]))
        d_brier.append(brier_score_loss(y_te[i], p_slot[i]) - brier_score_loss(y_te[i], p_comb[i]))

    def ci(a):
        return [float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))]

    by_group = []
    for g in GROUP_ORDER:
        k = (test["group"] == g).to_numpy()
        if k.sum() < 30 or y_te[k].min() == y_te[k].max():
            continue
        by_group.append({"group": g, "slot": _scores(y_te[k], p_slot[k]), "combine": _scores(y_te[k], p_comb[k])})

    # Which drills carry weight in the combine model (coefficients on z-scores).
    off = 2 * len(GROUP_ORDER)
    weights = {k: float(m_comb.coef_[0][off + j]) for j, k in enumerate(DRILLS)}

    # Starter rate by round on held-out classes: the plain-English baseline.
    by_round = (
        test.group_by("round").agg(rate=pl.col("starter").mean(), n=pl.len()).sort("round").to_dicts()
    )

    return {
        "outcome": "3+ seasons as a primary starter",
        "train_classes": list(TRAIN),
        "test_classes": list(TEST),
        "overall": {"slot": _scores(y_te, p_slot), "combine": _scores(y_te, p_comb)},
        # Robustness: also using "skipped this drill" flags. Skipping became far more
        # common after 2015, so a pattern learned on 2000-2012 doesn't carry over.
        "with_skip_flags": _scores(y_te, p_flag),
        "skip_rate_40": test.group_by((pl.col("season") // 5 * 5).alias("era")).agg(rate=pl.col("forty").is_null().mean()).sort("era").to_dicts(),
        "delta": {"auc": float(np.mean(d_auc)), "auc_ci": ci(d_auc), "brier": float(np.mean(d_brier)), "brier_ci": ci(d_brier)},
        "by_group": by_group,
        "drill_weights": weights,
        "by_round": by_round,
        "_models": (m_slot, m_comb),
    }


def comps(df: pl.DataFrame, pool: pl.DataFrame, k: int = 3) -> dict[str, list[dict]]:
    """Closest athletic profiles among drafted players from finished classes (same position group).

    Distance is computed only on the tests both players took, and needs at
    least four of them. Similarity is reported as the distance in standard
    deviations, not as a percentage.
    """
    zc = [f"z_{d}" for d in DRILLS]
    out: dict[str, list[dict]] = {}
    pool_g = {g: pool.filter(pl.col("group") == g) for g in GROUP_ORDER}
    for r in df.iter_rows(named=True):
        P = pool_g.get(r["group"])
        if P is None or P.height == 0:
            continue
        a = np.array([np.nan if r[c] is None else r[c] for c in zc], dtype=float)
        if np.sum(~np.isnan(a)) < 4:
            continue
        B = P.select(zc).to_numpy().astype(float)
        both = ~np.isnan(B) & ~np.isnan(a)
        cnt = both.sum(axis=1)
        diff = np.where(both, B - a, 0.0)
        dist = np.sqrt((diff**2).sum(axis=1) / np.maximum(cnt, 1))
        dist[cnt < 4] = np.inf
        idx = np.argsort(dist)[:k]
        out[r["pfr_player_id"] or r["pfr_player_name"]] = [
            {
                "name": P["pfr_player_name"][int(i)],
                "season": int(P["season"][int(i)]),
                "pick": int(P["pick"][int(i)]),
                "team": P["team"][int(i)],
                "seasons_started": int(P["seasons_started"][int(i)] or 0),
                "distance": round(float(dist[int(i)]), 2),
            }
            for i in idx
            if np.isfinite(dist[int(i)])
        ]
    return out
