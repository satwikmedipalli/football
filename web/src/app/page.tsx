import Link from "next/link";
import PlayHero from "@/components/PlayHero";
import { DRAFT_STUDY, LATEST_FULL, TEAMS } from "@/lib/data";
import { epa, pct } from "@/lib/format";

export default function Home() {
  const s = LATEST_FULL;
  const ranked = [...s.teams].sort((a, b) => a.net_epa_rank - b.net_epa_rank);
  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-3).reverse();

  const f = s.fourth;
  const clear = f.reduce((a, x) => a + x.clear_calls, 0);
  const agreed = f.reduce((a, x) => a + x.agreed, 0);
  const shouldGo = f.reduce((a, x) => a + x.should_go, 0);
  const lost = f.reduce((a, x) => a + x.ep_lost, 0);

  const d = DRAFT_STUDY;
  const r1 = d.by_round[0];
  const r7 = d.by_round[d.by_round.length - 1];

  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <div className="hero-text">
            <h1>
              Football,<br />
              <em>measured.</em>
            </h1>
            <p className="hero-sub">
              Every NFL play is worth some number of expected points. Add them up and you can rank teams, grade 4th-down calls, and test whether
              the scouting combine knows anything the draft board doesn&apos;t. Built from public play-by-play, with the method and limits in the open.
            </p>
          </div>
          <PlayHero teams={s.teams} meta={TEAMS} season={s.season} />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <p className="kicker">Three findings · {s.season} season</p>
          <h2 className="section-h">What the numbers say</h2>
          <div className="grid3" style={{ marginTop: 36 }}>
            <article className="card">
              <p className="kicker">Teams</p>
              <h3>{TEAMS[top[0].team]?.team_nick} were the best team per play</h3>
              <p className="muted">Net EPA per play, offense minus defense allowed.</p>
              <ul className="plays" style={{ marginTop: 16, gap: 6 }}>
                {top.map((t) => (
                  <li key={t.team} style={{ gridTemplateColumns: "40px 1fr auto", padding: "8px 12px" }}>
                    <span className="mono muted">#{t.net_epa_rank}</span>
                    <span>{TEAMS[t.team]?.team_name}</span>
                    <span className="mono pos">{epa(t.net_epa, 3)}</span>
                  </li>
                ))}
                {bottom.map((t) => (
                  <li key={t.team} style={{ gridTemplateColumns: "40px 1fr auto", padding: "8px 12px" }}>
                    <span className="mono muted">#{t.net_epa_rank}</span>
                    <span>{TEAMS[t.team]?.team_name}</span>
                    <span className="mono neg">{epa(t.net_epa, 3)}</span>
                  </li>
                ))}
              </ul>
              <Link className="more" href="/teams">All 32 teams →</Link>
            </article>

            <article className="card">
              <p className="kicker">4th downs</p>
              <div className="big">{pct(agreed / clear)}</div>
              <h3 style={{ marginTop: 8 }}>of clear-cut calls matched the model</h3>
              <p className="muted">
                Of {clear.toLocaleString()} 4th downs where one option was worth at least half a point more, coaches kicked {shouldGo} times when the model
                said go. Across every graded 4th down, calls that differed from the model gave up about {Math.round(lost)} expected points league-wide.
              </p>
              <Link className="more" href="/fourth-down">The decision chart →</Link>
            </article>

            <article className="card">
              <p className="kicker">Draft</p>
              <div className="big">{d.delta.auc > 0 ? "+" : "−"}{Math.abs(d.delta.auc).toFixed(3)}</div>
              <h3 style={{ marginTop: 8 }}>AUC the combine adds over draft slot</h3>
              <p className="muted">
                On {d.overall.slot.n.toLocaleString()} picks from {d.test_classes[0]}–{d.test_classes[1]}, adding 40 times, jumps and agility drills to the pick
                number didn&apos;t predict who became a starter any better. The slot already priced it in: {pct(r1.rate)} of 1st-rounders started 3+ seasons, {pct(r7.rate)} of 7th-rounders.
              </p>
              <Link className="more" href="/draft">The draft study →</Link>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
