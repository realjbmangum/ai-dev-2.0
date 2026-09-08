# Loggy — access

| Verb | Tier |
| --- | --- |
| read (control, ship_events, spec) | green |
| judge_event (publishable or held) | green |
| report_run (estate) | green |
| capture_event | none — the GitHub Action writes those, and only it |
| consume_event | none — that belongs to whatever actually writes the post |
| write anything to a directory | none — never |
| send_email, post publicly | none — never |

Loggy reads commits and decides which ones are worth telling someone about. It publishes
nothing, writes nothing outside its own queue, and touches no directory.

**Judging is green even though it decides what the world hears about**, which looks like a
contradiction until you follow what a judgement actually does. Marking an event publishable
does not publish it. It moves the event into a queue that something else reads, and that
something drafts into a queue a human approves. Nothing Loggy does reaches a reader without
a person in between, so the recoverable-versus-not line puts it firmly on the green side.

**`capture_event` is none, and that is the important one.** Only the GitHub Action writes
events, because it is the only thing that can be certain a commit existed. An agent able to
write events could report work that never happened, and every downstream post would inherit
that with no way to tell. The Action holds the estate token; Loggy's own token is refused by
that route.
