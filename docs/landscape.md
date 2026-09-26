# Continuum in the landscape

An honest comparison, written to be useful rather than flattering. The
point is to show what Continuum does, what it explicitly does not do, and
which existing system you should reach for instead.

## First, the category error

The most common misreading of this project is to treat it as a competitor
to LangGraph, Temporal, OpenAI Agents SDK, Google ADK, or AutoGen. It is not.

Those are **durable-execution and runtime frameworks**. They provide
checkpointing, replay, scheduling, and human-in-the-loop primitives. They
do not provide a workspace convention, a handoff document contract, or a
sealed read-only parent Session.

Continuum is **one layer above them**: a local operating protocol for
deciding *when* a Session should end, *how* the successor Session learns
what it needs, and *what must never happen automatically*.

The honest framing:

| | Continuum | LangGraph / Temporal / ADK |
|---|---|---|
| Runs a workflow | no | yes |
| Checkpoints and replays | no | yes |
| Decides when to seal a Session | yes | no |
| Types the handoff document | yes | no |
| Revocable parent Session | yes | no |
| Bounded context projection | yes | no |
| Needs a server | no | usually |
| Maturity | new, adversarial-audited | years, production |

Continuum can sit next to any of them. It cannot replace them.

## What is genuinely different

**1. The handoff is a typed, checkable artifact.**

Most session-continuity guidance is "write a summary". A summary cannot be
validated, drifts from reality, and silently becomes the only copy of an
identifier. Continuum's handoff is a frontmatter-typed record whose
`sections`, `objective`, `next_action`, `blockers`, `checkpoint` and
`workspace` are schema-checked, and whose body sections are checked for
substance rather than mere presence.

The gates that exist because earlier versions were caught accepting hollow
records:

- a section with a heading and no content is rejected
- eleven sections restating one sentence are rejected
- `next_action: "Continue the work"` is rejected
- a path asserted as current must exist, but a path documented as removed
  is allowed, because that is what the stale-information section is for
- a ledger row recording `fail` while state claims `pass` is an error
- the handoff `close` certifies must be the same one the context pack ships

**2. The parent is sealed, not deleted.**

Codex `/archive` hides a transcript and `codex delete` removes it. Neither
gives a fork that keeps a verifiable, unmutated parent. Continuum's
`/continuum-fork` refuses while the Session is running, forks at a
completed-turn boundary, and retains the parent. Archive remains a
human-confirmed client action and is never triggered by a model.

**3. Safety guards are mutation-tested, not asserted.**

This is the part that distinguishes the project from most "production
ready" claims. Every guard was verified by deleting it and confirming the
test suite fails:

```sh
# the suite passes
python3 -B -m unittest discover -s .agent-workspace/tests
# 53 tests, node plugin regression, doctor 0 errors / 0 warnings
```

Ten guards have been mutation-checked this way, including four that
initially *passed* without their test — which is exactly the failure mode
that makes a test suite a source of false confidence rather than evidence.

**4. It refuses to touch the control plane.**

Measured, not promised: the DSH source checkout shows an empty
`git diff HEAD` and an empty `git diff --cached`, and the installed
shipped presets hash to the values recorded before this work began. See
`docs/main-system-safety.md`.

## What Continuum does not do

Stated plainly, because these are the reasons to choose something else.

- **It does not survive a crash mid-turn.** No loss budget is claimed.
  LangGraph documents one per durability mode; Continuum documents none
  because the experiment has not been run.
- **It does not deduplicate external effects.** There is no operation key
  with a receiver-side unique constraint. Stripe loses idempotency
  protection silently after 24 hours; Temporal bounds reuse checks by
  retention. Continuum implements neither.
- **It does not authorize a resumed run.** No vendor we examined documents
  how to prevent a resumed run inheriting a broader permission set than
  its parent. That is an unsolved problem, not a solved one.
- **It does not manage long-horizon memory.** No provenance, no
  supersession, no TTL, no consolidation. It refuses to write semantic
  memory at all, which is a deliberate non-goal rather than a feature.
- **It is not a scheduler, a queue, or a workflow engine.**
- **It is new.** One project, a bounded number of contributors, and a
  validation ledger whose real-DSH gates are still marked `DEFERRED`.

## Which gates remain unproven

`docs/acceptance-matrix.md` is the authority. Five gates are deferred and
are not claimed anywhere else in this repository:

| gate | why it is deferred |
|---|---|
| crash / approval / tool-boundary recovery | needs a disposable DSH profile with fault injection |
| fresh-agent recovery from generated context | the context pack is generated and hashed, but no fresh agent has consumed it |
| cross-session authorization and duplicate effects | source-level guard tests only; no real fork plus approval pause plus sink idempotency run |
| validation profile execution | the CLI validates policy; it deliberately does not execute arbitrary profile commands |
| monorepo package-scope depth | scope ids, paths, dependencies and cycles are validated; package manifests are not yet cross-checked |

Anyone considering this for unattended recycling should read that table
first. The release rule in the same file is unambiguous: automatic
archiving, autonomous memory writes, and unattended recycling stay disabled
until every deferred row has an artifact, an exact version, a commit, and a
reproducible result.

## Performance

Local, reproducible, no API (`python3 -B bench/benchmark.py`):

```text
command                min (ms)  median (ms)
doctor --strict           155.7        161.6
status                     42.9         45.0
context T-0001             62.6         65.9
close --dry-run           163.7        173.3
node plugin test           68.4         70.5

 tasks  doctor (ms)  status (ms)    ms/task
     1          138           45      138.50
    10          151           43       15.06
    50          230           51        4.61
   200          539           74        2.70
```

Measured on CPython 3.12.3, Linux x86_64. Timings are machine-specific;
re-run the script rather than quoting these. Scaling is linear, and the
marginal cost per task falls as startup cost amortises.

These are not competitive numbers, and they are not meant to be. The point
is that the correctness gates are cheap enough to run on every change,
which is the property that makes the mutation-testing claim affordable.

## When to use something else

- If you need **workflow durability and replay**, use Temporal or LangGraph.
  They have production histories Continuum does not.
- If you need **model memory with provenance**, use a memory system. The
  research review in `docs/research/context-engineering-sota-review.md`
  covers Mem0, Zep/Graphiti, A-MEM, LangMem and Letta with their real
  limitations. Continuum deliberately writes no memory.
- If you need **routing between models**, use FrugalGPT or RouteLLM
  patterns, and validate the cheap-model acceptance test independently.
  Continuum's router is a route table, not a learned router.
- If you want **zero server dependencies and a single binary's worth of
  setup**, Continuum is the only one of these that runs from a Python
  script with no dependency at all.

## Sources

The claims about vendor behaviour in this document come from
`docs/research/context-engineering-sota-review.md` and its source ledger
at `.agent-workspace/research/RES-0001-context-engineering/`, which records
URL, access date, locator and confidence per source. Where a vendor does
not document something, the ledger says `NOT DOCUMENTED` rather than
inferring an answer.
