# Guidey: access

| Verb | Tier |
| --- | --- |
| read (control, guide, own drafts, own rejections, Scripture, the open web) | green |
| draft_field_guide_week | green, lands at needs_review, always |
| report_run (estate) | green |
| write to the book database, in any table | none, no credential, and no reason to have one |
| set `book_guides.status`, or publish a guide | none, that gate is the application's and a human's |
| choose the next book, or edit its own hire | none |
| generate or regenerate a public guide page | none, a script does that, from published rows only |
| commit, open a pull request | none |
| send_email, post publicly | none, never |

Guidey drafts one week of a book's field guide and stops. Everything it produces sits in
a review queue.

**Drafting is green even though the words end up in front of a room of men**, which is the
part of this that deserves the argument. A draft is not a publication and there are two
gates after this one, not one. A person clears the estate queue, and then a person moves
an approved week into the application, where a second status column decides whether the
public page is generated at all. The distance between what this role writes and what a man
reads aloud is two deliberate human acts, and that is what makes green defensible for work
this consequential.

**Writing to the book database is `none`, and it is the important one.** The obvious
convenience is to let this role write its week straight into the guide row at a draft
status. It does not, for a reason that is not about trust: **it cannot read that row back
through any interface it holds.** The public generator reaches the database through a
command line tool with a deployment credential, which a scheduled routine has neither. A
role that writes where it cannot read is a role whose mistakes are invisible to it and to
everything watching it, and the estate's first law is that nothing is real until something
reports it. So the week lands in the queue this role can actually see, and a human carries
it across.

**Setting a status is `none` everywhere, and here it is doubly so.** The application's
`published` status is what causes a public page to exist. That is the ministry's own gate
and it predates the estate. Nothing in this estate reaches across and turns it.

**Choosing the next book is `none`.** A book is a six week commitment for every man in
every chapter, chosen by the people who lead them. The hire names it. When six weeks are
drafted this role stops and says so, and waits to be told.

**No repository access, no pull request, no page generation.** The public page is a
deterministic reduction of a published guide, produced by a script that never writes a
sentence of its own. Letting an agent near that script would put generated prose into a
path whose entire value is that it contains none.
