# Designy, access

| Verb | Tier |
| --- | --- |
| read (control, own spec, appended grammar, blog guide, own runs) | green |
| draft_email (one, addressed to the account's own mailbox) | green |
| report_run (estate) | green |
| generate_image | none, this role writes prompts, never art |
| send_message, reply, forward | none, never |
| list_drafts, get_draft, search_threads, trash, spam | none |
| write to estate drafts, events or registry | none |
| commit, push, publish, set any status | none |

Designy proposes apparel concepts and cannot make one, print one, send one, or record one
anywhere but its own run report. The whole output is a single email draft sitting in the
mailbox it was created in.

**Drafting is green even though the output is public objects**, for the reason every
drafting role here is green: a draft is not a publication, and the estate's line is
recoverability. What makes that true in this role's case is the addressing rule. The draft
is addressed to the mailbox the connector is authenticated as and no address is ever typed,
so the worst case of an accidental send is mail arriving where the draft already was.

**The mail connector must be scoped, and this is the paragraph to read before granting it.**
Gmail exposes `send_message`, `reply`, `forward`, `trash_thread` and `mark_message_spam`
alongside `create_draft`, so an unscoped grant can send on the owner's behalf. That was
believed for months not to be the case, and the belief is exactly what made an unscoped
grant look harmless: the safety was assumed to come from the connector, when nothing in the
connector provided it. So the routine carries `permitted_tools: ["create_draft"]` and
nothing else, and a run finding it holds more should say so rather than quietly enjoying the
extra reach.

That list is also this role's answer to "the gate is a status column". There is no column,
because the output is an email rather than a row. Honestly, that is the weaker gate in one
respect: the list lives in the routine's configuration where the estate API cannot see it,
so nothing in this repository can prove it is still narrow. It is stronger in another: the
forbidden verb is not refused, it is absent. Disposal is the owner keeping or deleting the
draft, and no path runs from draft to reader without a person on it.

**Reading the mailbox is none, deliberately, and it costs something.** This role needs to
remember what it proposed last week so it does not repeat an archetype or a handle, and the
obvious source is its own old drafts. But a draft id is not a namespace: a grant that reads
the drafts this role wrote reads the drafts the owner wrote. So the memory comes from
`detail` on its own run reports, which the run route already scopes to the caller's own key.
The cost is a memory only four weeks deep. That is the right trade, because a repeated handle
is an embarrassment and a mailbox read is a standing capability pointed at private mail.

**No write to the estate drafts queue, which is a deliberate omission.** Every other
drafting role posts to `/api/drafts` and inherits a rejection vocabulary to learn from, and
this role would benefit: six `wrong_voice` rejections in a row is a fact worth having. It is
left out because the routine being registered here writes to no database, that property is
the whole reason it can be trusted with public physical objects, and widening it in the same
change that registers it would mean never knowing which change caused whatever happened
next. Adding it later turns concepts into rows somebody has to clear, which is a second
queue, and the queue budget decides whether any of this gets read at all.
