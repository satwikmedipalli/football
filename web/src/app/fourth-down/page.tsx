import type { Metadata } from "next";
import Link from "next/link";
import { FOURTH_MODEL, LATEST_FULL, TEAMS } from "@/lib/data";
import { fieldPos, pct } from "@/lib/format";

export const metadata: Metadata = { title: "4th downs · Football, measured" };

const REC_COLOR = { go: "#c6ff3d", fg: "#3dd6ff", punt: "#5b6b72" } as const;

function DecisionGrid() {
  const g = FOURTH_MODEL.grid;
  const ys = [...new Set(g.map((c) => c.y))].sort((a, b) => b - a); // own goal (95) on left → opp goal (5) on right
  const togos = [...new Set(g.map((c) => c.togo))].sort((a, b) => a - b);
  const cw = 52, ch = 44, ox = 70, oy = 10;
  const w = ox + ys.length * cw + 10;
  const h = oy + togos.length * ch + 50;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Recommended 4th-down decision by field position and yards to go">
      {togos.map((tg, r) =>
        ys.map((y, c) => {
          const cell = g.find((x) => x.y === y && x.togo === tg);
          if (!cell) return null;
          const opts = [cell.go, cell.fg, cell.punt].filter((v): v is number => v != null).sort((a, b) => b - a);
          const margin = opts.length > 1 ? opts[0] - opts[1] : 1;
          const a = 0.25 + Math.min(margin / 1.5, 1) * 0.75;
          return (
            <g key={`${y}-${tg}`}>
              <rect x={ox + c * cw + 1} y={oy + r * ch + 1} width={cw - 2} height={ch - 2} rx={4} fill={REC_COLOR[cell.rec]} opacity={a}>
                <title>{`4th & ${tg} at ${fieldPos(y)}: ${cell.rec.toUpperCase()} (go ${cell.go.toFixed(2)}, FG ${cell.fg?.toFixed(2) ?? "–"}, punt ${cell.punt?.toFixed(2) ?? "–"} EP)`}</title>
              </rect>
              <text x={ox + c * cw + cw / 2} y={oy + r * ch + ch / 2 + 4} textAnchor="middle" style={{ fill: cell.rec === "punt" ? "#e9f2ec" : "#070b0f", fontSize: 11, fontWeight: 600 }}>
                {cell.rec === "fg" ? "FG" : cell.rec === "go" ? "GO" : "P"}
              </text>
            </g>
          );
        }),
      )}
      {togos.map((tg, r) => (
        <text key={tg} x={ox - 12} y={oy + r * ch + ch / 2 + 4} textAnchor="end">
          {tg === 10 ? "10+" : tg} to go
        </text>
      ))}
      {ys.map((y, c) => (
        <text key={y} x={ox + c * cw + cw / 2} y={oy + togos.length * ch + 18} textAnchor="middle">
          {y === 50 ? "50" : y > 50 ? `own ${100 - y}` : `opp ${y}`}
        </text>
      ))}
      <text x={ox} y={h - 6}>← own goal line</text>
      <text x={w - 10} y={h - 6} textAnchor="end">opponent goal line →</text>
    </svg>
  );
}

