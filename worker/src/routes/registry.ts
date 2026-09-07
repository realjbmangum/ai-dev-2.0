import { Hono } from "hono";
import type { Bindings, Vars } from "../types";
import { readJsonBody } from "../lib/auth";

const registry = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const ROOMS = new Set(["field", "cockpit", "worker", "action"]);
const SOURCES = new Set(["routine", "local_task", "worker_cron", "github_action"]);
const STATUSES = new Set(["planned", "active", "paused", "retired"]);

type UpsertBody = {
  key?: string;
  entity?: string;
  role?: string;
  property?: string | null;
  room?: string;
  source?: string;
  schedule?: string | null;
  trigger_id?: string | null;
  worker_name?: string | null;
  expected_every_minutes?: number | null;
  status?: string;
  notes?: string | null;
};

/**
 * What is supposed to exist, and whether it is currently keeping its promise.
 *
 * Admin only. The full listing enumerates every scheduled thing in the estate with its
 * trigger ids and worker names, which is an inventory an individual agent has no use
 * for and an attacker holding one leaked token would.
 */
registry.get("/", async (c) => {
  if (!c.get("identity").admin) {
    return c.json({ error: "the registry listing needs the estate token" }, 403);
  }
  const entity = c.req.query("entity");
  const where = entity ? "WHERE entity = ?" : "";
  const binds = entity ? [entity] : [];

  const rows = await c.env.DB.prepare(
    `SELECT key, entity, role, property, room, source, schedule, trigger_id, worker_name,
            expected_every_minutes, status, first_run_at, last_run_at, confirmed_at, notes,
            created_at, updated_at,
            CAST((julianday('now') - julianday(COALESCE(last_run_at, created_at))) * 1440 AS INTEGER)
              AS minutes_since_report
       FROM registry ${where}
      ORDER BY entity, role`
  )
    .bind(...binds)
    .all();

  return c.json({ registry: rows.results ?? [] });
});

/**
 * Register or update one thing. Upsert on key so re-running the seed is safe.
 *
 * Deliberately does NOT accept first_run_at or last_run_at. Those are written only by a
 * real report through POST /runs, so a registry row can never claim a liveness it has
 * not demonstrated. That is the difference between this table and the hand-maintained
 * roster it replaces, which drifted three times in three weeks precisely because it
 * could be told anything.
 */
registry.post("/", async (c) => {
  // Registering things is a human act. An agent that could edit the registry could
  // register itself, or quietly widen its own cadence so it stops looking overdue.
  if (!c.get("identity").admin) {
    return c.json({ error: "registering needs the estate token, not an agent token" }, 403);
  }

  let body: UpsertBody;
  try {
    body = await readJsonBody<UpsertBody>(c.req.raw);
  } catch {
    return c.json({ error: "body must be JSON and under 64KB" }, 400);
  }

  const key = (body.key ?? "").trim();
  const entity = (body.entity ?? "").trim();
  const role = (body.role ?? "").trim();

  if (!key || !entity || !role) {
    return c.json({ error: "key, entity and role are all required" }, 400);
  }

  const room = body.room ?? "field";
  const source = body.source ?? "";
  const status = body.status ?? "planned";

  if (!ROOMS.has(room)) {
    return c.json({ error: `room must be one of: ${[...ROOMS].join(", ")}` }, 400);
  }
  if (!SOURCES.has(source)) {
    return c.json({ error: `source must be one of: ${[...SOURCES].join(", ")}` }, 400);
  }
  if (!STATUSES.has(status)) {
    return c.json({ error: `status must be one of: ${[...STATUSES].join(", ")}` }, 400);
  }

  /*
   * An active thing with no expectation is invisible to the watcher, which is the exact
   * hole this system exists to close, so it is refused rather than accepted quietly.
   *
   * Cockpit work is the one honest exception. A procedure Brian runs by hand when he
   * wants it has no cadence to miss, and inventing one would manufacture overdue
   * findings for something that is behaving correctly by sitting still. The exception is
   * narrow on purpose: a FIELD agent with no cadence is still a bug, because a scheduled
   * thing that cannot be timed is precisely what went undetected for five days.
   */
  if (status === "active" && body.expected_every_minutes == null && room !== "cockpit") {
    return c.json(
      {
        error:
          "an active row needs expected_every_minutes, or the watcher can never tell that it stopped. Use status 'planned' while you work out the cadence, or room 'cockpit' if this is on-demand work with no schedule.",
      },
      400
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO registry
       (key, entity, role, property, room, source, schedule, trigger_id, worker_name,
        expected_every_minutes, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       entity                 = excluded.entity,
       role                   = excluded.role,
       property               = excluded.property,
       room                   = excluded.room,
       source                 = excluded.source,
       schedule               = excluded.schedule,
       trigger_id             = excluded.trigger_id,
       worker_name            = excluded.worker_name,
       expected_every_minutes = excluded.expected_every_minutes,
       status                 = excluded.status,
       notes                  = excluded.notes,
       updated_at             = datetime('now')`
  )
    .bind(
      key,
      entity,
      role,
      body.property ?? null,
      room,
      source,
      body.schedule ?? null,
      body.trigger_id ?? null,
      body.worker_name ?? null,
      body.expected_every_minutes ?? null,
      status,
      body.notes ?? null
    )
    .run();

  return c.json({ ok: true, key });
});

/**
 * Open findings, newest first. The answer to "what is wrong right now".
 *
 * Admin sees the fleet. An agent sees only findings against itself, because the full
 * list is a map of exactly which parts of the estate are currently broken and how long
 * they have been broken, which is reconnaissance rather than something an agent needs.
 */
registry.get("/findings", async (c) => {
  const identity = c.get("identity");
  const includeClosed = c.req.query("closed") === "true";
  const rows = await c.env.DB.prepare(
    `SELECT f.id, f.registry_key, f.kind, f.detail, f.opened_at, f.last_seen_at,
            f.closed_at, f.notified_at, r.entity, r.role, r.source, r.schedule
       FROM findings f
       LEFT JOIN registry r ON r.key = f.registry_key
      ${includeClosed ? "WHERE 1=1" : "WHERE f.closed_at IS NULL"}
      ${identity.admin ? "" : "AND f.registry_key = ?"}
      ORDER BY f.opened_at DESC
      LIMIT 200`
  )
    .bind(...(identity.admin ? [] : [identity.key]))
    .all();

  return c.json({ findings: rows.results ?? [] });
});

export default registry;
