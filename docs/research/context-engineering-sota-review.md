# Clean Context Engineering for Long-Running Agents

**State of the art review for a new DSH agent and safe session recycling**  
**Research cut-off:** 2026-09-25 (base review cut-off 2026-03-21; current supplemental verification added 2026-09-25)  
**Source policy:** Primary papers, official project documentation, and first-party repositories only. Peer-reviewed work is distinguished from technical reports, engineering reports, and project conventions.

## Executive decision

The strongest architecture is **not “keep a longer prompt”** and **not “replace the session with a summary.”** It is a two-plane system that keeps the DSH **Main System** as a stable control plane:

1. **A stable control plane** holds the main system identity, immutable policy, approved capabilities, durable goals, run ledger, workspace pointers, and security invariants. This plane is not rewritten by compaction or session recycling.
2. **A disposable working plane** holds the active model context, raw recent turns, speculative scratch notes, and temporary subagent state. It may be recycled at a quiescent boundary without deleting the evidence needed to reconstruct or audit it.

For DSH, session recycling should therefore be a **fork-and-seal operation**, not an in-place reset. The parent session becomes immutable and read-only; a child session receives a signed, versioned handoff plus a pointer to durable workspace state. A new model context is built from the stable system instructions, a compact typed handoff, a small raw tail, and task-relevant memory fetched at runtime. The main system and its host-side services remain in place. The child is not activated until the handoff passes schema, provenance, workspace, and policy checks; the old parent remains the rollback target. This fork-and-seal protocol is an engineering synthesis proposed by this review, not a result directly validated by the cited memory benchmarks.

The mechanisms below are supported by converging evidence; the DSH-specific control-plane, handoff, and recycling protocol is a proposed design whose safety and task-success claims must be established with the release gates below:

