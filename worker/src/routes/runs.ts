import { Hono } from "hono";
import type { Bindings, Vars } from "../types";
import { readJsonBody } from "../lib/auth";
import { recordRun } from "../lib/runs";

const runs = new Hono<{ Bindings: Bindings; Variables: Vars }>();

type PostBody = {
  registry_key?: string;
  ok?: boolean;
  expected?: number | null;
  actual?: number | null;
  /**
   * Explicit declaration that this work has no countable unit. Required to omit
   * expected/actual, so omission is always a decision somebody made rather than a field
   * somebody forgot. Forgetting is how the SEO cron reported success for six weeks.
   */
  no_unit?: boolean;
  summary?: string;
  detail?: unknown;
  started_at?: string;
};

/**
 * How every scheduled thing in the estate says what it did.
 *
 * The coverage pair is not optional by accident. A run that cannot say what it expected
 * cannot be checked by anything, so the API refuses the report rather than accepting a
 * half one. `no_unit: true` is the escape hatch, and it is deliberately noisier to type
 * than the numbers are.
 */
runs.post("/", async (c) => {
  let body: PostBody;
  try {
    body = await readJsonBody<PostBody>(c.req.raw);
  } catch {
    return c.json({ error: "body must be JSON and under 64KB" }, 400);
  }

  const key = (body.registry_key ?? "").trim();
  if (!key) {
    return c.json({ error: "registry_key is required, so every run is attributable" }, 400);
  }
  if (typeof body.ok !== "boolean") {
    return c.json({ error: "ok must be true or false" }, 400);
  }

  /*
   * An agent may only ever report as itself. Its token IS its identity, so this is not
   * a policy an agent could talk its way past: a mismatched key is refused before
   * anything is written.
   *
   * This is the whole reason per-agent tokens exist. Under one shared token, any agent
   * could report a run for any other agent, which made attribution in agent_runs a
   * convention rather than a fact, while the watcher's entire picture rested on it.
   * Admin (the desk, a cockpit session) may still write any key, because backfilling
   * and correcting is a human job.
   */
  const identity = c.get("identity");
  if (!identity.admin && identity.key !== key) {
    return c.json(
      { error: `this token may only report runs for "${identity.key}"` },
      403
    );
  }

  const hasCoverage =
    typeof body.expected === "number" && typeof body.actual === "number";

  if (!hasCoverage && body.no_unit !== true) {
    return c.json(
      {
        error:
          "expected and actual are both required. A run that cannot say what it expected cannot be checked. If this work genuinely has no countable unit, send no_unit: true and say so.",
      },
      400
    );
  }

  if (hasCoverage && (body.expected! < 0 || body.actual! < 0)) {
    return c.json({ error: "expected and actual must not be negative" }, 400);
  }

  /*
   * started_at is clamped, not trusted.
   *
   * Watchy picks each key's current run with MAX(started_at) over a TEXT column, so
   * SQLite orders it lexically. One report with started_at "9999-01-01T00:00:00Z" would
   * win that comparison forever, and every real failure afterwards would sort beneath a
   * row that says ok. A single request would permanently blind the watcher to that
   * agent, which defeats the entire point of the system.
   *
   * Agents are semi-trusted: they are models following instructions that web content
   * could have poisoned. So the value is accepted only when it is a real instant inside
   * a sane window, and otherwise silently replaced with server time. Rejecting outright
   * would let a confused agent lose its report; clamping keeps the report and discards
   * only the lie.
   */
  const nowMs = Date.now();
  let startedAt = new Date(nowMs).toISOString();
  if (typeof body.started_at === "string") {
    const t = Date.parse(body.started_at);
    if (!Number.isNaN(t) && t <= nowMs + 5 * 60_000 && t >= nowMs - 24 * 60 * 60_000) {
      startedAt = new Date(t).toISOString();
    }
  }

  await recordRun(c.env, {
    registryKey: key,
    startedAt,
    ok: body.ok,
    expected: hasCoverage ? body.expected! : null,
    actual: hasCoverage ? body.actual! : null,
    // Bounded like detail. "One human-readable line" does not need more, and an
    // unbounded TEXT column reachable by an authenticated loop is a way to fill D1.
    summary: typeof body.summary === "string" ? body.summary.slice(0, 500) : null,
    detail: body.detail,
  });

  return c.json({ ok: true, registry_key: key });
});

/**
 * Read side. Defaults to unhealthy only, because "show me everything" is a question
 * nobody asks twice and "what is wrong" is the one that matters. The second clause is
 * the important one: a run that reported success while covering less than it should.
 */
runs.get("/", async (c) => {
  const identity = c.get("identity");
  // An agent sees only its own history. Scoping by identity rather than by a query param
  // means the filter cannot be widened by omitting it, which is how this route
  // previously returned every other agent's summaries and detail blobs to any token.
  const key = identity.admin ? c.req.query("registry_key") : identity.key;
  const unhealthy = c.req.query("unhealthy") !== "false";
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50) || 50, 1), 200);

  const where: string[] = ["started_at >= datetime('now', '-30 days')"];
  const binds: unknown[] = [];

  if (key) {
    where.push("registry_key = ?");
    binds.push(key);
  }
  if (unhealthy) {
    where.push("(ok = 0 OR (expected IS NOT NULL AND actual IS NOT NULL AND actual < expected))");
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, registry_key, started_at, finished_at, ok, expected, actual, summary, detail
       FROM agent_runs
      WHERE ${where.join(" AND ")}
      ORDER BY started_at DESC
      LIMIT ?`
  )
    .bind(...binds, limit)
    .all();

  return c.json({ runs: rows.results ?? [] });
});

export default runs;
