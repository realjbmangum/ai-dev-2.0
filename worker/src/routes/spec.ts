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

  /*
   * The voice guide, looked up by PROPERTY first and entity only as a fallback.
   *
   * A directory's brand is its property, not its entity. The registry files both
   * Patriot and RecordStops under entity "directories", so an entity-keyed lookup
   * would have served RecordStops' agents Patriot's voice: "plainspoken and proud,
   * patriotic never partisan", on a record shop directory. That is not a near miss,
   * it is the entire brand, and it would have read as working.
   *
   * There is deliberately NO fallback from one property to a sibling. A missing
   * guide is a hard stop for any role that writes, and a sibling's voice is worse
   * than no voice, because no voice stops the run and the wrong voice ships.
   */
  const voiceSurface = hireValue(hire.terms, "voice");
  const voice = voiceSurface
    ? await c.env.DB.prepare(
        `SELECT body, source_repo, source_path, source_sha, synced_at
           FROM guides WHERE entity = ? AND surface = ?`
      )
        .bind(hire.property ?? hire.entity, voiceSurface)
        .first<{
          body: string;
          source_repo: string;
          source_path: string;
          source_sha: string | null;
          synced_at: string;
        }>()
    : null;

  // Fill the placeholders the template leaves for a hire to decide. A missing value
  // becomes readable prose rather than a stray brace, so a half-filled hire produces a
  // sentence an agent can act on instead of a token it will copy verbatim.
  const filled = role.body
    .replaceAll("{registry_key}", requested)
    .replaceAll("{directory}", hire.property ?? hire.entity)
    .replaceAll("{entity}", hire.entity)
    .replaceAll("{cadence}", hire.schedule ?? "the schedule on your hire")
    .replaceAll("{batch}", "the batch size on your hire")
    /*
     * The directory's own API base, read off the hire rather than written into
     * the template.
     *
     * The template had this as a literal https://patriot.directory, in six
     * places, which was invisible while one directory existed and became the
     * whole problem the moment a second one was hired: RecordStops' Mailroom
     * would have been handed instructions to call Patriot's API. With separate
     * tokens that is a 401 and a wasted run. If the tokens had ever been shared
     * it would have been an agent triaging the wrong directory's mail and
     * writing to the wrong directory's listings, which is the failure this
     * whole per-hire design exists to make impossible.
     *
     * "one template, every hire" is the PRD's central claim about how a second
     * directory costs nothing. A literal hostname in the template made that
     * claim false while appearing to hold.
     *
     * Falls back to the property's own domain rather than to Patriot's, because
     * a missing api block should break loudly for the hire that is missing it,
     * never silently point somebody at a directory that does exist.
     */
    .replaceAll("{directory_api}", directoryApi(hire.terms, hire.property));

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
    ...voiceSection(voiceSurface, voice, hire.property ?? hire.entity),
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

/**
 * The directory API base this hire is for, taken from its own terms.
 *
 * The hire carries an `api:` block whose `directory:` line is the base every
 * call in the composed spec should use. Parsed rather than templated because
 * the terms are markdown a person writes and reviews, and a hire that forgets
 * the line should be obvious rather than quietly inheriting somebody else's.
 */
function directoryApi(terms: string, property: string | null): string {
  // `m?.[1]` rather than `m[1]`: the capture group is typed as possibly absent
  // under noUncheckedIndexedAccess, and reading it unguarded is the one line in
  // this file that has ever failed a typecheck.
  const found = /^\s*directory:\s*(\S+)/m.exec(terms)?.[1];
  if (found) return found.replace(/\/+$/, "");
  // No api block. Say so in the text the agent reads, rather than guessing a
  // host: a wrong host is a run against somebody else's directory.
  return `[NO api.directory ON THE HIRE FOR ${property ?? "this property"}, STOP AND REPORT IT]`;
}

/**
 * Pull a `key: value` line out of a hire's terms.
 *
 * The terms are markdown a person writes and reviews, so this reads them the way
 * a person wrote them rather than demanding a parser-friendly format. A hire that
 * omits the line gets null and the caller decides what that means, which is the
 * only way a missing declaration can be made loud instead of defaulted away.
 */
function hireValue(terms: string, key: string): string | null {
  const found = new RegExp(`^\\s*${key}:\\s*(\\S+)`, "m").exec(terms)?.[1];
  return found ? found.trim() : null;
}

/**
 * The voice section, or the reason there isn't one.
 *
 * Three cases, and the third is the one that matters. A hire declaring no voice
 * gets no section, which is right for a role that only reads. A hire declaring a
 * surface that exists gets the guide. A hire declaring a surface with no guide
 * behind it gets an instruction to stop, in the spec itself, because an agent
 * that writes against no guide looks identical to one writing against a good one
 * right up until a person reads what it published.
 */
function voiceSection(
  surface: string | null,
  guide: { body: string; source_repo: string; source_path: string; source_sha: string | null } | null,
  brand: string
): string[] {
  if (!surface) return [];
  if (!guide) {
    return [
      "",
      "---",
      "",
      "# Voice",
      "",
      `STOP. Your hire declares \`voice: ${surface}\`, and no ${surface} guide is` +
        ` published for \`${brand}\`. Do not draft, enrich, or publish any text on this` +
        ` run. Report the run as failed with this as the reason, and exit. Writing in a` +
        ` voice nobody approved is worse than writing nothing, and a sibling property's` +
        ` guide is not a substitute.`,
    ];
  }
  return [
    "",
    "---",
    "",
    `# Voice — ${brand}, ${surface}`,
    "",
    `Source: \`${guide.source_repo}/${guide.source_path}\` at ${guide.source_sha ?? "unknown sha"}.`,
    "",
    guide.body,
  ];
}
