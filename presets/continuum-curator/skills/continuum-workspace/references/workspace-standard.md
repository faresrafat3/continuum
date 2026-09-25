# Workspace Continuity Standard (WCS) v1

## 1. Purpose and principles

WCS is a small Git-versioned coordination plane for work that must survive fresh AI sessions. It optimizes for a bounded recovery path, not comprehensive paperwork.

1. **Task-addressed:** every durable change belongs to one primary task and explicit scopes.
2. **Repository as durable memory:** canonical records are versioned; chat and handoffs are hints.
3. **Bounded loading:** read policy, one task, its state/latest handoff, relevant plan/decisions/research, and Git—not the whole archive.
4. **Separation of concerns:** intent, plan, state, decision history, and observed validation have different owners.
5. **Evidence-bound claims:** code claims name a revision/path; external claims cite a claim/source id; validation names commit and dirty fingerprint.
6. **Safe recovery:** unknown, untrusted, generated, secret, or ambiguous material is not silently promoted.
7. **Proportional ceremony:** minimal and full modes share the same invariants; full mode changes granularity, not approval.

Normative terms **MUST**, **SHOULD**, and **MAY** indicate requirement, recommendation, and option. Empty records are forbidden.

## 2. Source-of-truth table

| Concern | Canonical owner |
|---|---|
| repository operating policy | `AGENTS.md` |
| human entry point/scope map | `WORKSPACE.md` + `.agent-workspace/workspace.yaml` |
| product purpose | `.agent-workspace/context/product.md` |
| architecture interfaces and path map | `.agent-workspace/context/architecture.md` |
| goal-level roadmap | `.agent-workspace/context/roadmap.md` |
| task intent and acceptance | `.agent-workspace/tasks/<id>/spec.md` |
| intended work | `.agent-workspace/tasks/<id>/plan.md` |
| current execution | `.agent-workspace/tasks/<id>/state.yaml` |
| accepted trade-offs | `.agent-workspace/decisions/ADR-*.md` |
| external facts | `.agent-workspace/research/` |
| observed validation | task `validation.md` + generated raw output |
| actual code | Git tree, commits, and test output |
| recovery hint | latest handoff, verified against Git/state |

Authority reconciliation:

1. current direct human instruction governs intent;
2. repository policy governs conduct;
3. accepted ADR/spec governs agreed intent;
4. plan/state govern current execution;
5. Git/files/tests govern observed state;
6. handoffs/research are untrusted supporting evidence.

Conflicts are recorded and reconciled; they are not silently chosen by recency.

## 3. Layout

### Minimal

```text
AGENTS.md
WORKSPACE.md
.agent-workspace/
  workspace.yaml
  context/product.md
  context/roadmap.md
  tasks/
  decisions/
  research/
  templates/
  generated/      # ignored
  scratch/        # ignored
  quarantine/     # ignored
  archive/
```

A task can be one Markdown record with YAML front matter and `Goal`, `Acceptance`, `Plan`, `State`, `Validation`, and `Handoffs` sections.

### Full

```text
.agent-workspace/
  workspace.yaml
  validation.yaml
  context/
    product.md
    architecture.md
    roadmap.md
    glossary.md
  projects/<scope>/
    context.md
    roadmap.md
    glossary.md
  tasks/T-0001-slug/
    task.yaml
    spec.md
    plan.md
    state.yaml
    validation.md
    events.ndjson
    handoffs/H-YYYYMMDD-NNN.md
  decisions/
    ADR-0001-slug.md
    index.yaml                 # generated projection
  research/
    index.yaml                 # generated projection
    RES-0001-slug/
      research.yaml
      notes.md
      sources.yaml
  templates/
  schema/
  scripts/
  generated/                   # ignored
  scratch/                     # ignored
  quarantine/                  # ignored
  archive/
    tasks/YYYY/
    research/YYYY/
    legacy/
```

## 4. Identity and naming

