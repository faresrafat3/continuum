# Continuum

A local operating protocol for DSH: decide when a Session should end, how
the next Session learns what it needs, and what must never happen
automatically.

It is not a durable-execution framework, a workflow engine, or a memory
system. It sits one layer above those. `docs/landscape.md` explains the
difference and, more usefully, when you should reach for something else.

## Install

```sh
./install.sh                      # install the two presets and verify them
./install.sh --workspace ../proj  # also initialise a workspace there
./install.sh --check              # verify an existing install
./install.sh --uninstall          # remove them
```

The installer writes only to `~/.dsh/.agent-presets/`. It cannot reach the
Host composition, the shipped presets, the persistence registry, the
credentials, or the model route, and it refuses to run if the preset root
resolves outside the user plane. Every install is checked byte-for-byte
against the archived source, so a hand-edited install is reported as drift
rather than quietly accepted.

## What you get

| | |
|---|---|
| `continuum` | context-engineering, research, routing, handoff |
| `continuum-curator` | workspace governance and safe migration |
| `bin/continuum-workspace` | dependency-free CLI: `init`, `doctor --strict`, `status`, `context`, `close --dry-run` |
| `plugins/continuum-handoff.js` | source of record for the process-local `hand-3/pkg-14` Host package |
| `bench/benchmark.py` | reproducible local benchmark, no API |
| `docs/landscape.md` | honest comparison, including the reasons not to use this |

## The idea

A long Session degrades: context rot, lost identifiers, half-finished work.
The usual fix is to summarise. A summary cannot be validated, drifts from
reality, and quietly becomes the only copy of an exact commit hash or a
failed command.

Continuum instead writes a **typed, checkable handoff**: a frontmatter
record whose fields are schema-validated, whose body sections must carry
real content, and whose claims are re-checked against Git on every run.
Then a fresh Session reads a **bounded, redacted, hash-stamped projection**
instead of a transcript.

The parent Session is never deleted. `/continuum-fork` refuses while the
Session is running, forks at a completed-turn boundary, and retains the
parent. Archive stays a human-confirmed action.

## Using it

Inside a DSH Session with the `continuum` preset:

```text
/continuum-handoff T-0001     # bounded prompt for a fresh Session
/continuum-fork T-0001        # human-triggered fork, parent retained
```

The model tool `continuum_handoff` is current-Session-only and read-only.
It cannot take an arbitrary cross-session id, archive, delete, or change a
permission.

## Verify

```sh
./bin/continuum-workspace doctor --strict                    # 0 errors, 0 warnings
python3 -B -m unittest discover -s .agent-workspace/tests     # 53 tests
node plugins/continuum-handoff.test.mjs                      # plugin regression
python3 -B bench/benchmark.py                                # local timings
```

The guards are **mutation-tested**: deleting any one of them makes the
suite fail. That is checked, not claimed — including the four guards whose
absence the suite originally failed to notice.

## What it does not do

No crash loss budget. No external-effect deduplication. No authorization of
a resumed run. No semantic memory. Five real-DSH gates remain `DEFERRED`
and are listed in `docs/acceptance-matrix.md`. Automatic archiving and
unattended recycling stay disabled until every one of them has an artifact,
an exact version, a commit, and a reproducible result.

Read [WORKSPACE.md](WORKSPACE.md) and [AGENTS.md](AGENTS.md) before
changing project records.