- Long-context models degrade with position, semantic distance, distractors, and task length—not merely advertised context-window size ([Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/); [NoLiMa, ICML 2025](https://arxiv.org/abs/2502.05167); [Context Rot, 2025 technical report](https://www.trychroma.com/research/context-rot)).
- ReAct, Reflexion, Tree of Thoughts, Generative Agents, and MemGPT/Letta illustrate bounded mechanisms—interleaved action, feedback/reflection, search, and external memory—that can support longer horizons; they do not establish production long-running behavior or durability ([ReAct, ICLR 2023](https://arxiv.org/abs/2210.03629); [Reflexion, NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html); [Tree of Thoughts, NeurIPS 2023](https://arxiv.org/abs/2305.10601); [Generative Agents, UIST 2023](https://doi.org/10.1145/3586183.3606763); [MemGPT, 2023](https://arxiv.org/abs/2310.08560)).
- Durable runtimes distinguish **replayable control flow** from **retryable, possibly duplicated side effects**. LangGraph, Temporal, Google ADK, and OpenAI Agents SDK provide checkpoint/session mechanisms; AutoGen provides explicit AgentChat snapshots but not durable replay; PydanticAI provides durable execution only through its Temporal/DBOS/Prefect integrations ([LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence); [Temporal Workflow Execution](https://docs.temporal.io/workflow-execution); [ADK Resume](https://adk.dev/runtime/resume/); [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/); [AutoGen state](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/state.html); [PydanticAI durable execution](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/overview.md)).
- Persistent memory is not automatically trustworthy. Query-only memory injection attacks have demonstrated that adversarial content can be written into an agent’s long-term memory through normal interaction ([MINJA, NeurIPS 2025](https://proceedings.neurips.cc/paper_files/paper/2025/hash/42a97bbd9844d2bf68596730af80bcdf-Abstract-Conference.html)).
- Cost-aware model routing is empirically useful, but only when routing quality, judge quality, and model drift are evaluated together; benchmark results do not transfer automatically to a new agent domain ([FrugalGPT, TMLR 2024](https://openreview.net/forum?id=1J6nBzgF3S); [RouteLLM, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/5503a7c69d48a2f86fc00b3dc09de686-Abstract-Conference.html); [RouterBench, 2024](https://arxiv.org/abs/2403.12031)).

## 0.1 Supplemental 2026 evidence (verified 2026-09-25)

The base review's recommendations remain directionally correct, but three newer primary sources sharpen the operating policy:

1. **Context Rot in long-horizon search (arXiv:2606.29718v2, 2026-08-04).** Across four open models and three search benchmarks, the paper reports a positive relationship between trajectory length and premature termination—giving up or producing an uncertain incorrect answer while much of the context window remains. It evaluates seven context-management variants and frames compaction, trimming, and isolation as test-time scaling: they can improve exploration but add tool calls and unfinished trajectories. The paper reports a model-dependent choice (strong agentic models may benefit from isolation; weaker models may need compaction plus trimming) and a 2.6–4.9% gain from its behavior-aware parallel-sampling filter. These are reported study results, not universal guarantees ([paper](https://arxiv.org/html/2606.29718v2), [code](https://github.com/GAIR-NLP/ContextRot)).

2. **Agentic Context Engineering / ACE (arXiv:2510.04618v3, revised 2026-03-29).** ACE separates a Generator, Reflector, and Curator; represents context as itemized bullets; merges localized deltas; and grows/refines rather than repeatedly rewriting one prose summary. The authors explicitly identify brevity bias and context collapse as failure modes and report gains including +10.6% on agent benchmarks and +8.6% on domain-specific benchmarks. For DSH, this supports a delta-based context ledger with provenance, but the paper's benchmark numbers must be treated as author-reported evidence until reproduced locally ([paper](https://arxiv.org/html/2510.04618v3), [code](https://github.com/ace-agent/ace)).

3. **PACE (ACL 2026, 2026.acl-long.1252).** PACE treats context extraction as next-step prediction and adjusts historical-memory granularity by predicted relevance. Its abstract reports sustained reasoning for 4,897 interaction steps and improvements over full-context ReAct and folding baselines. The result supports predictive, task-aware retrieval as an advanced option, but it does not remove the need for typed state, raw evidence anchors, or side-effect idempotency ([ACL record](https://aclanthology.org/2026.acl-long.1252/), [PDF](https://aclanthology.org/2026.acl-long.1252.pdf)).

**Updated DSH policy:** use ACE-style incremental deltas and PACE-style next-step retrieval as optional strategies, while retaining the original safety contract: raw logs remain append-only, summaries are derived, the main system stays outside recycled scope, and every externally visible effect has an idempotency/precondition record. Measure premature termination, critical-fact recall, duplicate effects, and cost/latency in a local golden corpus before enabling autonomous context evolution.

## 1. What the evidence supports

### 1.1 Long context is finite working memory, not durable state

“Lost in the Middle” evaluated multi-document QA and key-value retrieval and found U-shaped position sensitivity: models used beginning and end information better than information in the middle, including for models marketed with long context. In its GPT-3.5 experiments, some 20- and 30-document cases performed worse than the closed-book baseline. The same work observed reader saturation before retrieval recall saturated, so simply increasing retrieved context added little accuracy while increasing cost ([Liu et al., TACL 2024](https://doi.org/10.1162/tacl_a_00638); [reproduction code](https://github.com/nelson-liu/lost-in-the-middle)). Its position-bias result is important evidence, but its model set is 2023-era and should not be read as a current-model ranking.

NoLiMa removed strong lexical overlap between a question and the relevant “needle.” Across 13 models advertising at least 128K context, performance fell sharply as input length increased; at 32K, 11 models were below half of their short-context baseline. GPT-4o fell from a 99.3% short-context score to 69.7% at 32K in the reported v3 study. Reasoning prompts did not eliminate the failure ([Modarressi et al., ICML 2025](https://arxiv.org/abs/2502.05167)). The benchmark’s associative needles still rely on parametric/world knowledge, so it is a useful retrieval stress test rather than a pure measure of context utilization.

Chroma’s reproducible 2025 technical report evaluated 18 models and varied input length while holding task complexity comparatively fixed. It found degradation on non-lexical retrieval, repeated-word reproduction, and long-term memory tasks; distractor similarity and structure changed the failure rate, which challenges the assumption that irrelevant context is harmless ([Hong, Troynikov, and Huber, 2025](https://www.trychroma.com/research/context-rot); [replication toolkit](https://github.com/chroma-core/context-rot)). Its LongMemEval experiment is a manually cleaned 306-prompt subset with a GPT-4.1 judge, not the canonical full benchmark. This is useful engineering evidence but is not peer-reviewed.

Other primary benchmarks cover complementary failure modes rather than establishing one universal “context length”: [RULER, COLM 2024](https://arxiv.org/abs/2404.06654) tests synthetic retrieval and multi-hop manipulation; [HELMET, ICLR 2025](https://arxiv.org/abs/2410.02694) tests long-context reasoning and instruction following; [LongBench, ACL 2024](https://arxiv.org/abs/2308.14508) covers diverse long-document tasks; [∞Bench](https://arxiv.org/abs/2402.13718) stresses long-context reasoning beyond ordinary window sizes; [BABILong, NeurIPS 2024 Datasets and Benchmarks](https://arxiv.org/abs/2406.10149) tests long-context reasoning with synthetic memory demands; and [RAPTOR, ICLR 2024](https://arxiv.org/abs/2401.18059) studies recursive retrieval/clustering for long documents. These benchmarks should be selected by failure mode, not collapsed into a single claimed context score.

**Operational consequence:** Context should be assembled for the current decision. Keep stable policy and a minimal control header in every window; fetch large artifacts, histories, and prior research just in time; rerank and truncate retrieved material; and preserve source anchors outside the prompt.

### 1.2 ReAct, Reflexion, Tree of Thoughts, Generative Agents, and MemGPT solve different problems

| Work | Concrete mechanism | Evidence in the original paper | What it does **not** establish | DSH implication |
|---|---|---|---|---|
| [ReAct, ICLR 2023](https://openreview.net/forum?id=WE_vluYUL-X) | Interleave reasoning traces and environment actions so observations update plans. | On ALFWorld, the paper reports 71% success versus 37% for BUTLER and 45% for Act (+34/+26 percentage points); on WebShop it reports 40.0% versus 30.1%. On HotpotQA, ReAct alone is below CoT/CoT-SC, while the best ReAct→CoT-SC hybrid reaches 35.1 EM. | It is a prompting/fine-tuning study, not a durable runtime. The official repository is explicitly GPT-3 `text-davinci-002` prompting code and does not include the paper’s main PaLM-540B experiments; complex action spaces can exceed in-context example limits. | Keep tool observations and action outcomes outside the durable summary; provide a small verified working trace and replayable tool journal. |
| [Reflexion, NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html) | Actor, evaluator, and self-reflection modules; trajectory is short-term memory, while bounded reflective text is long-term episodic memory (usually 1–3 experiences). | The paper reports 91.0% on HumanEval **Python** using GPT-4, generated tests, and iterative Reflexion, and gains on ALFWorld/HotpotQA; it also reports HumanEval-style improvements that do not generalize uniformly. | The 91.0% setup is not generic Reflexion; GPT-4 availability/API cost and model drift limit independent reproduction. Reflection quality depends on feedback/evaluator quality; WebShop exposes local-minimum failures, and MBPP Python falls from 80.0% to 77.1%. | Store only concise, evidence-linked lessons; evaluate reflection as a proposal, not as truth. Do not recursively summarize every failure. |
| [Tree of Thoughts, NeurIPS 2023](https://arxiv.org/abs/2305.10601) | Generate, evaluate, backtrack over coherent intermediate “thoughts.” | On 100 relatively hard Game-of-24 games (indices 901–1000 of 1,362 ordered by human solving time), the paper reports 74/100 (74%) for Chat Completion GPT-4 at temperature 0.7, three equation thoughts, breadth-first search width 5, and three value samples per thought. The 4% CoT comparator is a single-sample mean, not equal-compute; b=1 ToT is 45% and best-of-100 CoT is 49%. The later 69% is a same-team rerun, not independent reproduction; the paper also reports creative-writing and crossword tasks. | The 74% is a paper result: the [official repository](https://github.com/princeton-nlp/tree-of-thought-llm) later reports 69% in a rerun because of decoding randomness. These bounded search tasks are not production long-running agents. | Use bounded search only for high-uncertainty decisions. Keep candidate paths, scores, pruning criteria, and final evidence; avoid unbounded reflection loops. |
| [Generative Agents, UIST 2023](https://doi.org/10.1145/3586183.3606763) | Memory stream scored by relevance, recency, and importance; periodic reflection; daily planning. | A controlled 100-participant interview/ablation study and a separate two-day 25-agent Smallville simulation found that the full architecture produced more believable behavior than ablations; the paper also documented retrieval failures. | It evaluated simulation believability, not production task completion, security, or multi-tenant durability. | Separate raw episodes from curated reflections; retrieve by task need, and measure belief/attribution and contradiction rate. |
| [MemGPT, 2023](https://arxiv.org/abs/2310.08560) / [Letta](https://docs.letta.com/agent-sdk/memory/) | The original paper’s main context is read-only system instructions plus a fixed-size read/write working context and an in-context rolling FIFO queue; external state is separate recall storage and archival storage. Later Letta memory blocks are successor terminology, not the original mechanism. | MemGPT evaluated document analysis beyond the model context and multi-session conversation behavior. Letta’s current docs describe a successor implementation, not the original experiment. | The bounded evaluation covers five-session MSC tasks, 50 NQ-open questions, and synthetic nested KV; it is not a production durability/security proof. Self-editing memory adds mutation, overwrite, and injection risks. | Use deterministic runtime state for correctness. If the model may edit memory, constrain scope, provenance, limits, versioning, and audit. |

Anthropic’s first-party multi-agent research report provides a useful, explicitly internal comparison: its Opus-led multi-agent system reportedly outperformed a single Opus agent by 90.2% on an internal research evaluation, while multi-agent research used about 15× as many tokens as chat. The report describes parallel clean-context exploration as one design factor but does not establish that it caused the gain; it also describes coordination failures, deployment complexity, and a poor fit for tightly dependent coding tasks. Treat these numbers as first-party internal research-evaluation results and engineering-report evidence, not an independent benchmark or production validation ([Anthropic, 2025-06-13](https://www.anthropic.com/engineering/multi-agent-research-system)).

Together, these works support a **loop plus external state**: observe, act, record, evaluate, and occasionally reflect. None supports the claim that one very long transcript is an ideal database or scheduler.

### 1.3 Memory should be a governed lifecycle, not a vector dump

For this engineering design, **working state**, **episodic history**, **semantic facts**, and **procedural guidance** are an operational decomposition, not a claim that they map one-to-one onto biological memory categories. Write, retrieval, consolidation, updating, and forgetting should be separate operations with different controls.

Generative Agents supplies the foundational retrieve/reflect loop. MemGPT supplies explicit tiers and paging. Reflexion shows that a small bounded failure memory can improve retries. More recent systems explore richer organization:

- [MemoryBank, AAAI 2024](https://doi.org/10.1609/aaai.v38i17.29946) analyzes 10 simulated days, 15 virtual users, 194 human probes, and qualitative real-user examples; it has no no-memory ablation and is not a standardized persistent-memory benchmark.
- [LoCoMo, ACL 2024](https://aclanthology.org/2024.acl-long.747/) contains very long conversations (the final ACL version averages about 600 turns and 16K tokens over up to 32 sessions) and evaluates QA, event summarization, and multimodal dialogue. The final ACL paper reports 12–20% QA improvements for long-context variants, a 36% human gap, a 41% temporal-reasoning gap, and 65% adversarial degradation; observation/assertion-style RAG was strongest. These are benchmark-specific, partly generated-data results, not a general proof of production memory safety ([Adyasha Maharana et al., 2024](https://doi.org/10.18653/v1/2024.acl-long.747); [code/data](https://github.com/snap-research/locomo)).
- [LongMemEval, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html) contains 500 questions across extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention; its LongMemEvalS setting is about 115K tokens per question (500 questions), with LongMemEvalM at 500 sessions and about 1.5M tokens. The paper reports about a 30% drop in its headline experiment, with larger roughly 30–60% model/metric-dependent gaps reported across systems and analyses, when models use full histories instead of focused evidence; it also reports improvements from fact-expanded keys, time-aware expansion, and structured reading. Sessions are LLM-simulated and human-edited, and evaluation uses a GPT-4o judge, so treat the numbers as benchmark evidence rather than production SLOs ([Di Wu et al., 2025](https://arxiv.org/abs/2410.10813)).
- [A-Mem, NeurIPS 2025](https://proceedings.neurips.cc/paper_files/paper/2025/hash/19909c36f51abc4856b4560aff3d36d6-Abstract-Conference.html) dynamically links and rewrites atomic memories, outperforming several baselines mainly on non-GPT backbones; GPT baselines win some open-domain/adversarial categories, while A-MEM’s strongest claim is multi-hop. The evidence is QA on those datasets with automatic rewrites, not durable production safety; the official [evaluation repository](https://github.com/WujiangXu/A-mem) and [system repository](https://github.com/WujiangXu/A-mem-sys) should be treated as implementation references. Automatic evolution is also a mutation and provenance concern, not only a benefit.
- The official [LangMem](https://github.com/langchain-ai/langmem) project provides namespace, semantic-search, and background-memory patterns for LangGraph applications; this is implementation guidance, not independent evidence that every memory write should be automatic.
- [Mem0, 2025](https://arxiv.org/abs/2504.19413) and its [official repository](https://github.com/mem0ai/mem0) propose an extracted, updateable memory service and author-reported benchmark gains. Treat the paper as affiliated/self-evaluated evidence: results depend on benchmark version, extractor/generator models, and evaluation prompts, and require independent replication before selecting it as a correctness substrate.
- [Zep, 2025](https://arxiv.org/abs/2501.13956) and [Graphiti](https://github.com/getzep/graphiti) propose temporal knowledge-graph memory for agent retrieval. The paper and project are useful implementation references, but reported benchmark gains are author-affiliated and should not be generalized from small conversation benchmarks such as LoCoMo without independent replication.

**Recommended write policy:**

1. Deterministic runtime state is authoritative for cursors, pending approvals, leases, job IDs, budgets, and retries.
2. Files, Git history, and test results are authoritative for coding state.
3. Semantic memory is a derived, searchable cache with provenance, timestamp, confidence, scope, and source anchors.
4. A new fact supersedes rather than silently overwrites an old fact; both remain auditable.
5. Model-generated reflections are proposals until validated.
6. Secrets and authorization decisions are not ordinary semantic memory.
7. Retrieval is tenant-, agent-, and task-scoped and includes negative-result evidence where absence matters.

Persistent memory adds distinct attack classes. [AgentPoison, NeurIPS 2024](https://arxiv.org/abs/2407.12784) demonstrates optimized retrievable triggers/backdoors in agent memory; [MINJA, NeurIPS 2025](https://proceedings.neurips.cc/paper_files/paper/2025/hash/42a97bbd9844d2bf68596730af80bcdf-Abstract-Conference.html) demonstrates query-only persistent injection and reports 98.2% memory-injection success plus 76.8% downstream malicious-reasoning success in its evaluated settings; [MEXTRA, ACL 2025](https://aclanthology.org/2025.acl-long.1227/) studies privacy extraction from agent memory; and [MemBench, Findings ACL 2025](https://aclanthology.org/2025.findings-acl.989/) evaluates effectiveness, efficiency/capacity, and reflective-memory decay. These papers support provenance, write authorization, privacy, capacity, and decay controls; they do not establish the proposed DSH fork-and-seal protocol.

### 1.4 Compaction is lossy; it must be a derived view, not the system of record

LLMLingua reports up to 20× compression with little loss across GSM8K, BBH, ShareGPT, and Arxiv-March23; the approximately 1.5-point drop is the specific 20× GSM8K result, not an average across all four datasets. This is prompt compression, not a proof that free-form conversation summaries preserve task state ([Jiang et al., EMNLP 2023](https://aclanthology.org/2023.emnlp-main.825/)).

Direct working-memory studies strengthen the case for external evidence over full replay. [ReadAgent, ICML 2024](https://proceedings.mlr.press/v235/lee24c.html) treats long document reading as memory management; [HiAgent, ACL 2025](https://aclanthology.org/2025.acl-long.1575/) uses hierarchical working memory with subgoals, summarized completed chunks, and trajectory retrieval; and [R3Mem, Findings ACL 2025](https://aclanthology.org/2025.findings-acl.235/) uses reversible compressed implicit memory with virtual tokens and backward reconstruction. These are task-specific systems, not proof of generic crash-safe handoff.

Anthropic’s first-party context-engineering guidance recommends the smallest high-signal token set and describes three long-horizon techniques: compaction, structured note-taking, and subagents with clean contexts. It explicitly warns that aggressive compaction can lose subtle context that becomes important later ([Anthropic, 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)). Its long-running harness report recommends an initializer that creates requirements, setup, and a progress log, then sessions that make incremental progress, test end to end, commit, and update progress; these are strong practitioner observations, not controlled comparative evidence ([Anthropic, 2025-11-26](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).

Google ADK currently exposes token- or completed-event/invocation-triggered event compaction, a configurable summarizer, overlap, and a last-N raw tail left un-compacted in the model input ([ADK context compaction](https://adk.dev/context/compaction/)). This model-input tail is not an immutable raw transcript/audit log; persistent event history is separate. At the cutoff, Resume was available for Python 1.16+/Kotlin 0.1+ and Rewind for Python 1.17+/Kotlin 0.3+. At the 2026-03-21 cutoff, OpenAI’s Agents SDK snapshot distinguishes client-side sessions from server-managed continuation and documents Responses compaction plus SQLite, Redis, SQLAlchemy, and Dapr backends; the mutable current page should not be used to backfill later backends ([pinned sessions snapshot](https://github.com/openai/openai-agents-python/blob/8db2ed2d08bbed60407de2c255317ed3bbdf990a/docs/sessions/index.md)). These APIs establish practical mechanisms, not the fidelity of any particular summary prompt.

**Compaction contract:**

- Keep the raw transcript append-only outside the prompt.
- Make each compacted claim addressable to a source event range or workspace artifact.
- Preserve a recent raw tail for pronoun resolution and immediate correction.
- Extract state with a fixed schema rather than asking for an unconstrained prose recap.
- Validate contradictions, unresolved approvals, pending jobs, exact identifiers, test results, and the next action.
- Reconstruct from raw evidence on demand; never require the summary to be the only copy.
- Make compaction idempotent and reversible, and measure critical-fact recall rather than summary fluency.

## 2. Durable continuation and framework decision matrix

“Durable execution” is not the same as “durable chat storage.” At the cutoff, PydanticAI’s version-pinned integration docs put orchestration durability in an external engine and leave application persistence of typed message history to the application ([PydanticAI v1.70.0 durable overview](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/overview.md); [message history](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/message-history.md)). LangGraph separately provides thread-scoped checkpointers and cross-thread stores ([LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)).

| Option | What is persisted | Replay/recovery guarantee | Memory/session model | Main-system protection | Operational tradeoff | DSH fit |
|---|---|---|---|---|---|---|
| **LangGraph** | Graph state at supersteps; checkpointer task/pending writes are recovery data; separate cross-thread store. | `sync` synchronously persists checkpoints; `async` can lose only the newest uncommitted step; `exit` persists at exit/interrupts. Automatic failure recovery re-runs the failed node; deliberate time travel re-executes downstream nodes, LLM/API calls, and interrupts, without rewinding world state ([durable execution](https://docs.langchain.com/oss/python/langgraph/durable-execution); [persistence](https://docs.langchain.com/oss/python/langgraph/persistence); [interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts); [time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)). | Thread checkpointer for short-term state; store for user/app memory; store namespaces are organization-scoped, not ACLs ([cutoff persistence source](https://raw.githubusercontent.com/langchain-ai/docs/a54d6a31d46ba50e8d14f1b7008d825ca07a3b7a/src/oss/langgraph/persistence.mdx)). | Good if the DSH host registry is outside graph state and an independent authorization/tenant boundary is enforced outside LangGraph. | `sync` is checkpoint persistence, not an end-to-end transaction with external effects or store writes. Successful task results can be reused after persistence, but crash-after-effect remains idempotency-dependent; OSS is in-process; Agent Server/Deployment is optional managed/background infrastructure. | **Strong candidate for a DSH workflow engine** (analyst recommendation), subject to release and security checks. |
| **Temporal** | Per-Run append-only Event History is the source of record; workflow variables/SDK objects are replay-derived Worker memory; Visibility/Search Attributes are a separate eventually consistent index. | Logical Workflow code is effectively once under recoverable infrastructure failure, not external effects or guaranteed completion. Activities may repeat; terminal results/failures are recorded after retries ([Workflow Execution](https://docs.temporal.io/workflow-execution); [Activity idempotency](https://docs.temporal.io/activity-definition#idempotency); [Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies)). | Event History is finite/retention-bounded; Continue-As-New starts a fresh history/Run ID with explicit state while old history remains. Signals are asynchronous writes, Updates tracked synchronous writes, and Queries nonblocking reads. The programming model supplies no approval UI or application-specific approver authorization; Temporal Cloud separately supplies platform access controls/RBAC. Self-hosted deployments require an Authorizer/ClaimMapper configuration. | Strong only with explicit retention, Payload Codec/client-side encryption, TLS/mTLS, and (for self-hosted OSS) an Authorizer/ClaimMapper; Workers still see decoded plaintext payloads. | Self-hosted authorizer defaults, finite retention, payload exposure, and the workflow sandbox are not a complete security or external-effects boundary; Cloud platform RBAC does not replace application approver policy. | **Candidate for durable, recoverable long-running execution and Temporal-observed finite-retention audit history** (analyst recommendation). |
| **Google ADK** | Independent `SessionService`, `ArtifactService`, and optional `MemoryService`; versioned session artifacts and resumable invocation steps. Persistence is backend-dependent, not one atomic bundle. | Resume reinstates successful tool results and reruns the interrupted/uncompleted tool, so tools are at least once and may repeat; custom agents need explicit saved step checkpoints ([Resume](https://adk.dev/runtime/resume/)). | Clear Session / State / Memory / Artifact separation; memory ingestion is explicit via `add_session_to_memory`; compaction and artifact services are separate ([conversational context](https://adk.dev/sessions/); [artifacts](https://adk.dev/artifacts/)). | Good if session, user, and app state/artifacts are deliberately scoped. | ADK core can run locally with non-durable in-memory services; Vertex AI, Agent Engine, IAM, and cloud persistence are optional backend/deployment choices. At the cutoff, Resume was Python 1.16+/Kotlin 0.1+ and Rewind Python 1.17+/Kotlin 0.3+. Tool Confirmation was experimental and did not support `DatabaseSessionService` or `VertexAiSessionService`; Resume confirmation requires the original invocation ID ([Action confirmations](https://adk.dev/tools-custom/confirmation/)). | **Good reference model for event/artifact boundaries** (analyst recommendation), not proof of safe world rollback. |
| **OpenAI Agents SDK** | Client session items; server conversation/Responses state; compaction item; optional encrypted sessions. A paused approval run must persist serialized `RunState` and retain the same underlying session store; this is an interruption pause/resume snapshot, not generic crash replay, an automatic per-step checkpoint, or a transaction with Session. The session itself is conversation memory, not the execution cursor ([HITL](https://openai.github.io/openai-agents-python/human_in_the_loop/)). | `result.to_state()` → persist → approve/reject → `Runner.run(agent, state)` resumes the run. Server-managed and client-side continuation modes are intentionally not layered. | Multiple core/extension backends; model-input callbacks can filter history while stored items remain ([sessions](https://openai.github.io/openai-agents-python/sessions/)). | Good when a stable system layer and durable `RunState` are outside session history. | Provider coupling applies to server-managed conversation/Responses/hosted-tool paths, not every local Session/custom-provider use. `OpenAIResponsesCompactionSession` is a wrapper that can clear/rewrite underlying history, not an independent durable backend; `EncryptedSession` does not encrypt provider state or serialized `RunState`. Tracing documents observation/export but no replay contract; sensitive tracing data defaulted on, `response_id` retention and API-org ZDR limitations require application-owned redaction/retention controls ([tracing](https://openai.github.io/openai-agents-python/tracing/)). | **Useful for an OpenAI-native deployment, not a portable DSH persistence contract.** |
| **AutoGen** | Serializable Python AgentChat agent/team state; separate memory backing stores can mutate model context. | Save/load is an explicit AgentChat snapshot operation, not durable replay; default custom-agent state is empty unless overridden ([Managing State](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/state.html)). | AgentChat team snapshots are separate from the experimental Core distributed gRPC runtime. An in-run `UserProxyAgent` wait leaves a team in an unstable state that cannot be saved/resumed; the safe pattern is terminate → save → new run ([HITL](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html)). | Possible, but preservation depends on each custom agent’s serialized state; memory stores are separate from team state. | The [official repository](https://github.com/microsoft/autogen) says new users should use Microsoft Agent Framework and that AutoGen will still be maintained with bug fixes and critical security patches; this row covers Python AgentChat/Core, not the full .NET surface. Save/load provides no replay, exactly-once, at-least-once, or effect-deduplication guarantee and omits configuration/world state; Only connect to trusted MCP servers, because MCP may run local commands or expose sensitive data; local code executors run on the host, and Docker is not complete isolation when mounts, sockets, network, tools, or external volumes are exposed ([distributed runtime](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/distributed-agent-runtime.html); [gRPC API](https://microsoft.github.io/autogen/stable/reference/python/autogen_ext.runtimes.grpc.html); [command-line executors](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/components/command-line-code-executors.html)). | **Snapshot-oriented orchestration option; do not choose it as a new DSH durability foundation without a migration reason.** |
| **PydanticAI + Temporal** | Temporal Workflow/Activities plus application-persisted, typed message history. At the cutoff (v1.70.0, published 2026-03-18 UTC), PydanticAI documented Temporal, DBOS, and Prefect integrations. | Model requests, MCP communication, and tool calls that may require I/O run as Activities; pure async tools may opt out. Durable execution requires an actual Temporal workflow, frozen model/toolset definitions, stable IDs, serializable dependencies, model strings or preregistered identities, and a provider factory; credentials should be loaded in Activities or an external secret store rather than embedded in serialized `deps` or Event History ([Temporal integration](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/temporal.md)). | Durable run state is distinct from application-persisted `ModelMessagesTypeAdapter` history; there is no built-in general user store. | Strong if definitions/IDs remain stable and credentials are obtained at Activity execution time or from an external secret store rather than embedded in serialized `deps`/Event History. | Activities can duplicate external effects; Temporal’s default 2 MB payload limit and provider/Activity retry multiplication require controls. Deferred approvals are run data, not a durable approval database or policy engine; payloads can contain prompts/results/dependencies, and Logfire/OTel content export requires explicit content controls. At the cutoff, in-workflow streaming APIs were unsupported; use an event handler plus external queue/consumer. | **Strong production option if Temporal is already accepted** (analyst recommendation). |
| **Bespoke SQLite + Git** | Append-only local events, typed snapshots, refs, commits, diffs, and test evidence. | Atomic pointer swap and recovery journal can be made transactional; external side effects still need idempotency keys. | Excellent for single-host DSH; must add encryption, tenancy, retention, and compaction. | Strongest if implemented as a narrow session overlay and never owns host composition. | Application must build schema migration, crash recovery, locking, and audit. | **Recommended MVP for a safe DSH session-recycling plugin.** |

**Evidence level:** Every guarantee in this matrix is an official documentation contract, implementation example, or project-status signal—not a comparative benchmark. The DSH-fit labels are analyst recommendations. No framework documentation establishes the ranking, and all rows require the report’s crash, authorization, idempotency, and adversarial tests.

**Cutoff release signals (separate from guarantees):** LangGraph Python 1.1.3 (2026-03-18; MIT; Production/Stable, with 1.x active-LTS policy) ([official releases](https://github.com/langchain-ai/langgraph/releases)); Temporal server tag v1.30.2 was created 2026-03-21 but published on GitHub 2026-03-24, while Python SDK 1.24.0 was released 2026-03-19 ([server](https://github.com/temporalio/temporal/releases/tag/v1.30.2); [SDK](https://github.com/temporalio/sdk-python/releases/tag/1.24.0)); Google ADK Python 1.27.2 was released 2026-03-17 ([release](https://github.com/google/adk-python/releases/tag/v1.27.2)); and OpenAI Agents Python 0.12.5 was the cutoff-tree version ([release](https://github.com/openai/openai-agents-python/releases/tag/v0.12.5)). These are maintenance signals, not comparative reliability evidence.

### 2.1 Temporal’s important caveat: Activities can repeat

Temporal requires deterministic workflow code and moves external I/O to Activities. An Activity may have completed an effect before a worker crashed and before Temporal recorded the result, so it can execute again. Temporal’s cutoff-era guidance calls for idempotent Activities and idempotency keys ([Activity idempotency](https://docs.temporal.io/activity-definition#idempotency)); Retry Policies govern retries, not exactly-once external effects ([Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies)). LangGraph documents the same requirement when replaying a node or API call.

The same rule applies to DSH: file writes, shell commands, tool calls, message delivery, model spend, and plugin activation need an operation key, receiver-enforced uniqueness or outbox/inbox/reconciliation, pre/postconditions, and compensating behavior. Classify each effect as idempotent, reconcilable, or compensatable; record unknown outcomes; and account for duplicate model spend even when a returned result is deduplicated.

### 2.2 ADK’s rewind limitations are a warning for DSH

ADK preserves rewound requests in its log for audit but excludes them from later model input. It restores session-level state and session-scoped artifacts, but not app/user-level state, broader-scoped artifacts, or external systems; state/artifact/event updates are not one atomic transaction ([ADK Rewind](https://adk.dev/sessions/session/rewind/)). A DSH “undo” must therefore distinguish **conversation rollback** from **world rollback** and label anything that cannot be restored.

## 3. Model and agent routing

FrugalGPT learned cascades that matched the best individual model with up to 98% cost reduction or improved accuracy by 4% at equal cost on its selected classification, reading-comprehension, and science-QA datasets ([Chen, Zaharia, and Zou, TMLR 2024](https://openreview.net/forum?id=1J6nBzgF3S)). RouteLLM trained routers from preference data and reported more than 2× cost savings without substantial quality loss on MMLU, MT-Bench, and GSM8K, with generalization across some unseen model pairs ([Ong et al., ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/5503a7c69d48a2f86fc00b3dc09de686-Abstract-Conference.html)). RouterBench found large potential Pareto improvements but also found that many predictive routers did not significantly beat a simple baseline across its benchmark, and that judge error limits cascades ([Hu et al., 2024](https://arxiv.org/abs/2403.12031)).

**DSH routing policy:**

- Route only on validated task envelopes: security tier, required tools, repository write access, test burden, context length, risk, and latency SLO.
- Use a cheap model for classification, extraction, search planning, and deterministic transforms; use a stronger model for ambiguous architecture, security, and high-impact synthesis.
- Use a cascade with a **deterministic or independently validated acceptance test** before accepting the cheap answer.
- Keep a strong-model escalation path; routing must never bypass user approval, sandboxing, or evidence checks.
- Re-evaluate after model upgrades, prompt changes, tool changes, or drift. RouteLLM’s generalization is encouraging, not a guarantee.
- Log route inputs, selected model, expected/actual cost, quality evidence, escalation, and final result.

## 4. Workspace, specification, and “Agent OS” practices

These practices place durable task state in inspectable artifacts, but their quality and productivity claims are first-party method or practitioner assertions, not controlled research:

- Git worktrees attach multiple working trees to one repository, each with its own `HEAD` and index while sharing most repository data ([Git 2.53.0 documentation, 2026-02-02](https://git-scm.com/docs/git-worktree/2.53.0)). The same branch normally cannot be checked out twice; removal refuses dirty worktrees; manual deletion leaves stale administrative metadata unless pruned; locks prevent prune/delete; moving either tree can require repair; and submodule multiple checkouts are not recommended. For DSH, allocate a unique branch/worktree, serialize ownership, capture dirty/untracked state, and clean only after a post-health gate. Ports, caches, credentials, services, and shared config can still collide; that last list is an operational inference, not a reliability claim from Git.
- GitHub’s [Spec Kit](https://github.com/github/spec-kit) separates what/why from how and uses `specify → plan → tasks → implement → converge`; its current [spec-driven method](https://github.com/github/spec-kit/blob/main/spec-driven.md), rechecked 2026-09-25, is first-party advocacy. A spec can become stale or over-specified, and a spec must not override runtime, Git, or test evidence.
- BMAD’s [planning guidance](https://docs.bmad-method.org/plan/choose-a-planning-path/) emphasizes right-sized planning and a five-field `SPEC.md` kernel: Why, Capabilities, Constraints, Non-goals, and Success signal. Its current skill contract describes an append-only memlog as a useful provenance pattern when validated and stored outside the Host control plane; that current contract was rechecked 2026-09-25 and is not asserted by the cutoff release. The cutoff release was [v6.2.0, 2026-03-15](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.2.0).
- [OpenSpec v1.2.0, 2026-02-23](https://github.com/Fission-AI/openspec/releases/tag/v1.2.0) uses proposal/spec/design/task artifacts and change-scoped `ADDED`/`MODIFIED`/`REMOVED` sections; its archive/date path preserves history. The [version-pinned Getting Started](https://github.com/Fission-AI/OpenSpec/blob/v1.2.0/docs/getting-started.md) confirms that lifecycle. The current [FAQ](https://github.com/Fission-AI/OpenSpec/blob/main/docs/faq.md), rechecked 2026-09-25, recommends committing `openspec/` to Git because it survives context resets. Treat prose/spec drift and generated instructions as risks; a spec is not proof that runtime behavior is correct.
- [Kai Linux Agent OS](https://github.com/kai-linux/agent-os) is a very new practitioner pattern (repository created 2026-03-16), not a standardized evidence class or well-established reliability result. Its issues/worktrees/result-contract/control-plane ideas are useful, but self-reported success and auto-merge/rebase policies do not override this report’s human or deterministic quality gates.

Current coding-agent guidance reinforces the same boundary without proving it: Claude Code distinguishes loaded `CLAUDE.md`/`AGENTS.md` context from enforced policy; a same-process branch may carry session-scoped grants, while a separate-process fork starts without them; auto memory is repository-scoped/shared across worktrees and may outlive transcript cleanup; worktrees share Git metadata/plugins/project instructions/permission rules and do not isolate processes, secrets, services, or approvals; checkpoints omit Bash/subagent/external/concurrent edits and are not version control ([memory](https://code.claude.com/docs/en/memory), [sessions](https://code.claude.com/docs/en/sessions), [worktrees](https://code.claude.com/docs/en/worktrees), [checkpointing](https://code.claude.com/docs/en/checkpointing)). Treat repository, memory, handoff, MCP, and fetched text as untrusted; enforce managed settings/hooks/sandbox, fail closed at startup, and never retry unsandboxed. Codex documents `AGENTS.md`, sandbox/security, and CLI lifecycle controls ([AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [security](https://developers.openai.com/codex/security), [CLI](https://developers.openai.com/codex/cli/reference)). Gemini CLI documents context files, save/resume, checkpoint limits, sandboxing, trusted folders, session management, experimental worktrees, rewind, auto-memory, policy, and system-prompt override controls ([context](https://geminicli.com/docs/cli/gemini-md/), [commands](https://geminicli.com/docs/cli/commands/), [session management](https://geminicli.com/docs/cli/session-management/), [worktrees](https://geminicli.com/docs/cli/git-worktrees/), [rewind](https://geminicli.com/docs/cli/rewind/), [auto memory](https://geminicli.com/docs/cli/auto-memory/), [policy](https://geminicli.com/docs/reference/policy-engine/), [system prompt](https://geminicli.com/docs/cli/system-prompt/), [sandbox](https://geminicli.com/docs/cli/sandbox/), [trusted folders](https://geminicli.com/docs/cli/trusted-folders/)). These pages are vendor guidance, not efficacy evidence.

**Synthesis for DSH:** Markdown/spec files are excellent human-readable source material, but generated prose is not the transaction record. Pair specs with typed status, checksums, source refs, tests, and a machine-readable state machine. Use worktrees or equivalent isolated workspaces for parallel coding agents; never let two workers share mutable working files without locks or a merge protocol. Pin tool/spec versions or commit SHAs when implementing from mutable `main` documentation.

## 5. Recommended S-tier DSH architecture

### 5.1 Five state tiers

| Tier | Contents | Durability | Recyclable? | Authority |
|---|---|---|---|---|
| **Control** | Main system prompt/composition, model policy, tool policy, security rules, user identity, approved grants | Host-owned; versioned | No | **Authoritative** |
| **Run ledger** | Append-only events: message envelope IDs, tool requests/results, approvals, route choices, errors, lifecycle transitions | Transactional database | No | **Authoritative audit** |
| **Task state** | Goal, plan, checklist, blockers, next action, open questions, exact IDs, worktree, HEAD, dirty paths, tests | Versioned snapshot | Derived but stable | **Authoritative task state** |
| **Durable memory/workspace** | Specs, notes, artifacts, curated facts, code, test reports | Git/object store/database | No; may be superseded | Authoritative for artifacts; derived for summaries |
| **Working context** | Prompt, recent raw turns, retrieved snippets, scratch reasoning, temporary subagent traces | Ephemeral session cache | **Yes** | Non-authoritative |

### 5.2 Five-part context packet

Every new model window should be assembled from five explicit parts:

1. **System header:** stable identity, safety rules, tool and approval policy, and output contract.
2. **Task capsule:** goal, scope, constraints, non-goals, definitions, and current phase.
3. **Verified progress:** completed work, evidence, test status, blockers, and exact next action.
4. **Small raw tail:** recent user requests, assistant messages, and tool results needed for immediate repair.
5. **Targeted retrieval:** only the current spec slice, files, logs, or memories needed for the next decision.

Keep a sixth part, **large evidence**, outside the context and address it by path/ID/URL/hash. The agent should fetch it through a read tool.

A normalized starting tuple is 15% system/control, 25% task capsule and verified progress, 20% recent raw work, 25% targeted retrieval, and 15% output reserve. These are engineering starting points, not research results; tune them on measured task traces.

### 5.3 Versioned handoff contract

A handoff should be schema-validated, immutable, and evidence-linked:

```yaml
schema: dsh.session-handoff/v1
handoff_id: UUID
parent_session_id: UUID
child_session_id: UUID
created_at: RFC3339
control_plane_revision: immutable identifier
parent_last_event_seq: integer
workspace:
  root: absolute or stable logical path
  worktree: path/identifier
  git_head: commit
  branch: branch
  dirty_paths: [path]
goal:
  statement: string
  acceptance_criteria: [string]
  constraints: [string]
  non_goals: [string]
state:
  phase: enum
  completed: [{item, evidence_ids}]
  current_focus: string
  next_actions: [{action, completion_criterion}]
  blockers: [{description, owner_or_dependency}]
  open_questions: [string]
continuation:
  recent_event_range: [start, end]
  pending_approvals: [id]
  pending_jobs: [id]
  leases: [id]
  budgets: object
memory:
  promoted: [{key, value, source_event_ids, confidence, expires_at}]
  invalidated_keys: [key]
safety:
  grants_snapshot: identifier
  reauthentication_required: [operation classes]
provenance:
  source_hashes: object
  generated_by: {agent, model, prompt_version}
  payload_sha256: canonical-payload-digest
  signature: base64-or-external-signature-reference
  signature_alg: HMAC-SHA256|Ed25519|other
  signing_key_id: key-identifier
verification:
  schema_check: pass|fail
  workspace_check: pass|fail
  policy_check: pass|fail
```

The prose summary is an index into this contract, not its replacement. Raw events remain the recovery source. The host must canonicalize the payload, recompute `payload_sha256`, and verify `signature`/`signing_key_id` before activation; `source_hashes` authenticate artifacts, not the handoff envelope.

### 5.4 Safe recycling protocol

Each step has a completion criterion so a new session knows when the state is sufficient.

1. **Choose a safe boundary.** Recycle only at a quiescent point: after a model/tool step has committed and before the next non-idempotent action. **Done when:** no run is mid-write, no approval token is hidden in transient memory, and every launched child job has a durable ID.
2. **Verify the control plane.** Hash or revision the main system, agent preset, tools, grants, and policy. **Done when:** the control revision matches the active run and is not being mutated.
3. **Seal the parent.** Append a recycle intent, wait for the ledger transaction, mark the session read-only, and assign a terminal status. **Done when:** reopening the parent cannot append or execute tools.
4. **Capture world state.** Record workspace path, worktree, `HEAD`, branch, dirty files, processes, ports, artifacts, test evidence, and external IDs. **Done when:** a fresh process can inspect the same state without trusting the summary.
5. **Build and validate the handoff.** Extract the typed capsule, source anchors, recent raw range, pending work, and explicit non-goals. Run schema, referential-integrity, policy, and hash checks. **Done when:** every completion claim has evidence and every next action has a completion criterion.
6. **Create the child with a new identity.** Do not reuse session authentication or privileged grant tokens blindly. Assign a new child ID; copy only scoped, still-valid capabilities. **Done when:** child logs show a distinct lineage and least-privilege policy.
7. **Bootstrap with verification.** Load the control header, handoff, and small raw tail. Ask the agent to inspect the workspace and reconcile its claimed state with Git/status/tests before editing. **Done when:** it can state the current goal, last verified evidence, and next action without relying on hidden transcript memory.
8. **Atomic activation and rollback.** Atomically move the conversation pointer to the child; keep the parent as the recovery target until a health gate passes. **Done when:** a first bounded task succeeds and telemetry links child events to the parent checkpoint.
9. **Retire the working cache.** Expire token caches, provider response IDs, temporary subscriptions, and obsolete tool definitions only after the child is active. **Done when:** rollback does not require the deleted cache.

### 5.5 Main-system preservation invariants

The session-recycling plugin should enforce these as hard tests:

- The host composition, model route defaults, tool policy, sandbox, persistence service, and agent preset remain outside the recycled session.
- A child cannot mutate a main-system service merely because its parent could.
- Plugin definitions, packages, runs, grants, and version pointers have explicit ownership; cleanup affects only the child scope.
- A session summary cannot grant authority, approve an action, change policy, or erase another session.
- The parent ledger and workspace evidence remain readable until retention policy explicitly archives them.
- All destructive actions require a fresh policy check and, where appropriate, fresh human approval.
- Recovery never depends on an opaque provider compaction item or an unavailable in-memory runtime object.

## 6. Anti-patterns

1. **Unlimited transcript as memory.** It raises cost and attention noise, preserves obsolete facts, and makes contradictory histories hard to govern.
2. **Prose-only compaction.** A fluent summary may omit exact IDs, pending approvals, failed actions, negative results, or security constraints.
3. **Summary as destructive replacement.** Deleting the raw parent removes audit, rollback, and conflict resolution.
4. **In-place session reset.** Reusing a session ID obscures lineage and can carry poisoned memory, stale grants, or cached provider state.
5. **Blind capability inheritance.** “Continue the task” is not authorization to publish, delete, spend, or change system policy.
6. **Unvalidated model-generated memory.** Self-reflection and extracted facts can be wrong, stale, adversarial, or over-specific.
7. **Last-write-wins shared memory.** Concurrent agents and workers can erase each other’s updates.
8. **RAG without a negative answer.** Retrieval must distinguish “not found” from “not indexed” and “not remembered.”
9. **Router without an acceptance test.** Cheap-model confidence and LLM judges are not ground truth.
10. **Treating framework state as world state.** A serialized team state does not rewind external APIs, files, packages, or side effects.
11. **Assuming replay means no duplicate side effects.** Replayed nodes and Activities can repeat external effects unless actions are idempotent.
12. **Choosing a framework before specifying boundaries.** Framework defaults should follow durability, isolation, and audit requirements.
13. **Automatic merge or auto-rebase in an agent loop.** Require a human or deterministic quality gate and preserve branch lineage.
14. **Treating workspace isolation as complete isolation.** Worktrees share repository data and do not isolate ports, services, credentials, or external systems.
15. **Marketing claims as benchmarks.** A provider’s “unlimited,” “persistent,” or “enterprise” wording is not evidence of task success, security, or recoverability.
16. **Unbounded auto-refresh or self-modification.** A-Mem-style evolution and Reflexion-style self-correction need validation, budgets, and rollback.
17. **Testing only the happy path.** Handoffs must be tested at every tool, approval, process-crash, and concurrency boundary.

## 7. Evaluation rubric

Score each dimension from 0–4. Weight the total to 100. Any critical gate failure caps the design at “not safe,” regardless of total score.

| Dimension | Weight | 0 | 1 | 2 | 3 | 4 | Required measures |
|---|---:|---|---|---|---|---|---|
| **Continuity fidelity** | 18 | Loses goal/constraints | Major omissions | Core facts mostly retained | Critical facts and next action retained | Critical recall 100% on declared set; conflicts and negative results preserved | Handoff critical-fact precision/recall; source coverage; contradiction rate; next-action validity |
| **Durable recovery** | 18 | Manual reconstruction | Recovers only happy path | Recovers from common crash | Recovers from every tested boundary | Recovered run has no unauthorized duplicate effect | Crash injection at each step; state divergence; duplicate side-effect rate; RTO/RPO |
| **Security and isolation** | 18 | Main system or tenant can be changed | Grants leak across session | Main control plane protected but stale grants possible | Least privilege, reauth, provenance, audit | Zero unauthorized effect across adversarial tests | Permission-bypass suite; cross-session memory tests; prompt/memory injection; secret-leak scan |
| **Task success** | 14 | Regression vs no recycling | Large regression | No regression on easy tasks | Equal success on target distribution | Non-inferior on long-horizon and crash-recovery slices | Acceptance tests; human review; agent completion; test pass rate; rework count |
| **Context quality** | 12 | Critical facts buried/lost | Summary noisier than raw context | Useful but over-retrieves | Minimal high-signal context | Recall-first compaction then precision optimization; targeted retrieval | Token composition; relevant-context precision/recall; NoLiMa-style non-lexical probes; abstention |
| **Operational efficiency** | 8 | Cost/latency prohibitive | Large regression | Cost-neutral | Lower cost with no loss | Better Pareto frontier at equal quality | Tokens, dollars, latency P50/P95, tool calls, summarizer overhead, cache hit rate |
| **Observability and control** | 7 | Unexplainable lineage | Logs incomplete | Basic audit | Typed handoff and correlated events | Reproducible timeline, rollback drill, lineage graph, policy decisions | Log completeness; replayability; rollback pass; lineage coverage |
| **Maintainability/interoperability** | 5 | Framework-specific opaque state | High migration cost | Manual migrations | Schema-versioned adapters | Compatibility tests across framework/storage versions | Migration drills; schema conformance; adapter contract tests |

### 7.1 Hard release gates

A candidate should not ship until all are true:

- Main-system integrity hashes and service registry are unchanged after 1,000 recycle cycles.
- Recovery succeeds after crash injection before, during, and after every write/approval/tool boundary.
- No critical handoff fact is missing in the golden corpus; no unsupported completion claim survives verification.
- Zero cross-session memory, capability, or filesystem escape in the adversarial suite.
- Duplicate irreversible side effects are zero; all repeatable actions use receiver-enforced unique keys plus outbox/inbox or reconciliation, record unknown outcomes, and account separately for duplicate model spend.
- Parent session, raw event range, and workspace revision remain auditable and rollback-capable.
- A user can understand the active lineage, handoff, approvals, and next action from the UI.
- The design has explicit retention, encryption, redaction, tenant isolation, and deletion semantics. Deletion cascades across raw events, summaries, embeddings, graph edges, caches/backups, and provider stores; legal holds/retention and crypto-shredding are explicit, and thread/namespace IDs are not treated as ACLs.

## 8. Recommended implementation sequence

1. **Start with an append-only local run ledger and SQLite/PostgreSQL state snapshots.** Keep the plugin narrow: it recycles DSH sessions, not the host composition.
2. **Implement the handoff schema, evidence hashes, and golden-corpus evaluator.** Do not begin with opaque LLM prose summaries.
3. **Add Git/worktree/process inventory capture** for coding tasks. Record dirty state rather than silently cleaning it.
4. **Add synchronous checkpoint persistence plus application-level idempotency/transactions at lifecycle transitions.** Async checkpointing is acceptable for ordinary steps only after crash tests establish the loss budget; neither mode is an end-to-end transaction with external effects.
5. **Add idempotency wrappers** for tools, subprocesses, file writes, provider calls, message delivery, and plugin lifecycle operations.
6. **Add a constrained compaction service.** Retain a raw tail, preserve source ranges, and test factual recall and authorization invariants.
7. **Add governed memory namespaces** with provenance, supersession, TTL, and user visibility. Start with explicit user-approved writes; add autonomous consolidation behind a feature flag.
8. **Add a two-tier model route** with deterministic routing rules, a validated cheap-model acceptance test, and strong-model escalation.
9. **Only then add subagent routing.** A subagent returns a typed result contract, not a giant transcript; each subagent has an isolated scope and a bounded budget.
10. **Adopt Temporal when a separate orchestration service is warranted; adopt LangGraph OSS for in-process workflows, adding Agent Server only when managed/background runtime infrastructure is desired.** PydanticAI’s Temporal/DBOS/Prefect integration is another option when its typed activity/message contracts fit. Keep the portable handoff/ledger contract independent of the chosen runtime.

## 9. Primary source catalog

Base undated documentation was accessed on 2026-03-21 and supplemental pages were rechecked on 2026-09-25; “n.d.” means the page does not state a publication date. Mutable `main`/current documentation should be pinned to a release or commit when used for implementation.

### Peer-reviewed papers, preprints, and reproducible technical reports

1. Nelson F. Liu et al., [“Lost in the Middle: How Language Models Use Long Contexts”](https://aclanthology.org/2024.tacl-1.9/), **TACL 2024**; arXiv first submitted 2023-07-06.
2. Ali Modarressi et al., [“NoLiMa: Long-Context Evaluation Beyond Literal Matching”](https://arxiv.org/abs/2502.05167), **ICML 2025**; submitted 2025-02-07, revised 2025-07-09.
3. Shunyu Yao et al., [“ReAct: Synergizing Reasoning and Acting in Language Models”](https://openreview.net/forum?id=WE_vluYUL-X), **ICLR 2023**; arXiv submitted 2022-10-06.
4. Noah Shinn, Federico Cassano, Edward Berman, Ashwin Gopinath, Karthik Narasimhan, and Shunyu Yao, [“Reflexion: Language Agents with Verbal Reinforcement Learning”](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html), **NeurIPS 2023**; [arXiv 2303.11366](https://arxiv.org/abs/2303.11366) submitted 2023-03-20; [official code](https://github.com/noahshinn/reflexion).
5. Shunyu Yao et al., [“Tree of Thoughts: Deliberate Problem Solving with Large Language Models”](https://arxiv.org/abs/2305.10601), **NeurIPS 2023**; submitted 2023-05-17, revised 2023-12-03; [official code/result note](https://github.com/princeton-nlp/tree-of-thought-llm).
6. Joon Sung Park et al., [“Generative Agents: Interactive Simulacra of Human Behavior”](https://doi.org/10.1145/3586183.3606763), **UIST 2023**; [arXiv 2304.03442](https://arxiv.org/abs/2304.03442) submitted 2023-04-07; ACM publication 2023-10-29.
7. Charles Packer et al., [“MemGPT: Towards LLMs as Operating Systems”](https://arxiv.org/abs/2310.08560), **arXiv technical report**, v1 2023-10-12 and v2 2024-02-12; [Letta lineage announcement, 2024-09-23](https://www.letta.com/blog/memgpt-and-letta/). The original paper’s main/recall/archival tiers are distinct from later Letta memory blocks.
8. Wanjun Zhong, Lianghong Guo, Qiqi Gao, He Ye, and Yanlin Wang, [“MemoryBank: Enhancing Large Language Models with Long-Term Memory”](https://ojs.aaai.org/index.php/AAAI/article/view/29946), **AAAI 2024**, published 2024-03-24; [arXiv 2305.10250](https://arxiv.org/abs/2305.10250) submitted 2023-05-17; [official code](https://github.com/zhongwanjun/MemoryBank-SiliconFriend).
9. Adyasha Maharana et al., [“Evaluating Very Long-Term Conversational Memory of LLM Agents”](https://doi.org/10.18653/v1/2024.acl-long.747), **ACL 2024**; arXiv submitted 2024-02-27.
10. Di Wu et al., [“LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory”](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html), **ICLR 2025**; arXiv submitted 2024-10-14, revised 2025-03-04.
11. Huiqiang Jiang et al., [“LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models”](https://aclanthology.org/2023.emnlp-main.825/), **EMNLP 2023**.
12. Kelly Hong et al., [“Context Rot: How Increasing Input Tokens Impacts LLM Performance”](https://www.trychroma.com/research/context-rot), **2025-07-14 technical report**; replication code at [chroma-core/context-rot](https://github.com/chroma-core/context-rot). Not peer-reviewed.
13. Lingjiao Chen et al., [“FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance”](https://arxiv.org/abs/2305.05176), **TMLR 2024**; arXiv submitted 2023-05-09.
14. Isaac Ong et al., [“RouteLLM: Learning to Route LLMs from Preference Data”](https://proceedings.iclr.cc/paper_files/paper/2025/hash/5503a7c69d48a2f86fc00b3dc09de686-Abstract-Conference.html), **ICLR 2025**; arXiv submitted 2024-06-26.
15. Qitian Jason Hu et al., [“RouterBench: A Benchmark for Multi-LLM Routing System”](https://arxiv.org/abs/2403.12031), **ICML 2024 Agentic Markets Workshop**; arXiv submitted 2024-03-18. Workshop evidence is not equivalent to main-conference peer review.
16. Shen Dong et al., [“Memory Injection Attacks on LLM Agents via Query-Only Interaction”](https://proceedings.neurips.cc/paper_files/paper/2025/hash/42a97bbd9844d2bf68596730af80bcdf-Abstract-Conference.html), **NeurIPS 2025**; [arXiv 2503.03704](https://arxiv.org/abs/2503.03704) submitted 2025-03-05, revised 2026-02-12; [official code](https://github.com/dsh3n77/MINJA).
17. Wujiang Xu et al., [“A-Mem: Agentic Memory for LLM Agents”](https://proceedings.neurips.cc/paper_files/paper/2025/hash/19909c36f51abc4856b4560aff3d36d6-Abstract-Conference.html), **NeurIPS 2025**; arXiv submitted 2025-02-17; [evaluation code](https://github.com/WujiangXu/A-mem) and [system code](https://github.com/WujiangXu/A-mem-sys).
18. Prateek Chhikara et al., [“Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory”](https://arxiv.org/abs/2504.19413), **ECAI 2025**, published 2025-10-21, pp. 2993–3000 ([publisher record](https://ebooks.iospress.nl/doi/10.3233/FAIA251160); DOI [10.3233/FAIA251160](https://doi.org/10.3233/FAIA251160)); arXiv submitted 2025-04-28; [official code](https://github.com/mem0ai/mem0). Author-affiliated/self-evaluated evidence.
19. Preston Rasmussen et al., [“Zep: A Temporal Knowledge Graph Architecture for Agent Memory”](https://arxiv.org/abs/2501.13956), **arXiv**, submitted 2025-01-20; [Graphiti official code](https://github.com/getzep/graphiti). Author-affiliated/self-evaluated implementation evidence.
20. Zhaorun Chen et al., [“AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases”](https://arxiv.org/abs/2407.12784), **NeurIPS 2024**.
21. Bo Wang et al., [“Unveiling Privacy Risks in LLM Agent Memory”](https://aclanthology.org/2025.acl-long.1227/), **ACL 2025** (MEXTRA method).
22. H. Tan et al., [“MemBench: Towards More Comprehensive Evaluation on the Memory of LLM-based Agents”](https://aclanthology.org/2025.findings-acl.989/), **Findings ACL 2025**.
23. Kuang-Huei Lee et al., [“ReadAgent: A Human-Inspired Reading Agent with Gist Memory of Very Long Contexts”](https://proceedings.mlr.press/v235/lee24c.html), **ICML 2024**.
24. [“HiAgent: Hierarchical Working Memory Management for Solving Long-Horizon Agent Tasks with Large Language Model”](https://aclanthology.org/2025.acl-long.1575/), **ACL 2025**.
25. [“R3Mem: Bridging Memory Retention and Retrieval via Reversible Compression”](https://aclanthology.org/2025.findings-acl.235/), **Findings ACL 2025**.

**Additional primary long-context sources:** [RULER, COLM 2024](https://arxiv.org/abs/2404.06654), [HELMET, ICLR 2025](https://arxiv.org/abs/2410.02694), [LongBench, ACL 2024](https://arxiv.org/abs/2308.14508), [∞Bench](https://arxiv.org/abs/2402.13718), [BABILong, NeurIPS 2024 Datasets and Benchmarks](https://arxiv.org/abs/2406.10149), and [RAPTOR, ICLR 2024](https://arxiv.org/abs/2401.18059).

Additional compaction/forgetting studies include [LongLLMLingua, ACL 2024](https://aclanthology.org/2024.acl-long.91/), [ACON](https://arxiv.org/html/2510.00615v2) (cutoff-safe arXiv revision 2025-10-17), and [MemoryAgentBench v3](https://arxiv.org/html/2507.05257v3) (2026-03-17). These cover prompt compression, agent-history/tool-observation compaction, and selective forgetting; their reported scores remain task/model-specific, and MemoryAgentBench uses reconstructed/synthetic data.

### Supplemental 2026 primary sources (verified 2026-09-25)

- [Diagnosing and Mitigating Context Rot in Long-horizon Search](https://arxiv.org/html/2606.29718v2), arXiv **2026-08-04**, with [official code](https://github.com/GAIR-NLP/ContextRot). The study’s reported results are bounded to its models/search benchmarks and are not universal guarantees.
- [Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models](https://arxiv.org/html/2510.04618v3), arXiv revised **2026-03-29**, with [official code](https://github.com/ace-agent/ace). Treat benchmark gains as author-reported until independently reproduced.
- [PACE: Predictive Adaptive Context Extraction for Long-Horizon LLM Agents](https://aclanthology.org/2026.acl-long.1252/), **ACL 2026**. It supports predictive, task-aware retrieval but does not replace typed state, raw evidence, or idempotency.

### Official framework, runtime, and project sources

26. Anthropic: [Effective context engineering for AI agents, 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents); [Effective harnesses for long-running agents, 2025-11-26](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [multi-agent research system, 2025-06-13](https://www.anthropic.com/engineering/multi-agent-research-system). First-party engineering evidence, not controlled comparative research.
27. LangChain: [cutoff persistence source](https://raw.githubusercontent.com/langchain-ai/docs/a54d6a31d46ba50e8d14f1b7008d825ca07a3b7a/src/oss/langgraph/persistence.mdx), [cutoff durable-execution source](https://raw.githubusercontent.com/langchain-ai/docs/fc290f30a9d33cdcb26c8770b0cf76b3702cacf3/src/oss/langgraph/durable-execution.mdx), [cutoff interrupts source](https://raw.githubusercontent.com/langchain-ai/docs/dcdef0630525c5bf4228fae68d0d62a80301d50e/src/oss/langgraph/interrupts.mdx), and [Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel), cutoff sources 2026-03-21.
28. Temporal: [cutoff Workflow Execution source](https://github.com/temporalio/documentation/blob/54ec321853d6340ffd6574816c9a7b90a72c3b24/docs/encyclopedia/workflow/workflow-execution/workflow-execution.mdx), [cutoff Continue-As-New source](https://github.com/temporalio/documentation/blob/74e6612f12d33b82b02ccb1e6712dc44cb40a6f1/docs/encyclopedia/workflow/workflow-execution/continue-as-new.mdx), [Activity idempotency](https://docs.temporal.io/activity-definition#idempotency), [Retry Policies](https://docs.temporal.io/encyclopedia/retry-policies), and [Event History](https://docs.temporal.io/workflow-execution/event), cutoff sources 2026-03-21.
29. Google ADK: [repository](https://github.com/google/adk-python), [docs repository](https://github.com/google/adk-docs), [Conversational Context: Session, State, and Memory](https://adk.dev/sessions/), [Compress agent context for performance](https://adk.dev/context/compaction/), [Resume stopped agents](https://adk.dev/runtime/resume/), [Rewind sessions for agents](https://adk.dev/sessions/session/rewind/), [Action confirmations](https://adk.dev/tools-custom/confirmation/), [Artifacts](https://adk.dev/artifacts/), and [Memory](https://adk.dev/sessions/memory/). Stable v1.27.2 was published 2026-03-17; v2.0.0a1 was a prerelease on 2026-03-18.
30. OpenAI: [cutoff sessions snapshot](https://github.com/openai/openai-agents-python/blob/8db2ed2d08bbed60407de2c255317ed3bbdf990a/docs/sessions/index.md), [v0.12.5 Human-in-the-loop](https://github.com/openai/openai-agents-python/blob/v0.12.5/docs/human_in_the_loop.md), [v0.12.5 tracing](https://github.com/openai/openai-agents-python/blob/v0.12.5/docs/tracing.md), [Responses compaction](https://developers.openai.com/api/docs/guides/compaction), and [Agents JS SDK](https://github.com/openai/openai-agents-js). Python v0.12.5 was published 2026-03-19 07:18:48Z; the JS SDK is separate.
31. Microsoft: [AutoGen repository/project status](https://github.com/microsoft/autogen), cutoff commit [b0477309](https://github.com/microsoft/autogen/commit/b0477309), [Managing State](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/state.html), [HITL](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html), [Memory/RAG](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/memory.html), [Core architecture](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/core-concepts/architecture.html), and [python-v0.7.5, 2025-09-30](https://github.com/microsoft/autogen/releases/tag/python-v0.7.5). Rendered state/HITL/memory pages are n.d.; use the cutoff commit link above for reproducibility. The cited state/HITL pages cover Python AgentChat; the Core distributed runtime is a separate surface.
32. PydanticAI: [v1.70.0 durable overview](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/overview.md), [Temporal](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/temporal.md), [DBOS](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/dbos.md), [Prefect](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/durable_execution/prefect.md), [deferred tools/HITL](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/deferred-tools.md), [message history](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/message-history.md), and [Logfire privacy](https://github.com/pydantic/pydantic-ai/blob/v1.70.0/docs/logfire.md). Release v1.70.0 was published 2026-03-18 UTC.
33. Git: [`git-worktree` 2.53.0 documentation](https://git-scm.com/docs/git-worktree/2.53.0), **2026-02-02**.
34. GitHub: [Spec Kit](https://github.com/github/spec-kit) and current [Specification-Driven Development](https://github.com/github/spec-kit/blob/main/spec-driven.md), official method/repository, rechecked 2026-09-25.
35. BMAD Method: [planning guidance](https://docs.bmad-method.org/plan/choose-a-planning-path/) and [v6.2.0, 2026-03-15](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.2.0).
36. Fission AI: [OpenSpec v1.2.0, 2026-02-23](https://github.com/Fission-AI/openspec/releases/tag/v1.2.0), [version-pinned Getting Started](https://github.com/Fission-AI/OpenSpec/blob/v1.2.0/docs/getting-started.md), and current [FAQ](https://github.com/Fission-AI/OpenSpec/blob/main/docs/faq.md), rechecked 2026-09-25.
37. Kai Linux: [Agent OS](https://github.com/kai-linux/agent-os), first-party practitioner repository created 2026-03-16. It is a pattern, not standardized or independent reliability evidence.
38. LangChain: [LangMem](https://github.com/langchain-ai/langmem), official implementation repository, **n.d.**, accessed 2026-03-21.
39. Letta: [current Agent SDK memory docs](https://docs.letta.com/agent-sdk/memory/), [active `letta-code` repository](https://github.com/letta-ai/letta-code), and [legacy/retired V1 repository](https://github.com/letta-ai/letta), successor implementation evidence, **n.d.**, accessed 2026-09-25.

### Current coding-agent operational guidance

40. Claude Code: [How Claude remembers your project](https://code.claude.com/docs/en/memory), [Manage sessions](https://code.claude.com/docs/en/sessions), [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees), [Checkpointing](https://code.claude.com/docs/en/checkpointing), [Security](https://code.claude.com/docs/en/security), and [Configure sandboxing](https://code.claude.com/docs/en/sandboxing), n.d.; supplemental recheck 2026-09-25. Vendor guidance, not efficacy evidence.
41. OpenAI Codex: [AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [Security](https://developers.openai.com/codex/security), and [CLI reference](https://developers.openai.com/codex/cli/reference), n.d.; supplemental recheck 2026-09-25. Final-pass fetch was unavailable after DNS/TinyFish failures, so these remain vendor guidance rather than newly reverified efficacy evidence.
42. Gemini CLI: [GEMINI.md context](https://geminicli.com/docs/cli/gemini-md/), [session management](https://geminicli.com/docs/cli/session-management/), [experimental worktrees](https://geminicli.com/docs/cli/git-worktrees/), [rewind](https://geminicli.com/docs/cli/rewind/) (updated 2026-02-13), [auto memory](https://geminicli.com/docs/cli/auto-memory/), [policy engine](https://geminicli.com/docs/reference/policy-engine/), [system prompt override](https://geminicli.com/docs/cli/system-prompt/), [sandbox](https://geminicli.com/docs/cli/sandbox/), and [trusted folders](https://geminicli.com/docs/cli/trusted-folders/), n.d.; supplemental recheck 2026-09-25. Vendor guidance, not efficacy evidence.

## Bottom line

Build the DSH agent as a **durable, inspectable operating protocol** rather than a clever compaction prompt. Preserve the main system in the control plane; make model context a recyclable projection of authoritative state; seal each session at a safe boundary; require typed, evidence-linked, integrity-verified handoffs before switching; and keep DSH-owned append-only evidence independent of mutable vendor transcript/checkpoint storage. Enforce fresh-child identity/grants, host fail-closed policy/sandbox, and distrust of repository/memory/handoff/MCP text. Let frameworks supply durable execution where appropriate, but keep the handoff, lineage, memory provenance, and policy invariants portable across runtimes. This is the most defensible evidence-consistent architecture direction for long horizons, pending local crash, security, handoff-fidelity, and task-success validation; it is not a head-to-head validated “best” system.
