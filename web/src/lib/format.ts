export const epa = (x: number | null | undefined, d = 2) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`);
export const pct = (x: number | null | undefined, d = 0) => (x == null ? "–" : `${(x * 100).toFixed(d)}%`);
export const signedPct = (x: number | null | undefined, d = 1) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}%`);
export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
export const record = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
export const fieldPos = (y: number) => (y === 50 ? "midfield" : y > 50 ? `own ${100 - y}` : `opp ${y}`);
export const OPTION = { go: "Go for it", fg: "Field goal", punt: "Punt" } as const;
export const height = (inches: number | null) => (inches == null ? "–" : `${Math.floor(inches / 12)}′${Math.round(inches % 12)}″`);
