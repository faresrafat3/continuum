# Long-running agent context management: current design and local DSH recommendation

**Review date:** 2026-09-25  
**Primary-route:** `research` under the Continuum Router  
**Scope:** Compaction, trimming, context isolation, durable checkpoints, and evolving memory for a single-host/local DSH agent.  
**Evidence policy:** Original papers, official framework/provider documentation, and first-party source code. Product engineering reports are identified as first-party evidence, not independent validation. Recommendations and thresholds labeled as engineering choices are not claimed as research results.

## Executive decision

There is no single best context mechanism. The strongest current design is a **layered context projection over durable state**:

1. Keep the DSH Host/Main System and security policy outside session recycling.
2. Preserve the full session as an append-only event ledger and write typed checkpoints at execution boundaries.
3. Build each model call from a small, reconstructible context: stable instructions, a typed task checkpoint, a recent closed-turn tail, and targeted evidence retrieved for the next action.
4. Use **isolation first** for independent, bulky exploration; workers return concise results or artifact references rather than transcripts.
5. Use **trimming** for completed, bulky tool payloads whose raw results remain durable outside the prompt.
6. Use **structured compaction** for older conversational narrative, always with source ranges, exact identifiers, a recent raw tail, and the ability to rehydrate the original evidence.
7. Promote only validated, provenance-bearing facts and procedures into **evolving memory**. New information supersedes old information; it does not silently overwrite it.
8. Treat resume as checkpoint replay, not world rollback. Non-idempotent effects need operation keys, preconditions, and reconciliation.

