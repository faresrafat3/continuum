# Continuum dynamic Host package

The active process-local package is `hand-3/pkg-13` (`Continuum Handoff + Human Fork (bounded inputs)`).

## Capabilities

- `continuum_handoff` model tool: current Agent/Session only; returns bounded facts and a pasteable recovery prompt; no mutation.
- `/continuum-handoff [TASK_ID]`: human command; returns the same prompt without sending it to the model.
- `/continuum-fork [TASK_ID]`: human command; refuses while the current Session is running, an open turn is present, a background job is nonterminal, or the current goal is active; then forks at the product API's completed-turn boundary, retains the parent, and never archives.

## Safety

- No arbitrary cross-session id is accepted.
- Archive remains the existing user-confirmed Workspace UI action and is one-way navigation metadata, not deletion.
- The package does not edit Host composition, shipped presets, persistence, credentials, or the Main System.
- Dynamic definitions disappear on DSH restart; use `cordis_inspect_self` with `pluginId=hand-3` and `packageId=pkg-13` to recover the exact source, then define it again if needed.

## Current verification

`cordis_inspect_self(pluginId="hand-3", packageId="pkg-13")` reports Host `running`, no waiting services, and no published services. The source-level test `node plugins/continuum-handoff.test.mjs` passes, including bounded typed inputs, fail-closed missing-service, running-Session, active-job, paused/active-goal, open-turn, redaction, child identity/workspace/preset, unknown-outcome, inspect-failure, and idempotency guards.