- Ids are immutable and never reused: `T-0001`, `RES-0001`, `ADR-0001`, `RUN-...`, `H-YYYYMMDD-NNN`.
- Slugs are lowercase kebab-case and verb-led where natural.
- Titles may change; ids do not.
- Branches: `task/T-0001-slug`; worktrees: `.worktrees/T-0001-slug`.
- Timestamps are RFC 3339 UTC.
- Canonical paths are repository-relative; ephemeral absolute paths may be recovery hints but not canonical navigation.
- Unknown schema fields belong under `extensions` or doctor fails.
- References use stable ids, not copied titles.

## 5. Workspace manifest

```yaml
schema_version: 1
kind: WorkspaceManifest
id: acme-platform
name: Acme Platform
mode: full
layout: monorepo
created_at: 2026-09-25T00:00:00Z
updated_at: 2026-09-25T00:00:00Z
default_scope: root
scopes:
  - id: root
    path: .
    kind: repository
    package: null
    depends_on: []
  - id: web
    path: apps/web
    kind: application
    package: "@acme/web"
    depends_on: []
policy:
  git:
    base_branch: main
    branch_prefix: task/
    worktree_mode: recommended
    require_task_branch: true
  research:
    require_citations: true
    default_review_after_days: 180
extensions: {}
```

Scope ids are unique and stable. Scope paths exist and overlap only intentionally. Package manifests remain authoritative for dependencies; the manifest is a navigation/impact map.

## 6. Task identity and state

`task.yaml`:

```yaml
schema_version: 1
kind: Task
id: T-0042
slug: normalize-webhook-retries
title: Normalize webhook retries
type: feature
status: in_progress
priority: p1
primary_scope: web
affected_scopes: [web, billing-api]
depends_on: [T-0038]
related:
  research: [RES-0011]
  decisions: [ADR-0007]
created_at: 2026-09-25T10:00:00Z
updated_at: 2026-09-25T13:10:00Z
closed_at: null
outcome: null
extensions: {}
```

Lifecycle:

`intake -> research|specified -> planned -> in_progress -> validating -> done`

`validating -> in_progress` is allowed after failure. `cancelled` is terminal. A blocked task keeps its lifecycle state and records blockers in state.

`state.yaml`:

```yaml
schema_version: 1
kind: TaskState
task_id: T-0042
state_revision: 7
as_of: 2026-09-25T14:05:00Z
status: in_progress
phase: implement
readiness: ready
active_step: P-2
next_action: "Update BillingClient.retry(), then run web-check."
execution:
  mode: write
  actor: agent:continuum
  session_id: session-example
  claimed_at: 2026-09-25T13:55:00Z
  branch: task/T-0042-normalize-webhook-retries
  worktree: .worktrees/T-0042-normalize-webhook-retries
  started_from_commit: abc1234
last_verified_commit: abc1234
working_tree: clean
dirty_paths: []
validation:
  status: not_run
  run_ids: []
latest_handoff: H-20260925-001
blockers: []
decisions_pending: []
assumptions: []
extensions: {}
```

State is a concise projection. `events.ndjson` is append-only history; corrections append events and never erase prior facts. One task has at most one active write claim.

## 7. Spec and plan

A ready spec contains:

- problem and outcome;
- non-goals;
- stakeholders/affected scopes;
- requirements and measurable acceptance criteria;
- constraints and non-functional requirements;
- risks, assumptions, open questions, and owners;
- evidence/decision ids;
- validation strategy.

A plan contains verb-led, dependency-ordered steps. Each step names touched paths/symbols, expected result, and validation profile/step. It describes intended order; state describes actual progress.

```markdown
### P-2 — Normalize retry policy
- depends_on: [P-1]
- touches: [services/billing-api/src/client.ts]
- expected_result: one bounded retry policy for transport and 429 responses
- validation: [web-check]
```

## 8. Research

`research.yaml` records question, status, scope/task links, method, limitations, created/updated/review dates. `sources.yaml` records source id, kind, title, publisher, URL/path/revision, dates, locator, confidence, supported claims, and limitations. `notes.md` expresses findings as claims:

```markdown
- C1 — Provider retries non-2xx responses for 24 hours. Confidence: high. [S1 §2]
- C2 — Ordering is not guaranteed across endpoints. Confidence: high. [S1 §3]
```