This is a synthesis, not a claim that one paper proves the whole architecture. The direct comparative evidence supports the need for context management but finds that the best method is model- and task-dependent: in a 2026 long-horizon search study, stronger agentic models benefited most from isolation, while weaker agentic models did better with compaction plus trimming; all tested methods traded lower premature termination for more exploration and additional cost ([Xia et al., 2026](https://arxiv.org/html/2606.29718v2)). The practical answer is therefore a router that chooses among the five mechanisms, not a permanent winner.

## Why a long transcript is not a database

Long-context use degrades before the nominal window is exhausted. *Lost in the Middle* found that retrieval performance can depend strongly on information position, with relevant information in the middle used less reliably even by long-context models ([Liu et al., TACL 2024](https://aclanthology.org/2024.tacl-1.9/)). A newer multi-turn deep-search study found “premature termination”—giving up or returning uncertain incorrect answers while much of the window remains—and showed that the rate rises with trajectory length after controlling for query difficulty ([Xia et al., 2026](https://arxiv.org/html/2606.29718v2)). This supports treating the context window as a scarce working set, not as durable storage.

## Comparison of the five mechanisms

| Mechanism | What it changes | Main benefit | What it preserves | Main failure mode | Best DSH role |
|---|---|---|---|---|---|
| **Compaction** | Rewrites older turns as a summary or provider compaction item | Keeps a long conversation inside budget while retaining narrative continuity | A lossy representation of older turns, plus any retained raw tail | Opaque or lossy state; recursive summaries lose exact IDs, failed attempts, tool constraints, or subtle facts | Phase-level compression after a durable checkpoint |
| **Trimming** | Removes selected messages or tool-result payloads from the next prompt | Predictable token reduction; surgical and cheap | Only what is explicitly pinned; the full copy is recoverable only if stored elsewhere | Accidental loss of unresolved constraints, exact errors, or tool-call/result structure | Clear completed tool payloads before summarizing conversation |
| **Isolation** | Moves bulky exploration into a separate context window or worker | Prevents noisy exploration and path dependence from polluting the coordinator | Worker artifacts and a bounded result contract; not the worker transcript | Duplicate work, omissions, coordination overhead, stale artifacts, and much higher token use | Independent research, broad audits, and high-volume verification |
| **Durable checkpoints** | Persists execution state independently of the prompt | Crash recovery, approval continuity, human handoff, and time-travel inspection | Exact task/run state and references to evidence | Snapshot can become stale; replay can repeat model/API calls or external effects | Mandatory at every safe execution boundary |
| **Evolving memory** | Promotes selected facts, preferences, lessons, and procedures across sessions | Reuses prior knowledge without replaying all history | Accepted records with scope, provenance, validity, and supersession links | Retrieval misses, contradictions, stale facts, and unsafe self-reinforcement | A governed, derived retrieval layer—not the source of truth |

These mechanisms are complementary, not substitutes. A checkpoint is invisible to the model unless projected into context; memory without a checkpoint can record what was learned but not where execution stopped; compaction without a durable source event range turns the summary into an unauditable authority; trimming without an external raw store is destructive; and isolation without a typed result contract merely moves ambiguity.

## 1. Compaction

### What the current primary sources establish

Anthropic now distinguishes three compaction modes: on-demand compaction controlled by the application, threshold compaction performed inside an ordinary request, and a client-owned summarizer. Anthropic describes summarized compaction as the primary long-conversation strategy and context editing as the selective alternative when old tool results or thinking should be cleared by rule rather than summarized ([Claude compaction overview](https://platform.claude.com/docs/en/build-with-claude/compaction)). On-demand compaction can keep a chosen recent tail verbatim; the cut must leave every tool call and its result on the same side of the boundary ([Claude keep-recent-turns](https://platform.claude.com/docs/en/build-with-claude/compaction-keep-recent-turns)).

OpenAI exposes both threshold-triggered server compaction and a standalone compaction endpoint. The returned item is encrypted/opaque, carries selected prior state and reasoning, and is intended to be passed forward unchanged; exact retained state is not human-readable or enumerated ([OpenAI compaction](https://developers.openai.com/api/docs/guides/compaction.md)). OpenAI’s Agents SDK can also filter the history sent to a model without rewriting the session’s stored items ([OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/)).

Anthropic’s first-party context-engineering report describes compaction as summarizing architectural decisions, unresolved bugs, and implementation details while discarding redundant messages/tool output, but explicitly warns that aggressive compaction can discard context whose importance becomes apparent later ([Anthropic, 2025](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#context-engineering-for-long-horizon-tasks)). The 2026 ACE study provides a compatible warning: repeated monolithic LLM rewriting can cause “context collapse,” while itemized, incremental delta updates preserve more detail; the reported benchmark gains are author-reported and not a production-safety proof ([Zhang et al., 2026 preprint](https://arxiv.org/html/2510.04618v3)).

### Assessment for DSH

**Use compaction after a checkpoint, not before one.** The prompt projection should be a structured state capsule with a recent raw tail, not an unconstrained prose recap. A new compaction should consume the prior typed checkpoint plus the newly closed event range, not recursively summarize an opaque summary.

The minimum compaction record should contain:

- source event range and artifact hashes;
- objective, scope, constraints, and non-goals;
- decisions and rejected alternatives, with rationale;
- completed work mapped to evidence IDs;
- unresolved approvals, jobs, leases, and tools;
- important failures and “do not repeat” facts;
- current workspace/Git/test state;
- unresolved contradictions and confidence;
- artifact pointers and one concrete next action.

**Do not rely on a provider compaction item as the only audit record.** Store any provider item opaquely, but keep a local, inspectable checkpoint beside it. This preserves portability and makes provider changes or opaque-state failures recoverable.

## 2. Trimming

### What the current primary sources establish

Trimming removes selected content rather than rewriting it. Claude’s context-editing API can clear old tool results in chronological order while the client retains the full, unmodified conversation; placeholders replace cleared results in the model view ([Claude context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing)). The OpenAI Agents SDK supports last-N history selection and a callback that filters retrieved history while leaving stored session items unchanged ([OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/)). LangChain’s `trim_messages` can preserve a system message and recent history, but warns that tool messages generally require a preceding tool-calling assistant message ([LangChain `trim_messages`](https://reference.langchain.com/python/langchain-core/messages/utils/trim_messages)).

The 2026 context-rot study directly compared discard-style trimming, recent-turn retention, and trimming plus summarization. These methods reduced premature termination in its search settings but added tool calls and unfinished trajectories, so they are test-time scaling rather than free efficiency improvements ([Xia et al., 2026](https://arxiv.org/html/2606.29718v2)).

### Assessment for DSH

Trimming should be the first response to bulky **completed** tool output, not the first response to a long conversation. Keep the raw result in the event ledger or an artifact store, then replace it in the prompt with:

- result status and essential fields;
- source event/artifact ID and hash;
- errors or warnings that affect later decisions;
- a read/search locator for rehydration.

Never trim:

- an in-flight tool call or its result;
- the system/approval/tool policy;
- the current user correction or unresolved question;
- exact IDs, paths, commands, diffs, and validation results needed for the next action;
- a failed operation whose cause prevents retry loops.

This is lossless at the system level but lossy at the prompt level. The implementation must make that distinction explicit.

## 3. Isolation

### What the current primary sources establish

Isolation means giving a bounded worker its own model context while the coordinator retains only a result contract. Anthropic reports that subagents can consume tens of thousands of tokens in isolated contexts and return a much smaller summary; it recommends the approach for independent research rather than tightly dependent work ([Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents#context-engineering-for-long-horizon-tasks)). In its production research system, Anthropic reports a 90.2% internal-eval improvement for a multi-agent configuration over a single-agent baseline, but also about 15× chat token usage, duplicate work, coordination complexity, and poor fit for tasks requiring shared context ([Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). These are first-party, model- and task-specific results, not an isolated causal estimate of “context isolation.”

Isolation also has a filesystem variant: workers write full outputs to durable artifacts and return lightweight references. Anthropic describes this as reducing token copying and avoiding a lossy coordinator relay ([Anthropic multi-agent appendix](https://www.anthropic.com/engineering/multi-agent-research-system#appendix)). The 2026 context-rot study found isolation could be best for stronger agentic models, supporting conditional routing rather than universal fan-out ([Xia et al., 2026](https://arxiv.org/html/2606.29718v2)).

### Assessment for DSH

Use a fresh worker when all are true:

1. the question is independently answerable;
2. the expected exploration is high-volume;
3. the result can be expressed in a small typed contract;
4. workers can have disjoint write sets or read-only access;
5. the coordinator can verify the artifact before relying on it.

Do **not** isolate a tightly coupled reasoning chain, iterative dialogue, or sequence of edits to the same mutable files. Context isolation is not filesystem, process, permission, or secret isolation; those require ordinary OS/tool authorization controls.

A worker task packet should include:

- objective and acceptance criteria;
- exact scope and non-goals;
- relevant decisions and source event ranges;
- workspace path, branch/commit, and dirty-state warning;
- read/write/approval boundary;
- source-quality rules;
- output schema and budget;
- one next action or a complete result.

The worker should return a compact status, findings, evidence IDs, artifact path/hash, unresolved gaps, and token/time use—not its transcript. Parent/child “handoff,” “fork,” and “fresh worker” must be distinct operations because some frameworks propagate prior history by default while others start clean.

## 4. Durable checkpoints

### What the current primary sources establish

A conversation/session store preserves history; a durable checkpoint additionally captures enough execution state to resume. LangGraph separates thread-scoped checkpointers from cross-thread stores and persists graph-state snapshots for conversation continuity, human approval, fault tolerance, and time travel ([LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence.md)). Its checkpointer writes full checkpoints at graph supersteps and task-level pending writes, so successful work in a failed parallel step need not be rerun ([LangGraph checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers.md)). LangGraph also documents that replay re-executes later LLM calls, API requests, and interrupts; checkpoint replay therefore does not roll back the external world ([LangGraph checkpointers: replay](https://docs.langchain.com/oss/python/langgraph/checkpointers.md#replay)).

Temporal persists an append-only Event History for crash recovery and audit, and `Continue-As-New` passes the latest relevant state into a fresh execution/history when an event log becomes large or code versioning requires a new run ([Temporal event history](https://docs.temporal.io/workflow-execution/event.md), [Temporal Continue-As-New](https://docs.temporal.io/workflow-execution/continue-as-new.md)). Temporal explicitly warns that activities may execute more than once and recommends idempotence plus receiver-enforced idempotency keys ([Temporal activity idempotency](https://docs.temporal.io/activity-definition.md#idempotency)).

OpenAI’s Agents SDK can persist and resume a serialized run state across an approval interruption, while sessions separately preserve conversation history ([OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/)). This supports the same architectural distinction: execution state and conversation memory are related but not identical.

### Assessment for DSH

For the local single-host MVP, use the existing DSH session log and workspace records rather than introducing Temporal or LangGraph immediately:

- **Append-only session event ledger:** authoritative messages, tool calls/results, approvals, errors, lifecycle transitions, and memory proposals.
- **Typed checkpoint snapshot:** current goal, phase, exact IDs, completed/evidence mapping, pending approvals/jobs/leases, workspace fingerprint, validation results, blockers, and next action.
- **Workspace/Git/tests:** authoritative observed implementation state.
- **Generated context pack:** rebuildable projection, never the sole copy.

Write a checkpoint:

- before and after a non-idempotent effect;
- after every completed model/tool step;
- before and after compaction;
- before worker dispatch and after worker acceptance;
- when entering an approval wait;
- at a phase boundary or quiescent handoff;
- before model, tool, prompt, or runtime-version changes.

Use a monotonic event sequence and parent checkpoint ID. A checkpoint should be atomic, schema-versioned, hash-linked to source events/artifacts, and recoverable after a crash between file/database writes. It should classify an unknown external outcome explicitly rather than assuming “not checkpointed means not executed.”

Do not promise exactly-once recovery. Model calls can be repeated, and external effects need an operation key, receiver-side deduplication or an outbox/inbox, pre/postconditions, and reconciliation. Add Temporal or a database workflow engine only when multi-process jobs, long timers, or a measured recovery SLA justify the operational cost.

## 5. Evolving memory

### What the current primary sources establish

MemGPT proposed “virtual context management”: a bounded in-context tier plus external recall/archival tiers that the agent can page into the window ([Packer et al., 2023](https://arxiv.org/abs/2310.08560)). Anthropic’s current memory tool uses client-owned files and just-in-time reads rather than keeping all remembered material in context; the application, not the provider, controls storage and access ([Claude memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)). LangGraph likewise separates thread checkpoints from a cross-thread application store ([LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence.md)).

LongMemEval tests extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. Its paper reports roughly a 30% accuracy drop for the evaluated commercial chat assistants and long-context baselines on sustained-interaction memory tasks, and finds gains from separating memory into indexing, retrieval, and reading with time-aware retrieval ([Wu et al., ICLR 2025](https://arxiv.org/abs/2410.10813)). This is benchmark evidence, not a universal 30% penalty for every modern model or architecture.

ACE replaces monolithic repeated rewriting with itemized bullets, localized delta updates, counters, and grow-and-refine consolidation. It reports +10.6% on agent benchmarks and +8.6% on domain-specific benchmarks, but these are author-reported results on selected models/tasks and do not establish safe autonomous memory mutation ([ACE preprint](https://arxiv.org/html/2510.04618v3)). PACE, published at ACL 2026, treats context extraction as next-step prediction and adjusts historical-memory granularity to predicted relevance; it reports sustained reasoning over 4,897 interaction steps, but still does not remove the need for exact state, provenance, or effect idempotency ([PACE, ACL 2026](https://aclanthology.org/2026.acl-long.1252/)).

### Assessment for DSH

Evolving memory should be a **governed lifecycle**, not a vector database that silently rewrites itself.

Use four memory classes:

1. **Episodic/source memory:** append-only events and raw tool results; authoritative but retrieved only on demand.
2. **Working/task memory:** the latest typed checkpoint; exact and short-lived.
3. **Semantic memory:** validated facts, preferences, decisions, and failure lessons across sessions.
4. **Procedural memory:** accepted instructions, skills, ADRs, and policies; changes require stronger review because they alter future behavior.

Every semantic/procedural record should include:

- stable key and tenant/agent/task scope;
- value or narrow instruction;
- source event/artifact IDs and content hashes;
- `valid_from`, optional `valid_to`, and review time;
- confidence and verification method;
- status: `proposed`, `accepted`, `superseded`, or `rejected`;
- `supersedes` / `superseded_by` links;
- conflict set when sources disagree.

The safe write path is:

1. The model **proposes** a candidate with exact provenance.
2. Deterministic code validates schema, scope, source existence, and contradiction status.
3. Human or an objective acceptance test promotes high-impact preferences, policies, procedures, or security-relevant facts.
4. The new record is appended; the old record is superseded, not overwritten.
5. Retrieval first uses exact IDs, scope, and time, then optionally semantic ranking.
6. Conflicting records are returned as a conflict rather than silently blended.
7. Raw evidence remains recoverable; garbage collection applies only to derived indexes under a retention policy.

Do not put secrets, approval authority, security policy, or live service objects into ordinary model memory. Do not allow a model to edit its own system/agent preset as a side effect of “learning.” A background curator may propose ACE/PACE-style deltas, but acceptance remains a separate controlled step until local evaluations show acceptable precision.

## Recommended local DSH implementation

### A. State topology

Keep five planes separate:

1. **Control plane:** Host composition, model route, security, approvals, persistence registry, and stable identity. Session context operations never mutate it.
2. **Evidence plane:** append-only session events, tool outputs, Git/files, tests, and source artifacts.
3. **Checkpoint plane:** typed snapshots and handoffs that make execution recoverable.
4. **Working-context plane:** per-call model projection; disposable and rebuildable.
5. **Memory/index plane:** derived, provenance-bearing retrieval and evolving candidates.

This mirrors the useful separation in OpenAI’s SDK between local runtime context (not sent to the model) and conversation history ([OpenAI context management](https://openai.github.io/openai-agents-python/context/)). DSH should additionally separate those from durable artifacts and do not serialize live Host objects into prompts or checkpoints.

### B. Per-call context packet

Assemble every model input in this order:

1. **Pinned system header:** identity, safety, approvals, tools, output contract, and control-plane revision.
2. **Typed task capsule:** objective, scope, constraints, non-goals, acceptance criteria, phase, blockers, and next action.
3. **Verified progress:** completed work with evidence IDs, workspace/Git fingerprint, validations, and current contradictions.
4. **Recent raw tail:** a bounded number of complete user/assistant/tool cycles needed for immediate repair and pronoun resolution.
5. **Targeted retrieval:** only the files, events, research claims, or memory records needed for the next decision.
6. **Output reserve:** enough budget for the model response and tool schemas.

Large evidence remains outside the prompt and is addressed by path/ID/URL/hash.

### C. Initial trigger policy

These are starting heuristics, not universal research findings:

- Reserve at least the larger of the provider’s output allowance or 20% of the usable model window.
- Treat the **effective** context limit as model/task-specific and lower than the advertised maximum; initialize it conservatively, then tune from evaluations.
- Start trimming completed tool payloads when they consume more than roughly 15% of the window or when a phase closes.
- Compact at the lower of the measured effective limit or roughly 60% of the usable window.
- Use hard last-N trimming only as a checkpointed emergency fallback near 75–80%, never as the normal continuity mechanism.
- Always checkpoint at phase boundaries regardless of token count.

The 2026 long-horizon study shows that compaction, trimming, and isolation all add inference cost, so trigger placement should be evaluated on task success and critical-fact recall—not only tokens ([Xia et al., 2026](https://arxiv.org/html/2606.29718v2)).

### D. Operation router

Before each model call, choose the least destructive operation that fits:

1. **Recall** exact prior evidence by ID/range.
2. **Retrieve** targeted artifacts or memory.
3. **Isolate** independent high-volume exploration.
4. **Trim** completed redundant payloads.
5. **Compact** older narrative into a typed checkpoint plus raw tail.
6. **Fresh session** when context is contaminated, repeatedly compacted, or operationally risky.

This ordering follows the Continuum Router principle: preserve the source, move bulky work out of the active window, and summarize only after cheaper and more reversible operations are insufficient.

### E. Checkpoint contract

A practical local checkpoint can be small and portable:

```yaml
schema: dsh.context-checkpoint/v1
checkpoint_id: ULID
parent_checkpoint_id: ULID|null
session_id: string
source_event_range: [first_seq, last_seq]
created_at: RFC3339
control_plane_revision: string
phase: string
objective: string
scope: {paths, systems, non_goals}
acceptance_criteria: [string]
completed:
  - item: string
    evidence_ids: [string]
pending:
  approvals: [id]
  jobs: [id]
  leases: [id]
  contradictions: [string]
workspace:
  root: string
  branch: string|null
  commit: string|null
  dirty_paths: [string]
validation: [{command, exit_code, run_id, evidence_path}]
memory_candidates: [memory_id]
blockers: [string]
next_action:
  action: string
  completion_criterion: string
source_hashes: {path_or_id: sha256}
```

Serialize only owned leaf data. Do not dump live services, Sessions, Events, or Cordis/DSH objects into the checkpoint.

### F. Memory candidate contract

```yaml
schema: dsh.memory-candidate/v1
memory_id: ULID
kind: fact|preference|decision|lesson|procedure
scope: {tenant, agent, project, task?}
statement: string
source_event_ids: [id]
source_artifact_hashes: {path: sha256}
valid_from: RFC3339
valid_to: RFC3339|null
confidence: number
verification: human|test|deterministic-check|unverified
status: proposed|accepted|superseded|rejected
supersedes: memory_id|null
review_after: RFC3339|null
```

A model may generate `proposed` records. Deterministic code owns persistence, scope enforcement, supersession, and retrieval. Human review owns high-impact procedural or policy changes.

## Failure-mode controls

| Failure | Control |
|---|---|
| Summary drops exact ID, approval, failed action, or next step | Schema validation plus source-range checks; fail closed to the previous projection |
| Repeated compaction degrades context | Compact from the typed checkpoint plus new events, never recursively from prose summaries |
| Cleared tool result is later needed | Durable raw result plus read/search rehydration |
| Worker returns stale or incomplete result | Artifact hash, source citations, coordinator verification, and task-specific acceptance test |
| Worker and parent both mutate shared state | Disjoint write sets, locks/atomic writes, or worktree isolation |
| Checkpoint says “not done” after an effect occurred | Idempotency key, external lookup, and `unknown-outcome` reconciliation state |
| Memory contradicts current truth | Validity/scope filtering; show both records and require resolution |
| Memory poisoning or stale preference | Provenance, write authorization, review status, contradiction detection, and human gate |
| Provider compaction item is opaque | Preserve the item opaquely and maintain a separate local typed checkpoint |
| Context reaches emergency limit | Checkpoint, hard trim at a closed tool boundary, rehydrate only pinned evidence, then continue |

## Evaluation and release gates

No cited source benchmarks this exact local DSH architecture. Before enabling automatic context evolution, build a local golden corpus of long tool-heavy research and coding tasks, including crash and approval boundaries. Compare at least:

- full retained history with a recent tail;
- trimming only;
- compaction only;
- isolation only;
- the proposed hybrid.

Measure:

- end-state task success and acceptance-test pass rate;
- critical-fact, exact-ID, command, path, and citation recall;
- premature give-up or uncertain-wrong termination;
- duplicate or missing external effects after crash/replay;
- checkpoint restore correctness and time;
- stale/contradictory memory use;
- user corrections and handoff defects;
- input/output tokens, wall time, and total cost;
- artifact rehydration rate and unused retrieved context.

Minimum release gates:

1. **No evidence loss:** every trimmed or compacted item is rehydratable from a durable source.
2. **Checkpoint correctness:** restore succeeds at model, tool, approval, worker, and non-idempotent-effect boundaries.
3. **Effect safety:** crash tests produce no undetected duplicate side effect.
4. **Compaction fidelity:** exact IDs, pending approvals/jobs, failed constraints, validation results, and next action survive every golden trace.
5. **Isolation integrity:** workers stay within task scope and write sets; parent verifies artifacts.
6. **Memory safety:** no autonomous production writes; all accepted records are scoped, sourced, and auditable.
7. **Measured benefit:** the hybrid must improve a target metric without unacceptable cost, latency, or premature termination.

## Uncertainty and limits

- The most directly comparative 2026 study used four open models and three long-horizon search benchmarks; it did not test DSH, coding sessions, or all current closed models ([Xia et al., 2026](https://arxiv.org/html/2606.29718v2)).
- Anthropic’s 90.2% multi-agent gain and 15× token cost are first-party internal measurements; token use, model choice, parallelism, and orchestration change together, so this is not a clean causal estimate of isolation alone ([Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).
- ACE and Mem0-style automatic memory results are benchmark- and implementation-specific; ACE’s preprint does not prove that unconstrained self-referential memory writes are safe for a local agent ([ACE](https://arxiv.org/html/2510.04618v3), [Mem0](https://arxiv.org/abs/2504.19413)).
- PACE’s next-step retrieval is promising but adds prediction and retrieval complexity; the reported ultra-long-horizon result does not establish crash safety, side-effect idempotency, or security ([PACE, ACL 2026](https://aclanthology.org/2026.acl-long.1252/)).
- Provider compaction/context-editing APIs are evolving, some features are beta, and opaque compaction items do not expose what was retained. Pin schemas/API versions and re-test when providers change ([Claude compaction](https://platform.claude.com/docs/en/build-with-claude/compaction), [OpenAI compaction](https://developers.openai.com/api/docs/guides/compaction.md)).
- Initial percentages and operation ordering above are engineering defaults for a local MVP. They must be replaced or confirmed by model-specific DSH evaluations.

## Final recommendation

Implement the **hybrid, checkpoint-first architecture** now:

- existing DSH append-only session log + typed workspace checkpoint as the recovery substrate;
- a deterministic per-call context projector;
- completed-tool-output trimming before narrative compaction;
- structured compaction with recent closed-turn tail and source anchors;
- fresh isolated workers for independent, high-volume work, returning artifact references;
- a provenance-bearing memory proposal/index layer, initially write-authorized outside the model;
- at-least-once execution semantics with idempotency and reconciliation.

Do not recursively summarize summaries, do not make a vector store the system of record, and do not treat a model’s ability to edit memory as proof that the memory is correct. The core invariant is simple: **the active context may be lossy, but the system’s authoritative state must remain complete, inspectable, and rebuildable.**

## Continuum route record

```json
{
  "route": "research",
  "owner": "agent:continuum-evaluation",
  "task_id": "T-0001-build-continuum",
  "scope_ids": ["continuum-router", "context-management", "local-dsh"],
  "phase": "research",
  "read_set": [
    "/home/fares/.dsh/.agent-presets/continuum/skills/continuum-router/SKILL.md",
    "AGENTS.md",
    "WORKSPACE.md",
    ".agent-workspace/context/architecture.md",
    ".agent-workspace/tasks/T-0001-build-continuum/{spec.md,state.yaml,plan.md}",
    ".agent-workspace/tasks/T-0001-build-continuum/handoffs/H-20260925-002.md",
    "primary external sources linked in this report"
  ],
  "write_set": [
    "/home/fares/continuum-system/evals/continuum-router/iteration-1/research-context-decision/with-skill/output.md"
  ],
  "protected": ["current-session", "DSH-Main-System", "T-0000", "all files outside write_set"],
  "next_gate": "parent-agent-review",
  "next_action": "Review this cited decision and select release gates for a local DSH implementation",
  "stop_when": "The report exists, cites primary sources, states uncertainty, and makes one implementable local recommendation"
}
```
