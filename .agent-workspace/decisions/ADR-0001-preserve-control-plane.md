---
schema_version: 1
kind: Decision
id: ADR-0001
title: Preserve the DSH control plane during session recycling
status: accepted
scope_ids: [root]
related_tasks: [T-0001]
supersedes: []
superseded_by: null
context: "Session compaction can improve model context, but in-place mutation risks losing audit history, carrying stale grants, and obscuring lineage."
decision: "Continuum treats the DSH Host/Main System as a stable control plane. It recycles only a disposable working context through a typed handoff and a distinct child/fresh Session. The parent log remains readable for rollback. Workspace archive is separate, human-confirmed navigation metadata and never means deletion."
alternatives:
  - "In-place reset: destroys lineage and can retain stale authority."
  - "Prose summary only: exact ids, pending work, errors, and provenance can disappear."
  - "Automatic archive/delete: the user must choose and the APIs do not provide safe deletion."
  - "Host-level model tool for arbitrary session ids: session query is context-wide and not an authorization boundary."
consequences:
  - "More explicit handoff and verification work."
  - "Parent history and workspace evidence remain available."
  - "A client-confirmed continuation action is required before archiving."
  - "External side effects need idempotency keys and fresh policy checks."
risks:
  - "A stale or incomplete handoff can misstate current state."
  - "A replayed side effect can duplicate work unless the sink enforces an operation key."
  - "Archive is one-way Workspace navigation metadata."
rollback: "Keep the parent Session and workspace evidence readable; stop at the recovery conflict and ask for one focused human decision. Do not delete or reset the parent."
evidence:
  - "RES-0001: Clean context engineering for long-running agents"
  - "H-20260925-002: Continuum recovery protocol"
  - "ADR-0001-preserve-control-plane.md body sections below"
revisit_conditions:
  - "Crash-boundary recovery tests pass."
  - "Authorization and fresh-session recovery tests pass."
  - "A golden critical-fact corpus demonstrates no unsupported completion claims."
---

# ADR-0001: Preserve the DSH control plane during session recycling

## Context

Session compaction and recycling can improve model context, but in-place mutation risks losing audit history, carrying stale grants, and obscuring lineage. DSH Host services own persistence, model routing, sandbox, approval, and shipped presets.

## Decision

Continuum treats the DSH Host/Main System as a stable control plane. It recycles only a disposable working context through a typed handoff and a distinct child/fresh Session. The parent log remains readable for rollback. Workspace archive is a separate, human-confirmed, one-way navigation operation and never means deletion.

## Alternatives considered

- In-place reset: rejected because it destroys lineage and can retain stale authority.
- Prose summary only: rejected because exact ids, pending work, errors, and provenance can disappear.
- Automatic archive/delete: rejected because the user must choose and the underlying APIs do not provide safe deletion.
- Host-level model tool for arbitrary session ids: rejected because session query is context-wide and not an authorization boundary.

## Consequences and trade-offs

- More explicit handoff and verification work.
- Parent history and workspace evidence remain available.
- A client-confirmed continuation action is required before archiving.
- External side effects need idempotency keys and fresh policy checks.

## Security/data/operational risks

A stale handoff can misstate state; replay can duplicate an effect; archive is one-way navigation metadata. These risks are tested before enabling automatic recycling.

## Rollback or migration

Keep the parent readable, stop at a recovery conflict, and ask one focused human decision. Never delete or reset the parent as rollback.

## Evidence

See `RES-0001`, `H-20260925-002`, and the research report's safe-recycling gates.

## Revisit conditions

Revisit only after crash-boundary, authorization, idempotency, and golden critical-fact recovery tests demonstrate safe child activation.