function Curve({ pts, xLabel, color, xs }: { pts: { x: number; p: number }[]; xLabel: string; color: string; xs: number[] }) {
  const w = 560, h = 260, l = 46, r = 14, t = 14, b = 40;
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  const X = (v: number) => l + ((v - x0) / (x1 - x0)) * (w - l - r);
  const Y = (p: number) => t + (1 - p) * (h - t - b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x)} ${Y(p.p)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line x1={l} x2={w - r} y1={Y(p)} y2={Y(p)} stroke="rgb(233 242 236 / 0.08)" />
          <text x={l - 8} y={Y(p) + 4} textAnchor="end">{p * 100}%</text>
        </g>
      ))}
      {xs.map((v) => (
        <text key={v} x={X(v)} y={h - b + 18} textAnchor="middle">{v}</text>
      ))}
      <text x={w - r} y={h - 4} textAnchor="end">{xLabel}</text>
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} />
      {pts.map((p) => (
        <circle key={p.x} cx={X(p.x)} cy={Y(p.p)} r={2.5} fill={color}>
          <title>{`${p.x}: ${pct(p.p)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function FourthPage() {
  const s = LATEST_FULL;
  const rows = [...s.fourth].sort((a, b) => a.ep_lost_rank - b.ep_lost_rank);
  const m = FOURTH_MODEL;
  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">4th downs</p>
        <h1>Go, kick or punt</h1>
        <p>
          For each option the model asks: what are the expected points of the next state? Going for it is the conversion chance (from real 3rd- and 4th-down
          runs and passes) times the value of a first down, plus the miss chance times handing the ball over on the spot. A field goal is the make
          probability times the value of three points and a kickoff, plus the miss chance times giving the ball up at the kick spot. A punt is the value of
          the opponent&apos;s typical starting field position, and is never considered inside the opponent&apos;s 35. Every input is
          fitted from {m.fit_seasons[0]}–{m.fit_seasons[m.fit_seasons.length - 1]} play-by-play. It ignores score, clock and weather, so treat it as a
          baseline, not a coach.
        </p>
      </header>

      <section style={{ paddingBottom: 56 }}>
        <p className="kicker">The decision chart</p>
        <div className="tbl-wrap" style={{ padding: 16 }}>
          <DecisionGrid />
        </div>
        <div className="legend">
          <span><i className="swatch" style={{ background: REC_COLOR.go }} /> Go for it</span>
          <span><i className="swatch" style={{ background: REC_COLOR.fg }} /> Field goal</span>
          <span><i className="swatch" style={{ background: REC_COLOR.punt }} /> Punt</span>
          <span className="muted">Brighter = bigger edge over the next-best option · hover for EP values</span>
        </div>
      </section>

      <section className="section">
        <div className="grid2">
          <div className="card">
            <p className="kicker">Inputs · conversion</p>
            <h3>How often 4th downs convert</h3>
            <Curve pts={m.conversion.filter((c) => c.togo <= 15).map((c) => ({ x: c.togo, p: c.p }))} xs={[1, 5, 10, 15]} xLabel="yards to go" color="#c6ff3d" />
          </div>
          <div className="card">
            <p className="kicker">Inputs · kicking</p>
            <h3>Field goal make rate by distance</h3>
            <Curve pts={m.fg.map((c) => ({ x: c.distance, p: c.p }))} xs={[20, 30, 40, 50, 60]} xLabel="kick distance (yards)" color="#3dd6ff" />
          </div>
        </div>
      </section>

      <section className="section">
        <p className="kicker">{s.season} · by team</p>
        <h2 className="section-h">Who followed the math</h2>
        <p className="section-lede">
          Graded: every 4th-down run, pass, field goal or punt in the first three quarters or with more than five minutes left, with the score within 16. A
          call is &ldquo;clear&rdquo; when the best option beats the next by at least {m.clear_margin} expected points. Plays wiped out by penalties don&apos;t
          count, and a fake punt counts as going for it. Ranked by EP given up on calls that differed from the model.
        </p>
        <div className="tbl-wrap" style={{ marginTop: 28, marginBottom: 80 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th className="l">Team</th>
                <th>Graded</th>
                <th>Went</th>
                <th>Clear calls</th>
                <th>Matched</th>
                <th>Kicked, should go</th>
                <th>Went, should kick</th>
                <th>EP given up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = TEAMS[r.team];
                if (!meta) return null;
                return (
                  <tr key={r.team}>
                    <td>
                      <Link href={`/teams/${r.team}`} className="team-cell">
                        <span className="swatch" style={{ background: meta.team_color }} />
                        <strong>{meta.team_nick}</strong>
                      </Link>
                    </td>
                    <td>{r.decisions}</td>
                    <td>{r.go}</td>
                    <td>{r.clear_calls}</td>
                    <td>{pct(r.agree_rate)}</td>
                    <td>{r.should_go}</td>
                    <td>{r.went_should_kick}</td>
                    <td className={r.ep_lost_rank <= 8 ? "pos" : r.ep_lost_rank >= 25 ? "neg" : undefined}>{r.ep_lost.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
