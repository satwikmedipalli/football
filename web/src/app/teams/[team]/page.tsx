import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SEASONS, TEAMS, TEAM_IDS, type Season, type Team } from "@/lib/data";
import { epa, fieldPos, OPTION, ordinal, pct, record } from "@/lib/format";

export function generateStaticParams() {
  return TEAM_IDS.map((team) => ({ team }));
}

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  return { title: `${TEAMS[team]?.team_name ?? team} · Football, measured` };
}

type Metric = { label: string; key: keyof Team; lowerBetter?: boolean; rank?: keyof Team };
const METRICS: Metric[] = [
  { label: "Offense EPA/play", key: "off_epa", rank: "off_epa_rank" },
  { label: "Pass EPA/dropback", key: "pass_epa" },
  { label: "Rush EPA/carry", key: "rush_epa" },
  { label: "Offense success", key: "off_success", rank: "off_success_rank" },
  { label: "Defense EPA allowed", key: "def_epa", lowerBetter: true, rank: "def_epa_rank" },
  { label: "Pass D EPA", key: "def_pass_epa", lowerBetter: true },
  { label: "Run D EPA", key: "def_rush_epa", lowerBetter: true },
  { label: "Defense success allowed", key: "def_success", lowerBetter: true, rank: "def_success_rank" },
];

function rankOf(s: Season, team: string, key: keyof Team, lowerBetter?: boolean) {
  const sorted = [...s.teams].sort((a, b) => ((b[key] as number) - (a[key] as number)) * (lowerBetter ? -1 : 1));
  return sorted.findIndex((t) => t.team === team) + 1;
}

function Meters({ s, team }: { s: Season; team: Team }) {
  return (
    <div>
      {METRICS.map((m) => {
        const vals = s.teams.map((t) => t[m.key] as number);
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const v = team[m.key] as number;
        let pos = (v - lo) / (hi - lo || 1);
        if (m.lowerBetter) pos = 1 - pos;
        const r = rankOf(s, team.team, m.key, m.lowerBetter);
        const color = r <= 8 ? "var(--off)" : r >= 25 ? "var(--bad)" : "var(--chalk-2)";
        const isPct = m.key.includes("success");
        return (
          <div className="meter" key={m.key}>
            <span>{m.label}</span>
            <span className="track" title="League worst → best">
              <b />
              <i style={{ left: `${pos * 100}%`, color }} />
            </span>
            <span className="v">
              {isPct ? pct(v, 1) : epa(v, 3)} <span className="muted">{ordinal(r)}</span>
            </span>
          </div>
        );
      })}
      <p className="muted mono" style={{ fontSize: "0.7rem", marginTop: 8, letterSpacing: "0.08em" }}>
        DOT POSITION: LEAGUE WORST (LEFT) → BEST (RIGHT) · RANK OF 32
      </p>
    </div>
  );
}

