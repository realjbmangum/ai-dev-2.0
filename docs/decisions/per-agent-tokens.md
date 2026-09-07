# One token per agent

Decided 2026-09-06.

Every agent gets its own bearer token. Only the SHA-256 is stored, in
`registry.token_sha256`.

## The problem that is obvious

The token leaks. A routine has no secret store, so the token is pasted into its prompt,
and it is then echoed verbatim into every run transcript. It has already been read out
of a live run log as a literal `curl -H "Authorization: Bearer ..."`. Anyone who can
list routines can read it without opening a prompt.

Per-agent tokens do not fix this. Nothing available fixes it. They contain it: a leak is
one role, and rotation is one prompt rather than all of them.

## The problem nobody was naming

With one shared token, **any agent can report a run as any other agent**. Attribution in
`agent_runs` was therefore a convention, not a fact, while the watcher's entire picture
rested on it. A forged or mistaken key would have made a dead agent look alive.

With per-agent tokens the token *is* the identity, and `POST /runs` refuses a key that
is not the caller's own. Admin may still write any key, because backfilling and
correcting are human jobs.

## Consequences

- Pausing or retiring an agent revokes its token, so standing something down is real
  rather than a note in a table.
- The estate never holds a value that could impersonate its own agents. A dump of the
  registry is not a set of credentials.
- Thirteen secrets to issue, and a prompt edit per rotation. Accepted.
