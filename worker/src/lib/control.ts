/**
 * estate_control: runtime-read configuration, read fresh on every run.
 *
 * The point is that a limit can be changed, and the fleet stopped, with one SQL
 * statement and no deploy. ascend-systems has no equivalent, which is why its cron jobs
 * could not be paused when they misbehaved. From RecordStops' factory_control.
 *
 * Never cache these across runs, and never hardcode a value that lives here.
 */

import type { Bindings } from "../types";

export type Control = Record<string, string>;

export async function readControl(env: Bindings): Promise<Control> {
  const rows = await env.DB.prepare(`SELECT key, value FROM estate_control`).all<{
    key: string;
    value: string;
  }>();
  const out: Control = {};
  for (const r of rows.results ?? []) out[r.key] = r.value;
  return out;
}

/**
 * Missing reads as OFF, not as ON. A switch nobody has set has not been turned on, and
 * an unreadable control table must never be the reason something starts acting.
 */
export function isOn(control: Control, key: string): boolean {
  return control[key] === "1";
}

export function num(control: Control, key: string, fallback: number): number {
  const raw = control[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
