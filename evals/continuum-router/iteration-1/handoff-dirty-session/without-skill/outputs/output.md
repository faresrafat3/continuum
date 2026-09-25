# Safe recycle classification

**Classification: `PRESERVE_AND_HANDOFF` — a live, dirty Session that is not safe to recycle by archive or deletion.**

The unfinished implementation and dirty worktree are durable workspace state. The active background job and paused goal are session-scoped live state: they do not become safe merely because the workspace path is reused in a new Session, and they may not be visible from the new Session. Therefore:

- Preserve the worktree exactly as-is. Do not reset, clean, stash, commit, restore, discard, or move it as part of this handoff.
- Do not delete or archive the old Session, and do not stop or kill its background job.
- Do not start a duplicate job or create/replace a goal until the existing job and goal have been identified.
- Treat all claims about the old Session's state as unverified until checked from the old Session or from workspace evidence.

**Safe lifecycle:** prepare a bounded handoff → open a fresh Session at the exact same workspace → perform read-only state verification there → continue only after the job/goal discrepancy is resolved.

# Bounded handoff prompt

```text
Take over unfinished implementation from an older DSH Session in the SAME workspace.

Known facts supplied by the user (verify before relying on them):
- implementation work is unfinished;
- the Git worktree is dirty;
- the old Session has an active background job;
- the old Session has a paused goal;
- the old Session must not be deleted or archived.

Workspace: use the exact workspace path recorded by the old Session; do not infer it from this prompt.

Start with read-only verification and make no edits until it is complete:
1. Read the repository's AGENTS.md/WORKSPACE.md and the task/spec files.
2. Record `pwd`, the Git top-level, branch/HEAD, `git status --short --branch`, `git diff --stat`, and the list of untracked files. Treat every existing modification as someone else's work to preserve.
3. Record the old background job's ID, command/purpose, current status, and latest output. Do not kill it and do not launch a duplicate. If the job is not addressable from this Session, report that as a blocker and remain read-only in the workspace until ownership is clear.
4. Record the paused goal's exact ID, revision, objective, phase, and blocker/status. Do not assume a missing goal means there was no goal. If it is unavailable, reconstruct it only from durable task records and user-provided evidence; do not create a replacement goal yet.
5. Compare the verified workspace state with the handoff and list all discrepancies.

Then report:
- verified task and current implementation state;
- dirty paths and which are understood/unexplained;
- status/ownership of the old job;
- status/identity of the paused goal;
- risks or blockers;
- exactly one next action.

After that report, continue the smallest verified unfinished slice. Do not broaden scope, perform cleanup, discard changes, or modify the old Session. If the active job could still mutate the worktree, wait for or safely account for it before editing.
```

# Exact next action

Open a new DSH Session at the **exact same workspace**, submit the bounded handoff above, and make its first action the read-only verification sequence. Leave the old Session, its background job, its paused goal, and all worktree contents untouched; do not archive or delete anything.
