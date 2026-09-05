/**
 * Records what every scheduled thing actually did, so failures stop being invisible.
 * See db/migrations/0002-runs.sql for the why.
 *
 * The rule this enforces: a run reports COVERAGE, not just success. The SEO cron in
 * ascend-systems returned ok=true every Monday for six weeks while silently covering 3
 * of 16 sites, because nothing compared what it processed against what it should have
 * processed. Pass `expected` and `actual` even when they match. A run that cannot say
 * what it expected cannot be checked by anything.
 */

import type { Bindings } from "../types";

export type RunInput = {
  registryKey: string;
  startedAt: string;
  ok: boolean;
  /** Items that should have produced a result. Omit only for work with no unit. */
  expected?: number | null;
  /** Items that actually did. */
  actual?: number | null;
  summary?: string | null;
  /** Anything structured worth keeping. Serialised and bounded. */
  detail?: unknown;
};

/**
 * Never throws. A monitoring write that breaks the thing it monitors is worse than no
 * monitoring, so failures here go to console and are swallowed.
 */
export async function recordRun(env: Bindings, input: RunInput): Promise<void> {
  try {
    let detail: string | null = null;
    if (input.detail !== undefined && input.detail !== null) {
      // Bounded: D1 rows are cheap but not free, and nothing downstream needs more than
      // a few KB of notes to tell you what broke.
      detail = JSON.stringify(input.detail).slice(0, 8000);
    }

    // Collapse an unchanged repeat into the existing row rather than adding another.
    // In ascend-systems, stripe-sync fired every 15 minutes with 17 unmatched invoices
    // for months and wrote ~96 identical rows a day, which is precisely the noise this
    // table exists to prevent. A persistent condition should read as one row with a
    // duration, not ninety-six rows.
    //
    // `detail` is deliberately excluded from the identity check: it varies harmlessly
    // (timestamps, ordering) while the condition it describes is unchanged.
    const last = await env.DB.prepare(
      `SELECT id, ok, expected, actual, summary FROM agent_runs
       WHERE registry_key = ? ORDER BY started_at DESC LIMIT 1`
    )
      .bind(input.registryKey)
      .first<{
        id: number;
        ok: number;
        expected: number | null;
        actual: number | null;
        summary: string | null;
      }>();

    const unchanged =
      last &&
      last.ok === (input.ok ? 1 : 0) &&
      last.expected === (input.expected ?? null) &&
      last.actual === (input.actual ?? null) &&
      last.summary === (input.summary ?? null);

    if (unchanged) {
      // finished_at becomes "still true as of", so the row shows how long this state
      // has persisted.
      await env.DB.prepare(`UPDATE agent_runs SET finished_at = datetime('now') WHERE id = ?`)
        .bind(last!.id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO agent_runs
           (registry_key, started_at, finished_at, ok, expected, actual, summary, detail)
         VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)`
      )
        .bind(
          input.registryKey,
          input.startedAt,
          input.ok ? 1 : 0,
          input.expected ?? null,
          input.actual ?? null,
          input.summary ?? null,
          detail
        )
        .run();
    }

    // The heartbeat. first_run_at is set once and never moved, because "has this ever
    // worked" is a different question from "is it working now", and it is the one that
    // catches something that was born broken.
    await env.DB.prepare(
      `UPDATE registry
         SET last_run_at   = datetime('now'),
             first_run_at  = COALESCE(first_run_at, datetime('now')),
             updated_at    = datetime('now')
       WHERE key = ?`
    )
      .bind(input.registryKey)
      .run();
  } catch (err) {
    console.error("recordRun failed", err);
  }
}

/**
 * Wraps a job so it records itself whether it succeeds, fails, or throws.
 *
 * `describe` turns the job's own return value into coverage numbers, which is where the
 * useful signal lives: the job already knows what it expected. It may return null to
 * mean "this run is not worth a row", for high-frequency jobs that usually no-op. A run
 * that THROWS is always recorded, regardless of what describe would have said.
 */
export async function runTracked<T>(
  env: Bindings,
  registryKey: string,
  fn: () => Promise<T>,
  describe: (result: T) => Omit<RunInput, "registryKey" | "startedAt"> | null
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    const result = await fn();
    const described = describe(result);
    if (described) await recordRun(env, { registryKey, startedAt, ...described });
  } catch (err) {
    await recordRun(env, {
      registryKey,
      startedAt,
      ok: false,
      summary: err instanceof Error ? err.message : String(err),
    });
  }
}
