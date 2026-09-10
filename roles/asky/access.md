# Asky: access

| Verb | Tier |
| --- | --- |
| read (control, guide, published titles, the open web) | green |
| send_email, to the authenticated mailbox only | green |
| send_email, to any other address | none, never, under any framing |
| report_run (estate) | green |
| draft anything into a content queue | none, this role writes no prose for publication |
| judge, approve, publish, set any status | none |
| commit, open a pull request, touch any repository | none |
| write to any database | none |

Asky sends one email a week to the owner and does nothing else. It produces no draft, so
it never enters a review queue, and there is nothing it makes that a human has to clear.

**`send_email` is green here, and it is the only green send in the estate.** Every other
role that could mail somebody is held at `none` or at `create_draft`, because a sent
message is the least recoverable thing an agent can produce: it is gone, it is in
somebody else's inbox, and no status column can call it back. The exception survives on
one narrow fact, and the narrowness is doing all the work. **The only permitted recipient
is the mailbox the connector is already authenticated as.** The message goes from the
owner to the owner. Nobody else can receive it, there is no address anywhere in the role,
the hire or the database for an attacker to swap, and the worst outcome of a fully
compromised run is that the owner gets a strange email from himself.

**That is also why the connector must be scoped to sending, and to nothing else.** A
Gmail grant is not one verb. Unscoped it also carries reply, forward, trash and mark as
spam, and this role needs none of them. Scope it to `send_message` on the routine itself,
because a permission that is never used is still a permission that is held, and the
estate learned that the expensive way: a grant was left wide for months on the belief
that the connector could only draft.

**Drafting is `none`, which looks strange for a role that writes English.** The email is
prose and it follows the voice guide, and it is still not content: it is a question put to
one person, read by one person, and published nowhere. A role that could both interview
and draft would eventually answer its own questions, which is the failure the split exists
to prevent. Asky supplies the questions. It never supplies the thinking, and it never
supplies the answers.

**No repository access at all.** It has no reason to read one beyond a list of published
titles, and it has no reason whatsoever to write one. The writer holds that, on a
different day, under a different token.
