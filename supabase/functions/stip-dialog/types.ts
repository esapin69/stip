import type { AgentLike } from "./people.ts";

export type Agent = AgentLike & {
  source_key?: string | null;
  prenom?: string | null;
  nom?: string | null;
  ghe?: string | null;
  equipe?: string | null;
  type_planning?: string | null;
  role?: string | null;
  telephone?: string | null;
  email?: string | null;
  profile_photo_url?: string | null;
  avatar_url?: string | null;
  nickname?: string | null;
  can_message?: boolean;
};

export type SessionCtx = {
  agent: Agent;
  level: "visitor" | "pro";
  team: string;
  permissions: Record<string, unknown>;
};

export type ShiftDef = {
  code: string;
  label: string;
  start_time: string;
  end_time: string;
  base_shift?: string;
  schedule_mode?: "fixed" | "flexible";
  duration_minutes?: number;
  window_start?: string;
  window_end?: string;
  special?: boolean;
  exchangeable?: boolean;
};

export type Card = Record<string, unknown>;
export type Action = Record<string, unknown>;
export type DialogResponse = {
  kind: string;
  title: string;
  text: string;
  cards?: Card[];
  actions?: Action[];
  context?: Record<string, unknown>;
  suggestions?: string[];
};
