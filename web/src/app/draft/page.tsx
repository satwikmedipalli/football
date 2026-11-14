import type { Metadata } from "next";
import DraftBoard from "@/components/DraftBoard";
import { DRAFT_CLASS, DRAFT_STUDY } from "@/lib/data";
import { pct } from "@/lib/format";

export const metadata: Metadata = { title: "Draft · Football, measured" };

function RoundBars() {
  const rows = DRAFT_STUDY.by_round;
  const w = 560, rowH = 34, l = 40;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${rows.length * rowH + 6}`} role="img" aria-label="Share of picks who started three or more seasons, by round">
      {rows.map((r, i) => (
        <g key={r.round} transform={`translate(0 ${i * rowH})`}>
          <text x={0} y={21}>R{r.round}</text>
          <rect x={l} y={6} width={w - l - 70} height={20} rx={4} fill="rgb(233 242 236 / 0.06)" />
          <rect x={l} y={6} width={(w - l - 70) * r.rate} height={20} rx={4} fill="#c6ff3d" opacity={0.35 + r.rate * 0.65} />
          <text x={w - 62} y={21} style={{ fill: "#e9f2ec" }}>{pct(r.rate)}</text>
          <text x={w} y={21} textAnchor="end">n={r.n}</text>
        </g>
      ))}
    </svg>
  );
}

export default function DraftPage() {
  const d = DRAFT_STUDY;
  const sign = (x: number, k = 3) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(k)}`;
  const skipFirst = d.skip_rate_40[0];
  const skipLast = d.skip_rate_40[d.skip_rate_40.length - 1];
  const span = (era: number) => {
    const a = Math.max(era, d.test_classes[0]);
    const b = Math.min(era + 4, d.test_classes[1]);
    return a === b ? `${a}` : `${a}–${String(b).slice(2)}`;
  };
  const tested = DRAFT_CLASS.players.filter((p) => p.forty != null).length;

  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">Draft</p>
        <h1>Does the combine tell you anything the pick doesn&apos;t?</h1>
        <p>
          Draft slot is the league&apos;s consensus on a player. If the combine held information teams were ignoring, adding it to the pick number should
          predict careers better. The test: train on the {d.train_classes[0]}–{d.train_classes[1]} classes, score on {d.test_classes[0]}–{d.test_classes[1]},
          outcome = {d.outcome.toLowerCase()}.
        </p>
      </header>

      <dl className="stat-row">
        <div>
          <dt>Slot only · AUC</dt>
          <dd>{d.overall.slot.auc.toFixed(3)}</dd>
          <small>held-out, {d.overall.slot.n.toLocaleString()} picks</small>
        </div>
        <div>
          <dt>Slot + combine · AUC</dt>
          <dd>{d.overall.combine.auc.toFixed(3)}</dd>
          <small>position-adjusted drills</small>
        </div>
        <div>
          <dt>Difference</dt>
          <dd className={d.delta.auc > 0 ? "pos" : "neg"}>{sign(d.delta.auc)}</dd>
          <small>
            95% CI {sign(d.delta.auc_ci[0])} to {sign(d.delta.auc_ci[1])}
          </small>
        </div>
        <div>
          <dt>Base rate</dt>
          <dd>{pct(d.overall.slot.base_rate)}</dd>
          <small>of picks became 3-yr starters</small>
        </div>
      </dl>

      <section className="section" style={{ borderTop: 0 }}>
        <div className="grid2" style={{ alignItems: "start" }}>
          <div>
            <p className="kicker">The answer</p>
            <h2 className="section-h" style={{ fontSize: "2.2rem" }}>No. The pick already priced it in.</h2>
            <p className="section-lede">
              The interval straddles zero, so the combine adds nothing measurable once you know where a player was drafted. That doesn&apos;t mean
              athleticism is irrelevant; it means teams already weigh it when they pick. Adding a flag for skipped drills made things worse (AUC{" "}
              {d.with_skip_flags.auc.toFixed(3)}), partly because skipping the 40 went from {pct(skipFirst.rate)} of picks in the {span(skipFirst.era)} classes to{" "}
              {pct(skipLast.rate)} in {span(skipLast.era)}, so what a skip means drifts over time.
            </p>
          </div>
          <div className="card">
            <p className="kicker">What the slot is worth</p>
            <h3>3+ seasons as a starter, by round</h3>
            <RoundBars />
          </div>
        </div>
      </section>

      <section className="section">
        <p className="kicker">By position</p>
        <h2 className="section-h" style={{ fontSize: "2.2rem" }}>Nowhere does it clearly help</h2>
        <div className="tbl-wrap" style={{ marginTop: 24 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="l">Group</th>
                <th>Test picks</th>
                <th>Base rate</th>
                <th>Slot AUC</th>
                <th>+ Combine AUC</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {d.by_group.map((g) => {
                const delta = g.combine.auc - g.slot.auc;
                return (
                  <tr key={g.group}>
                    <td>{g.group}</td>
                    <td>{g.slot.n}</td>
                    <td>{pct(g.slot.base_rate)}</td>
                    <td>{g.slot.auc.toFixed(3)}</td>
                    <td>{g.combine.auc.toFixed(3)}</td>
                    <td className={delta > 0.005 ? "pos" : delta < -0.005 ? "neg" : "muted"}>{sign(delta)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: 12 }}>
          Small groups are noisy; a few hundredths of AUC either way is within chance at these sample sizes.
        </p>
      </section>

      <section className="section">
        <p className="kicker">The {DRAFT_CLASS.season} class</p>
        <h2 className="section-h" style={{ fontSize: "2.2rem" }}>Every pick, with what history says</h2>
        <p className="section-lede" style={{ marginBottom: 28 }}>
          The number is the slot model&apos;s estimate, so it depends only on the pick and the position. The drills are context, not a forecast.
          {` ${tested} of ${DRAFT_CLASS.players.length}`} picks ran the 40. No grades, no rankings of who will bust.
        </p>
        <DraftBoard />
      </section>
      <div style={{ height: 80 }} />
    </main>
  );
}
