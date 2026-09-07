---
name: voicey
description: Draft the voice guide for a surface that has none, derived from what has actually shipped there. Use when a drafting agent is blocked on a missing or wrong voice guide, or when the user says "run voicey", "voicey <surface>", or asks for a voice guide for an entity or surface.
---

# Voicey

**The method lives in `roles/voicey/instructions/spec.md`. Read it first and follow it
exactly.** This file is the launcher: what surfaces exist, where their guides go, and how
to open the pull request. It deliberately does not restate the method, because two copies
of a rule is how a rule drifts.

Access table: `roles/voicey/access.md`. The short version is that Voicey opens a pull
request and never merges, and never touches a guide that already exists.

## Usage

```
run voicey ascend/client-facing
run voicey directories/recordstops
```

If no surface is named, print the table below and ask which one.

## The surfaces

Status as of 2026-09-06. **Verify before trusting this table**: check the path yourself,
because a status with no date beside it is not a fact, and this table is exactly the kind
of thing that rots.

| Surface | Guide path | Repo | Status |
|---|---|---|---|
| `jbmangum/blog` | `voice-guide.md` | `site-jbmangum` | exists |
| `jbmangum/x` | `voice.md` | `jbmangum-inbox` | exists, sole copy since 6 Sep |
| `crownandcompass/prose` | `brand/voice.md` | `site-crownandcompass` | exists |
| `crownandcompass/visual` | `brand/design-grammar.md` | `site-crownandcompass` | exists, in sync since 6 Sep |
| `crownandcompass/app-ui` | `.impeccable.md` | `app-crownandcompass` | exists, design brief rather than voice |
| `crownandcompass/brand-standards` | `brand/brand-standards.md` | `site-crownandcompass` | rewritten 6 Sep, PR #21 |
| `directories/patriot` | `directories/patriot/voice/tone.md` | `directory-machine` | exists |
| `directories/recordstops` | none yet | `site-recordstore-directory` | **missing** |
| `directories/potty` | none yet | `site-pottydirectory` | **missing** |
| `ascend/client-facing` | `brand/voice.md` | `site-ai-tech-co` | derived 6 Sep from 64 samples, PR #75 |

**Wordy, Designy and Salesy are unblocked** as of 6 September. The only guides still
missing are the two directory properties, and no role is waiting on either.

Two lessons from those three runs, worth carrying into the next one:

**A wrong guide beats a missing one at hiding.** Crown and Compass' brand standards
described a dark palette the site had abandoned, and it survived six months because the
rebuild kept the old CSS variable names as compat aliases. Every name still resolved,
just to the opposite value, so code written from the doc looked correct and rendered
inverted. When checking a surface, compare against what is **served**, not against what
the repo says.

**Check for a second document giving the same direction.** Ascend's brand kit described a
different company entirely. Crown and Compass' standards carried image prompts that
contradicted its own design grammar. In both cases the fix was to name the winner in
writing rather than quietly update the loser, because otherwise somebody restores the
aspiration later and it looks like a correction.

## The X duplicate: resolved 2026-09-06

`jbmangum/x` used to have two guides in different repos that disagreed in emphasis.
`site-jbmangum/crew/voice-profile.md`, orphaned from the deleted X Crew and never tracked
in git, has been deleted. **`jbmangum-inbox/voice.md` is now the only X voice guide.**

Before deleting, the surviving guide was checked against it and is a superset: the
BotBase take, the 63-view post, the 295-follower baseline, the 3,175 post count, the
patterns section and the duct-tape line are all already in it. Only a passing mention of
a Charlotte HVAC demo was unique, and that is not worth a second source of truth.

`crew/competitors.md` was salvaged to `jbmangum-inbox/competitors.md`. It is the only
competitor list in the estate and nothing else names those five accounts.

Two stale pointers survive and are harmless history rather than live guidance:
`crew/README.md` describes the retired X Crew, and `jbmangum-inbox/voice.md` carries a
provenance line saying it was adapted from the file that is now gone. Provenance about a
deleted source is still true.

## Opening the pull request

Work in the entity's own repo, never here. The guide belongs where the work is, so it
gets edited in context; the estate only serves a copy.

```bash
cd <the entity repo>
git checkout -b voice/<surface>
# write the single guide file
git add <guide path>
git commit
gh pr create --title "voice(<surface>): derive a guide from what actually shipped" --body "..."
```

One file, one branch, nothing else touched. Say what it was derived from and how many
samples, in the PR body, so the reviewer can judge it without reading the diff twice.

## Reporting the run

```
POST https://estate-api.bmangum1.workers.dev/api/runs
Authorization: Bearer <ESTATE_TOKEN>
Content-Type: application/json

{"registry_key":"estate:voicey","ok":true,"expected":<samples sought>,
 "actual":<samples actually read>,"summary":"<surface>: guide drafted, PR #N"}
```

`expected` and `actual` are both required and the gap is the point. A run that read four
of the eight samples it wanted still reports, with `actual` at four, and that gap is the
honest signal that the guide rests on thin evidence.

The token is in `.secrets/ESTATE_TOKEN`, which is gitignored. Never paste it into a file,
a commit, or a PR body.

## Before you start

Read `CLAUDE.md` at the repo root. The five laws and the thirteen hard rules apply to
this run like any other, and rule 9 is the one that put Voicey first: no drafting role is
built before its voice guide exists.
