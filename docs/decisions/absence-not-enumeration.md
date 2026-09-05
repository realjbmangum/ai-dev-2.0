# Liveness by absence, not by enumeration

Decided 2026-09-05, building Watchy.

**The watcher never asks "does this exist". It asks "has this reported".**

## The design that does not work

The obvious approach is to fetch the live Claude routine list and diff it against the
registry. It fails for a mechanical reason and then, on inspection, for a better one.

The mechanical reason: the routine API is OAuth-authenticated as Brian. A Cloudflare
Worker holds no such session, and giving it one would mean storing a credential that can
create and delete routines inside an automation nobody reviews.

## The better reason

On 2026-09-05 the two genuinely dead things in this estate were `patriot-tidy` and the
`shipnotes` local task. Both were **present and correctly configured**. patriot-tidy was
enabled, had a Tuesday cron, had been created on 1 September, and had never produced a
single run session. shipnotes was enabled, had a daily cron, and had no `lastRunAt`
field at all.

An enumeration diff would have reported both healthy, because they *were* there. Only a
check that asks "has this reported" catches them.

Two more properties fell out of the inversion:

- **It covers all three rails identically.** Cloud routines, local Mac tasks and Worker
  crons all just POST. Enumeration would only ever have seen one rail, and the estate's
  problem was precisely that its three rails could not see each other.
- **A thing that cannot report is already broken.** Requiring the heartbeat makes the
  report the proof, rather than trusting a config file's word for it. That is the same
  argument as `confirmed_at` on `ascend-db.entities`: a row nobody has confirmed reads as
  unconfirmed, never as fact.

## What this costs, and where it goes

Absence-detection cannot see a routine that exists but was never registered. Nothing
reports for it, so nothing is missing. That gap is real and it is handled two ways:

1. `POST /api/runs` accepts a report from an unregistered key rather than rejecting it,
   and the watcher raises an `unregistered` finding. Losing the evidence would be worse
   than having an unexplained key.
2. Reconciling the registry against the live routine list is **cockpit work**, done by a
   human with an OAuth session, not the watcher's job. Seeding is the same.

## The grace period

A row that has never reported is measured from `created_at`, so it gets exactly one
grace period to prove it works before it is called dead. `watchy_grace_multiplier`
defaults to 1.5, which absorbs the scheduler's own jitter without hiding a real stall: a
daily job is late at 36 hours, not at 25.
