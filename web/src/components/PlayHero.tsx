"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Team, TeamMeta } from "@/lib/data";
import { epa, record } from "@/lib/format";

type P = [number, number];
type Player = { side: "o" | "d"; path: P[]; start: number; dur: number };

const W = 1200;
const H = 560;
const SNAP = 0.9;
const THROW = 2.35;
const CATCH = 3.35;
const MORPH = 4.5;
const MORPH_END = 6.0;
const END = 6.6;

// A four-verticals-ish shot play, drawn on a chalkboard. Offense moves right.
const PLAYERS: Player[] = [
  // offensive line
  ...[238, 259, 280, 301, 322].map((y): Player => ({ side: "o", path: [[488, y], [472, y + (y - 280) * 0.15]], start: SNAP, dur: 0.7 })),
  { side: "o", path: [[440, 280], [384, 282], [378, 280]], start: SNAP, dur: 1.1 }, // QB drop
  { side: "o", path: [[412, 304], [452, 380], [600, 430]], start: SNAP, dur: 2.0 }, // RB flat
  { side: "o", path: [[488, 348], [560, 364], [730, 312]], start: SNAP, dur: 2.2 }, // TE drag
  { side: "o", path: [[490, 66], [800, 66], [1040, 78], [1150, 110]], start: SNAP, dur: 3.1 }, // X go route (target)
  { side: "o", path: [[472, 150], [630, 150], [676, 108]], start: SNAP, dur: 1.9 }, // slot out
  { side: "o", path: [[482, 486], [650, 486], [830, 372]], start: SNAP, dur: 2.3 }, // Z post
  // defense
  ...[246, 270, 292, 316].map((y, i): Player => ({ side: "d", path: [[516, y], [470, y + (i < 2 ? -18 : 18)], [430, y + (i < 2 ? -6 : 6)]], start: SNAP + 0.1, dur: 1.6 })),
  { side: "d", path: [[574, 206], [600, 170], [660, 140]], start: SNAP + 0.15, dur: 1.8 },
  { side: "d", path: [[574, 280], [590, 330], [700, 322]], start: SNAP + 0.15, dur: 2.0 },
  { side: "d", path: [[574, 354], [560, 400], [612, 424]], start: SNAP + 0.15, dur: 1.9 },
  { side: "d", path: [[522, 80], [760, 84], [1010, 96], [1126, 128]], start: SNAP + 0.2, dur: 3.3 }, // CB trailing X
  { side: "d", path: [[522, 476], [660, 478], [800, 396]], start: SNAP + 0.2, dur: 2.4 },
  { side: "d", path: [[720, 176], [820, 150], [960, 120]], start: SNAP + 0.3, dur: 2.6 }, // late safety
  { side: "d", path: [[720, 390], [770, 380], [830, 380]], start: SNAP + 0.3, dur: 2.2 },
];
const QB = 5;
const TARGET = 8;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function along(path: P[], f: number): P {
  if (path.length === 1 || f <= 0) return path[0];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let want = clamp(f) * total;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? clamp(want / seg[i]) : 1;
      return [lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k)];
    }
    want -= seg[i];
  }
  return path[path.length - 1];
}

const playerAt = (p: Player, t: number) => along(p.path, ease(clamp((t - p.start) / p.dur)));
const toD = (path: P[]) => path.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

// scatter plot area
const PX0 = 110, PX1 = 1150, PY0 = 50, PY1 = 470;

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const dotColor = (m?: TeamMeta) => {
  if (!m) return "#888";
  if (lum(m.team_color) > 0.12) return m.team_color;
  return lum(m.team_color2) > 0.12 ? m.team_color2 : "#9aa7ad";
};

