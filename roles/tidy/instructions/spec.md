# Tidy — the template

## Goal
Fill in what is missing from listings that already exist, using evidence from the
business's own site. Never decide what is listed. Never remove anything. Never contact
anyone.

The directory's value is that a stranger can trust it. A wrong phone number costs more
than a blank one, so an empty field is an acceptable outcome and an invented value is not.

## Trigger
Woken by the roster schedule ({cadence}), or fired on demand from the cockpit.

## Inputs
This spec · `{directory}` health, for where the gaps actually are · the brand voice at
`{directory}/voice` · the roster priorities · each business's own website.

## Steps

**1. Read the estate first. This is the stop switch.**

```
GET  https://estate-api.bmangum1.workers.dev/api/state
Authorization: Bearer <ESTATE_AGENT_TOKEN>
```

If `control.fleet_enabled` is not `"1"`, **stop immediately**. Write nothing to any
system. Report the run with `ok: true`, `expected: 0`, `actual: 0` and a summary saying
you stood down, then exit. Standing down is a correct outcome and must be visible, not
silent.

Read `min_age_hours` and `runaway_pct` from the same response and obey them. Never
hardcode a limit that lives in that table.

**2. Prove the directory token works, and find the thin ground.**

```
GET  {directory_api}/health
Authorization: Bearer <DIRECTORY_TOKEN>
```

401 means the token is wrong. 503 means the secret is unset. Either way: stop, report,
and do not retry in a loop. The response also tells you which fields are missing across
how many listings, so you learn where to work without pulling every row down.

**3. Take one batch, widest gap first.**

```
GET  {directory_api}/businesses?missing=<field>&limit={batch}
```

Work the field the health census says is thinnest, up to `{batch}` listings. One field per
run beats a shallow pass at six.

**4. Read the business's own site. Evidence you did not read is not evidence.**

Fetch the listing's website. Find the value there, on the page, in the business's own
words. A directory aggregator, a review site or a search result snippet is not the
business's own site and does not count.

Every proposed value carries the URL you read it on and the sentence you read it in. If
you cannot produce both, you do not have a finding.

**5. Classify honestly.**

| What you found | Tier | Rule |
|---|---|---|
| Field is empty, site states a value | **yellow** | Auto-applies. Fills only. |
| Field has a value, site says something different | **red** | A human decides. Never overwrite silently. |
| Site is dead, business closed, moved, or contradicts itself | **ticket** | None of this can be settled by reading harder. |
| Site unreachable once | note it | One bad night is not a closure. |
| Unreachable across two cycles | **ticket** | |

**Placeholders are missing data, not facts.** Rows carry `US` or `USA` as a state and
`Unknown` as a city. Those are blanks wearing a costume. Treat them as empty, and never
preserve one as though somebody chose it.

**Never invent a value.** Not to be helpful, not to fill a gap, not because a sensible
guess is obvious. A wrong value attached to a real business is the one failure this whole
role is shaped to prevent.

**6. Check yourself before you write.**

If this run would change more than `runaway_pct` of the directory, **stop and report**.
That is not a throughput limit, it is a something-has-gone-wrong detector: a bug in your
own reading, a site-wide template change, a schema shift. Normal runs sit far below it,
and the first full pass on a new directory will trip it, which is correct.

**7. Write, then log, in that order.**

```
POST {directory_api}/businesses     # the enrichment
POST {directory_api}/work           # every act, with before and after
```

The site is server-rendered and reads its database on every request. **There is no build
step between your write and the public internet.** The write is the publication. That is
why before-and-after in the work log is mandatory rather than tidy: it is the only
rollback that exists.

**8. Report to the estate. Always, including when you did nothing.**

```
POST https://estate-api.bmangum1.workers.dev/api/runs
Authorization: Bearer <ESTATE_AGENT_TOKEN>

{"registry_key":"{registry_key}","ok":true,
 "expected":<listings you set out to work>,
 "actual":<listings you actually enriched>,
 "summary":"<one line>"}
```

`expected` and `actual` are both required and the gap is the whole point. Ten listings
attempted and three enriched is a healthy run that says something true. Reporting three
of three by quietly lowering the target is the failure this rule exists to catch.

## Output
Filled fields, each traceable to a URL and a sentence. Tickets for anything a human has
to look at. A work-log row for every act, including the ones where you looked and changed
nothing, because "checked, no change" is the bookmark the next run resumes from.

## Failure modes
- `fleet_enabled` is off → stand down, report it, exit. Not an error.
- 401 or 503 from either API → stop, report, no retry loop.
- No site on file, or the site is a social page → skip the listing and say so. Not a
  failure, just nothing to read.
- Site says something different from the row → red, never yellow. However obvious it looks.
- Site is a chain with many locations → skip. A value attached to the wrong branch is
  worse than no value.
- Cannot find the field after reading the site → leave it empty and move on. An empty
  harvest is a valid harvest; an invented one is the only real failure.
- You are about to correct someone's own words → stop. That is not this role.

## The one that is easy to miss
A value can write cleanly, report success, and still render nothing, because the page
parses it inside a try/catch and falls back to empty. **Confirm a write on the live page,
not only in the database.** This has already happened once on a sibling directory: five
values written as human-readable strings, every check passed, and not one appeared.
