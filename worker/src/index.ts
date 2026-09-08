/**
 * estate-api. The spine every scheduled thing in the estate reports to.
 *
 * Two surfaces:
 *   fetch()     the bearer-gated API agents call
 *   scheduled() Watchy, every 15 minutes
 *
 * The API never becomes a general database passthrough. Every verb it grows is trust
 * spent, and the reason this exists at all is that headless agents have no browser
 * session and no wrangler, so HTTPS is their only route to the data.
 */

import { Hono } from "hono";
import type { Bindings, Vars } from "./types";
import { guard } from "./lib/auth";
import { runWatchy } from "./lib/watchy";
import { readControl } from "./lib/control";
import registryRoutes from "./routes/registry";
import runRoutes from "./routes/runs";
import draftRoutes from "./routes/drafts";
import specRoutes from "./routes/spec";
import eventRoutes from "./routes/events";

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/**
 * Liveness only, and deliberately unauthenticated: it says nothing about the estate.
 * Every route that reveals anything sits behind the guard below.
 */
app.get("/health", (c) =>
  c.json({ status: "ok", service: "estate-api", at: new Date().toISOString() })
);

// Everything under /api is rate limited, then authenticated, in that order. The
// resolved identity rides on the context so a route never re-derives who is calling.
app.use("/api/*", async (c, next) => {
  const g = await guard(c.req.raw, c.env);
  if (!g.ok) return g.response;
  c.set("identity", g.identity);
  await next();
});

/** Routes only Brian, the desk, or a cockpit session may reach. */
const adminOnly = async (c: any, next: any) => {
  if (!c.get("identity")?.admin) {
    return c.json({ error: "this route needs the estate token, not an agent token" }, 403);
  }
  await next();
};

app.route("/api/registry", registryRoutes);
app.route("/api/runs", runRoutes);
app.route("/api/drafts", draftRoutes);
app.route("/api/spec", specRoutes);
app.route("/api/events", eventRoutes);

/**
 * What an agent reads at the top of its run: the switches it must obey, and how much of
 * the fleet is currently in trouble. One call, so no agent has a reason to skip it.
 */
app.get("/api/state", async (c) => {
  const control = await readControl(c.env);

  const counts = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM registry WHERE status = 'active')      AS active,
       (SELECT COUNT(*) FROM registry WHERE status = 'planned')     AS planned,
       (SELECT COUNT(*) FROM findings WHERE closed_at IS NULL)      AS open_findings,
       (SELECT COUNT(*) FROM registry
         WHERE status = 'active' AND first_run_at IS NULL)          AS never_ran`
  ).first();

  return c.json({
    control,
    counts,
    // Precomputed so no agent has to decide for itself what "nothing to report" means,
    // and so all clear means the same thing every time it is said.
    all_clear: (counts?.open_findings ?? 0) === 0,
    at: new Date().toISOString(),
  });
});

/** Run Watchy on demand, for the acceptance test and for a cockpit session. */
app.post("/api/watchy/run", adminOnly, async (c) => {
  const result = await runWatchy(c.env);
  return c.json(result);
});

app.all("*", (c) => c.json({ error: "not found" }, 404));

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    /*
     * Housekeeping, on a fixed cadence rather than in the request path.
     *
     * The rate-limit prune used to be inline, gated on "one request in fifty". That only
     * fires above 50 requests a minute, so a quiet fleet never reached it and the table
     * grew forever. agent_runs needs the same treatment for the same reason: the read
     * window is 30 days, so rows older than that are dead weight nothing ever looks at.
     */
    ctx.waitUntil(
      (async () => {
        try {
          const minute = Math.floor(Date.now() / 60000);
          await env.DB.prepare(`DELETE FROM rate_limit WHERE window_start < ?`)
            .bind(minute - 5)
            .run();
          await env.DB.prepare(
            `DELETE FROM agent_runs WHERE started_at < datetime('now', '-45 days')`
          ).run();
          // A finding closed long ago has served its purpose; the run log carries the history.
          await env.DB.prepare(
            `DELETE FROM findings WHERE closed_at IS NOT NULL AND closed_at < datetime('now', '-90 days')`
          ).run();
        } catch (err) {
          // Housekeeping must never be the reason a watch cycle fails.
          console.error("housekeeping failed", err);
        }
      })()
    );

    ctx.waitUntil(
      runWatchy(env).catch((err) => {
        // Watchy failing silently would be the same class of bug it exists to catch, so
        // the error is logged loudly. It still writes its own agent_runs row via
        // recordRun, which never throws.
        console.error("watchy failed", err);
      })
    );
  },
};
