# Salesy: access

Two systems, two tiers, and the table has to say which system each verb acts on. Every
other role in this estate reads and writes inside one boundary. This one straddles the
only boundary in the estate that is about people rather than about brands.

| Verb | System | Tier |
| --- | --- | --- |
| read (estate control state, own spec, own run history) | estate | green |
| read (own rejections, quiet leads) | CRM | green |
| read (voice guide) | estate | green |
| draft_outreach | CRM | green, lands at `needs_review`, always |
| stamp_outreach_drafted | CRM | green, records a draft was written, never that one was sent |
| report_run | estate | green, counts and ids only |
| write a draft into the estate | estate | none, the draft is client data and that database holds none |
| put a name, company, quote or figure in a run report | estate | none, at any tier, forever |
| set a lead's status, owner, notes, labels, deal value | CRM | none |
| read email, phone, address, linkedin, deal value, close date | CRM | none, and the endpoint does not return them |
| approve, reject, publish, set any draft status | CRM | none, words end at a human |
| send_email, or create a mail draft in a mail client | either | none, never |

## Why drafting is green when the output is an email to a real prospect

The same reason every drafting role here is green: a draft is not a send. It lands at
`needs_review` in a queue a person clears, and the estate's line is recoverability rather
than importance. An unsent draft is the most recoverable thing in the system.

**That reasoning is doing more work here than anywhere else, and it is worth saying so out
loud rather than letting the tier look routine.** A bad blog post that gets approved is a
row somebody deletes. A bad email that gets approved goes to one person who is deciding
whether this company is serious, and it cannot be unsent. The gate is what makes the verb
green, so the gate has to be structural rather than remembered: the write endpoint has no
status field at all, and the column defaults to `needs_review` in the schema. There is
nothing here an agent could set wrong and no instruction it could misread into publishing.

If that ever changes, if somebody adds a status field to that endpoint or wires an
approved `outreach_draft` into anything that sends, this row is not green any more and the
change is a deliberate decision rather than a convenience.

## Why `stamp_outreach_drafted` is green, and it is the one that deserves a paragraph

It is the only verb here that writes to a real client record. It sets `last_outreach_at`
on a lead, which suppresses that person from the next run's query for seven days.

It is green because the alternative is worse in the direction that matters. Without it,
the "never write to the same person twice in a week" rule has nothing enforcing it across
runs, and the failure it prevents is a real prospect receiving two follow-ups in five days
from a company that just told them it is one person paying attention. What a mistaken
stamp costs is the opposite and much smaller: a lead stays quiet an extra week, on a row a
human is looking at anyway, and clearing one column undoes it.

**It is also why step 7 of the spec insists on the order.** Stamp after the draft saves,
never before. The wrong order fails silently in exactly the way nothing downstream can
catch, because a suppressed lead and a satisfied lead are the same shape from outside.

## Why the estate `drafts` table is `none` for this role

Every other drafting role in the estate writes there. This one does not, and the
difference is not about trust.

The estate database holds no client name, no email address and no dollar amount. A
follow-up to a lead is nothing but those things: it opens with a name, it refers to what a
named company asked for, and its whole purpose is to reach one identified person. There is
no version of that draft that could sit in the estate and still be worth sending.

So the draft stays in the CRM, which is the system of record for these people and the only
place a name is not a leak, and the estate gets a pointer instead. This is the same
separation the desk already runs on. It binds two databases and never the CRM's, and
Ascend's work reaches it as "leads have gone quiet, open the CRM" rather than as a payload.

## Why a count is allowed when a name is not

Because Law 2 requires it. `expected` and `actual` are mandatory on every run report, and
for this role they are numbers of leads. Refusing to send them would break the only check
that can distinguish a working Salesy from a deleted one, and it would break it to protect
a fact that is not protected anywhere: pipeline volume is not a name, not a contact
detail, and not a figure of money.

**Integer ids are allowed for the same reason and with the same limit.** A lead id is
opaque to anyone who cannot already open the CRM, and the estate has an established
precedent for it: a sibling role is told to refer to a message by its inbox id and a
listing by its listing id, precisely so that reports can be specific without being
identifying. Salesy inherits that. An id says which row, and nothing about who.

The line between those and everything else is not "is it sensitive". It is **can a person
who reads the estate database learn something about a human being from this field**. A
count cannot. An id cannot. A first name can, and so can a company, a job title, an
industry, a budget band, and any sentence either party wrote.

## Keeping this honest

The spec at `instructions/spec.md` carries the same boundary in operational form, because
that is the file a routine actually reads at three in the morning. Change them together.
If they ever disagree, obey the tighter reading and report the disagreement as a bug: two
records of the same rule means keeping two records in agreement, which fails quietly and
always in the permissive direction.
