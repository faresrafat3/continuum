# Long-running agent context management: an evidence-backed decision for a local DSH agent

**Research snapshot:** 2026-09-25 (the mutable web documents below should be pinned to a release or commit before implementation).  
**Method:** baseline research without a Continuum skill. I used original papers, official framework documentation, and first-party engineering reports. Vendor engineering reports are evidence about the vendor's own system, not independent proof of comparative superiority.

## Executive decision

There is no single best context-management primitive. The strongest current design is a **layered, evidence-preserving operating protocol**:

1. Keep a stable **control plane** (system/agent policy, tool and approval policy, task identity, and durable state) outside the model context.
2. Treat the model window as a **rebuildable working projection** assembled from a small stable header, a typed task capsule, verified progress, a short raw tail, and just-in-time evidence.
3. **Offload and trim** bulky tool output first. Preserve the complete output in an append-only store and show the model a bounded preview plus a locator.
4. At a measured pressure threshold, **compact only an older balanced span** into an evidence-linked checkpoint while retaining a recent raw tail. Never make the prose summary the system of record.
5. Use **clean-context isolation** for independent or high-volume work. A child gets a narrow task, its own authority scope, and returns a typed result or an artifact reference; it does not silently become the parent’s memory.
6. **Checkpoint execution durably before model requests and side-effecting tools**, and at safe step boundaries. Checkpoints support recovery; they do not create exactly-once external effects.
7. Add **evolving memory only as a governed, derived layer**: provenance, scope, confidence, source event/artifact anchors, supersession, expiry, and explicit write policy. Do not let an unconstrained model write authority-bearing or security-bearing memory.

For the installed local DSH build, I recommend composing the existing session persistence, checkpoint policy, spill, tool-result pruner, compaction, session-reference, and subagent packages rather than introducing a new orchestration framework. Keep the Host/Main System unchanged. Treat a fresh child session plus a typed handoff as the safe recycling boundary, retain the parent as rollback, and add autonomous memory evolution only behind a measured feature flag.

The ordering is intentional:

> **durable evidence and checkpoints → offload/trim → pressure-triggered compaction → task-triggered isolation → optional governed memory evolution.**

This ordering follows the convergent evidence that context is finite and noisy, while also reflecting the important limitation that no framework documentation establishes a universal ranking of these methods.

## What each mechanism does

| Mechanism | What it changes | Best use | Main failure mode | DSH recommendation |
|---|---|---|---|---|
| **Compaction** | Rewrites an older span into a smaller representation, usually a model-written summary or an opaque compaction item. | Long, coherent conversations where a model needs continuity and the retained facts can be checked. | Loss of subtle constraints, exact identifiers, failed attempts, contradictions, or unresolved approvals. Auxiliary summarization also costs money and can itself be wrong. | Use as a derived, source-linked checkpoint at pressure; retain a raw tail and keep the raw event log. |
| **Trimming / clearing** | Drops or replaces tokens/results without rewriting the whole conversation. | Large, already-consumed tool outputs, duplicated search results, and low-value intermediate observations. | Important material can be in the discarded middle; a purely syntactic head/tail rule has no notion of semantic importance. | Use model-free, bounded previews or locators before compaction; preserve originals in the log. |
| **Isolation** | Moves a subtask into a fresh child context, worktree, or external artifact and returns a bounded result. | Parallel research, independent verification, broad exploration, and preventing one noisy task from polluting the main history. | Coordination overhead, duplicated token cost, loss of shared state, and weak fit for tightly dependent sequential work. | Use fresh `spawn` children with explicit task/output contracts; use `fork` only when completed parent turns are genuinely needed. |
| **Durable checkpoint** | Persists an execution cursor, events, approvals, tool-call identity, and/or graph state so a process can resume. | Crash recovery, approval waits, long-running jobs, and safe context recycling. | A checkpoint records intent or state, not necessarily that an external effect completed; replay can duplicate a side effect. | Use DSH's fail-closed checkpoint policy plus idempotency keys and an explicit `TOOL_OUTCOME_UNKNOWN` path. |
| **Evolving memory** | Persists, retrieves, consolidates, and revises facts/lessons across sessions. | User preferences, durable project knowledge, reusable procedures, and cross-session continuity. | Stale or poisoned facts, last-write-wins corruption, privacy leakage, context collapse, and over-retrieval. | Start with explicit/user-approved writes and provenance-bearing records; make model-driven consolidation a proposal until evaluated. |

