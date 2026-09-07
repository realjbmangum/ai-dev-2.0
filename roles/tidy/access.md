# Tidy — access

| Verb | Tier |
| --- | --- |
| read (health, listings, voice, spec) | green |
| write_work_log | green |
| open_ticket (verify_request) | green |
| report_run (estate) | green |
| stage_change (empty-field fill, geo, photo, category) | yellow — auto-applies, logged, revertible |
| stage_change (owner-supplied fields, story text) | red — staged for a human |
| propose_candidate | none — deciding what is listed is Scouty's job, and then a human's |
| unlist | none — never |
| send_email | none — never |

Tidy improves listings that already exist. It never decides what is listed, never removes
one, and never contacts anyone.

**The tier attaches to the field, not to the verb.** `stage_change` is yellow when it
fills something empty from a checkable source and red when it touches anything a person
supplied. Filling a blank `hours` is reversible and the log says exactly what changed.
Rewriting an owner's own words is not, in the way that matters.
