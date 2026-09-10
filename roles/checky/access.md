# Checky: access

| Verb | Tier |
| --- | --- |
| read (health, listings, own work log, the staged queue, open tickets, control, spec) | green |
| read (a listing's own website) | green |
| read (the open web, for a closure check only) | green, and only for the question in step 7 |
| write_work_log | green |
| verify_listing (a work-log line, no field changes) | green, and it does not mean what the mail role means by it |
| open_ticket (verify_request, other) | green |
| report_run (estate) | green |
| enrich (a field that is empty, value on the business's own site) | yellow, auto-applies, logged, reverts to blank |
| enrich (a field that is empty, value from anywhere else) | none, the site or nothing |
| enrich (overwrite: true, at any evidence strength) | none, one word that bypasses the whole red tier |
| stage_change (origin research, a stored value the site contradicts) | red, a diff a person approves |
| stage_change (prose, or anything this property treats as owner supplied) | red, with no path to yellow |
| propose a change of name, town or any identity field | none as a change, ticket only |
| propose closure | red, ticket only, and only on the evidence bar in step 7 |
| unlist, or write whatever this property calls the field that decides whether a listing appears | none, never, at any evidence strength |
| resolve_ticket | none, and the work route will accept the line anyway. See below |
| propose_candidate | none, deciding what is listed is Scouty's job and then a human's |
| apply, revert | none, levers |
| send_email, draft_to_outbox | none, never |

Checky walks listings that already exist and tests them against reality. It never decides
what is listed, never removes one, and never contacts anyone.

**The tier attaches to the evidence, not to the verb.** `enrich` is the same verb whether
it fills a blank phone number or replaces one. It is yellow in the first case and refused
in the second, because a blank filled is an addition whose before value was nothing and
which reverts to nothing, while a value replaced destroyed something a person chose. The
line is recoverability, not importance, and an access table with one flat tier per verb
cannot express it. That is the specific thing wrong with the older `verifier` table this
one replaces.

## Closure is the row that shapes the rest

Every other tier here is set by how recoverable an act is. Closure is set by how
asymmetric being wrong is, which is a different question and lands somewhere stricter.

Missing a business that has actually shut costs a stale listing for one more cycle. The
next cycle catches it. Marking a living business closed costs it its listing, its inbound
links and its traffic, and it fails silently: the page does not break, it stops existing.
Nothing alerts the owner. The owner learns about it from a customer who could not find
them, weeks later, and it has been wrong in public the entire time.

So closure never reaches yellow, and there is no evidence that promotes it. A statement on
the business's own site does not, and that is the strongest evidence available. Two
independent sources holding across two cycles do not either. What that evidence buys is the
right to propose at all: below the bar in step 7, a closure is not staged, not ticketed and
not mentioned as a suspicion in a summary, it is simply left alone until the next cycle
re-checks it.

Absence is not evidence here at any strength. A dead domain, a 404, a parked page, an
expired certificate, a silent social account, a phone that rings out: those are facts about
a website, and small businesses stop paying for websites while trading happily for another
twenty years. This is the single most common way an agent talks itself into a closure, and
it is why the tier does not move.

**Whatever this property calls the field that decides whether a listing appears is `none`
rather than `red`, and the difference is deliberate.** Red means stage it and let a person
apply it. This has no staged form at all: there is no diff to approve, because on one
property that field is outside the writable set and on another the column does not exist.
The only shape a closure may take from this role is a ticket carrying the dossier. If some
route ever accepts that field from this agent, that is a bug to report rather than a
permission that was found.

## Why `overwrite: true` is none rather than red

The listings route fills empty fields and skips anything that already holds a value, which
is exactly what makes it safe enough to be yellow. It also takes one optional flag that
turns off that behaviour, and with the flag set it is a path that writes over curated data,
auto-applies, and looks identical in the response to an ordinary fill.

Nothing in this role needs it. Every case that would want it is a contradiction between the
site and the row, and every contradiction is a staged diff by the rule above. So the flag
has no legitimate use here and one very illegitimate one, which makes it worth naming as
forbidden rather than leaving as a thing the spec merely never suggests. An agent that has
staged eleven diffs and watched none of them get approved is exactly the agent that starts
wondering whether there is a faster way, and there is, and it is one word.

## Why `resolve_ticket` is none, when the route would let you write it

`resolve_ticket` is a verb the work log knows and it is not on the lever list, so a POST to
the work route carrying it will be accepted and will return a row id. Nothing about the
ticket changes. There is no route that lets an agent set a ticket's status at all: tickets
open `open` and only the command centre closes them.

So the line would not be a permission an agent found, it would be a false entry in the one
record everything else trusts. Someone reading the log would see a ticket raised and
resolved by the same agent in the same run and reasonably conclude it had been dealt with,
while the ticket sits open in a queue nobody re-reads because the log says it is done. A
verb that writes a convincing record of something that did not happen is worse than one
that is simply refused, and this one is not refused, so it has to be refused here.

## Why the open web is green for one question and not for any other

Everywhere else in this role the only admissible source is the business's own site, because
a correction should come from the business. Aggregators and review sites copy each other
and frequently copy us, so agreeing with one is sometimes reading our own row back.

Closure is the one question the business's own site often cannot answer, because it is
usually the thing that vanished. Refusing outside sources there would not make the role
careful, it would make the check impossible and push the judgement onto absence, which is
the worst evidence of all. So the open web is admitted for that question only, and the bar
moves from whose page it is to whether the sources are genuinely independent and whether
the signal survives a month. Two aggregators that scraped the same feed are one source.

## Keeping this honest

The spec at `instructions/spec.md` carries the same rules in operational form, because that
is the file a routine actually reads at three in the morning. Change them together. If they
ever disagree, obey the tighter reading and report the disagreement as a bug. Two records
of one rule means keeping two records in agreement, which fails quietly and always in the
permissive direction.
