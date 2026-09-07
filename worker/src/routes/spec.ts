import { Hono } from "hono";
import type { Bindings, Vars } from "../types";

const spec = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/**
 * An agent's whole instruction set, composed at request time.
 *
 * Five parts, in this order: who you are, the role template, the hire terms, the access
 * table, and where your voice guide lives. Composing here rather than in the prompt means
 * editing one template reaches every hire at its next wake, while each property still
 * sets its own terms.
 *
 * An agent may only ever fetch its OWN spec. Reading another role's instructions is
 * neither useful to it nor its business, and scoping by identity rather than by a path
 * parameter means the request cannot be widened by changing the URL.
 */
spec.get("/:registry_key{.+}", async (c) => {
  const identity = c.get("identity");
  const requested = c.req.param("registry_key");

  if (!identity.admin && identity.key !== requested) {
    return c.json({ error: `this token may only fetch the spec for "${identity.key}"` }, 403);
  }

  const hire = await c.env.DB.prepare(
    `SELECT h.role, h.terms, h.source_sha AS hire_sha, h.synced_at AS hire_synced,
            r.entity, r.property, r.schedule, r.status
       FROM hires h JOIN registry r ON r.key = h.registry_key
      WHERE h.registry_key = ?`
  )
    .bind(requested)
    .first<{
      role: string;
      terms: string;
      hire_sha: string | null;
      hire_synced: string;
      entity: string;
      property: string | null;
      schedule: string | null;
      status: string;
    }>();

  if (!hire) {
    return c.json({ error: `no hire registered for "${requested}"` }, 404);
  }

  const role = await c.env.DB.prepare(
    `SELECT body, access, source_sha, synced_at FROM specs WHERE key = ?`
  )
    .bind(hire.role)
    .first<{ body: string; access: string | null; source_sha: string | null; synced_at: string }>();

  if (!role) {
    return c.json({ error: `no spec published for role "${hire.role}"` }, 404);
  }

  // Fill the placeholders the template leaves for a hire to decide. A missing value
  // becomes readable prose rather than a stray brace, so a half-filled hire produces a
  // sentence an agent can act on instead of a token it will copy verbatim.
  const filled = role.body
    .replaceAll("{registry_key}", requested)
    .replaceAll("{directory}", hire.property ?? hire.entity)
    .replaceAll("{entity}", hire.entity)
    .replaceAll("{cadence}", hire.schedule ?? "the schedule on your hire")
    .replaceAll("{batch}", "the batch size on your hire");

  const composed = [
    `You are \`${requested}\`. Use exactly that name in every report you write, because` +
      ` the run log threads by it.`,
    "",
    filled,
    "",
    "---",
    "",
    "# Your hire terms",
    "",
    hire.terms,
    "",
    "---",
    "",
    "# Access granted to this role",
    "",
    role.access ?? "_No access table published for this role. Treat that as read-only._",
  ].join("\n");

  return new Response(composed, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // The agent can see it is reading a stale copy, and is told to say so.
      "X-Spec-Sha": role.source_sha ?? "unknown",
      "X-Spec-Synced-At": role.synced_at,
      "X-Hire-Synced-At": hire.hire_synced,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
});

export default spec;
