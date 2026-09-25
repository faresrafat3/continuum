# Architecture

## Two planes

- **Control plane:** DSH Host composition, model route, sandbox/approval policy, persistence, shipped presets, and the stable Continuum identity. Session recycling never mutates it.
- **Working plane:** active model context, raw recent turns, scratch notes, and temporary subagent traces. It is recyclable at a quiescent boundary.

## Durable records

- Session event log: append-only transport and audit source.
- WCS task/spec/plan/state/validation/handoff: current task truth.
- Git/files/tests: observed implementation state.
- Research claim/source ledger: cited external knowledge.
- Generated context pack: bounded, rebuildable projection.

## Session recycling

1. classify and protect;
2. capture a typed handoff;
3. validate schema, provenance, workspace, and policy;
4. create a distinct least-privilege child or fresh Session;
5. verify recovery;
6. retain the parent for rollback;
7. archive only after explicit human confirmation.

Archive hides a Workspace row; it does not delete or unload a Session.

## Security

No model-facing tool accepts an arbitrary cross-session id for mutation. Session references are bounded, untrusted recall. All destructive or externally visible operations require an explicit policy check and idempotency key.