export default async function TeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const meta = TEAMS[team];
  if (!meta) notFound();
  const [full, current] = SEASONS;
  const t = full.teams.find((x) => x.team === team)!;
  const c = current.teams.find((x) => x.team === team);
  const f = full.fourth.find((x) => x.team === team);
  const worst = full.fourth_examples[team] ?? [];
  const swings = full.swings[team] ?? [];

  return (
    <main>
      <section className="team-hero" style={{ ["--tc" as string]: meta.team_color }}>
        <div className="wrap">
          <p className="kicker">
            <Link href="/teams" style={{ textDecoration: "none" }}>← Teams</Link> · {meta.team_division}
          </p>
          <h1>{meta.team_name}</h1>
          <p className="sub">
            {full.season}: {record(t)} · {ordinal(t.net_epa_rank)} in net EPA/play
            {c && ` · ${current.season} thru wk ${current.through_week}: ${record(c)}, ${ordinal(c.net_epa_rank)}`}
          </p>
        </div>
      </section>

      <div className="wrap">
        <dl className="stat-row">
          <div>
            <dt>Net EPA/play</dt>
            <dd className={t.net_epa >= 0 ? "pos" : "neg"}>{epa(t.net_epa, 3)}</dd>
            <small>{ordinal(t.net_epa_rank)} of 32</small>
          </div>
          <div>
            <dt>Points</dt>
            <dd>
              {t.points_for}–{t.points_against}
            </dd>
            <small>for – against</small>
          </div>
          <div>
            <dt>Neutral pass rate</dt>
            <dd>{pct(t.neutral_pass_rate)}</dd>
            <small>
              {t.proe >= 0 ? "+" : "−"}
              {Math.abs(t.proe).toFixed(1)} pts over expected
            </small>
          </div>
          <div>
            <dt>Explosive plays</dt>
            <dd>{pct(t.explosive, 1)}</dd>
            <small>of offensive plays</small>
          </div>
        </dl>

        <section className="section" style={{ borderTop: 0, paddingTop: 56 }}>
          <div className="grid2" style={{ alignItems: "start" }}>
            <div>
              <p className="kicker">{full.season} profile</p>
              <h2 className="section-h" style={{ fontSize: "2rem" }}>Where they rank</h2>
              <div style={{ marginTop: 20 }}>
                <Meters s={full} team={t} />
              </div>
            </div>
            <div>
              {c && (
                <>
                  <p className="kicker">{current.season} so far · thru week {current.through_week}</p>
                  <h2 className="section-h" style={{ fontSize: "2rem" }}>This season</h2>
                  <div style={{ marginTop: 20 }}>
                    <Meters s={current} team={c} />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {f && (
          <section className="section">
            <p className="kicker">4th downs · {full.season}</p>
            <h2 className="section-h" style={{ fontSize: "2.2rem" }}>
              {f.decisions} graded calls, {f.go} go-for-its
            </h2>
            <p className="section-lede">
              On the {f.clear_calls} clear-cut calls, the {meta.team_nick} matched the model {pct(f.agree_rate)} of the time. They kicked {f.should_go}{" "}
              {f.should_go === 1 ? "time" : "times"} when going was clearly better, and went {f.went_should_kick} {f.went_should_kick === 1 ? "time" : "times"} when
              kicking was. Total cost of calls that differed from the model: {f.ep_lost.toFixed(1)} expected points, {ordinal(f.ep_lost_rank)} fewest in the league.
            </p>
            {worst.length > 0 && (
              <>
                <h3 style={{ marginTop: 32, marginBottom: 14, fontSize: "1.2rem" }}>The costliest calls</h3>
                <ul className="plays">
                  {worst.map((d, i) => (
                    <li key={i}>
                      <span className="tag">
                        <strong className="neg">−{d.ep_lost.toFixed(2)}</strong>
                        EP · wk {d.week}
                      </span>
                      <span>
                        <span className="mono" style={{ fontSize: "0.78rem" }}>
                          vs {d.defteam} · Q{d.qtr} {d.time} · 4th & {d.ydstogo} at {fieldPos(d.yardline_100)} · {d.score_differential > 0 ? "up" : d.score_differential < 0 ? "down" : "tied"}{" "}
                          {d.score_differential ? Math.abs(d.score_differential) : ""}
                        </span>
                        <br />
                        <span className="desc">
                          Chose <b>{OPTION[d.did].toLowerCase()}</b>; model said <b className="pos">{OPTION[d.rec].toLowerCase()}</b>. {d.desc}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {swings.length > 0 && (
          <section className="section">
            <p className="kicker">Swing plays · {full.season}</p>
            <h2 className="section-h" style={{ fontSize: "2.2rem" }}>The plays that moved win probability most</h2>
            <ul className="plays" style={{ marginTop: 24, marginBottom: 40 }}>
              {swings.map((s, i) => (
                <li key={i}>
                  <span className="tag">
                    <strong className={s.gain >= 0 ? "pos" : "neg"}>
                      {s.gain >= 0 ? "+" : "−"}
                      {Math.abs(s.gain * 100).toFixed(0)}%
                    </strong>
                    win prob · wk {s.week}
                  </span>
                  <span>
                    <span className="mono" style={{ fontSize: "0.78rem" }}>
                      {s.posteam} vs {s.defteam} · Q{s.qtr} {s.time}
                    </span>
                    <br />
                    <span className="desc">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
