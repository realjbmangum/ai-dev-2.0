/**
 * Watchy. The estate's watcher.
 *
 * It answers one question: is anything that is supposed to be running not running?
 *
 * WHY IT WORKS BY ABSENCE RATHER THAN BY ENUMERATION. The obvious design is to fetch
 * the live Claude routine list and diff it against the registry. That cannot work from
 * here: the routine API is OAuth-authenticated as Brian and a Worker holds no such
 * session. So every registered thing reports in after each run, and Watchy flags what
 * has gone quiet.
 *
 * That inversion turned out to be the better design anyway. On 2026-09-05, the two
 * genuinely dead things in this estate were `patriot-tidy` and `shipnotes`, and BOTH
 * were present and correct in their config. patriot-tidy was enabled, scheduled, and
 * had never produced a single run session. An enumeration diff would have reported it
 * healthy. Absence-detection catches it one grace period after registration.
 *
 * Watchy takes no action beyond writing findings. It is the one thing in the fleet that
 * ships enabled, because a watcher you have to remember to turn on is not a watcher.
 */

import type { Bindings, FindingKind, RegistryRow } from "../types";
import { readControl, isOn, num } from "./control";
import { recordRun } from "./runs";

const WATCHY_KEY = "estate:watchy";

export type WatchResult = {
  checked: number;
  healthy: number;
  opened: { key: string; kind: FindingKind; detail: string }[];
  closed: number;
  skipped: boolean;
};

/** Minutes between two SQLite datetime strings, treating them as UTC. */
function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  // SQLite writes "YYYY-MM-DD HH:MM:SS" with no zone. Normalise to an ISO instant.
  const normalised = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const t = Date.parse(normalised);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 60000;
}

export async function runWatchy(env: Bindings): Promise<WatchResult> {
  const control = await readControl(env);

  if (!isOn(control, "watchy_enabled")) {
    return { checked: 0, healthy: 0, opened: [], closed: 0, skipped: true };
  }

  const grace = num(control, "watchy_grace_multiplier", 1.5);

  const rows = await env.DB.prepare(
    `SELECT key, entity, role, property, room, source, schedule, trigger_id, worker_name,
            expected_every_minutes, status, first_run_at, last_run_at, confirmed_at, notes,
            created_at
       FROM registry
      WHERE status = 'active' AND expected_every_minutes IS NOT NULL`
  ).all<RegistryRow & { created_at: string }>();

  const registered = rows.results ?? [];
  const opened: WatchResult["opened"] = [];
  let healthy = 0;
  let examined = 0;

  for (const row of registered) {
    try {
      // A thing that has never reported is measured from when it was registered, so it
      // gets exactly one grace period to prove it works before it is called dead.
      const reference = row.last_run_at ?? row.created_at;
      const age = minutesSince(reference);
      const limit = (row.expected_every_minutes ?? 0) * grace;

      if (age !== null && age > limit) {
        const kind: FindingKind = row.last_run_at ? "overdue" : "never_ran";
        const detail = row.last_run_at
          ? `Last reported ${Math.round(age)} min ago; expected every ${row.expected_every_minutes} min.`
          : `Registered ${Math.round(age)} min ago and has never reported once. Expected every ${row.expected_every_minutes} min.`;
        const isNew = await openFinding(env, row.key, kind, detail);
        if (isNew) opened.push({ key: row.key, kind, detail });
      } else {
        healthy++;
        await closeFindings(env, row.key, ["overdue", "never_ran"]);
      }
      examined++;
    } catch (err) {
      // One row failing to evaluate must not abort the sweep. The gap between expected
      // and examined is what reports it.
      console.error("watchy could not evaluate", row.key, err);
    }
  }

  // Runs that reported in but reported trouble. Looks only at each key's newest run, so
  // a fixed problem clears rather than being rediscovered forever.
  const latest = await env.DB.prepare(
    `SELECT r.registry_key, r.ok, r.expected, r.actual, r.summary
       FROM agent_runs r
       JOIN (SELECT registry_key, MAX(started_at) AS m
               FROM agent_runs
              WHERE started_at >= datetime('now', '-7 days')
              GROUP BY registry_key) newest
         ON newest.registry_key = r.registry_key AND newest.m = r.started_at`
  ).all<{
    registry_key: string;
    ok: number;
    expected: number | null;
    actual: number | null;
    summary: string | null;
  }>();

  for (const r of latest.results ?? []) {
    if (!r.ok) {
      const detail = r.summary ?? "Reported ok = 0.";
      if (await openFinding(env, r.registry_key, "failing", detail)) {
        opened.push({ key: r.registry_key, kind: "failing", detail });
      }
    } else {
      await closeFindings(env, r.registry_key, ["failing"]);
    }

    // The finding the whole coverage rule exists for: it said it succeeded, and it did
    // less than it should have. This is the shape of the six-week SEO failure.
    if (r.expected !== null && r.actual !== null && r.actual < r.expected) {
      const detail = `Reported success while covering ${r.actual} of ${r.expected}.`;
      if (await openFinding(env, r.registry_key, "undercovered", detail)) {
        opened.push({ key: r.registry_key, kind: "undercovered", detail });
      }
    } else {
      await closeFindings(env, r.registry_key, ["undercovered"]);
    }
  }

  // Something reported under a key with no registry row. Not an error: the report is
  // kept and the gap is surfaced, because losing the evidence would be worse than
  // having an unexplained key.
  const strays = await env.DB.prepare(
    `SELECT DISTINCT r.registry_key
       FROM agent_runs r
       LEFT JOIN registry g ON g.key = r.registry_key
      WHERE g.key IS NULL AND r.started_at >= datetime('now', '-7 days')`
  ).all<{ registry_key: string }>();

  for (const s of strays.results ?? []) {
    const detail = `Reported a run under "${s.registry_key}", which is in no registry row.`;
    if (await openFinding(env, s.registry_key, "unregistered", detail)) {
      opened.push({ key: s.registry_key, kind: "unregistered", detail });
    }
  }

  const closed = await countOpenFindings(env);

  /*
   * Watchy reports on itself by the same rule as everything else, and getting the
   * semantics right here mattered: the first acceptance run opened an `undercovered`
   * finding against Watchy itself.
   *
   * The cause was reporting expected = registered, actual = HEALTHY. Those numbers meant
   * "3 of 5 registered things are healthy", but the undercovered rule reads any
   * actual < expected as "this job did less than it should have", so a fleet with two
   * sick members made the watcher look broken.
   *
   * Coverage means "did I check everything I was supposed to check", nothing else.
   * Whether the things it checked are healthy is what findings are for. So `actual` is
   * how many rows were successfully evaluated, and the health count lives in the summary.
   */
  await recordRun(env, {
    registryKey: WATCHY_KEY,
    startedAt: new Date().toISOString(),
    ok: true,
    expected: registered.length,
    actual: examined,
    summary:
      opened.length > 0
        ? `${opened.length} new finding(s); ${healthy} of ${registered.length} healthy.`
        : `${healthy} of ${registered.length} healthy.`,
    detail: opened.length > 0 ? opened : null,
  });

  if (opened.length > 0 && isOn(control, "notify_enabled")) {
    await notify(env, opened);
  }

  return { checked: registered.length, healthy, opened, closed, skipped: false };
}

