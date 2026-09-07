# The Estate

The tier above the individual project. It holds the registry of everything scheduled,
the run log everything reports to, the watcher, and (later) the role templates, voice
guides and the build-in-public event spine.

Standalone repo. It does not live in a monorepo and it never will.

## Why this exists

On 2026-09-05 an audit of 26 scheduled things across three unrelated execution rails
found two cloud routines that had never produced a single run, a local task that had
never fired, two lapsed domains, a client site returning 500, and a hand-maintained
roster that had drifted three times in three weeks while containing a rule saying it
must never be hand-maintained.

None of that was a bug in any one project. Every rule, registry and watcher had been
written inside a single repo, so it could only ever see that repo. Two systems ended up
tracking the same X account and reporting different follower counts on the same day,
neither aware of the other.

This repo is the tier that can see all of it.

## The shape

```
JB MANGUM          the narrative parent. jbmangum.com + @realjbmangum.
  ├── THE DIRECTORIES
  ├── CROWN AND COMPASS
  └── ASCEND SYSTEMS
```

There are two hierarchies over the same nodes and both are real. **Lighthouse 27 LLC is
the legal parent**, which is who owns what. **JB Mangum is the narrative parent**, which
is who tells whose story. A registry that models only one will be wrong for the other.

**The parent aggregates events, not content.** Each entity writes in its own voice for
its own audience, and none of that flows upward. What flows upward is what shipped, what
broke, and what the wrong assumption was. Crown and Compass writing as a contemplative
pilgrim is not JB Mangum material; the story of building Crown and Compass is.

Four flows: **events up, attention up, voice down, rules down.**

## The five laws

Each was written somewhere in this estate after a real failure, and each was obeyed by
exactly one repo before this one existed.

1. **Nothing runs unless it is in the registry, and the registry is generated.**
   A row's liveness comes only from a real report. The API refuses to accept
   `last_run_at`, so a registry row can never claim a liveness it has not demonstrated.

2. **Every run reports coverage, not success.** `expected` and `actual`, always, even
   when they match. `POST /api/runs` refuses a report without them; `no_unit: true` is
   the escape hatch, and it is deliberately noisier to type than the numbers are. The
   original lesson: the SEO cron returned `ok=true` every Monday for six weeks while
   covering 3 of 16 sites.

3. **Agents propose, humans dispose, and the gate is a status column.** Not a
   convention, not a line in a prompt. Autonomy grows by moving specific verbs between
   tiers deliberately, never by choosing once between gated and loose.

4. **Ground every claim, or produce nothing.** An empty result is a correct outcome; an
   invented one is the only real failure. Since agents draft freely here, the constraint
   is not "Brian supplied the input" but "the agent can cite a checkable source".

5. **Instructions are served, versioned and drift-checked, never embedded.** The repo is
   the source of truth; D1 is the serving copy; a GitHub Action pushes on merge so no
   human has to remember.

**The test every law must pass: if it needs a human to remember it, it has already
failed.**

## Hard rules

1. **Liveness is proven by a report, never by configuration.** The watcher works by
   absence, not by enumeration. See `docs/decisions/absence-not-enumeration.md`.

2. **An `active` row must carry `expected_every_minutes`.** An active thing the watcher
   cannot time is invisible, which is the exact hole this repo closes. The API refuses
   it. Use `planned` while you work out the cadence.

3. **A finding opens once and is bumped, never re-opened.** Only a NEW finding notifies.
   A condition true for three days is one finding with a duration, not 288 alerts.

4. **This database holds no client data.** No client name, no email address, no dollar
   amount, ever. The desk at app-jbmangum has the same rule and binds `jbmangum-desk`
   and `estate-db` only, never `ascend-db`. Ascend's work reaches the desk as a pointer
   ("3 leads quiet 9+ days, open the CRM"), never as a payload.

5. **Everything that can cause an action ships off.** `fleet_enabled` and `notify_enabled`
   are `0` in the seed. `watchy_enabled` is the one exception, because a watcher you have
   to remember to turn on is not a watcher.

6. **Read limits from `estate_control` at run time. Never hardcode one.** The point is
   that the fleet can be stopped with one SQL statement and no deploy.

7. **Secrets live in Cloudflare.** Config carries secret names only. Private is still not
   a place for secrets, because repos get opened.

8. **The API never becomes a general database passthrough.** Every verb it grows is trust
   spent.

9. **No drafting role is built before its voice guide exists.** Since agents draft
   freely, the guide is the safety system. A missing guide is a hard stop, not a warning.

10. **Naming: a short functional name ending in -y.** It is the display name, the
    `registry.role` value and the basename of the role's doc. Those three always match.

11. **One token per agent, and only its hash is stored.** An agent may report runs only
    under its own key: the token *is* the identity. Assume every agent token is already
    public, because it sits in a routine prompt and is echoed into that run's transcript.
    Admin (`ESTATE_TOKEN`) is a Cloudflare secret, never in a prompt, and is the only
    thing that may register, approve, reject or drive the watcher.

12. **A rejection needs a reason from the closed list.** `wrong_voice`, `already_said`,
    `not_true`, `too_thin`, `not_now`, `other`. One tap, so it survives a five-minute
    morning, and countable, so "six of your last ten were wrong_voice" is possible.
    Enforced in the route and again by a schema trigger.

13. **Words end at a human. Reversible data edits may auto-apply.** Content is red
    permanently, with no graduation path defined. An empty field filled from a checkable
    source, with before and after logged, is yellow after `min_age_hours`. The line is
    recoverability, not importance.

**A deliberate omission, so nobody "fixes" it:** there is no queue-depth backpressure.
It was considered and deferred until there is a month of real data, because a threshold
invented before the evidence is a number chosen to feel safe. See
`docs/decisions/no-backpressure-yet.md` for what would trigger revisiting.

## Vocabulary

Inherited whole from directory-machine, which got it right.

| Term | Means |
|---|---|
| Estate | Everything. This tier. |
| Entity | Directories, Crown and Compass, Ascend, JB Mangum. |
| Property | A thing an entity owns: patriot, recordstops, the C&C app. |
| Role | A job description written once, property-agnostic, with `{braces}`. |
| Hire | A role instantiated for one property on specific terms. One file. |
| Lever | A verb only a human fires. |
| Verb tier | green (propose) / yellow (auto, reversible) / red (staged) / none (forbidden). |
| Room | `field` = cloud routine, `cockpit` = a session on the Mac, `worker`, `action`. |

## Working here

```bash
cd worker
npm install
npm run typecheck
npm run migrate:local          # apply every migration to the local D1
bash ../scripts/acceptance-watchy.sh
```

The acceptance script is the real test. It sets up four registered things in four states
and asserts the watcher reaches the right verdict about each. It has already earned its
keep: on its first run it caught a semantic bug where Watchy reported the fleet's health
count as its own coverage number and opened a finding against itself.

## Session hygiene

- Ask before committing. Never push without asking.
- Commit messages are public raw material. Subject is the one-sentence summary; body
  carries the wrong assumption or the thing that broke, in plain prose. No client names,
  no email addresses, no dollar amounts.
- Log the session to `ascend-db.session_log`, project `routines-fleet`.
