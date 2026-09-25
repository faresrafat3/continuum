---
schema_version: 1
kind: Research
id: RES-0001
slug: context-engineering-sota
title: Clean context engineering and durable session recycling
question: Which evidence-backed patterns should guide Continuum's context, memory, routing, and session continuity design?
status: verified
scope_ids: [root]
related_tasks: [T-0001]
created_at: 2026-09-25T00:00:00Z
updated_at: 2026-09-25T05:45:00Z
review_by: 2027-03-25
method: primary papers, official docs, first-party repositories, local DSH source audit
limitations: "Framework benchmark numbers are not automatically transferable to DSH; client-confirmed continuation UI is not yet implemented."
extensions: {}
---

# Findings

- C1 — Long context degrades retrieval and can cause premature termination; use targeted context and measurable critical-fact recall. Sources: Lost in the Middle, NoLiMa, Context Rot 2026.
- C2 — Compaction is lossy and should be a derived, source-anchored view. Sources: LLMLingua, Anthropic context guidance, DSH compaction contracts.
- C3 — Durable execution and conversation storage are separate concerns; replayed external effects need idempotency. Sources: LangGraph, Temporal, ADK, PydanticAI docs.
- C4 — Memory requires provenance, update, supersession, forgetting, and retrieval controls. Sources: memory survey, A-Mem, MINJA.
- C5 — Workspace specs plus typed state, Git identity, validation, and handoffs beat prose-only documentation. Sources: Git worktree, Spec Kit, BMAD, OpenSpec, Agent OS.

# Full report

See `docs/research/context-engineering-sota-review.md` for the cited matrix, rubric, anti-patterns, and 2026 supplemental evidence.

# Recommendation

Implement a narrow local handoff/doctor MVP first, then add a client-confirmed fork-and-continue action. Keep the control plane immutable and measure before enabling autonomous memory evolution.
