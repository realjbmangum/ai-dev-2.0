# GitHub Support request, ready to send

Send from <https://support.github.com/request>, signed in as `realjbmangum`.
Category: **Account or repository** &rarr; **Sensitive data removal**.

Why this is needed: force-pushing cleaned every branch, but GitHub keeps its own
pull-request refs (`refs/pull/*`) which no one can force-push. The old commit is still
reachable by anyone with repo access who knows the SHA. Only Support can purge those.

---

**Subject:** Purge cached views and pull request refs after sensitive data removal

**Body:**

I removed sensitive files from `realjbmangum/site-suitemanagerllc` today by rewriting
history and force-pushing all branches. The repository is now private.

The files were a recording and transcript of a private client meeting, committed by
mistake:

- `app-suitemanager/data/Meeting Notes/transcript-clean.txt`
- `app-suitemanager/data/Meeting Notes/Document portal discussion .docx`
- `app-suitemanager/data/Meeting Notes/Document portal discussion .vtt`

They were introduced in commit `3be3b80` and removed from every branch. That commit is
still reachable through the API and through the pull request refs, which I cannot
force-push.

Please purge the cached views and the stale pull request refs for this repository so the
commit and its blobs are no longer retrievable.

There are no forks. Thank you.

---

## After they confirm

Check it worked. This should return "not found" rather than a commit:

```bash
gh api repos/realjbmangum/site-suitemanagerllc/commits/3be3b80
```

## Already done

- Repository set to private. Files no longer publicly reachable.
- Zero forks, so nothing was copied out.
- History rewritten across all four branches and force-pushed.
- Full pre-rewrite backup at `~/suitemanager-backup-20260907-144825.bundle`.

## One thing to know

Your local checkout at `/Users/jbm/new-project/site-suitemanagerllc` still has the old
history and 36 uncommitted files. Save anything you care about there, then re-clone. Do
not push from it, or the old commits go straight back.
