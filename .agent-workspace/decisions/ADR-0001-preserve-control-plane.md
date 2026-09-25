# ADR-0001: Preserve the DSH control plane during session recycling

- status: accepted
- date: 2026-09-25
- scope: Continuum
- related_task: T-0001

## Context

Session compaction and recycling can improve model context, but in-place mutation risks losing audit history, carrying stale grants, and obscuring lineage. DSH Host services own persistence, model routing, sandbox, approval, and shipped presets.

## Decision

Continuum treats the DSH Host/Main System as a stable control plane. It recycles only a disposable working context through a typed handoff and a distinct child/fresh Session. The parent log remains readable for rollback. Workspace archive is a separate, human-confirmed, one-way navigation operation and never means deletion.

## Alternatives considered

- In-place reset: rejected because it destroys lineage and can retain stale authority.
- Prose summary only: rejected because exact ids, pending work, errors, and provenance can disappear.
- Automatic archive/delete: rejected because the user must choose and the underlying APIs do not provide safe deletion.
- Host-level model tool for arbitrary session ids: rejected because session query is context-wide and not an authorization boundary.

## Consequences

- More explicit handoff and verification work.
- Parent history and workspace evidence remain available.
- A client-confirmed continuation action is required before archiving.
- External side effects need idempotency keys and fresh policy checks.

## Revisit conditions

Revisit only after crash-boundary tests, authorization tests, and a golden critical-fact corpus demonstrate safe child activation.
