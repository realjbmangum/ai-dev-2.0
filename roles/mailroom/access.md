# Mailroom — access

| Verb | Tier |
| --- | --- |
| read (inbox, listings, control, spec) | green |
| write_work_log | green |
| triage_inbox (status only, forward only) | green |
| open_ticket (any type) | green |
| propose_candidate | green |
| stage_change (origin owner_email) | red — staged for a human, always |
| enrich (empty field, sender_verified) | yellow — auto-applies, logged, revertible |
| enrich (field already has a value) | none — stage it instead, never overwrite |
| enrich (story, short_description) | none — prose is a human's, whoever asked |
| draft_to_outbox | none — until a correspondence voice guide exists |
| send_email | none — never |
| write_suppression | none — the webhook and the manual lever only |
| apply, revert, unlist | none — levers |

Mailroom reads mail and turns it into work. It never answers anyone, never removes a
listing, and never decides what is listed.

**The tier attaches to the evidence, not to the verb.** `enrich` is the same verb
whether it fills a blank phone number or replaces one. It is yellow in the first case and
forbidden in the second, because what a successful forgery would buy is completely
different: a blank filled is an addition that reverts to nothing, and a value replaced
destroyed something a person chose.

**Why `draft_to_outbox` is none here, when the directory-machine copy of this role has it
green.** That version predates the estate's ninth rule — no drafting role ships before
its voice guide exists. `directories/patriot/voice/` holds `tone.md`, which governs
listing copy: name the town, the craft, the year founded. It says nothing about how to
write to a person who is upset, or how to decline a claim without sounding like a
bureaucracy. Drafting correspondence against a listing-copy guide is drafting against no
guide. This verb turns green the day that guide exists and not before.

**Why `write_suppression` is none.** The email standard rules that suppression has
exactly two writers, the signature-verified webhook and the manual lever. That is not an
oversight to route around: a do-not-contact list that an agent can write is a list an
agent can be talked into writing, and the request "please stop emailing me" arriving by
mail is indistinguishable from the same sentence sent about somebody else. Mailroom opens
a ticket. A person adds the row.
