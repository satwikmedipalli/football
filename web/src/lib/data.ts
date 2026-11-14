import meta from "../../public/data/meta.json";
import t2025 from "../../public/data/teams_2025.json";
import t2026 from "../../public/data/teams_2026.json";
import fourthModel from "../../public/data/fourth_model.json";
import draftStudy from "../../public/data/draft_study.json";
import draftClass from "../../public/data/draft_class.json";

export type Team = {
  team: string;
  plays: number;
  off_epa: number;
  off_success: number;
  pass_epa: number;
  rush_epa: number;
  explosive: number;
  sacks_taken: number;
  neutral_pass_rate: number;
  proe: number;
  def_epa: number;
  def_success: number;
  def_pass_epa: number;
  def_rush_epa: number;
  sacks: number;
  takeaways: number;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  net_epa: number;
  net_epa_rank: number;
  off_epa_rank: number;
  def_epa_rank: number;
  off_success_rank: number;
  def_success_rank: number;
};

export type Fourth = {
  team: string;
  decisions: number;
  go: number;
  ep_lost: number;
  clear_calls: number;
  agreed: number;
  should_go: number;
  went_should_kick: number;
  agree_rate: number;
  ep_lost_rank: number;
};

export type Decision = {
  week: number;
  posteam: string;
  defteam: string;
  qtr: number;
  time: string;
  yardline_100: number;
  ydstogo: number;
  score_differential: number;
  desc: string;
  did: "go" | "fg" | "punt";
  rec: "go" | "fg" | "punt";
  margin: number;
  ep_lost: number;
  ep_go: number | null;
  ep_fg: number | null;
  ep_punt: number | null;
};

export type Swing = { week: number; posteam: string; defteam: string; qtr: number; time: string; desc: string; wpa: number; gain: number };

export type Season = {
  season: number;
  through_week: number;
  teams: Team[];
  fourth: Fourth[];
  fourth_examples: Record<string, Decision[]>;
  swings: Record<string, Swing[]>;
};

export type TeamMeta = { team_abbr: string; team_name: string; team_nick: string; team_conf: string; team_division: string; team_color: string; team_color2: string };

export const SEASONS = [t2025, t2026] as unknown as Season[];
export const LATEST_FULL = SEASONS[0];
export const META = meta as unknown as { built: string; seasons: { season: number; through_week: number }[]; teams: TeamMeta[]; draft_class: number };

const CURRENT = new Set(LATEST_FULL.teams.map((t) => t.team));
export const TEAMS: Record<string, TeamMeta> = Object.fromEntries(META.teams.filter((t) => CURRENT.has(t.team_abbr)).map((t) => [t.team_abbr, t]));
export const TEAM_IDS = [...CURRENT].sort();

export const FOURTH_MODEL = fourthModel as unknown as {
  fit_seasons: number[];
  conversion: { togo: number; p: number }[];
  fg: { distance: number; p: number }[];
  grid: { y: number; togo: number; rec: "go" | "fg" | "punt"; go: number; fg: number | null; punt: number | null }[];
  clear_margin: number;
};

type Scores = { auc: number; brier: number; log_loss: number; n: number; base_rate: number };
export const DRAFT_STUDY = draftStudy as unknown as {
  outcome: string;
  train_classes: [number, number];
  test_classes: [number, number];
  overall: { slot: Scores; combine: Scores };
  with_skip_flags: Scores;
  skip_rate_40: { era: number; rate: number }[];
  delta: { auc: number; auc_ci: [number, number]; brier: number; brier_ci: [number, number] };
  by_group: { group: string; slot: Scores; combine: Scores }[];
  drill_weights: Record<string, number>;
  by_round: { round: number; rate: number; n: number }[];
};

export type Comp = { name: string; season: number; pick: number; team: string; seasons_started: number; distance: number };
export type Prospect = {
  pick: number;
  round: number;
  team: string;
  pfr_player_id: string | null;
  pfr_player_name: string;
  position: string;
  group: string;
  college: string;
  slot_p: number;
  ht_in: number | null;
  wt: number | null;
  forty: number | null;
  bench: number | null;
  vertical: number | null;
  broad_jump: number | null;
  cone: number | null;
  shuttle: number | null;
  z_forty: number | null;
  z_wt: number | null;
  z_ht_in: number | null;
  z_bench: number | null;
  z_vertical: number | null;
  z_broad_jump: number | null;
  z_cone: number | null;
  z_shuttle: number | null;
  comps: Comp[];
};
export const DRAFT_CLASS = draftClass as unknown as { season: number; players: Prospect[] };

export function season(s: number) {
  return SEASONS.find((x) => x.season === s) ?? LATEST_FULL;
}
