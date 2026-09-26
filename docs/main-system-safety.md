# Main System Safety Evidence

Recorded: 2026-09-25

## Scope

Continuum writes only under:

- `/home/fares/continuum-system/`
- `/home/fares/.dsh/.agent-presets/continuum/`
- `/home/fares/.dsh/.agent-presets/continuum-curator/`

The dynamic Package `hand-3/pkg-14` is process-local and is owned by this Session.

## Checks

- Source checkout `/home/fares/Projects/deepseek-harness`: `git diff --name-only HEAD` empty and `git diff --cached --name-only` empty. No tracked or staged change exists in the Main System.
- Shipped preset hashes of the **installed** deployment, re-verified on 2026-09-26:

```text
~/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-presets/presets
  standard/agent.cordis.yml  08a029c64fdeaabe415a5627ef73ce6f6c6bc61dadaf9989d11f9e15608907f6
  cordis/agent.cordis.yml    2b8d89c3137ce685f3d97f65aea5bd1c5099e08bba6c16815768245f8fb61d2d
```

- The deployment preset directory contains only `cordis`, `minimal`, `ptc`, `standard`. Neither `continuum` nor `continuum-curator` was written there; both live only in the user plane at `~/.dsh/.agent-presets/`.
- The custom presets were copied through `agentPresets.copy()` and mount-validated with `agentPresets.standingKeyFor()`.
- The DSH Host composition, shipped preset files, persistence registry, credentials, and model route were not edited.
- `hand-3/pkg-14` reports Host `running`, no waiting services, and publishes no services. Its fail-closed guards require bounded typed inputs, goals/jobs visibility, quiescent turn/job state, a non-active goal, child identity/workspace/preset inspection, process-local outcome-key caching, and an idempotency key before reporting a fork.
- The nested Continuum repository has no Git remote (`git remote | wc -l` = 0), so nothing in this task can be pushed anywhere.

## Known pre-existing condition

The DSH checkout contains an untracked `.agents/skills/dyno-pony/` tree that was not created or modified by this task. It is excluded from the diff check above and is not part of Continuum.
