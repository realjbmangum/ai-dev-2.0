import { Hono } from "hono";
import type { Bindings, Vars } from "../types";
import { readJsonBody } from "../lib/auth";

const events = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/**
 * ship_events: where a commit becomes something publishable.
 *
 * Three writers, three stages, each doing the part it is actually able to do.
 *
 *   POST /            A GitHub Action, the moment a commit lands on main.
 *   PATCH /:id        Loggy, once a day, doing the editorial pass.
 *   POST /:id/consume Blogy, once a week, claiming what it wrote about.
 *
 * The split is the design. Capture must never wait on judgement, because a
 * commit nobody captured is gone and no later run can recover it. Judgement
 * must not happen in a webhook, because deciding whether something is worth
 * telling means reading prose.
 */

/* ------------------------------------------------------------------ capture */

type CaptureBody = {
  repo?: string;
  entity?: string;
  property?: string | null;
  commits?: {
    sha?: string;
    message?: string;
    url?: string;
    timestamp?: string;
  }[];
};

const ENTITIES = new Set(["jbmangum", "directories", "crownandcompass", "ascend", "estate", "personal"]);

/** Commit subjects that describe the repository rather than the work. */
function isNoise(subject: string): boolean {
  const s = subject.toLowerCase();
  return (
    s.startsWith("merge branch") ||
    s.startsWith("merge pull request") ||
    s.startsWith("revert ") ||
    s === "wip" ||
    s.startsWith("wip ") ||
    s.startsWith("bump ") ||
    s.startsWith("chore(deps")
  );
}

/**
 * Record commits. Called by a GitHub Action on push to the default branch.
 *
 * Admin token only. This is not an agent reporting on itself, it is a
 * repository asserting that something happened, and the per-agent identity
 * check that governs run reports has nothing to say about it.
 */
events.post("/", async (c) => {
  const identity = c.get("identity");
  if (!identity.admin) {
    return c.json({ error: "recording an event needs the estate token" }, 403);
  }

  let body: CaptureBody;
  try {
    body = await readJsonBody<CaptureBody>(c.req.raw, 256 * 1024);
  } catch {
    return c.json({ error: "body must be JSON and under 256KB" }, 400);
  }

  const repo = (body.repo ?? "").trim();
  if (!repo.includes("/")) {
    return c.json({ error: "repo is required, as owner/name" }, 400);
  }

  const entity = (body.entity ?? "").trim();
  if (!ENTITIES.has(entity)) {
    return c.json({ error: `entity must be one of: ${[...ENTITIES].join(", ")}` }, 400);
  }
  const property = typeof body.property === "string" && body.property.trim() ? body.property.trim() : null;

  const commits = Array.isArray(body.commits) ? body.commits : [];
  if (commits.length === 0) {
    // A push with nothing in it is not an error. An Action firing on a tag or a
    // branch delete should get a clean 200 rather than a red cross in the repo.
    return c.json({ recorded: 0, skipped: 0, duplicate: 0 });
  }

  let recorded = 0;
  let skipped = 0;
  let duplicate = 0;

  for (const commit of commits.slice(0, 100)) {
    const sha = (commit.sha ?? "").trim();
    const message = (commit.message ?? "").trim();
    if (!sha || !message) {
      skipped++;
      continue;
    }

    // The subject is the first line; everything after the blank line is the body.
    // That split is git's own convention and the standing rule leans on it: the
    // subject is the one-sentence summary, the body carries the reasoning.
    const newline = message.indexOf("\n");
    const headline = (newline === -1 ? message : message.slice(0, newline)).trim().slice(0, 500);
    const rest = newline === -1 ? "" : message.slice(newline).trim();

    /*
     * Merge commits and dependency bumps are dropped at the door.
     *
     * They are facts about the repository, not about the work, and a merge
     * commit duplicates the subject of the branch it merges. Left in, the
     * weekly blog would read every feature twice: once as the commit and once
     * as "Merge pull request #3 from ...".
     */
    if (isNoise(headline)) {
      skipped++;
      continue;
    }

    /*
     * The commit body, minus the trailer block.
     *
     * Co-Authored-By and Signed-off-by lines are metadata that git puts in the
     * body, and leaving them in means every event carries an email address into
     * a database whose fourth hard rule is that it holds none.
     */
    const bodyText =
      rest
        .split("\n")
        .filter((line) => !/^(Co-Authored-By|Signed-off-by|Co-authored-by):/i.test(line.trim()))
        .join("\n")
        .trim()
        .slice(0, 20000) || null;

    const happenedAt =
      typeof commit.timestamp === "string" && !Number.isNaN(Date.parse(commit.timestamp))
        ? new Date(commit.timestamp).toISOString().replace("T", " ").slice(0, 19)
        : new Date().toISOString().replace("T", " ").slice(0, 19);

    const url = typeof commit.url === "string" ? commit.url.slice(0, 500) : null;

    /*
     * ON CONFLICT DO NOTHING against the partial unique index, with its
     * predicate repeated in the conflict target. SQLite refuses to match a
     * partial index otherwise and throws, and a throw here is a commit dropped
     * on the floor, which is the one failure this whole path exists to prevent.
     */
    const row = await c.env.DB.prepare(
      `INSERT INTO ship_events
         (entity, property, happened_at, headline, body, source_ref, source_url, repo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repo, source_ref) WHERE source_ref IS NOT NULL DO NOTHING
       RETURNING id`,
    )
      .bind(entity, property, happenedAt, headline, bodyText, sha.slice(0, 64), url, repo.slice(0, 200))
      .first<{ id: number }>();

    if (row) recorded++;
    else duplicate++;
  }

  return c.json({ recorded, skipped, duplicate });
});

