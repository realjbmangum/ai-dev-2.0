# Mailroom: access

| Verb | Tier |
| --- | --- |
| read (inbox, listings, control, spec) | green |
| write_work_log | green |
| triage_inbox (status only, forward only) | green |
| open_ticket (any type) | green |
| propose_candidate | green |
| verify_listing (a work-log line, no field changes) | green, on the evidence below |
| stage_change (origin owner_email) | red, staged for a human, always |
| enrich (empty field, sender_verified) | yellow, auto-applies, logged, revertible |
| enrich (empty field, reply_match subaddress) | yellow, same tier on different evidence |
| enrich (field already has a value) | none, stage it instead, never overwrite |
| enrich (story, short_description) | none, prose is a human's, whoever asked |
| draft_to_outbox | none, until a correspondence voice guide exists |
| send_email | none, never |
| write_suppression | none, mechanical writers and the manual lever only |
| apply, revert, unlist | none, levers |

Mailroom reads mail and turns it into work. It never answers anyone, never removes a
listing, and never decides what is listed.

**The tier attaches to the evidence, not to the verb.** `enrich` is the same verb
whether it fills a blank phone number or replaces one. It is yellow in the first case and
forbidden in the second, because what a successful forgery would buy is completely
different: a blank filled is an addition that reverts to nothing, and a value replaced
destroyed something a person chose.

## Correlated replies

The same principle again, one level finer. When a message answers something the directory
sent, `inbox.reply_match` records how confidently that was established, and the same verb
is a different risk at each strength.

| Verb | `subaddress` | `in_reply_to` | `from_address` | no match |
| --- | --- | --- | --- | --- |
| triage_inbox, open_ticket, propose_candidate, write_work_log | green | green | green | green |
| verify_listing | green | green if sender_verified | green if sender_verified | none |
| enrich (empty field, on that outbox row's listing) | yellow | yellow if sender_verified | yellow if sender_verified | yellow if sender_verified |
| enrich (field already has a value) | red | red | red | red |
| enrich (story, short_description) | none | none | none | none |
| stage_change (origin owner_email) | red | red | red | red |
| draft_to_outbox, send_email | none | none | none | none |
| write_suppression | none | none | none | none |

A cell reading "if sender_verified" drops to red when it is not. A cell reading `none`
drops to nothing; it is refused.

**Two things changed here. The `verify_listing` row is new, and the top-left cell of the
fill row is the one place an existing rule loosened.** Everything else in the matrix is
the old tier restated at each strength, which is worth writing out rather than assuming:
a rule that is only obvious is a rule somebody will read the other way at midnight.

A `subaddress` match means the reply carried a token that was placed in the Reply-To of
exactly one message, sent to exactly one address, with an unguessable half. Answering with
it required receiving it. That is the same thing `sender_verified` establishes, by
possession rather than by a DMARC policy published by a domain this machine does not
control and mostly cannot see. Possession is the stronger of the two, so a proof-matched
reply may fill a blank field without a DMARC pass.

What it buys is deliberately small: a blank filled, before value null, on the listing that
message was addressed to, logged and one click from gone. The limit worth naming is that a
token proves which message is being answered and that the answer came from someone holding
mail sent to the address on file. It does not prove who, because a forwarded message
carries the token to whoever it was forwarded to. That is acceptable for an addition and
it is exactly why the overwrite row stays red at every strength: a hijacked or forwarded
mailbox produces a perfect `subaddress` match, and a value a person curated is not
recoverable by a revert of somebody's guess about it.

**`in_reply_to` and `from_address` add no identity evidence, so they change no tier.**
The first is evidence about a thread: message ids travel in forwarded copies and delivery
reports, and the id belongs to the sending platform rather than to this machine. The
second is a guess that is usually right, and it will be the most common match, which is
the combination to be careful with. Both tell you truthfully which conversation you are
in, which is worth having on its own, and neither tells you anything new about who is
talking. So they leave the existing rule exactly where it was.

**`verify_listing` is green and still has an evidence bar**, which looks inconsistent
until you follow what the line does. It changes no field and publishes nothing, so it is
green. But "the owner confirmed this listing was right" is a fact other roles will read as
settled, and a guess written there hardens into a fact nobody re-checks. Cheap to write is
not the same as cheap to be wrong about.

**Why `write_suppression` is still none, and now for a second reason.** The email standard
rules that suppression is written mechanically and never by an agent, and a do-not-contact
list an agent can write is a list an agent can be talked into writing: "please stop
emailing me" arriving by mail is indistinguishable from the same sentence sent about
somebody else. The new reason is that for an inbound opt-out the row already exists: the
intake Worker writes it on arrival, before triage, because the gap between a person asking
and the machine obeying must not depend on when a routine next wakes. Mailroom writing a
second one would be a second writer for a fact already recorded.

**That happens whether or not the message correlated to anything, and this paragraph used
to say otherwise.** It named an uncorrelated opt-out as a case nothing honours, which was
wrong: the Worker's scan reads the words the sender typed and never consults
`reply_match`. Correlation decides what an opt-out can be attributed to, not whether it is
obeyed.

Two cases do stay uncovered: an opt-out written underneath the quoted original rather than
above it, and one in a message flagged machine-generated that Mailroom's own reading says a
person wrote. Neither is honoured by anything. Mailroom opens a ticket and says so plainly,
and a person adds the row.

**Why `draft_to_outbox` is none here, when the directory-machine copy of this role has it
green.** That version predates the estate's ninth rule: no drafting role ships before its
voice guide exists. `directories/patriot/voice/` holds `tone.md`, which governs listing
copy: name the town, the craft, the year founded. It says nothing about how to write to a
person who is upset, or how to decline a claim without sounding like a bureaucracy.
Drafting correspondence against a listing-copy guide is drafting against no guide.

A correlated reply is the case that will press hardest on this, because the person is
mid-conversation and asked a direct question, and because `reply` is the one mail class
the email standard already contemplates auto-sending. Both of those are about the
*evidence*, and evidence was never what this verb was blocked on. Words end at a human is
the estate's standing ceiling, and the missing guide is a hard stop rather than a warning.
This verb turns green the day that guide exists, and the table above is what it should be
tiered against then.

## Keeping this honest

The spec at `instructions/spec.md` carries the same matrix in operational form, because
that is the file a routine actually reads at three in the morning. Change them together.
If they ever disagree, obey the tighter reading and report the disagreement as a bug: two
records of the same rule means keeping two records in agreement, which is a thing that
fails quietly and always in the permissive direction.
