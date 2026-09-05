import { Hono } from "hono";
import type { Bindings } from "../types";
import { readJsonBody } from "../lib/auth";
import { recordRun } from "../lib/runs";

const runs = new Hono<{ Bindings: Bindings }>();

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

  await recordRun(c.env, {
    registryKey: key,
    startedAt: body.started_at ?? new Date().toISOString(),
    ok: body.ok,
    expected: hasCoverage ? body.expected! : null,
    actual: hasCoverage ? body.actual! : null,
    summary: body.summary ?? null,
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
  const key = c.req.query("registry_key");
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