/**
 * Open a finding, or bump an existing one. Returns true only when the finding is NEW,
 * because only a new finding is worth telling anyone about. A condition that has been
 * true for three days should read as one finding with a duration, not as 288 alerts.
 */
async function openFinding(
  env: Bindings,
  key: string,
  kind: FindingKind,
  detail: string
): Promise<boolean> {
  const existing = await env.DB.prepare(
    `SELECT id FROM findings WHERE registry_key = ? AND kind = ? AND closed_at IS NULL`
  )
    .bind(key, kind)
    .first<{ id: number }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE findings SET last_seen_at = datetime('now'), detail = ? WHERE id = ?`
    )
      .bind(detail, existing.id)
      .run();
    return false;
  }

  await env.DB.prepare(
    `INSERT INTO findings (registry_key, kind, detail) VALUES (?, ?, ?)`
  )
    .bind(key, kind, detail)
    .run();
  return true;
}

async function closeFindings(env: Bindings, key: string, kinds: FindingKind[]): Promise<void> {
  const placeholders = kinds.map(() => "?").join(",");
  await env.DB.prepare(
    `UPDATE findings SET closed_at = datetime('now')
      WHERE registry_key = ? AND closed_at IS NULL AND kind IN (${placeholders})`
  )
    .bind(key, ...kinds)
    .run();
}

async function countOpenFindings(env: Bindings): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM findings WHERE closed_at IS NULL`
  ).first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Outbound notification, gated on estate_control.notify_enabled, which ships off.
 *
 * Deliberately a plain webhook rather than mail: the estate has learned twice that a
 * bot which can send is a bot that can send the wrong thing, and this one only ever
 * needs to reach one person. notified_at is set only after the POST returns ok, so a
 * failed delivery is retried next cycle rather than silently marked as delivered.
 */
async function notify(env: Bindings, opened: WatchResult["opened"]): Promise<void> {
  if (!env.NOTIFY_URL) return;
  try {
    const res = await fetch(env.NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "estate-watchy/1" },
      body: JSON.stringify({
        source: "watchy",
        at: new Date().toISOString(),
        findings: opened,
      }),
    });
    if (!res.ok) return;
    for (const f of opened) {
      await env.DB.prepare(
        `UPDATE findings SET notified_at = datetime('now')
          WHERE registry_key = ? AND kind = ? AND closed_at IS NULL`
      )
        .bind(f.key, f.kind)
        .run();
    }
  } catch (err) {
    console.error("notify failed", err);
  }
}
