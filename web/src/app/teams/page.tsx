import type { Metadata } from "next";
import TeamsTable from "@/components/TeamsTable";

export const metadata: Metadata = { title: "Teams · Football, measured" };

export default function TeamsPage() {
  return (
    <main className="wrap">
      <header className="page-head">
        <p className="kicker">Teams</p>
        <h1>All 32, per play</h1>
        <p>
          Expected points added (EPA) measures how much each play changed a team&apos;s expected score, given down, distance and field position. Per-play
          averages remove the effect of pace. Net EPA is offense minus defense allowed. No grades, no curves: just the averages and where
          each team ranks.
        </p>
      </header>
      <TeamsTable />
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: 16, marginBottom: 80 }}>
        PROE is pass rate over expected (nflverse&apos;s model) in neutral situations: 1st and 2nd down, win probability 20–80%, more than two minutes left in the half. In percentage points.
        Success means a play with positive EPA.
      </p>
    </main>
  );
}
