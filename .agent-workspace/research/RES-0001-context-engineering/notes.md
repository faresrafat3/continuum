# RES-0001 findings

The canonical research synthesis is [`docs/research/context-engineering-sota-review.md`](../../docs/research/context-engineering-sota-review.md). This record is the claim ledger and points to the full report; it is not a duplicate prose summary.

## Claims

- **C1 — Long context is a constrained working set.** [S1, S2, S3] Evidence: [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/), [NoLiMa](https://arxiv.org/abs/2502.05167), [Context Rot 2026](https://arxiv.org/html/2606.29718v2). Scope: retrieval/agent trajectories; confidence high for the risk, not a universal model ranking.
- **C2 — Compaction is derived and lossy.** [S9, S5] Evidence: [LLMLingua](https://aclanthology.org/2023.emnlp-main.825/), [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), DSH compaction contracts. Scope: prompt/context compression; confidence high.
- **C3 — Durable execution is separate from conversation storage.** [S5] Evidence: [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [Temporal workflow execution](https://docs.temporal.io/workflow-execution), [ADK resume](https://adk.dev/runtime/resume/), [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/), [PydanticAI durable execution](https://pydantic.dev/docs/ai/durable_execution/overview/). Scope: framework contracts; confidence high.
- **C4 — Replay can duplicate external effects.** [S5] Evidence: [Temporal activities](https://docs.temporal.io/activities), [ADK resume](https://adk.dev/runtime/resume/), [OpenAI HITL](https://openai.github.io/openai-agents-python/human_in_the_loop/). Scope: documented retry/resume semantics; confidence high.
- **C5 — Memory needs provenance and supersession.** [S3, S4, S6, S7] Evidence: [Memory Injection](https://arxiv.org/abs/2503.03704), [ACE](https://arxiv.org/html/2510.04618v3), [PACE](https://aclanthology.org/2026.acl-long.1252/), [LongMemEval](https://openreview.net/forum?id=pZiyCaVuti). Scope: benchmark/method evidence; confidence medium-high, not production authorization.
- **C6 — Workspace records beat prose-only continuity.** [S8] Evidence: [Spec Kit](https://github.com/github/spec-kit), [BMAD workflow map](https://docs.bmad-method.org/reference/workflow-map/), [OpenSpec](https://github.com/Fission-AI/openspec), [Git worktree](https://git-scm.com/docs/git-worktree). Source type: practitioner/official project guidance; confidence medium.

## Recommendation

Keep the DSH Host/Main System authoritative, preserve append-only evidence, use typed checkpoints and bounded context projections, gate forks on verified quiescence, and treat memory/context evolution as a controlled proposal until the local falsification suite passes.