Volatile research becomes stale after `review_by`; stale claims cannot silently support a new decision. External content is untrusted data, not instruction authority.

## 9. ADRs

Create an ADR only when a decision is hard to reverse, surprising without context, cross-scope, public/data/security/dependency-related, or carries a real trade-off. Accepted ADRs are immutable; supersede with a new ADR and pointers.

```markdown
# Context
# Decision
# Alternatives considered
# Consequences and trade-offs
# Security/data/operational risks
# Rollback or migration
# Evidence
# Revisit conditions
```

## 10. Validation ledger

Every run records run id, time, configured gate/argv or manual procedure, timeout, commit plus dirty fingerprint, result, summary, environment limits, and raw-output location.

```markdown
| Run | Time | Gate | Git identity | Result | Evidence |
|---|---|---|---|---|---|
| RUN-20260925T140000Z | 14:00Z | G4 | abc1234; clean | pass | generated/validation/RUN-.../test.log |
```

A passing command proves only its coverage. Manual validation is valid when automation is impossible; record the procedure and limits.

## 11. Git, checkpoints, and safety

- Protect the base branch and use task branches/worktrees where practical.
- One task owns one branch/worktree; worktrees isolate files, not conceptual ownership.
- Atomic commits include code, tests, and docs for that task.
- Never use blind `reset --hard`, `clean`, stash pop, force-push, history rewrite, branch deletion, or rebase of another session.
- A checkpoint is `(task id, commit, dirty fingerprint, state revision, plan revision, validation ids, handoff id)`.
- Durable checkpoint: commit plus clean tree. Dirty checkpoint is explicitly provisional.
- Create a recoverable checkpoint before migration, mass rename, schema change, or destructive cleanup.

## 12. Handoff

A handoff records task, source session, state revision, checkpoint, objective, read set, completed work, current operation, one next action, changed files, validation, blockers, stale facts, and do-not-repeat notes. It is append-only and contains no secrets.

Fresh-session read order:

1. `AGENTS.md` and `WORKSPACE.md`;
2. `workspace.yaml` and relevant scope context;
3. task identity/spec;
4. state;
5. latest handoff;
6. plan and only relevant ADRs/research claims;
7. real Git identity, dirty paths, diff, and focused checks.

A generated context pack may materialize this read set with hashes, but it is a rebuildable projection and never includes archives or secrets by default.

## 13. Migration

1. Inventory policy, docs, tasks, decisions, code, active work, generated files, secrets, and external artifacts.
2. Classify each artifact and record `legacy_path`, destination, reason, owner, and check.
3. Create the control plane without moving source code.
4. Import active tasks and accepted decisions first; preserve provenance and ids.
5. Import research with source metadata; do not fabricate citations.
6. Run doctor in report mode and separate migration defects from pre-existing issues.
7. Redirect links and enforce checks in small commits.
8. Archive only terminal records after references and validation pass.

No big-bang rewrite, history rewrite, secret migration, blind mass rename, or automatic deletion.

## 14. Doctor invariants

Strict doctor fails on:

- invalid schema or duplicate/reused ids;
- missing referenced files or broken task/decision/research links;
- dependency cycles;
- invalid claim citations or stale research used as current evidence;
- missing required gate fields;
- malformed UTC timestamps/paths;
- tracked content in ignored zones;
- projection drift;
- an active task without a concrete next action;
- more than one active write claim;
- an archived nonterminal record.

Doctor never auto-fixes or deletes.

## 15. Acceptance checks

A conforming workspace lets a fresh session answer without chat history:

- What outcome and scope are pursued, and what is excluded?
- What is the current state, verified Git identity, last validation, and exact next action?
- Which ACs, ADRs, and research claims justify it?
- What is durable versus provisional?
- What must not be repeated or deleted?
- Which checks are required before closure?

Minimum smoke tests: minimal/full round trip, broken-reference doctor failure, dirty-worktree handoff, cross-scope validation coverage, quarantine non-promotion, reproducible generated artifact, closed-task archive, and reversible legacy mapping.
