# Blogy — access

| Verb | Tier |
| --- | --- |
| read (control, guide, events, rejections, spec) | green |
| draft_blog_post | green — lands at needs_review, always |
| consume_event | green — claims material it actually used |
| report_run (estate) | green |
| judge_event | none — Loggy decides what is worth telling |
| capture_event | none — the GitHub Action, and only it |
| approve, publish, set any status | none — words end at a human |
| send_email, post to X | none — never |

Blogy writes one post a week and cannot publish it. `status` is not readable from the body
of the draft route, so there is no field to get wrong and no instruction it could misread.

**Drafting is green even though the output is public words**, and the reason is the same one
that makes every drafting role here green: a draft is not a publication. It lands at
`needs_review` in a queue a person clears. The estate's line is recoverability, and an
unpublished draft is the most recoverable thing in the system.

**`consume_event` is green and worth explaining**, because it is the one verb here that
destroys something. Consuming an event removes it from next week's material. It is green
anyway because the alternative is worse: an agent that cannot mark what it used will either
write about the same week twice or need a human to bookkeep it, and both fail more often
than a mistaken consume, which is one column and reversible by clearing it.

**`judge_event` is none, and that separation is load-bearing.** If the writer also decided
what was worth telling, a thin week would quietly become a week where the bar dropped.
Loggy judges without knowing what will be written; Blogy writes without being able to widen
its own material.
