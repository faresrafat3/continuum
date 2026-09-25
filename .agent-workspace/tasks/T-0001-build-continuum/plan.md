# Plan for T-0001

## Constraints and strategy

Build the smallest portable operating protocol first. Keep DSH Host state untouched. Use the existing session-reference and Workspace APIs instead of reimplementing persistence.

## Steps

### P-1 — Establish control-plane records
- depends_on: []
- touches: [README.md, AGENTS.md, WORKSPACE.md, .agent-workspace/workspace.yaml]
- expected_result: project scope, safety boundary, and validation policy are explicit.
- validation: [repo-fast/workspace-doctor]

### P-2 — Author presets and skills
- depends_on: [P-1]
- touches: [`~/.dsh/.agent-presets/continuum/`, `~/.dsh/.agent-presets/continuum-curator/`]
- expected_result: two user-authored presets mount with progressive-disclosure skills.
- validation: [DSH `standingKeyFor`]

### P-3 — Publish research synthesis
- depends_on: [P-1]
- touches: [docs/research/context-engineering-sota-review.md, .agent-workspace/research/RES-0001-*]
- expected_result: cited framework matrix and current evidence guide implementation.
- validation: [citation and link checks]

### P-4 — Implement WCS doctor/initialiser
- depends_on: [P-1]
- touches: [bin/continuum-workspace, .agent-workspace/schema, .agent-workspace/tests]
- expected_result: minimal/full initialization and read-only strict doctor.
- validation: [repo-fast]

### P-5 — Implement safe Session continuation
- depends_on: [P-2, P-3, P-4]
- touches: [future client-confirmed fork/archive action]
- expected_result: distinct child, typed handoff, protected parent, no automatic archive.
- validation: [fork boundary, recovery, authorization, duplicate-effect tests]

### P-6 — Acceptance and handoff
- depends_on: [P-2, P-3, P-4, P-5]
- touches: [validation.md, state.yaml, handoffs/]
- expected_result: evidence-backed closeout and exact next action.
- validation: [repo-fast, fresh-session recovery review]

## Rollback and migration

All current changes are new user files or new user-authored presets. Rollback is removal of those files/presets after explicit review; no Host or shipped file is touched.

## Open decisions

Whether to install a durable LangGraph/Temporal/PydanticAI adapter is deferred until recovery SLA and crash tests justify it.