export default function PlayHero({ teams, meta, season }: { teams: Team[]; meta: Record<string, TeamMeta>; season: number }) {
  const router = useRouter();
  const [t, setT] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const raf = useRef(0);
  const t0 = useRef(0);

  const scale = useMemo(() => {
    const xs = teams.map((d) => d.off_epa);
    const ys = teams.map((d) => d.def_epa);
    const pad = (a: number[]) => {
      const lo = Math.min(...a), hi = Math.max(...a), p = (hi - lo) * 0.08;
      return [lo - p, hi + p] as const;
    };
    const [x0, x1] = pad(xs);
    const [y0, y1] = pad(ys);
    return {
      x: (v: number) => PX0 + ((v - x0) / (x1 - x0)) * (PX1 - PX0),
      // lower defensive EPA allowed is better, so it goes on top
      y: (v: number) => PY0 + ((v - y0) / (y1 - y0)) * (PY1 - PY0),
      x0, x1, y0, y1,
    };
  }, [teams]);

  // the 22 players become the 22 best-net teams' dots, sorted so nobody crosses far
  const order = useMemo(() => [...teams].sort((a, b) => a.net_epa_rank - b.net_epa_rank), [teams]);

  // greedy label placement: above, below, right, left — first spot that doesn't hit a placed label or a dot
  const labelPos = useMemo(() => {
    const pts = teams.map((t) => ({ id: t.team, x: scale.x(t.off_epa), y: scale.y(t.def_epa) }));
    const boxes: [number, number, number, number][] = [];
    const hit = (bx: [number, number, number, number]) =>
      boxes.some((o) => bx[0] < o[2] && bx[2] > o[0] && bx[1] < o[3] && bx[3] > o[1]) ||
      pts.some((p) => p.x > bx[0] - 9 && p.x < bx[2] + 9 && p.y > bx[1] - 9 && p.y < bx[3] + 9);
    const out: Record<string, { dx: number; dy: number; anchor: "middle" | "start" | "end" }> = {};
    for (const p of [...pts].sort((a, b) => a.y - b.y)) {
      const w = p.id.length * 7 + 2;
      const opts = [
        { dx: 0, dy: -15, anchor: "middle" as const, bx: [p.x - w / 2, p.y - 25, p.x + w / 2, p.y - 13] },
        { dx: 0, dy: 25, anchor: "middle" as const, bx: [p.x - w / 2, p.y + 15, p.x + w / 2, p.y + 27] },
        { dx: 14, dy: 4, anchor: "start" as const, bx: [p.x + 13, p.y - 6, p.x + 13 + w, p.y + 6] },
        { dx: -14, dy: 4, anchor: "end" as const, bx: [p.x - 13 - w, p.y - 6, p.x - 13, p.y + 6] },
      ];
      const pick = opts.find((o) => !hit(o.bx as [number, number, number, number])) ?? opts[0];
      boxes.push(pick.bx as [number, number, number, number]);
      out[p.id] = { dx: pick.dx, dy: pick.dy, anchor: pick.anchor };
    }
    return out;
  }, [teams, scale]);

  const play = () => {
    cancelAnimationFrame(raf.current);
    t0.current = performance.now();
    const tick = (now: number) => {
      const s = (now - t0.current) / 1000;
      setT(Math.min(s, END));
      if (s < END) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setT(END));
      return () => cancelAnimationFrame(id);
    }
    play();
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const m = ease(clamp((t - MORPH) / (MORPH_END - MORPH)));
  const fieldA = 1 - clamp((t - MORPH) / 0.6);
  const plotA = clamp((t - MORPH - 0.5) / 0.9);
  const done = t >= END;

  // ball
  const qb = playerAt(PLAYERS[QB], t);
  const catchPt = along(PLAYERS[TARGET].path, ease(clamp((CATCH - PLAYERS[TARGET].start) / PLAYERS[TARGET].dur)));
  let ball: P = qb;
  let ballH = 0;
  if (t >= THROW && t < CATCH) {
    const k = (t - THROW) / (CATCH - THROW);
    const from = playerAt(PLAYERS[QB], THROW);
    ball = [lerp(from[0], catchPt[0], k), lerp(from[1], catchPt[1], k)];
    ballH = Math.sin(Math.PI * k);
  } else if (t >= CATCH) {
    ball = playerAt(PLAYERS[TARGET], t);
  }
  const td = t > PLAYERS[TARGET].start + PLAYERS[TARGET].dur - 0.05;

  // yard lines: LOS at x=500 is the opponent 25; 24px per yard
  const yard = (y: number) => 1100 - y * 24;
  const lines = Array.from({ length: 11 }, (_, i) => i * 5); // 0..50 yards to goal

  const hovered = hover ? teams.find((d) => d.team === hover) : null;

  return (
    <div className="board">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A pass play diagram that turns into a chart of all 32 teams' offensive and defensive EPA per play, ${season} season`}>
        <defs>
          <pattern id="grain" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="#0c1512" />
            <circle cx="1" cy="1" r="0.5" fill="rgb(255 255 255 / 0.025)" />
          </pattern>
          <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
          </filter>
          <radialGradient id="glow">
            <stop offset="0" stopColor="#c6ff3d" stopOpacity="0.55" />
            <stop offset="1" stopColor="#c6ff3d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#grain)" />

        {/* ---------- the field ---------- */}
        <g opacity={fieldA} style={{ pointerEvents: "none" }}>
          <rect x={1100} y={0} width={100} height={H} fill="rgb(198 255 61 / 0.05)" />
          <text x={1150} y={H / 2} fill="rgb(198 255 61 / 0.35)" fontFamily="var(--display)" fontSize="38" textAnchor="middle" transform={`rotate(90 1150 ${H / 2})`} letterSpacing="10">
            END ZONE
          </text>
          {lines.map((y) => (
            <g key={y}>
              <line x1={yard(y)} x2={yard(y)} y1={14} y2={H - 14} stroke="rgb(233 242 236 / 0.13)" strokeWidth={y % 10 === 0 ? 2 : 1} filter="url(#chalk)" />
              {y % 10 === 0 && y > 0 && (
                <text x={yard(y)} y={H - 26} fill="rgb(233 242 236 / 0.25)" fontSize="22" fontFamily="var(--display)" textAnchor="middle">
                  {y}
                </text>
              )}
            </g>
          ))}
          {Array.from({ length: 50 }, (_, i) => (
            <g key={i} stroke="rgb(233 242 236 / 0.12)">
              <line x1={yard(i)} x2={yard(i)} y1={196} y2={204} />
              <line x1={yard(i)} x2={yard(i)} y1={356} y2={364} />
            </g>
          ))}
          <line x1={500} x2={500} y1={20} y2={H - 20} stroke="#3dd6ff" strokeOpacity="0.5" strokeDasharray="6 6" />
          {/* routes, drawn as they are run */}
          {PLAYERS.map((p, i) => {
            if (p.side !== "o" || i < 5) return null;
            const k = ease(clamp((t - p.start) / p.dur));
            const len = 2000;
            const primary = i === TARGET;
            return (
              <path
                key={i}
                d={toD(p.path)}
                fill="none"
                stroke={primary ? "#c6ff3d" : "rgb(233 242 236 / 0.55)"}
                strokeWidth={primary ? 3.2 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${len}`}
                strokeDashoffset={len * (1 - k * 0.999)}
                filter="url(#chalk)"
                pathLength={len}
              />
            );
          })}
          {/* ball flight shadow + arc */}
          {t >= THROW && t < CATCH && (
            <path
              d={`M${playerAt(PLAYERS[QB], THROW).join(" ")} Q ${(playerAt(PLAYERS[QB], THROW)[0] + catchPt[0]) / 2} ${Math.min(playerAt(PLAYERS[QB], THROW)[1], catchPt[1]) - 120} ${catchPt.join(" ")}`}
              fill="none"
              stroke="rgb(255 211 107 / 0.35)"
              strokeDasharray="3 7"
            />
          )}
          {td && (
            <text x={1000} y={200} fill="#c6ff3d" fontFamily="var(--display)" fontSize="64" textAnchor="middle" opacity={clamp((t - 3.95) / 0.3) * fieldA} letterSpacing="4">
              TOUCHDOWN
            </text>
          )}
        </g>

        {/* ---------- the chart ---------- */}
        <g opacity={plotA}>
          <line x1={scale.x(0)} x2={scale.x(0)} y1={PY0 - 20} y2={PY1 + 10} stroke="rgb(233 242 236 / 0.22)" />
          <line x1={PX0 - 10} x2={PX1 + 20} y1={scale.y(0)} y2={scale.y(0)} stroke="rgb(233 242 236 / 0.22)" />
          <text x={PX1 + 20} y={PY1 + 34} textAnchor="end" fill="rgb(233 242 236 / 0.5)" fontSize="12" fontFamily="var(--mono)" letterSpacing="1.5">
            OFFENSE EPA / PLAY →
          </text>
          <text x={scale.x(0) + 10} y={PY0 - 8} fill="rgb(233 242 236 / 0.5)" fontSize="12" fontFamily="var(--mono)" letterSpacing="1.5">
            ↑ DEFENSE (EPA ALLOWED, LOWER IS BETTER)
          </text>
          <text x={PX1 + 10} y={PY0 + 20} textAnchor="end" fill="rgb(198 255 61 / 0.7)" fontSize="13" fontFamily="var(--display)" letterSpacing="2">
            GOOD O · GOOD D
          </text>
          <text x={PX0} y={PY1 + 34} fill="rgb(255 92 116 / 0.7)" fontSize="13" fontFamily="var(--display)" letterSpacing="2">
            BAD O · BAD D
          </text>
        </g>

        {/* ---------- players → teams ---------- */}
        {order.map((team, i) => {
          const p = PLAYERS[i];
          const tx = scale.x(team.off_epa);
          const ty = scale.y(team.def_epa);
          const color = dotColor(meta[team.team]);
          let x = tx, y = ty, a = 1, isO = true;
          if (p) {
            const [px, py] = playerAt(p, t);
            x = lerp(px, tx, m);
            y = lerp(py, ty, m);
            isO = p.side === "o";
            a = clamp(t / 0.5);
          } else {
            a = clamp((t - MORPH - 0.6) / 0.6);
          }
          const r = lerp(11, 9, m);
          const isHover = done && hover === team.team;
          return (
            <g
              key={team.team}
              transform={`translate(${x} ${y})`}
              opacity={a}
              style={{ cursor: done ? "pointer" : "default" }}
              onMouseEnter={() => done && setHover(team.team)}
              onMouseLeave={() => setHover(null)}
              onClick={() => done && router.push(`/teams/${team.team}`)}
            >
              {isO ? (
                <circle r={r} fill="none" stroke="#c6ff3d" strokeWidth={2.6} opacity={1 - m} />
              ) : (
                <path d="M-8 -8 L8 8 M8 -8 L-8 8" stroke="#3dd6ff" strokeWidth={2.8} strokeLinecap="round" opacity={1 - m} />
              )}
              <circle r={isHover ? 13 : r} fill={color} stroke="rgb(255 255 255 / 0.85)" strokeWidth={1.4} opacity={m} />
              <text x={labelPos[team.team].dx} y={labelPos[team.team].dy} textAnchor={labelPos[team.team].anchor} fontFamily="var(--mono)" fontSize="11" fill="rgb(233 242 236 / 0.8)" opacity={m} style={{ pointerEvents: "none" }}>
                {team.team}
              </text>
              {done && <circle r={18} fill="transparent" />}
            </g>
          );
        })}

        {/* ball */}
        {fieldA > 0 && (
          <g transform={`translate(${ball[0]} ${ball[1] - ballH * 60})`} opacity={fieldA}>
            {ballH > 0 && <circle r={26} fill="url(#glow)" />}
            <ellipse rx={7 + ballH * 3} ry={4.5 + ballH * 2} fill="#ffd36b" transform={`rotate(${t >= THROW && t < CATCH ? -12 : 0})`} />
          </g>
        )}
      </svg>

      {hovered && (
        <div className="tip" style={{ left: `${(scale.x(hovered.off_epa) / W) * 100}%`, top: `${(scale.y(hovered.def_epa) / H) * 100}%` }}>
          <b>{meta[hovered.team]?.team_name ?? hovered.team}</b>
          <span className="mono">
            {record(hovered)} · O {epa(hovered.off_epa)} · D {epa(hovered.def_epa)} · #{hovered.net_epa_rank} net
          </span>
        </div>
      )}
      <p className="board-cap">{t < MORPH ? "Every play has a value in expected points" : `${season} regular season · EPA per play · click a team`}</p>
      {done ? (
        <button className="replay" onClick={play}>
          ↻ Replay
        </button>
      ) : (
        <button className="replay" onClick={() => { cancelAnimationFrame(raf.current); setT(END); }}>
          Skip ›
        </button>
      )}
    </div>
  );
}
