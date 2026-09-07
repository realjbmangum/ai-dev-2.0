# Rejections use a closed vocabulary, not free text

Decided 2026-09-06.

Rejecting a draft requires a reason from a fixed list: `wrong_voice`, `already_said`,
`not_true`, `too_thin`, `not_now`, `other`. Free text is optional alongside it.

## Why a reason is required at all

Between 8 and 14 August 2026, 39 of 42 drafts across the fleet were rejected and nothing
changed between runs, because a rejection recorded only `status='rejected'` and the
reason lived in Brian's head. Every routine stayed exactly as good as it started.

## Why not free text, which is what fixed it the first time

Typing a sentence per rejection does not survive a five-to-ten-minute morning, and a
review step that costs more than the budget stops happening. A closed list is one tap.

## The unexpected benefit

A closed vocabulary can be counted. "Six of your last ten were wrong_voice" is a far
sharper instruction to an agent than six paragraphs of prose, and it is only possible
because the values are constrained. The rejections endpoint returns both the rows and
the tally.

## Enforcement

In the route, and again as a schema trigger, because the desk will not be the only thing
that ever writes this table.
