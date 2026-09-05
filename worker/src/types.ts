export type Bindings = {
  DB: D1Database;
  /** Bearer for every /api route. Minimum 32 chars, enforced in lib/auth.ts. */
  ESTATE_TOKEN?: string;
  /** Optional outbound webhook for findings. Gated on estate_control.notify_enabled. */
  NOTIFY_URL?: string;
};

export type RegistryRow = {
  key: string;
  entity: string;
  role: string;
  property: string | null;
  room: string;
  source: string;
  schedule: string | null;
  trigger_id: string | null;
  worker_name: string | null;
  expected_every_minutes: number | null;
  status: "planned" | "active" | "paused" | "retired";
  first_run_at: string | null;
  last_run_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
};

export type FindingKind =
  | "overdue"
  | "never_ran"
  | "undercovered"
  | "failing"
  | "unregistered";
