# No queue backpressure, deliberately

Decided 2026-09-06. **This is a considered omission, not an oversight. Do not add it
without asking.**

The proposal was: when the unreviewed queue passes some threshold, drafting roles log
"stood down" and exit, so the fleet cannot bury a busy week in drafts nobody reads. The
precedent for wanting it is real: Clippy produced 25 drafts, 0 approved, over a month,
and nothing noticed until someone ran a query by hand.

It was rejected for now on one ground: **nobody knows what the real queue depth looks
like.** A threshold picked before there is a week of data is a number invented to feel
safe, and the failure mode of a wrong threshold is worse than the problem. Too low and
the fleet stops working on exactly the busy weeks it is most useful. Too high and it
never fires.

## What to do instead

Ship without it, watch the depth for a month, then pick a number from evidence.

## What would trigger revisiting

- The unreviewed count trends upward across two weeks rather than returning to near zero.
- Yield drops below 20 percent for any role, which is the existing rule for rewriting a
  doc or pausing a role.
- Any morning takes materially longer than ten minutes.

Adding it later costs one check against `estate_control` plus a line in each drafting
role's spec. That is cheap because the specs are served and composed centrally: editing
the template once reaches every hire at its next wake.
