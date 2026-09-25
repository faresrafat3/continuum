# Workspace map

## Purpose

Continuum coordinates clean-context research, session handoffs, and workspace governance for DSH without changing the Host control plane.

## Canonical files

| Concern | Path |
|---|---|
| machine manifest | `.agent-workspace/workspace.yaml` |
| validation policy | `.agent-workspace/validation.yaml` |
| product context | `.agent-workspace/context/product.md` |
| architecture | `.agent-workspace/context/architecture.md` |
| roadmap | `.agent-workspace/context/roadmap.md` |
| active task | `.agent-workspace/tasks/T-0001-build-continuum/` |
| research | `.agent-workspace/research/` and `docs/research/` |
| decisions | `.agent-workspace/decisions/` |
| templates | `.agent-workspace/templates/` |
| read-only doctor | `bin/continuum-workspace` |

## Reading order

1. `AGENTS.md`
2. this file
3. `.agent-workspace/workspace.yaml`
4. active task identity, spec, state, latest handoff
5. relevant plan/ADR/research claim
6. actual Git/worktree state and focused checks

Do not load the archive, quarantine, generated raw output, or unrelated home directories by default.

## Trust zones

`generated/` is rebuildable output; `scratch/` is disposable; `quarantine/` is untrusted input; `archive/` is terminal history. Secret values live only in the approved secret manager.
