import { Hono } from "hono";
import type { Bindings, Vars } from "../types";
import { readJsonBody } from "../lib/auth";

const drafts = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const REJECTION_REASONS = [
  "wrong_voice",
  "already_said",
  "not_true",
  "too_thin",
  "not_now",
  "other",
] as const;

type PostBody = {
  entity?: string;
  kind?: string;
  title?: string;
  body?: string;
  source_note?: string;
};

/**
 * An agent proposes. It cannot approve, publish, or set any status at all: `status` is
 * not readable from the body, so there is no field to get wrong and no instruction an
 * agent could misread. Everything lands at needs_review.
 */
drafts.post("/", async (c) => {
  const identity = c.get("identity");
  if (!identity.key && !identity.admin) {
    return c.json({ error: "unknown caller" }, 403);
  }

  let body: PostBody;
  try {
    body = await readJsonBody<PostBody>(c.req.raw);
  } catch {
    return c.json({ error: "body must be JSON and under 64KB" }, 400);
  }

  const kind = (body.kind ?? "").trim();
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();

  if (!kind || !title || !text) {
    return c.json({ error: "kind, title and body are all required" }, 400);
  }

  /*
   * entity is derived from the caller's registry row, never read from the body.
   *
   * It used to be trusted from the request, which meant a poisoned Ascend agent could
   * post `{"entity":"crownandcompass"}` and inject content into the ministry's review
   * queue. The route was already scrupulous about registry_key for exactly this reason;
   * entity was the same class of field and was being handled differently.
   *
   * Admin may still state it, because backfilling is a human job.
   */
  let entity: string;
  if (identity.admin) {
    entity = (body.entity ?? "").trim();
    if (!entity) return c.json({ error: "admin must state the entity" }, 400);
  } else {
    const row = await c.env.DB.prepare(`SELECT entity FROM registry WHERE key = ?`)
      .bind(identity.key)
      .first<{ entity: string }>();
    if (!row) return c.json({ error: "caller is not in the registry" }, 403);
    entity = row.entity;
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO drafts (registry_key, entity, kind, title, body, source_note)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id`
  )
    .bind(identity.key ?? "admin", entity, kind, title, text, body.source_note ?? null)
    .first<{ id: number }>();

  return c.json({ ok: true, id: result?.id, status: "needs_review" });
});

/**
 * What Brian turned down, and why. Every drafting agent reads this BEFORE it writes.
 *
 * This endpoint exists because of a specific failure: between 8 and 14 August 2026, 39
 * of 42 drafts across the fleet were rejected and nothing changed between runs, because
 * a rejection recorded only status='rejected' and the reason stayed in Brian's head.
 * Every routine stayed exactly as good as it started.
 *
 * The body is truncated deliberately. An agent needs enough to recognise what it wrote,
 * not the whole rejected piece read back to it.
 */
drafts.get("/rejections", async (c) => {
  const identity = c.get("identity");
  // An agent sees only its own rejections. Reading another role's is neither useful nor
  // its business, and scoping by identity means the query cannot be widened by a param.
  const key = identity.admin ? c.req.query("registry_key") : identity.key;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 10) || 10, 1), 50);

  const where = ["status = 'rejected'", "rejection_reason IS NOT NULL"];
  const binds: unknown[] = [];
  if (key) {
    where.push("registry_key = ?");
    binds.push(key);
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, registry_key, kind, title, rejection_reason, rejection_note,
            substr(body, 1, 500) AS body_excerpt, reviewed_at
       FROM drafts
      WHERE ${where.join(" AND ")}
      ORDER BY reviewed_at DESC
      LIMIT ?`
  )
    .bind(...binds, limit)
    .all();

  // The counts are the sharper instruction. "Six of your last ten were wrong_voice" is
  // more actionable than six paragraphs, and it is only possible because the vocabulary
  // is closed rather than free text.
  const tally = await c.env.DB.prepare(
    `SELECT rejection_reason, COUNT(*) AS n
       FROM drafts
      WHERE status = 'rejected' AND rejection_reason IS NOT NULL
        ${key ? "AND registry_key = ?" : ""}
      GROUP BY rejection_reason ORDER BY n DESC`
  )
    .bind(...(key ? [key] : []))
    .all();

  return c.json({
    rejections: rows.results ?? [],
    counts: tally.results ?? [],
    reasons: REJECTION_REASONS,
  });
});

/**
 * The queue, for the desk to render.
 *
 * Scoped by identity, like /rejections. This route previously had no check at all, so
 * any agent token could read the full body of every draft in the estate, including
 * every other entity's unpublished work. It sits under the /api/* auth middleware, so
 * it was never public, but "authenticated" is not the same as "yours".
 */
drafts.get("/", async (c) => {
  const identity = c.get("identity");
  const status = c.req.query("status") ?? "needs_review";
  const entity = identity.admin ? c.req.query("entity") : null;
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50) || 50, 1), 200);

  const where = ["status = ?"];
  const binds: unknown[] = [status];
  if (entity) {
    where.push("entity = ?");
    binds.push(entity);
  }
  if (!identity.admin) {
    where.push("registry_key = ?");
    binds.push(identity.key);
  }

  const rows = await c.env.DB.prepare(
    `SELECT id, registry_key, entity, kind, title, body, source_note, status,
            rejection_reason, rejection_note, created_at, reviewed_at, published_at
       FROM drafts
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ?`
  )
    .bind(...binds, limit)
    .all();

  return c.json({ drafts: rows.results ?? [] });
});

/**
 * Brian's verdict. Admin only: the gate is the whole safety model, so an agent must not
 * be able to reach it even by accident.
 */
drafts.patch("/:id", async (c) => {
  if (!c.get("identity").admin) {
    return c.json({ error: "only a human sets a draft's status" }, 403);
  }

  let body: { status?: string; rejection_reason?: string; rejection_note?: string };
  try {
    body = await readJsonBody(c.req.raw);
  } catch {
    return c.json({ error: "body must be JSON and under 64KB" }, 400);
  }

  const id = Number(c.req.param("id"));
  const status = body.status ?? "";
  if (!["approved", "rejected", "published"].includes(status)) {
    return c.json({ error: "status must be approved, rejected or published" }, 400);
  }

  // A rejection with no reason carries no signal. Refused here and again by a trigger in
  // the schema, because the desk will not be the only thing that ever writes this table.
  if (status === "rejected") {
    const reason = body.rejection_reason ?? "";
    if (!REJECTION_REASONS.includes(reason as (typeof REJECTION_REASONS)[number])) {
      return c.json(
        { error: `rejection_reason must be one of: ${REJECTION_REASONS.join(", ")}` },
        400
      );
    }
  }

  await c.env.DB.prepare(
    `UPDATE drafts
        SET status = ?,
            rejection_reason = ?,
            rejection_note = ?,
            reviewed_at = datetime('now'),
            published_at = CASE WHEN ? = 'published' THEN datetime('now') ELSE published_at END
      WHERE id = ?`
  )
    .bind(
      status,
      status === "rejected" ? body.rejection_reason ?? null : null,
      status === "rejected" ? body.rejection_note ?? null : null,
      status,
      id
    )
    .run();

  return c.json({ ok: true, id, status });
});

export default drafts;