These are complementary operations, not mutually exclusive product choices. A local agent can (and should) use all five at different boundaries.

## Evidence and limits

### 1. A larger advertised context window is not a durable memory system

The original *Lost in the Middle* study found substantial performance degradation when relevant information was moved into the middle of a long input, including for models marketed for long context; its abstract reports the beginning/end advantage on multi-document QA and key-value retrieval ([Liu et al., TACL 2024](https://aclanthology.org/2024.tacl-1.9/)). The NoLiMa benchmark removed easy lexical overlap and found that 13 models advertising at least 128K context degraded sharply as input length grew; at 32K, 11 models were below half of their short-context baselines, and reasoning prompts did not remove the failure ([Modarressi et al., ICML 2025](https://arxiv.org/abs/2502.05167)). These studies are not a ranking of current DSH models, but they establish the risk of treating “fits in the window” as equivalent to “reliably used.”

The practical implication is to optimize the **next decision**, not to maximize the amount of history sent. Anthropic's first-party context-engineering guidance makes the same distinction: context includes system instructions, tools, retrieved data, and history, and the goal is the smallest high-signal token set; it recommends just-in-time retrieval and progressive disclosure rather than loading every artifact up front ([Anthropic, 2025](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

A 2026 long-horizon-search preprint adds a more operational failure mode: across four open models and three search benchmarks, premature give-up or uncertain incorrect answers increased with trajectory length even while substantial window capacity remained. It evaluated compaction, trimming, and isolation, found that all can trade fewer premature terminations for more tool calls and unfinished trajectories, and reported that the best method was model-dependent ([“Diagnosing and Mitigating Context Rot in Long-horizon Search,” arXiv:2606.29718v2](https://arxiv.org/html/2606.29718v2)). Because this is a recent preprint with a bounded model/benchmark setup, it is evidence for a hypothesis and an evaluation design, not a universal production law.

### 2. Compaction: useful projection, not authority

Anthropic describes compaction as summarizing a conversation nearing the window limit and reinitializing a context window, while explicitly warning that aggressive compaction can lose subtle information that becomes important later ([Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)). Its harness report says compaction alone is insufficient: frontier coding agents can leave half-implemented work undocumented or declare a partially complete project done, so the next session needs inspectable artifacts, progress records, and verification ([Anthropic long-running harness, 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).

Current official APIs implement compaction differently, which reinforces the need for an explicit source-of-truth policy:

- **OpenAI Agents SDK sessions** automatically retain conversation history, but `session_input_callback` and `SessionSettings(limit=...)` can select or reorder the model input without rewriting the stored session. The SDK distinguishes client-side session memory from server-managed continuation and serializes paused `RunState` for approval/resume ([OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/), [HITL](https://openai.github.io/openai-agents-python/human_in_the_loop/)). This is a useful separation: input projection and durable execution state need not be the same object.
- **OpenAI Responses compaction** can run server-side at a token threshold or through a standalone endpoint. The resulting compaction item is encrypted/opaque and carries forward state; OpenAI says the returned compacted window is canonical and should not be manually pruned ([OpenAI compaction guide](https://developers.openai.com/api/docs/guides/compaction)). That is efficient for a provider-native deployment, but an opaque item is not a suitable audit record or authority for a local DSH handoff.
- **Google ADK** exposes token-based and turn-based compaction with a configurable recent raw-event tail and configurable summarizer ([ADK context compaction](https://adk.dev/context/compaction/)). The mechanism is a practical reference, not evidence that a particular summarizer preserves all task-critical facts.

**Design implication:** a compaction result should be a versioned, derived record with source event/artifact references, a capture time, model/prompt version, and a validation result. It should never be the only copy of the transcript, a test result, an approval, or a permission decision.

### 3. Trimming and offloading: cheap, useful, and semantically dangerous

Trimming avoids a summarizer call and can immediately relieve pressure. Anthropic identifies clearing old tool calls/results as a relatively safe first compaction lever ([Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)). OpenAI's session callback demonstrates that history can be bounded for the model while the durable store retains the original items ([OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/)).

The risk is that a syntactic trim cannot know which line in a large output will matter later. DSH's own pruner documents this limitation: it retains a head and tail, makes no model call, and leaves the complete original in the session log ([`dsh-compaction-tool-result-pruner` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-tool-result-pruner/README.md)). DSH's spill policy is a stronger local pattern for oversized final text: the model receives a bounded head/tail preview and locator while the full formatted result remains in a spill backend ([`dsh-spill-policy` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-spill-policy/README.md), [`dsh-spill` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-spill/README.md)).

A locator is not automatically an access-control boundary: DSH's spill service states that owner namespaces writes but each backend/retrieval consumer must enforce reads. External web pages, tool output, and another session's transcript must therefore be treated as **untrusted data**, not instructions or authority.

### 4. Isolation: separate work, not shared mutable truth

Anthropic's multi-agent research report describes an orchestrator that delegates independent searches to subagents with their own contexts and returns distilled findings. It reports a 90.2% improvement over a single Opus agent on an internal research evaluation, but also reports roughly 15× the tokens of chat and says the design is a poor fit for tightly dependent coding tasks ([Anthropic multi-agent research, 2025](https://www.anthropic.com/engineering/multi-agent-research-system)). Those are first-party internal results, not an independent benchmark, but the tradeoff is credible: isolation reduces path dependence and context contamination while increasing coordination and compute.

The same report recommends storing subagent outputs as artifacts and passing lightweight references to the coordinator, which avoids a “telephone game” where large outputs are repeatedly paraphrased ([Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)). For DSH, the relevant distinction is:

- `spawn` starts a fresh child with an empty conversation; it inherits selected runtime settings but not the parent's conversation or authority ([`dsh-subagent-spawn-in-process` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/README.md)).
- `fork` copies the parent's completed-turn prefix once, so it pays the token cost again and has no live synchronization; the in-flight parent turn is excluded ([`dsh-subagent-fork-in-process` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/README.md)).

Use `spawn` for independent research/verification and `fork` only for a follow-up that truly needs the parent's completed conversational context. Neither should inherit write authority merely because the parent has it.

### 5. Durable checkpoints: recovery state is different from context

LangGraph's official persistence documentation separates **checkpointers** (thread-scoped graph state for conversation continuity, human-in-the-loop, time travel, and fault tolerance) from **stores** (application-defined data across threads, such as preferences and shared knowledge) ([LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)). This is a useful conceptual boundary: a checkpoint is a recovery cursor, while a store is durable application data; neither should be confused with a model summary.

Temporal provides stronger orchestration guarantees through an append-only Event History, replay, and Continue-As-New for a fresh history carrying selected state ([Temporal Workflow Execution](https://docs.temporal.io/workflow-execution), [Continue-As-New](https://docs.temporal.io/workflow-execution/continue-as-new)). It also states the crucial caveat: an Activity can execute more than once if a worker completes the effect but crashes before recording completion, so Activities should be idempotent and use operation-specific idempotency keys ([Temporal Activity idempotency](https://docs.temporal.io/activity-definition#idempotency)).

Google ADK's resumable workflows similarly restore completed tool results but explicitly describe tools as **at least once** and warn that purchases or other non-idempotent actions may run again ([ADK Resume](https://adk.dev/runtime/resume/)). OpenAI's HITL documentation says serialized `RunState` is designed to be durable, but it also warns that deserialization does not authenticate the snapshot; an application must authenticate the reviewer, authorize the run, validate pending calls, and prevent replay ([OpenAI HITL](https://openai.github.io/openai-agents-python/human_in_the_loop/)).

Therefore the correct claim is **“durable intent and resumable state,” not “exactly-once world effects.”** Every file write, shell command, message delivery, payment, deployment, package activation, and provider call needs an operation key, pre/postcondition, and either a safe retry or an explicit unknown-outcome state.

### 6. Evolving memory: useful, but a separate trust domain

MemGPT's original paper describes virtual context management as moving information between fast and slow memory tiers and evaluates document analysis plus multi-session chat ([Packer et al., 2023](https://arxiv.org/abs/2310.08560)). Reflexion shows a narrower but useful pattern: verbal feedback from task attempts is retained in an episodic memory buffer to improve later decisions ([Shinn et al., NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html)). MemoryBank explores continual updating and forgetting, but its companion evaluation is a long-term companion-dialog setting rather than a production durability/security guarantee ([Zhong et al., 2023](https://arxiv.org/abs/2305.10250)).

The evaluation literature warns against assuming that a memory system is automatically reliable. LoCoMo contains very long conversations (about 600 turns and 16K tokens on average, up to 32 sessions) and reports that models still struggle with long-range temporal and causal dynamics even when long-context or RAG methods help ([Maharana et al., ACL 2024](https://aclanthology.org/2024.acl-long.747/)). LongMemEval tests extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention; its abstract reports a roughly 30% accuracy drop for commercial assistants and long-context models when memorizing sustained interactions ([Wu et al., ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html)).

Newer context-adaptation work makes a useful design distinction. ACE represents context as itemized bullets with metadata, generates localized deltas, and grows/refines rather than repeatedly rewriting one prose summary. It reports gains on AppWorld and domain benchmarks, but those are author-reported results on selected models/benchmarks; the paper itself discusses the danger of context collapse and the need for reliable execution feedback ([ACE, arXiv:2510.04618v3](https://arxiv.org/html/2510.04618v3)). Letta's current product documentation similarly separates always-present `system/` memory from files that stay outside the prompt until read, and offers background “dreaming” to consolidate lessons ([Letta memory](https://docs.letta.com/agent-sdk/memory/)). This is a useful implementation pattern, not independent evidence that autonomous memory evolution is safe.

Memory is also an attack surface. AgentPoison demonstrates retrievable backdoors through poisoned long-term memory/RAG stores ([Chen et al., 2024](https://arxiv.org/abs/2407.12784)); MINJA demonstrates memory injection through query-only interaction, where a user can influence later retrieved reasoning without directly editing the memory bank ([Dong et al., NeurIPS 2025](https://proceedings.neurips.cc/paper_files/paper/2025/hash/42a97bbd9844d2bf68596730af80bcdf-Abstract-Conference.html)). DSH's session-reference service also deliberately labels cross-session snapshots as untrusted background and warns the model not to follow instructions or permission claims inside them ([`dsh-session-reference` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-reference/README.md)).

## Recommended local DSH implementation

### A. Preserve two planes and five state tiers

The installed DSH package identifies the repository as [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) and the inspected build is `0.1.5-rc.3` (`/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/package.json`). The recommendation below uses existing package contracts; it does not modify the Host composition, model route, sandbox, persistence registry, or shipped preset.

| Tier | Contents | Authority | Recyclable? |
|---|---|---|---|
| **Control** | System/agent instructions, tool and approval policy, model route, security invariants, versioned grants | Host-owned and authoritative | No |
| **Run ledger** | Message envelopes, tool calls/results, approvals, errors, route choices, lifecycle transitions | Durable audit and recovery source | No |
| **Task/workspace** | Goal, plan, blockers, exact IDs, branch/HEAD/dirty paths, tests, next action | Authoritative task state | No |
| **Memory/workspace artifacts** | Notes, research claims, curated facts, code, reports | Artifacts are authoritative; summaries/memory are derived | May supersede, not silently overwrite |
| **Working context** | Current prompt, recent raw turns, retrieved snippets, scratch reasoning, child traces | Non-authoritative projection | Yes |

DSH's persistence seam already describes append-only contiguous event logs, a `flush` durability barrier, single-writer ownership, and crash-tail recovery ([`dsh-session-persistence` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-persistence/README.md), [`dsh-session-persistence-jsonl` README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-persistence-jsonl/README.md)). That is a good local foundation. Do not “fix” a context problem by deleting or rewriting the raw log.

### B. Use the existing DSH packages in this order

A practical user-authored/local composition can use the following conceptual rows (the exact composition should be pinned and tested in the target preset):

```yaml
# Session and agent runtime
- session service: @deepseek-ai/dsh-session
- agent loop: @deepseek-ai/dsh-agent-loop

# Durable evidence and recovery
- session persistence: @deepseek-ai/dsh-session-persistence-jsonl
- semantic checkpoints: @deepseek-ai/dsh-session-checkpoint-policy

# Keep bulky observations out of the model window
- spill backend: @deepseek-ai/dsh-spill-local
- spill policy: @deepseek-ai/dsh-spill-policy
- optional compaction pruner: @deepseek-ai/dsh-compaction-tool-result-pruner

# Pressure-triggered derived checkpoints
- token measurement: @deepseek-ai/dsh-token-meter
- compaction: @deepseek-ai/dsh-compaction-basic
- optional manual command: @deepseek-ai/dsh-command-compact

# Explicit, bounded cross-session recall
- session references: @deepseek-ai/dsh-session-reference

# Narrow delegated work
- subagent service: @deepseek-ai/dsh-subagent
- fresh child: @deepseek-ai/dsh-subagent-spawn-in-process
- fork only when needed: @deepseek-ai/dsh-subagent-fork-in-process
```

The package references above are installed local documentation, not a claim that every deployment mounts all rows. The shipped DSH base already has compaction support, but a local long-running agent should verify the actual route, context-window metadata, and persistence configuration rather than assume defaults.

Important local contracts to preserve:

- `dsh-session-checkpoint-policy` is fail-closed: it flushes before a model request, before a top-level tool body, and at the next agent-step boundary; an unmatched persisted call recovers as `TOOL_OUTCOME_UNKNOWN`, not an automatic retry ([checkpoint policy README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-checkpoint-policy/README.md)).
- `dsh-compaction-basic` condenses an older balanced span while keeping a recent tail, records the compaction transaction in the log, and preserves the raw history for replay ([compaction-basic README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-basic/README.md)).
- The pruner is model-free, retains head/tail, and leaves the original event in the log ([pruner README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-tool-result-pruner/README.md)).
- Spill is best-effort for the model-facing result: a storage failure leaves the original result visible rather than converting a successful tool call into a failure ([spill-policy README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-spill-policy/README.md)).
- Session references are bounded snapshots, explicitly untrusted, and not live links or forks ([session-reference README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-reference/README.md)).
- Spawn children start with a fresh flat scope; fork children receive a one-time completed-turn seed and no live parent synchronization ([spawn README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/README.md), [fork README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/README.md)).

### C. Assemble every request from explicit parts

Use a small, stable request envelope rather than “whatever history happens to be in the session”:

1. **System/control header:** identity, safety rules, tool/approval policy, and output contract. Keep this outside recycled working state.
2. **Task capsule:** goal, scope, constraints, non-goals, definitions, current phase, and exact workspace path.
3. **Verified progress:** completed items paired with evidence IDs, test results, current blockers, unresolved questions, and one next action.
4. **Recent raw tail:** enough verbatim turns/tool results to repair references and understand immediate corrections.
5. **Targeted retrieval:** only the files, source spans, memory records, or child artifacts needed for the next decision.
6. **Large evidence outside the prompt:** path/ID/URL/hash plus instructions for a read tool.

Do not put an entire transcript, every prior tool output, or every memory record into the request. Anthropic's guidance and the long-context studies both support this smallest-high-signal approach, but the exact percentage budgets must be measured rather than presented as research constants ([Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/)).

### D. Use a staged trigger policy

The following policy is a safe starting point, not a universal optimum:

| Boundary | Action | Reason |
|---|---|---|
| Before each model request | Flush the session/checkpoint and calculate the routed context budget. | Prevent a crash from losing the request that is about to be sent. |
| Tool result above a configured cap | Spill the full formatted result; show bounded preview + locator. | Removes bulk without an auxiliary model call. |
| Pressure near the routed window limit | Prune oversized tool results first, then compact an older balanced span if still needed. | Cheapest safe reduction before lossy summarization. |
| Independent or high-volume subtask | Start a fresh `spawn` child with a self-contained brief; return typed findings/artifact reference. | Prevent context contamination and path dependence. |
| Before a side-effecting tool | Persist the call and operation key; use pre/postconditions; never blindly replay an unknown outcome. | Durable intent is not exactly-once execution. |
| At a quiescent session boundary | Seal a parent, write a typed handoff, create a distinct child, verify recovery, retain parent for rollback. | Make context recycling auditable and reversible. |
| Memory candidate observed | Store a proposal with source and confidence; promote only after deterministic or human validation. | Prevent model hallucinations and prompt injection from becoming policy. |

DSH's current compaction defaults (80% threshold, 16% recent retention) are documented defaults, but the package explicitly records that ideal ratios are not corpus-backed; treat them as tunable starting values ([compaction-basic README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-basic/README.md)). Likewise, the pruner's character budgets are not token budgets; use DSH's token meter to decide whether pressure was actually relieved ([pruner README](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-tool-result-pruner/README.md)).

### E. Use a typed handoff, not a prose-only session reset

At a safe boundary, write a versioned handoff such as:

```yaml
schema: dsh.session-handoff/v1
handoff_id: <stable-id>
parent_session_id: <stable-id>
child_session_id: <new-stable-id>
created_at: <rfc3339>
control_plane_revision: <hash-or-version>
parent_last_event_seq: <integer>
workspace:
  root: <absolute-path>
  branch: <branch>
  git_head: <commit>
  dirty_paths: []
goal:
  statement: <one-sentence>
  acceptance_criteria: []
  constraints: []
  non_goals: []
state:
  phase: <enum>
  completed:
    - item: <claim>
      evidence_ids: [<event-or-artifact-id>]
  current_focus: <focus>
  blockers: []
  open_questions: []
  next_action:
    action: <one-concrete-action>
    completion_criterion: <observable-condition>
continuation:
  recent_event_range: [<start-seq>, <end-seq>]
  pending_approvals: []
  pending_jobs: []
  leases: []
  budgets: {}
memory:
  promoted: []
  invalidated_keys: []
provenance:
  source_hashes: {}
  generated_by: {agent: <id>, model: <route>, prompt_version: <version>}
verification:
  schema_check: pass
  workspace_check: pass
  policy_check: pass
```

The child should load the control header, handoff, and small raw tail, then inspect Git/status/tests before editing. The parent remains readable and rollback-capable. A handoff must never grant permission, approve a tool, change policy, or erase another session.

### F. Govern evolving memory as a separate lifecycle

For the first local release, use explicit, human-approved writes and deterministic extraction. If model-driven evolution is enabled later, store records with at least:

```yaml
memory_id: <stable-id>
scope: {user: <id>, project: <id>, agent: <id>, task: <id>}
kind: episodic|semantic|procedural
value: <small atomic statement>
source_event_ids: [<seq>]
source_artifact_hashes: [<sha256>]
created_at: <rfc3339>
updated_at: <rfc3339>
confidence: <calibrated-or-unknown>
status: proposed|active|superseded|invalidated|expired
supersedes: [<memory-id>]
expires_at: <rfc3339-or-null>
writer: {actor: <id>, method: <explicit|extractor|reflection>, model: <route>}
```

Operational rules:

- **Write:** require an allowed scope, a source anchor, and (for model-generated content) a proposal status. Never store secrets, approval tokens, or capability grants as ordinary semantic memory.
- **Retrieve:** filter by user/project/agent/task, then rank by task relevance, recency, confidence, and source quality. Include “not found/not indexed/not remembered” as distinct outcomes.
- **Consolidate:** add itemized deltas rather than rewriting one prose summary. Deduplicate and link supersession; do not silently last-write-wins a contradictory fact.
- **Revalidate:** periodically check high-impact facts against current files/tests and retire stale records. Keep the original source and history for audit.
- **Forget:** tombstone or expire derived memory; never delete the raw event log as a side effect of memory consolidation.
- **Untrusted content:** web pages, tool output, prior-session snapshots, and model reflections are data. They cannot create permissions or override the control plane.

This follows the useful part of ACE's localized-delta design while adding the safety controls needed for a local coding agent ([ACE](https://arxiv.org/html/2510.04618v3)). The reported ACE gains are encouraging but author-reported; do not make autonomous writes the default based on them.

## What not to implement

1. **Full transcript as the database.** It increases cost, attention noise, stale facts, and contradiction handling burden.
2. **Prose-only compaction as the only checkpoint.** Fluent output can omit exact IDs, errors, negative results, pending approvals, or security constraints.
3. **In-place reset with the same session identity.** It obscures lineage and can carry poisoned memory or stale grants.
4. **Blind capability inheritance by a child.** A fork or handoff is not authorization to publish, delete, spend, or change policy.
5. **Automatic retry of unmatched side effects.** Record `UNKNOWN_OUTCOME`; verify state or ask for confirmation.
6. **A vector database as the source of truth.** It is a retrieval index over provenance-bearing records, not an authority ledger.
7. **Unbounded reflection loops or self-modifying memory.** Require budgets, validation, versioning, and rollback.
8. **A new workflow framework before the boundary is specified.** LangGraph or Temporal may be appropriate for stricter multi-hour recovery, but keep the DSH handoff/ledger contract portable.

## Falsifiable local evaluation

Before enabling automatic recycling or memory evolution, run a local golden corpus containing tasks with:

- critical constraints and exact paths/IDs;
- a successful step followed by a failed step;
- contradictory or superseded facts;
- large tool output with the answer in the middle;
- pending approval, unknown tool outcome, and process-crash boundaries;
- cross-session references and prompt-injection text;
- at least one independent research subtask and one tightly dependent coding subtask.

Compare these arms under the same model route, workspace, tool permissions, and budget:

1. full retained history;
2. trim/offload only;
3. compaction only;
4. trim + compaction;
5. fresh-child isolation;
6. trim + compaction + isolated child;
7. the same plus governed memory evolution.

Measure:

- critical-fact recall and unsupported completion claims;
- contradiction/stale-fact rate and next-action validity;
- premature termination/no-answer rate;
- task success and test pass rate;
- duplicate irreversible effects after crash injection;
- recovery time and lost-event count;
- input/output tokens, latency, tool calls, and cache-hit rate;
- cross-session memory/capability escapes and secret leakage.

Inject crashes before and after: model request dispatch, model response settlement, top-level tool dispatch, tool result persistence, checkpoint flush, compaction start/summary/end, approval decision, child start/result, and handoff activation. The acceptance gate should be **zero unauthorized or duplicate irreversible effects**, complete recovery of the declared critical facts, unchanged control-plane hashes, and a successful bounded child recovery. This is a proposed experiment, not a result already established by the cited papers.

## Uncertainty and decision confidence

- **High confidence:** long context is a finite, position-sensitive working resource; raw evidence should remain outside the model; trimming/offload and task isolation are complementary; durable checkpoints and exactly-once external effects are different problems; memory requires provenance and write controls. These conclusions converge across original papers, official APIs, and DSH's documented invariants.
- **Medium confidence:** a 75–85% pressure threshold, a 10–20% raw tail, and small context-packet allocations are reasonable starting points. They are engineering starting values, not universal benchmark results; tune per route and task.
- **Medium confidence:** itemized delta memory will outperform repeated prose rewriting for some long-horizon workloads. ACE and related work support the hypothesis, but the reported results need local reproduction and do not establish safety.
- **Low confidence:** a particular model, provider compaction item, memory graph, or multi-agent topology is universally best. The 2026 context-rot study explicitly finds model dependence, and vendor reports are not controlled comparisons.
- **DSH-specific uncertainty:** the installed `0.1.5-rc.3` package contracts are concrete, but defaults, tokenizer heuristics, route capacities, and cross-process behavior must be tested in the target local deployment. A later DSH release may change package names or guarantees; pin the version/commit.

## Final recommendation

For a local DSH agent, ship the smallest defensible version in this order:

1. append-only JSONL session events plus fail-closed semantic checkpoints;
2. bounded tool-output spill/preview and model-free pruning;
3. pressure-triggered, source-linked compaction with a raw tail;
4. clean `spawn` children for independent work and typed handoffs at session boundaries;
5. governed, provenance-bearing memory with explicit writes;
6. measured, feature-flagged model-driven consolidation;
7. an external durable workflow engine only if crash/recovery requirements exceed the local checkpoint policy's guarantees.

This design keeps the DSH Host/Main System stable, makes context recyclable without erasing evidence, preserves a rollback path, and treats evolving memory as a governed projection rather than a hidden source of authority.

## Primary sources

### Original research

- Liu et al., [*Lost in the Middle: How Language Models Use Long Contexts*](https://aclanthology.org/2024.tacl-1.9/), TACL 2024.
- Modarressi et al., [*NoLiMa: Long-Context Evaluation Beyond Literal Matching*](https://arxiv.org/abs/2502.05167), ICML 2025.
- Maharana et al., [*Evaluating Very Long-Term Conversational Memory of LLM Agents*](https://aclanthology.org/2024.acl-long.747/), ACL 2024.
- Wu et al., [*LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory*](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html), ICLR 2025.
- Packer et al., [*MemGPT: Towards LLMs as Operating Systems*](https://arxiv.org/abs/2310.08560), 2023.
- Shinn et al., [*Reflexion: Language Agents with Verbal Reinforcement Learning*](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html), NeurIPS 2023.
- Zhong et al., [*MemoryBank: Enhancing Large Language Models with Long-Term Memory*](https://arxiv.org/abs/2305.10250), 2023.
- Xu et al., [*Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models*](https://arxiv.org/html/2510.04618v3), arXiv preprint, revised 2026.
- [*Diagnosing and Mitigating Context Rot in Long-horizon Search*](https://arxiv.org/html/2606.29718v2), arXiv:2606.29718v2, 2026 preprint.
- Chen et al., [*AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases*](https://arxiv.org/abs/2407.12784), NeurIPS 2024.
- Dong et al., [*Memory Injection Attacks on LLM Agents via Query-Only Interaction*](https://proceedings.neurips.cc/paper_files/paper/2025/hash/42a97bbd9844d2bf68596730af80bcdf-Abstract-Conference.html), NeurIPS 2025.

### Official implementation and engineering sources

- Anthropic, [*Effective context engineering for AI agents*](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), 2025-09-29.
- Anthropic, [*Effective harnesses for long-running agents*](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), 2025-11-26.
- Anthropic, [*How we built our multi-agent research system*](https://www.anthropic.com/engineering/multi-agent-research-system), 2025-06-13.
- OpenAI, [*Agents SDK sessions*](https://openai.github.io/openai-agents-python/sessions/) and [*Human-in-the-loop*](https://openai.github.io/openai-agents-python/human_in_the_loop/).
- OpenAI, [*Responses API compaction*](https://developers.openai.com/api/docs/guides/compaction).
- Google ADK, [*Context compaction*](https://adk.dev/context/compaction/) and [*Resume stopped agents*](https://adk.dev/runtime/resume/).
- LangGraph, [*Persistence*](https://docs.langchain.com/oss/python/langgraph/persistence).
- Temporal, [*Workflow Execution*](https://docs.temporal.io/workflow-execution), [*Continue-As-New*](https://docs.temporal.io/workflow-execution/continue-as-new), and [*Activity idempotency*](https://docs.temporal.io/activity-definition#idempotency).
- Letta, [*Agent SDK memory*](https://docs.letta.com/agent-sdk/memory/).

### DSH first-party local references inspected

- [`@deepseek-ai/dsh-session-persistence`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-persistence/README.md)
- [`@deepseek-ai/dsh-session-checkpoint-policy`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-checkpoint-policy/README.md)
- [`@deepseek-ai/dsh-compaction-basic`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-basic/README.md)
- [`@deepseek-ai/dsh-compaction-tool-result-pruner`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-compaction-tool-result-pruner/README.md)
- [`@deepseek-ai/dsh-spill-policy`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-spill-policy/README.md)
- [`@deepseek-ai/dsh-session-reference`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-session-reference/README.md)
- [`@deepseek-ai/dsh-subagent-spawn-in-process`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/README.md)
- [`@deepseek-ai/dsh-subagent-fork-in-process`](/home/fares/.nvm/versions/node/v26.8.2/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/README.md)
- Upstream repository: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).
