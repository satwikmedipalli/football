"use client";

import { useMemo, useState } from "react";
import { DRAFT_CLASS, type Prospect } from "@/lib/data";
import { height, pct } from "@/lib/format";

const DRILLS: { key: keyof Prospect; z: keyof Prospect; label: string; fmt: (v: number) => string }[] = [
  { key: "forty", z: "z_forty", label: "40", fmt: (v) => `${v.toFixed(2)}s` },
  { key: "vertical", z: "z_vertical", label: "Vert", fmt: (v) => `${v}″` },
  { key: "broad_jump", z: "z_broad_jump", label: "Broad", fmt: (v) => `${Math.floor(v / 12)}′${v % 12}″` },
  { key: "cone", z: "z_cone", label: "3-cone", fmt: (v) => `${v.toFixed(2)}s` },
];

export default function DraftBoard() {
  const players = DRAFT_CLASS.players;
  const groups = useMemo(() => ["All", ...[...new Set(players.map((p) => p.group))].sort()], [players]);
  const [round, setRound] = useState(1);
  const [group, setGroup] = useState("All");
  const [q, setQ] = useState("");
  const list = players.filter(
    (p) =>
      (round === 0 || p.round === round) &&
      (group === "All" || p.group === group) &&
      (!q || `${p.pfr_player_name} ${p.college} ${p.team}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <div className="controls">
        <div className="toggle" role="group" aria-label="Round">
          {[1, 2, 3, 4, 5, 6, 7, 0].map((r) => (
            <button key={r} aria-pressed={round === r} onClick={() => setRound(r)}>
              {r ? `R${r}` : "All"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select className="search" style={{ minWidth: 0 }} value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Position group">
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <input className="search" placeholder="Search player, school, team" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="muted mono" style={{ fontSize: "0.72rem", marginBottom: 14 }}>
        {list.length} players · drill colour = position-adjusted z-score (lime ≥ +1, red ≤ −1)
      </p>
      <div className="prospects">
        {list.map((p) => (
          <article className="prospect" key={p.pick}>
            <header>
              <div>
                <h3>{p.pfr_player_name}</h3>
                <p className="meta">
                  {p.position} · {p.college} · {p.team}
                </p>
              </div>
              <span className="pick">#{p.pick}</span>
            </header>
            <p style={{ fontSize: "0.85rem" }}>
              <span className="mono pos">{pct(p.slot_p)}</span> <span className="muted">chance of 3+ seasons as a starter, from pick and position alone</span>
            </p>
            <p className="meta">
              {height(p.ht_in)} · {p.wt ? `${p.wt} lb` : "–"}
            </p>
            <div className="drills">
              {DRILLS.map((d) => {
                const v = p[d.key] as number | null;
                const z = p[d.z] as number | null;
                return (
                  <div key={d.label} className={`drill ${v == null ? "na" : z != null && z >= 1 ? "hi" : z != null && z <= -1 ? "lo" : ""}`}>
                    {d.label}
                    <b>{v == null ? "skipped" : d.fmt(v)}</b>
                  </div>
                );
              })}
            </div>
            {p.comps.length > 0 && (
              <div className="comps">
                <span className="muted mono" style={{ fontSize: "0.66rem", letterSpacing: "0.1em" }}>
                  CLOSEST ATHLETIC PROFILES, SAME POSITION GROUP
                </span>
                <ul>
                  {p.comps.slice(0, 3).map((c) => (
                    <li key={`${c.name}${c.season}`}>
                      <span>
                        {c.name} <span className="muted">’{String(c.season).slice(2)} #{c.pick}</span>
                      </span>
                      <span className="mono">{c.seasons_started} yrs started</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
