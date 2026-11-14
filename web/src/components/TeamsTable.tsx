"use client";

import Link from "next/link";
import { useState } from "react";
import { SEASONS, TEAMS, type Team } from "@/lib/data";
import { epa, pct, record } from "@/lib/format";

type Col = { key: keyof Team; label: string; fmt: (t: Team) => string; lowerBetter?: boolean };
const COLS: Col[] = [
  { key: "net_epa", label: "Net EPA", fmt: (t) => epa(t.net_epa, 3) },
  { key: "off_epa", label: "Off EPA", fmt: (t) => epa(t.off_epa, 3) },
  { key: "pass_epa", label: "Pass", fmt: (t) => epa(t.pass_epa) },
  { key: "rush_epa", label: "Rush", fmt: (t) => epa(t.rush_epa) },
  { key: "off_success", label: "Success", fmt: (t) => pct(t.off_success, 1) },
  { key: "proe", label: "PROE", fmt: (t) => `${t.proe >= 0 ? "+" : "−"}${Math.abs(t.proe).toFixed(1)}` },
  { key: "def_epa", label: "Def EPA", fmt: (t) => epa(t.def_epa, 3), lowerBetter: true },
  { key: "def_success", label: "Def succ.", fmt: (t) => pct(t.def_success, 1), lowerBetter: true },
  { key: "takeaways", label: "Takeaways", fmt: (t) => String(t.takeaways) },
];

export default function TeamsTable() {
  const [season, setSeason] = useState(SEASONS[0].season);
  const [sort, setSort] = useState<{ key: keyof Team; desc: boolean }>({ key: "net_epa", desc: true });
  const s = SEASONS.find((x) => x.season === season)!;
  const rows = s.teams.filter((t) => TEAMS[t.team]).sort((a, b) => {
    const d = (a[sort.key] as number) - (b[sort.key] as number);
    return sort.desc ? -d : d;
  });
  const extent = (k: keyof Team) => {
    const v = s.teams.map((t) => t[k] as number);
    return Math.max(...v.map(Math.abs));
  };
  const netMax = extent("net_epa");

  return (
    <>
      <div className="controls">
        <div className="toggle" role="group" aria-label="Season">
          {SEASONS.map((x) => (
            <button key={x.season} aria-pressed={x.season === season} onClick={() => setSeason(x.season)}>
              {x.season}
              {x.season === SEASONS[SEASONS.length - 1].season ? ` · thru wk ${x.through_week}` : ""}
            </button>
          ))}
        </div>
        <p className="muted mono" style={{ fontSize: "0.75rem" }}>
          Regular season · EPA per play · click a header to sort
        </p>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th className="l">Team</th>
              <th>Record</th>
              {COLS.map((c) => (
                <th key={c.key} aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}>
                  <button
                    onClick={() =>
                      setSort((p) => (p.key === c.key ? { key: c.key, desc: !p.desc } : { key: c.key, desc: !c.lowerBetter }))
                    }
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
              <th className="l" style={{ minWidth: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const m = TEAMS[t.team];
              const w = (Math.abs(t.net_epa) / netMax) * 50;
              return (
                <tr key={t.team}>
                  <td>
                    <Link href={`/teams/${t.team}`} className="team-cell">
                      <span className="swatch" style={{ background: m.team_color }} />
                      <span>
                        <strong>{m.team_nick}</strong> <span className="muted mono" style={{ fontSize: "0.72rem" }}>{t.team}</span>
                      </span>
                    </Link>
                  </td>
                  <td>{record(t)}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className={c.key === "net_epa" ? (t.net_epa >= 0 ? "pos" : "neg") : undefined}>
                      {c.fmt(t)}
                    </td>
                  ))}
                  <td className="l">
                    <div className="bar">
                      <b style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 1, background: "var(--line-2)" }} />
                      <i style={{ left: t.net_epa >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: t.net_epa >= 0 ? "var(--off)" : "var(--bad)" }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
