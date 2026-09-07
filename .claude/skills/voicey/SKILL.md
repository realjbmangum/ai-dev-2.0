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
| `jbmangum/x` | `voice.md` | `jbmangum-inbox` | exists, and a duplicate needs killing |
| `crownandcompass/prose` | `brand/voice.md` | `site-crownandcompass` | exists |
| `crownandcompass/visual` | `brand/design-grammar.md` | `site-crownandcompass` | exists, on-disk copy is behind origin |
| `crownandcompass/app-ui` | `.impeccable.md` | `app-crownandcompass` | exists, design brief rather than voice |
| `crownandcompass/brand-standards` | `brand/brand-standards.md` | `site-crownandcompass` | **wrong**: names fonts the live site stopped using |
| `directories/patriot` | `directories/patriot/voice/tone.md` | `directory-machine` | exists |
| `directories/recordstops` | none yet | `site-recordstore-directory` | **missing** |
| `directories/potty` | none yet | `site-pottydirectory` | **missing** |
| `ascend/client-facing` | none yet | `site-ai-tech-co` | **missing**, blocks Salesy |

Three roles are blocked on this: Wordy and Designy on guides that exist but are wrong or
stale, Salesy on one that does not exist at all.

## The duplicate to resolve first

`jbmangum/x` has two guides in different repos, and they disagree in emphasis:

- `jbmangum-inbox/voice.md` — newer, better, and already states the parent-brand rule
- `site-jbmangum/crew/voice-profile.md` — orphaned from the deleted X Crew, and **not
  even tracked in git**

Keep the first. Salvage `crew/competitors.md` from the second, which is the only
competitor list anywhere in the estate. Delete the rest. This is not a Voicey run; it is
a decision that needs Brian, and it should happen before anything drafts against either.

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
