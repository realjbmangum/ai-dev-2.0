import { Hono } from "hono";
import type { Bindings, Vars } from "../types";

const guides = new Hono<{ Bindings: Bindings; Variables: Vars }>();

/**
 * Voice guides, served to whatever is about to write something.
 *
 * The guides live in each entity's own repository, because the people editing a
 * brand's voice are editing that brand and a copy kept in the estate would
 * drift from the site it governs. A scheduled routine has no checkout and no
 * credential for a private repo, so it reads the serving copy here instead.
 *
 * Same shape as the spec endpoint on purpose: markdown in the body, provenance
 * in the headers. A drafting role fetches its guide the same way it fetches its
 * instructions, and both carry the SHA they came from.
 */

guides.get("/:entity/:surface", async (c) => {
  const entity = c.req.param("entity");
  const surface = c.req.param("surface");

  const row = await c.env.DB.prepare(
    `SELECT body, source_repo, source_path, source_sha, synced_at
       FROM guides WHERE entity = ? AND surface = ?`,
  )
    .bind(entity, surface)
    .first<{
      body: string;
      source_repo: string;
      source_path: string;
      source_sha: string | null;
      synced_at: string;
    }>();

  /*
   * A missing guide is a 404 with an instruction in it, not an empty 200.
   *
   * Hard rule 9 makes a missing guide a hard stop for any drafting role, so this
   * response is what makes the stop possible. A role that receives an empty body
   * and carries on is a role writing against no guide at all, which is the thing
   * the rule exists to prevent, and it would look like success from every angle.
   */
  if (!row) {
    return c.json(
      {
        error: `no voice guide for ${entity}/${surface}`,
        what_to_do:
          "Stop. Do not draft against no guide, and do not substitute another surface's guide. Report that the guide is missing and exit.",
      },
      404,
    );
  }

  return new Response(row.body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Guide-Repo": row.source_repo,
      "X-Guide-Path": row.source_path,
      "X-Guide-Sha": row.source_sha ?? "unknown",
      "X-Guide-Synced-At": row.synced_at,
    },
  });
});

/** What guides exist. For a human wondering what a new role could draft against. */
guides.get("/", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT entity, surface, source_repo, source_path, source_sha, synced_at,
            length(body) AS bytes
       FROM guides ORDER BY entity, surface`,
  ).all();
  return c.json({ count: rows.results.length, guides: rows.results });
});

export default guides;
