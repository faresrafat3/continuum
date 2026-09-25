# Glossary

- **Control plane:** Host-owned identity, policy, model route, approvals, persistence, and security invariants; never recycled by a Session handoff.
- **Working context:** Disposable model-visible projection assembled from current task state, bounded evidence, and recent turns.
- **Checkpoint:** Typed, source-linked recovery state; not a world rollback and not an authorization grant.
- **Handoff:** Verified recovery record naming the source Session, workspace, checkpoint, evidence, and one next action.
- **Quarantine:** Untrusted material that is not executable input and cannot become policy by being read.
- **Archive:** Versioned terminal history; navigation metadata is not physical deletion.
- **Idempotency key:** Stable operation identity used to prevent replayed fork/tool effects from duplicating work.
