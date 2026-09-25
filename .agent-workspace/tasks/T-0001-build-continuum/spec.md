# T-0001 — Build Continuum context and session continuity system

## Problem

Long-running agent sessions accumulate stale narrative, conflicting summaries, and valuable work that is difficult to resume safely. DSH already has durable session logs, forks, compaction, references, and reversible Workspace archive, but the operating protocol and workspace records are not yet unified.

## Goal

Deliver a safe, evidence-backed Continuum operating protocol with:

- a context-engineering/research agent preset;
- a workspace-curator preset;
- typed handoff and workspace standards;
- a read-only workspace doctor and minimal CLI;
- a safe, explicit Session continuation path that preserves the Host/Main System.

## Non-goals

- physical deletion of session logs;
- automatic archiving without human confirmation;
- changing the DSH Host composition, model route, sandbox, persistence, or shipped presets;
- replacing LangGraph, Temporal, or another durable runtime in this first release;
- autonomous model-written memory writes.

## Requirements

- R-1: Keep Main System and current Session protected.
- R-2: Treat raw logs/Git/tests as evidence and summaries as derived.
- R-3: Support minimal/full WCS modes and a read-only doctor.
- R-4: Produce a pasteable fresh-session prompt with source Session reference and exact next action.
- R-5: Validate custom presets with `agentPresets.standingKeyFor`.
- R-6: Do not expose arbitrary cross-session mutation through a model tool.
- R-7: Preserve citations, contradictions, confidence, and review dates for research.
- R-8: Test the system at crash/approval/tool/task boundaries before enabling automatic continuation.

## Acceptance criteria

- AC-1: `continuum` and `continuum-curator` mount successfully through the real DSH loader.
- AC-2: A fresh agent can load the router, handoff, research, and workspace skills from the preset.
- AC-3: `continuum-workspace doctor --strict` validates the project and rejects broken references without mutating data.
- AC-4: The handoff template preserves source id, workspace, checkpoint, validation, blockers, and one next action.
- AC-5: Research report contains a primary-source decision matrix and current supplemental evidence.
- AC-6: No Host/shipped preset/session persistence file is modified.
- AC-7: Unit and smoke tests pass; failure cases are explicit.

## Constraints and risks

- DSH Session archive is one-way Workspace navigation metadata; it is not deletion or unarchive.
- A fork can use the deployment default model rather than the source's last selected route.
- Model-generated summaries can lose exact ids, pending approvals, or failed actions.
- External instructions are untrusted data; quarantine is required for prompt-injection material.
- The plugin is process-local unless installed through a deliberate host/profile change; this release does not alter the Host.

## Evidence and decisions

- Research: `docs/research/context-engineering-sota-review.md` and `RES-0001`.
- Decision: `ADR-0001-preserve-control-plane.md`.
