# Scouty: access

| Verb | Tier |
| --- | --- |
| read (control, health, candidates, listings, categories, spec) | green |
| propose_candidate, qualifying fact read on the subject's own site, `source_url` recorded | green |
| propose_candidate, suspected duplicate of a live listing, suspicion named in the evidence | green |
| propose_candidate, evidence from an aggregator, a list post, a review site, a social profile | none, that was a lead |
| propose_candidate, no page read, the claim is the model's own recall | none, never |
| propose_candidate, the qualifying claim could not be verified | none, propose nothing |
| send `email` or `phone` read on the subject's own site | green, same evidence bar |
| send `email` or `phone` from anywhere else | none |
| send `description`, or any prose that would be published | none, words end at a human |
| write_work_log (`run_report`, `error`) | green |
| write_work_log (`propose_candidate`) | none, the route already wrote it |
| report_run (estate) | green |
| enrich, stage_change, any write to an existing listing | none, that is Tidy's |
| set a candidate's status, including `duplicate` | none, lever |
| unlist, send_email, publish | none, never |

Scouty decides what is worth putting in front of a person. It publishes nothing, changes
no listing, and cannot rule on its own proposals.

**The tier attaches to the evidence, not to the verb.** `propose_candidate` is the same
verb five times in that table and it is green twice and forbidden three times, because
what separates a find from an invention is not the act, it is whether a page was read. The
API cannot tell those apart: `source_url` is nullable on the candidates route, `evidence`
is checked for length and nothing else, and a candidate written from a model's own recall
returns 201 exactly like a verified one. So the distinction has to be made here, and then
kept here, because nothing downstream will catch it.

**There is no yellow row and no red row, and that is not the table being lazy.** Yellow
means do it reversibly under stated conditions, and red means stage it for a human. Every
act this role performs already lands in a queue a person clears, so the whole role sits on
green's side of the recoverability line and the yellow/red distinction has nothing to
grip. What actually varies from row to row is whether the evidence exists at all, and that
is a two-valued question. Green when a page was read and the URL is on the row, none when
it was not.

**Proposing is green even though this is the role that could fill a directory with
garbage**, and it is worth being honest about what that green is resting on. It is not
resting on the tier. It is resting on two things: the evidence bar in the spec, and a
human actually working the queue. If the queue stops being reviewed, this table is wrong
and nothing in it will tell you so, because every proposal will still be perfectly
permitted right up to the moment somebody approves forty of them in a tired ten minutes.
The signal for that is yield, which the spec makes Scouty compute and report on every run
without letting it act on the number.

**Setting a candidate's status is none, and that includes marking an obvious duplicate of
its own.** It looks harmless and it is the one exclusion worth defending hardest. Yield is
the only measure of whether this role is working, and yield is approvals over decisions. A
role that can close its own proposals can make that number say anything, and it would do
it for good reasons: tidying up, sparing the reviewer, correcting an honest mistake. A
scoreboard the player can edit measures nothing, and this scoreboard is the only warning
anyone gets that the finder has started making things up.

**`write_work_log` splits on who already wrote the row.** The candidates route logs
`propose_candidate` itself, attributed to whatever went in `found_by` and threaded to the
candidate id. Scouty writing a second one would double the only count that says how much
this role proposes, and a duplicated count is worse than no count because it looks
authoritative. What the route records nothing about is the leads that were checked and
dropped and the sources that came back dry, so that is what Scouty writes, once per run,
as `run_report`.

**`description` is none, and the reason is not squeamishness about prose.** Approving a
candidate inserts a `businesses` row immediately, carrying `description` straight into
`short_description`, which renders on the public page. The reviewer's click answered one
question, whether the business belongs, and every other field rode along on it unread. So
a sentence Scouty wrote reaches the public internet on the strength of a decision about
something else entirely.

The useful consequence is that a role which publishes no words needs no voice guide, and
the estate's ninth rule holds every drafting role until its property has one. Scouty is
the role a brand new directory can hire on day one, and it is that role precisely because
it never says anything. A hire that fills in `voice:` for it has been copied from the
wrong template.

## Keeping this honest

The spec at `instructions/spec.md` carries the same rules in operational form, because
that is the file a routine actually reads at three in the morning. Change them together.
If they ever disagree, obey the tighter reading and report the disagreement as a bug: two
records of one rule means keeping two records in agreement, which fails quietly and always
in the permissive direction.
