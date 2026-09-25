# Continuum System

A local DSH operating protocol for clean context, evidence-backed research, resumable work, and safe session recycling.

## Components

- `continuum` — context-engineering and research agent preset.
- `continuum-curator` — workspace governance and handoff agent preset.
- `docs/research/context-engineering-sota-review.md` — primary-source research and framework decision matrix.
- `.agent-workspace/` — WCS coordination plane for this project.
- `bin/continuum-workspace` — dependency-free workspace initializer/doctor CLI.
- `plugins/continuum-handoff.js` — source of record for the process-local `hand-3/pkg-14` Host package.

## Safety boundary

This project never edits the DSH Host composition or shipped presets. Session recycling is a typed handoff and reversible fork/archive workflow. It never physically deletes session logs, and archive is never automatic.

## Session continuity

In a DSH Session using the current dynamic package:

```text
/continuum-handoff T-0001
/continuum-fork T-0001
```

`/continuum-handoff` prints a bounded prompt for a fresh Session. `/continuum-fork` is human-triggered, refuses while the Session is running, forks at a completed-turn boundary, and retains the parent. Use the existing Workspace archive control only after recovery succeeds; archive is one-way navigation metadata, not deletion.

The model tool `continuum_handoff` is current-Session-only and read-only. It cannot accept an arbitrary cross-session id or mutate permissions.

## Start

```sh
cd /home/fares/continuum-system
./bin/continuum-workspace doctor --strict
python3 -m unittest discover -s .agent-workspace/tests -v
./bin/continuum-workspace status
```

Read [WORKSPACE.md](WORKSPACE.md) and [AGENTS.md](AGENTS.md) before changing project records.