/* ----------------------------------------------------------------- reading */

/**
 * What is waiting.
 *
 * `?state=unjudged` is Loggy's queue, `?state=publishable` is Blogy's. Default
 * unjudged, because that is the one with a daily deadline on it.
 */
events.get("/", async (c) => {
  const state = c.req.query("state") ?? "unjudged";
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);
  const since = c.req.query("since");

  let where: string;
  if (state === "unjudged") where = "publishable IS NULL";
  else if (state === "publishable") where = "publishable = 1 AND consumed_at IS NULL";
  else if (state === "held") where = "publishable = 0";
  else if (state === "consumed") where = "consumed_at IS NOT NULL";
  else return c.json({ error: "state must be unjudged, publishable, held or consumed" }, 400);

  const params: unknown[] = [];
  if (since) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      return c.json({ error: "since must be YYYY-MM-DD" }, 400);
    }
    where += " AND happened_at >= ?";
    params.push(since);
  }
  params.push(limit);

  const rows = await c.env.DB.prepare(
    `SELECT id, entity, property, happened_at, kind, headline, body, wrong_assumption,
            source_ref, source_url, repo, publishable, judged_at, consumed_at
       FROM ship_events
      WHERE ${where}
      ORDER BY happened_at ASC, id ASC
      LIMIT ?`,
  )
    .bind(...params)
    .all();

  /*
   * Oldest first, and a total that ignores the limit.
   *
   * A queue worked newest-first leaves its oldest item forever, and a reader
   * that cannot tell 50 of 50 from 50 of 300 will report having covered
   * everything. The same reasoning as the inbox route on the directory side.
   */
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ship_events WHERE ${where.replace(" AND happened_at >= ?", since ? " AND happened_at >= ?" : "")}`,
  )
    .bind(...(since ? [since] : []))
    .first<{ n: number }>();

  return c.json({
    state,
    count: rows.results.length,
    total_in_state: total?.n ?? rows.results.length,
    events: rows.results,
  });
});

/* --------------------------------------------------------------- judgement */

type JudgeBody = {
  kind?: string;
  publishable?: boolean;
  wrong_assumption?: string | null;
  judged_by?: string;
};

const KINDS = new Set(["shipped", "broke", "learned", "milestone"]);

/**
 * Loggy's pass: is this worth telling, and what was the wrong assumption.
 *
 * A judgement is final in the sense that it will not be asked for again, but it
 * is not immutable: a row already judged can be judged differently, because the
 * alternative is that one bad daily run permanently buries a week of work.
 */
events.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "bad id" }, 400);

  let body: JudgeBody;
  try {
    body = await readJsonBody<JudgeBody>(c.req.raw);
  } catch {
    return c.json({ error: "body must be JSON and under 64KB" }, 400);
  }

  if (typeof body.publishable !== "boolean") {
    return c.json(
      { error: "publishable must be true or false. Leaving it unset is not a judgement" },
      400,
    );
  }

  /*
   * A publishable event must say what kind it is and what the wrong assumption
   * was. Held events need neither: deciding not to write about something is a
   * complete decision on its own, and demanding a rationale for silence is how
   * a bot learns to publish everything rather than fill in a form.
   */
  if (body.publishable) {
    if (!KINDS.has(body.kind ?? "")) {
      return c.json({ error: `kind must be one of: ${[...KINDS].join(", ")}` }, 400);
    }
    const wrong = (body.wrong_assumption ?? "").trim();
    if (wrong.length < 15) {
      return c.json(
        {
          error:
            "a publishable event needs wrong_assumption: what was believed that turned out not to be true, or what broke. At least 15 characters. If there genuinely is not one, it is not publishable",
        },
        400,
      );
    }
  }

  const identity = c.get("identity");
  const by = (body.judged_by ?? identity.key ?? "unknown").slice(0, 64);

  const res = await c.env.DB.prepare(
    `UPDATE ship_events
        SET kind = ?, publishable = ?, wrong_assumption = ?,
            judged_at = datetime('now'), judged_by = ?
      WHERE id = ?`,
  )
    .bind(
      body.publishable ? (body.kind ?? null) : null,
      body.publishable ? 1 : 0,
      body.publishable ? (body.wrong_assumption ?? "").trim().slice(0, 4000) : null,
      by,
      id,
    )
    .run();

  if (!res.meta.changes) return c.json({ error: "no such event" }, 404);
  return c.json({ id, publishable: body.publishable, kind: body.publishable ? body.kind : null });
});

/* ---------------------------------------------------------------- consumed */

/**
 * Claim an event as written about.
 *
 * Separate from the judgement so a week that was drafted and then rejected can
 * be released again by clearing consumed_at, without touching whether the event
 * was ever worth telling.
 */
events.post("/:id/consume", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "bad id" }, 400);

  const identity = c.get("identity");
  const by = (identity.key ?? "unknown").slice(0, 64);

  const res = await c.env.DB.prepare(
    `UPDATE ship_events SET consumed_at = datetime('now'), consumed_by = ?
      WHERE id = ? AND publishable = 1 AND consumed_at IS NULL`,
  )
    .bind(by, id)
    .run();

  if (!res.meta.changes) {
    /*
     * Not an error. A second writer reaching the same event has lost a race it
     * did not know it was in, and the event is in exactly the state it wanted.
     * Returning 409 here would make an ordinary condition look like a fault.
     */
    return c.json({ consumed: false, id, reason: "already consumed, or not publishable" });
  }
  return c.json({ consumed: true, id });
});

export default events;
