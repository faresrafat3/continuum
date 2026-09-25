# Research: durable agent frameworks and memory systems for a DSH-style local agent

**Decision date:** 2026-09-25  
**Evidence boundary:** current official documentation, official repositories/releases, and package registries as of 2026-09-25. No framework was benchmarked in DSH in this study.

## Decision summary

### Recommendation

**Keep DSH's own host and permission system as the authority. Add a small, transactional local durability layer—an append-only run/effect journal plus materialized session state—and treat every memory system as a replaceable, derived index.** Do not make an LLM-managed memory database the source of truth for permissions, task state, or tool approvals. This is a **recommendation/inference**, not a vendor-documented guarantee.

For the current local-agent shape, the decision rule is:

1. **Default now: DSH-native SQLite event/effect ledger.** It is the smallest fit while DSH is one user, one workstation, short-to-medium jobs, and a handful of workers. It keeps storage inspectable and avoids operating another control plane.
2. **Pilot LangGraph OSS + SQLite if branchable time travel is a first-class product feature.** Its checkpoints and forked histories are unusually good for agent debugging, but replay deliberately re-executes downstream LLM/API/tool nodes, and its default serializer requires a hardening step. 【C-002】
3. **Choose Restate when durable execution becomes a service boundary:** long sleeps, external events/approvals, several languages, or many concurrent invocations. It has a single local binary and a journal model, but the server is Business Source License 1.1 (source-available, not an OSI open-source license) and self-hosted ingress/admin have different security postures. 【C-004】
4. **Choose Temporal when distributed/platform durability, mature worker routing, and operational scale matter more than local minimalism.** It has the strongest documented event-history/versioning model, but deterministic workflow discipline, a separate server, database, UI, and opt-in authorization make it the heaviest local option. 【C-003】
5. **For memory, start with explicit, human-reviewable records and Git/Markdown project artifacts.** Add a semantic index only after retrieval tests justify it. Of the studied systems:
   - **Letta Code MemFS** is the best studied fit when Git-backed, editable memory and agent-owned skills are desired, but it is a full agent harness rather than a small memory library. Current Letta is materially different from the archived V1 server. 【C-005】
   - **LangMem + a LangGraph Store** is the most composable option for LLM-driven extraction/consolidation, but it remains `0.0.x` and delegates trust, provenance, and curation policy to the application. 【C-007】
   - **Mem0 OSS** is convenient for user-preference extraction and hybrid retrieval. Its current algorithm is ADD-only, so corrected facts remain and ranking—not authoritative replacement—resolves current state. That is risky for project rules and authorization policy. 【C-008】
   - **Graphiti** is appropriate when changing relationships, historical validity, contradiction handling, and fact-to-episode provenance are core. It is much heavier and does not provide the full user/conversation/runtime layer. 【C-009】

### What would change the recommendation

- **Temporal** becomes preferred if jobs routinely outlive a workstation restart, cross machines, or require a supported distributed control plane and production persistence.
- **Restate** becomes preferred over Temporal for a smaller local deployment if a separate single binary, journal-first programming model, and typed signals/awakeables are more valuable than Temporal's larger platform and ecosystem. It is excluded if BSL terms are unacceptable.
- **LangGraph** becomes preferred if DSH's orchestrator becomes a graph and forkable checkpoint histories outweigh dependency and serialization risk.
- **Letta MemFS** becomes preferred only if DSH wants to delegate much of the harness, memory lifecycle, and agent-owned skills to Letta—not merely import a memory API.
- **Graphiti** becomes preferred only if time-varying relationships and provenance are demonstrated requirements, not speculative infrastructure.
- **Mem0/LangMem automatic writes** are enabled only if adversarial tests show acceptable correction accuracy and no write to trusted policy scope without review.

## Scope and method

### Decision question

Which durable-agent execution and memory systems should a DSH-style local coding agent use so that work survives process failure without silently duplicating side effects, leaking secrets, accepting poisoned memory, or making replay change the user's files and external state?

### Assumed DSH-style constraints

This comparison assumes a local, user-owned agent harness that:

- runs on one workstation and can use local files, shell, browser, and model tools;
- must resume after process or machine restart;
- may run background workers/subagents and human approval pauses;
- has non-idempotent effects such as shell commands, file edits, git/network actions, and browser submissions;
- must remain usable with services and databases offline;
- should keep human-readable, correctable state;
- must not trust a retrieved memory string as an authorization decision.

If these assumptions are wrong, the decision changes materially.

### Inclusion criteria

- Current open-source or source-available framework with a durable execution/checkpoint/replay contract.
- Current memory framework with an inspectable representation, persistence path, and update/retrieval model.
- Exact current version or official documentation boundary recorded.
- Primary evidence only: official docs, source repositories, release metadata, package registries, specifications, or papers.

### Exclusion and negative results

- Hosted-only products were not ranked as local implementations. Zep Cloud, LangSmith Agent Server, Temporal Cloud, Restate Cloud/BYOC, and Mem0 Platform appear only where official OSS documentation explains a boundary.
- Vendor benchmark numbers were not used to rank local implementations. Mem0 explicitly says its April 2026 scores are for the managed platform with proprietary optimizations and are not expected to match OSS; Graphiti's latency statements are also first-party claims. 【C-013】
- No independent, reproducible head-to-head benchmark was found that compares these systems on local crash recovery, external side-effect duplication, memory poisoning, and operational cost. The recommendation therefore relies on documented semantics and fit, not a synthetic performance score. 【C-014】

### Evidence labels

- **[CITED]** — directly stated by a primary source.
- **[OBSERVED]** — registry/repository metadata observed at the stated version/date; not a DSH benchmark.
- **[INFERRED]** — a reasoned consequence of cited behavior.
- **[RECOMMENDED]** — proposed design or decision rule.

## Source ledger

All sources were accessed **2026-09-25**. Confidence refers to fitness for the specific claim, not general vendor reliability.

| ID | Primary source and stable locator | Version/date boundary | Kind; confidence | Supports / limitation |
|---|---|---|---|---|
| S-LG-01 | LangChain, [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence.md), sections “Checkpointer vs. store” and “MemorySaver does not persist between restarts” | Live docs, 2026-09-25 | Official docs; high for API contract | Checkpoint vs. store scope; SQLite/Postgres choices. Volatile; not independent. |
| S-LG-02 | LangChain, [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers.md), “Pending writes,” “Durability modes,” “Checkpointer libraries,” “Encryption” | Live docs, 2026-09-25 | Official docs; high | Super-step checkpoints, `exit`/`async`/`sync`, SQLite/Postgres, optional `EncryptedSerializer`. |
| S-LG-03 | LangChain, [Use time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel.md), “Overview,” “Replay,” and “Fork” | Live docs, 2026-09-25 | Official docs; high | Replay re-executes downstream nodes and LLM/API/interrupt calls; fork is additive. |
| S-LG-04 | LangGraph package metadata, [`langgraph-checkpoint` PyPI](https://pypi.org/pypi/langgraph-checkpoint/json), “Checkpoint deserialization security”; [`langgraph-checkpoint-sqlite` PyPI](https://pypi.org/pypi/langgraph-checkpoint-sqlite/json), “Security” | `langgraph-checkpoint` 4.2.0; SQLite checkpointer 3.1.1 | Registry/package README; high for shipped metadata | Strict msgpack recommendation; SQLite local implementation. Not a vulnerability count. |
| S-LG-05 | [LangGraph Python PyPI](https://pypi.org/pypi/langgraph/json) and [LangGraph JavaScript npm](https://registry.npmjs.org/@langchain/langgraph/latest) | Python 1.2.12 (2026-09-21), `@langchain/langgraph` 1.4.18; MIT | Registry; high for release identity | Current language-specific package boundaries; JavaScript requires Node >=18. Rapidly moving project. |
| S-TMP-01 | Temporal, [Workflow Execution overview](https://docs.temporal.io/workflow-execution.md), “Durability,” “Reliability,” and “Replays” | Live docs, 2026-09-25 | Official docs; high | Event-history replay/recovery semantics. “Effectively once” is a workflow-replay statement, not proof that arbitrary external effects occur once. |
| S-TMP-02 | Temporal, [Workflow Definition](https://docs.temporal.io/workflow-definition.md), “Deterministic constraints,” “Code changes,” and “Versioning” | Live docs, 2026-09-25 | Official docs; high | AI/LLM/DB calls belong in Activities; replay failures and code-version constraints. |
| S-TMP-03 | Temporal, [Activities](https://docs.temporal.io/activities.md) | Live docs, 2026-09-25 | Official docs; high | Activities may retry; official recommendation is idempotency. Directly limits exactly-once claims. |
| S-TMP-04 | Temporal, [Python testing](https://docs.temporal.io/develop/python/best-practices/testing-suite.md), “How to Replay a Workflow Execution” | Live docs, 2026-09-25 | Official docs; high | CI replay of representative histories and non-determinism errors. |
| S-TMP-05 | Temporal, [Persistence](https://docs.temporal.io/temporal-service/persistence.md) and [Self-hosted defaults](https://docs.temporal.io/self-hosted-guide/defaults.md) | Live docs, 2026-09-25 | Official docs; high | Append-only history/state; SQLite is dev/test only; history size/count limits. |
| S-TMP-06 | Temporal, [Self-hosted security](https://docs.temporal.io/self-hosted-guide/security.md), “Authorizer Plugin” | Live docs, 2026-09-25 | Official docs; high | Without an Authorizer, the default `noopAuthorizer` allows every reachable API request. |
| S-TMP-07 | Temporal, [Embedded server](https://docs.temporal.io/self-hosted-guide/embedded-server.md), “Caution” and “SQLite limitations” | Live docs, 2026-09-25 | Official docs; high | In-process/SQLite is testing/development only. |
| S-TMP-08 | Temporal Server [v1.32.0 release](https://github.com/temporalio/temporal/releases/tag/v1.32.0), [LICENSE](https://raw.githubusercontent.com/temporalio/temporal/v1.32.0/LICENSE), and [Python SDK PyPI](https://pypi.org/pypi/temporalio/json) | Server 1.32.0 (2026-09-11), Python SDK 1.33.0; MIT | Official release/registry; high | Version and license boundary. SDK/server versions need compatibility checks. |
| S-TMP-09 | Temporal Python SDK package documentation, [PyPI README](https://pypi.org/project/temporalio/#workflow-sandbox), sections “External Storage,” “Workflow Sandbox,” “Sandbox is not Secure,” and “Workflow Replay” | Current package README, 2026-09-25 | Official package docs; high for shipped README | External payload storage is experimental; workflow sandbox is a determinism boundary, not hostile-code isolation; replay API. README warns it may track current branch rather than the exact release. |
| S-TMP-10 | Temporal TypeScript SDK registries for [`@temporalio/client`](https://registry.npmjs.org/@temporalio/client/latest) and [`@temporalio/worker`](https://registry.npmjs.org/@temporalio/worker/latest) | 1.24.0; MIT; Node >=20.3 | Official registry; high | DSH-relevant TypeScript client/worker boundary. Security and replay behavior still require the pinned-package test. |
| S-RS-01 | Restate, [Key Concepts](https://docs.restate.dev/foundations/key-concepts.md), “Durable Execution” and “Consistent State” | Live docs, 2026-09-25 | Official docs; high for documented model | Journal replay and single-writer K/V state. Product simplicity/exactly-once wording remains a first-party claim. |
| S-RS-02 | Restate, [Request lifecycle](https://docs.restate.dev/guides/request-lifecycle.md) and [Durable steps](https://docs.restate.dev/develop/python/durable-steps.md) | Live docs, 2026-09-25 | Official docs; high | Journal replay and `ctx.run` semantics. Does not eliminate external-side-effect ambiguity. |
| S-RS-03 | Restate, [Databases and Restate](https://docs.restate.dev/guides/databases.md), database examples | Live docs, 2026-09-25 | Official docs; high | Explicitly describes a small re-execution window after a DB write succeeds but Restate has not observed completion; shows idempotency-token/2PC patterns. |
| S-RS-04 | Restate, [Installation](https://docs.restate.dev/installation.md) and [Hosting overview](https://docs.restate.dev/hosting/overview.md) | Live docs, 2026-09-25 | Official docs; high | Single self-contained binary, local data directory, self-hosting. Marketing comparison is not independent evidence. |
| S-RS-05 | Restate, [Server security](https://docs.restate.dev/server/security.md) | Live docs, 2026-09-25 | Official docs; high | OSS server lacks application auth on management interfaces; ingress/admin/fabric have distinct exposure; headers are journaled. |
| S-RS-06 | Restate, [Service security](https://docs.restate.dev/services/security.md), “Locking down service access” and “Client-side journal encryption” | Live docs, 2026-09-25 | Official docs; high | Request identity; experimental TypeScript value encryption; metadata/headers remain unencrypted by that codec. |
| S-RS-07 | Restate Server [v1.7.12 release](https://github.com/restatedev/restate/releases/tag/v1.7.12), [LICENSE](https://raw.githubusercontent.com/restatedev/restate/v1.7.12/LICENSE), [Python SDK PyPI](https://pypi.org/pypi/restate-sdk/json), and [TypeScript SDK npm](https://registry.npmjs.org/@restatedev/restate-sdk/latest) | Server 1.7.12 (2026-09-22), Python SDK 1.0.5, TypeScript SDK 1.17.2 | Official release/license/registry; high | Server uses BSL 1.1 with four-year change date and a public-platform restriction; SDKs are separately licensed (TypeScript is MIT). |
| S-RS-08 | Restate, [Memory Configuration](https://docs.restate.dev/server/memory.md), “RocksDB Memory” and “RocksDB Memory Architecture” | Live docs, 2026-09-25 | Official docs; high | RocksDB stores durable state, journal entries, log data, and local loglet databases; default memory pools are material to local sizing. |
| S-LET-01 | Letta, [MemFS](https://docs.letta.com/concepts/memfs.md), “Memory structure,” “Versioning,” and “Managing memory” | Live docs, 2026-09-25 | Official docs; high for current product | Git-backed Markdown memory; `system/` injection; on-demand files; local/cloud repositories. |
| S-LET-02 | Letta, [current source notice](https://raw.githubusercontent.com/letta-ai/letta/main/README.md) and [Letta Code README](https://raw.githubusercontent.com/letta-ai/letta-code/main/README.md) | Current `main`, 2026-09-25 | Official repo; high | Active code moved to `letta-code`; V1 API server is on `archive`; cloud is default but local backend exists. |
| S-LET-03 | Letta, [Permissions](https://docs.letta.com/configuration/permissions.md), “Permission modes” and “Cross-agent memory guard” | Live docs, 2026-09-25 | Official docs; high | Interactive CLI starts unrestricted; standard/strict modes, persistent allow/deny rules, and cross-agent memory guard. |
| S-LET-04 | Letta, [Memory & dreaming](https://docs.letta.com/configuration/memory/index.md) | Live docs, 2026-09-25 | Official docs; high | Agent/dreaming updates, commits, reorganization, and optional agent review that does not itself request approval. |
| S-LET-05 | [Letta PyPI](https://pypi.org/pypi/letta/json), [npm registry](https://registry.npmjs.org/@letta-ai/letta-code/latest), and [pinned LICENSE](https://raw.githubusercontent.com/letta-ai/letta-code/5631c531da7ee8458decaf49e26a834119e6e549/LICENSE) | 0.33.1, 2026-09-24; Apache-2.0 plus brand-assets exclusion | Registry/license; high | Current packaged CLI/version. Code is Apache-2.0; names, logos, wordmarks, images, and ASCII art are excluded. |
| S-LET-06 | Letta Code release metadata for [v0.32.18](https://api.github.com/repos/letta-ai/letta-code/releases/tags/v0.32.18) and [v0.33.0](https://api.github.com/repos/letta-ai/letta-code/releases/tags/v0.33.0); retired V1 [0.16.8](https://api.github.com/repos/letta-ai/letta/releases/tags/0.16.8) | 2026-09-23, 2026-09-23, and 2026-05-14 | Official release metadata; high | Serialized memory-checkout writers/background upkeep, post-turn Git conflict repair, ambient credential redaction, and the final legacy V1 release. |
| S-LET-07 | Letta Agent SDK, [Sessions, turns, and durability](https://docs.letta.com/agent-sdk/sessions.md), “Guarantees and non-guarantees” | Live docs, 2026-09-25 | Official docs; high | Missed events are not replayed; reconcile with message listing/bootstrap; do not blindly retry an ambiguous `send()`. |
| S-LM-01 | LangMem, [Core Concepts](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/), “Types of Memory,” “Writing memories,” and “Storage System” | Live docs, 2026-09-25 | Official docs; high | LLM-driven extraction/consolidation; semantic/episodic/procedural forms; store-agnostic core and LangGraph stateful layer. |
| S-LM-02 | LangMem, [README](https://raw.githubusercontent.com/langchain-ai/langmem/main/README.md) and [PyPI](https://pypi.org/pypi/langmem/json) | 0.0.30, uploaded 2025-10-27; MIT | Official repo/registry; high | Hot-path tools/background manager and storage boundary. Pre-1.0 and comparatively stale release. |
| S-MEM-01 | Mem0, [OSS v2-to-v3 migration](https://docs.mem0.ai/migration/oss-v2-to-v3.md), “Overview,” “Add Calls,” and “How the New Algorithm Works” | Live docs, 2026-09-25 | Official docs; high | Current ADD-only extraction, old facts retained, hybrid/entity retrieval, graph memory removed from OSS. Breaking and volatile. |
| S-MEM-02 | Mem0, [OSS overview](https://docs.mem0.ai/open-source/overview.md), [setup](https://docs.mem0.ai/open-source/setup.md), and [configuration](https://docs.mem0.ai/open-source/configuration.md) | Live docs, 2026-09-25 | Official docs; high | Local Qdrant/history defaults, self-host Postgres/pgvector, auth/audit server, provider configurability. Operational defaults may change. |
| S-MEM-03 | Mem0, [repository README](https://raw.githubusercontent.com/mem0ai/mem0/main/README.md), “New Memory Algorithm” and benchmark table | `main`, 2026-09-25 | Vendor benchmark/marketing; medium for managed claims, **low for OSS transfer** | Explicitly says scores are managed-platform results with proprietary optimizations and not identical in OSS. |
| S-GR-01 | Zep/Graphiti, [Graphiti README](https://raw.githubusercontent.com/getzep/graphiti/main/README.md), “What is a Context Graph,” “Zep vs. Graphiti,” installation, local models, and telemetry | `main`, 2026-09-25 | Official repo; high for OSS architecture, medium for performance claims | Temporal facts/validity, episode provenance, BYO graph DB, no user/conversation management, local model path, opt-out telemetry. |
| S-GR-02 | [Graphiti Core PyPI](https://pypi.org/pypi/graphiti-core/json) and [v0.30.2 release](https://api.github.com/repos/getzep/graphiti/releases/tags/v0.30.2) | 0.30.2, uploaded/released 2026-09-08; Apache-2.0 | Registry/release; high | Current core release/license. Fast-moving extraction pipeline. |
| S-GR-03 | Graphiti security release [mcp-v1.0.2](https://api.github.com/repos/getzep/graphiti/releases/tags/mcp-v1.0.2) | 2026-03-11 | Official release/security notice; high | MCP 1.0.1 and earlier had a Cypher-injection vulnerability through `graphiti-core` 0.28.1; MCP 1.0.2 requires core >=0.28.2. |

## Findings by claim

### C-001 — Durable execution and long-term memory are different layers

**[CITED]** LangGraph separates thread checkpoints from cross-thread application-defined stores; Temporal persists workflow commands/events while Activities perform external work; Restate journals context operations and also offers a K/V state layer. 【S-LG-01】【S-TMP-01】【S-RS-01】

**[INFERRED]** A durable graph runner can survive process failure without making an automatically extracted “fact” correct or authoritative. DSH should keep run state, policy, and memory as separate stores with explicit links. This separation is the basis of the recommendation.

### C-002 — LangGraph is the closest lightweight checkpointing candidate, but replay is re-execution

**[CITED]** A checkpointer writes a state snapshot at each graph super-step and per-node pending writes; successful parallel nodes are not rerun after another node fails. `sync` durability writes every checkpoint before the next step, at a performance cost. SQLite is supported as a local checkpointer. 【S-LG-02】

**[CITED]** Time travel from a checkpoint re-executes nodes after it, including LLM calls, API requests, and interrupts. A fork creates another checkpoint/history branch; it does not roll back the original. 【S-LG-03】

**[CITED]** Python checkpoint state is serializable and encryption is optional through `EncryptedSerializer`; separate Python package guidance says the default serializer allows arbitrary Python types and recommends `LANGGRAPH_STRICT_MSGPACK=true` or an explicit module allow-list to prevent code execution if a checkpoint database is compromised. This does not establish the JavaScript package's serde defaults. 【S-LG-02】【S-LG-04】

**[INFERRED]** LangGraph is suitable for branching/debugging, not as proof of exactly-once tools. DSH tool nodes need an effect ID and an idempotent boundary. Checkpoint encryption and strict deserialization should be acceptance criteria, not optional hardening.

### C-003 — Temporal has the most explicit event-history contract and the highest determinism cost

**[CITED]** Temporal recreates workflow state by replaying code and matching emitted commands to durable Event History. A workflow function can execute many times even though the workflow is described as effectively once. 【S-TMP-01】

**[CITED]** Workflow code must be deterministic. LLM/AI calls, database queries, and external interactions belong in Activities. Activity attempts are automatically retried, and Temporal explicitly recommends idempotent Activities so retries do not duplicate side effects. Code changes that reorder commands can cause non-determinism errors; the docs prescribe representative-history replay in CI and worker/patching versioning. 【S-TMP-02】【S-TMP-03】【S-TMP-04】

**[CITED]** Persistence includes an append-only event-history table. SQLite is supported, but the official embedded-server guide says SQLite/in-memory deployments are for testing/development only. Default history limits can warn or terminate very long histories. 【S-TMP-05】【S-TMP-07】

**[CITED]** Self-hosted Temporal has opt-in TLS, claim mapping, and authorization. Without a configured Authorizer, the default `noopAuthorizer` permits every API request reachable on the server. 【S-TMP-06】

**[CITED]** The Python SDK's workflow sandbox is explicitly documented as **not a security boundary**; it exists to constrain imports/determinism. External payload storage is also marked experimental. Hostile repository or tool code still requires an OS/process sandbox, and durable payloads/history require normal secret protection. 【S-TMP-09】

**[INFERRED]** Temporal is the strongest choice when cross-machine, long-lived, multi-service execution is worth the service/database/authorization complexity. For one local workstation it is over-sized unless DSH expects those semantics soon.

### C-004 — Restate has a compact journal model, but external exactly-once effects and licensing remain

**[CITED]** Restate records Context operations in an invocation journal, replays the handler on retry, and returns prior results instead of re-running journaled steps. Its request lifecycle documents replay and result reuse. 【S-RS-01】【S-RS-02】

**[CITED]** The official database guide is more precise than the headline guarantee: an external database update can succeed and then be re-executed if Restate did not observe completion. It demonstrates idempotency tokens, conditional versions, and optional two-phase commit patterns. 【S-RS-03】

**[CITED]** The local server is a single self-contained binary with persistent local data. Self-hosted ingress should sit behind authentication, the admin port must be restricted, and request headers are persisted in the journal. TypeScript client-side value encryption is experimental and does not encrypt all metadata, headers, or failure messages. 【S-RS-04】【S-RS-05】【S-RS-06】

**[OBSERVED]** Server 1.7.12 is licensed under BSL 1.1. The license permits internal/local production use but restricts offering a public Restate platform service and changes to Apache-2.0 four years after each release. 【S-RS-07】

**[INFERRED]** Restate is a credible scale-up path for a local durable service, especially if Restate-managed calls and signals matter more than a lightweight library. It is not a drop-in “memory” layer, and DSH should not use a journal claim to bypass tool-level idempotency.

### C-005 — Current Letta memory is MemFS, not the legacy V1 core/recall/archival model

**[CITED]** Current Letta Code stores long-term memory in an agent-owned Git repository projected as a real checkout. Markdown files under `system/` are injected each turn; other files are discovered/read with ordinary tools. Every edit is versioned by Git. Local-only agents commit to a repository on the current machine and require user-managed backup. 【S-LET-01】

**[CITED]** The public `letta` repository says active source moved to `letta-ai/letta-code` and the old V1 API server is retained on the `archive` branch. Current packaged code is Letta Code 0.33.1; the final archived V1 release is 0.16.8. The code license is Apache-2.0 with an explicit brand-assets exclusion. 【S-LET-02】【S-LET-05】【S-LET-06】

**[INFERRED]** MemFS is attractive for DSH project conventions and skills because it is inspectable, diffable, and versioned. It also makes memory edits ordinary file writes, so DSH's file permissions, secret filtering, and approval model must cover `$MEMORY_DIR` explicitly.

### C-006 — Letta's local safety depends on selecting the right mode

**[CITED]** The interactive CLI starts in `unrestricted` mode. `standard` asks before approval-requiring tools, `acceptEdits` allows edits, and `strict` asks before every tool call. A cross-agent memory guard blocks access to other agents' memory directories even in unrestricted mode unless the parent guard is explicitly disabled. 【S-LET-03】

**[CITED]** Background dreaming can consolidate memory without interrupting work; “Agent reviews before applying” is an extra model review and does not itself ask the user for approval. 【S-LET-04】

**[CITED]** Letta Code 0.33.0 includes a fix to always redact ambient runtime credentials from tool output. This is a positive control, not evidence that arbitrary tool output or memory content is secret-free. 【S-LET-06】

**[INFERRED]** Installing Letta without a DSH-specific `standard`/`strict` policy and memory-path guard would widen the local threat surface. The durable memory and durable tools must be governed by the same approval policy.

### C-007 — LangMem is a curation library, not a trusted memory substrate

**[CITED]** LangMem's core operation prompts an LLM to expand or consolidate current memory state. It distinguishes semantic collections, typed profiles, episodic memories, and procedural instructions, with hot-path agent tools or delayed/background processing. Its stateful layer writes to a LangGraph `BaseStore`; its core functions are storage-agnostic. 【S-LM-01】

**[OBSERVED]** The current package is 0.0.30 (last upload 2025-10-27), so API and compatibility risk is higher than for the 1.x execution packages. 【S-LM-02】

**[INFERRED]** LangMem is useful for experiments in extraction, consolidation, and prompt refinement. DSH must add source-event IDs, trust levels, content hashes, review status, correction/tombstone semantics, and transactional coupling to the run before using it for project policy.

### C-008 — Mem0 optimizes retrieval, but current OSS deliberately retains conflicting facts

**[CITED]** Current Mem0 OSS extraction is single-pass and ADD-only: new facts are stored beside old facts; ranking is expected to surface current information. `add()` no longer emits UPDATE/DELETE, and the old graph-store integrations were removed from OSS. Hybrid retrieval combines semantic candidates with BM25/entity boosts. 【S-MEM-01】

**[CITED]** The local library defaults to OpenAI for LLM and embeddings, Qdrant under `/tmp/qdrant`, and history in `~/.mem0/history.db`; the self-hosted server defaults to Postgres/pgvector, has authentication enabled by default, and offers API keys plus request audit logs. Configurable providers include Ollama and local-compatible models. 【S-MEM-02】

**[CITED]** Mem0's April 2026 benchmark says the reported scores come from the managed platform, include proprietary optimizations, and should not be expected to match OSS. 【S-MEM-03】

**[INFERRED]** ADD-only semantics are reasonable for immutable observations with temporal ranking but dangerous for mutable rules such as “tests must use pnpm.” DSH should never let Mem0 memory authorize tools or overwrite a canonical policy record without an explicit supersession workflow.

### C-009 — Graphiti provides temporal fact lineage, not durable agent execution

**[CITED]** Graphiti represents entities, facts/relationships with validity windows, and episodes as raw provenance. New facts can invalidate old facts while preserving history; incremental ingestion and hybrid semantic/keyword/graph retrieval avoid requiring full graph recomputation. 【S-GR-01】

**[CITED]** Graphiti requires a graph database (or supported local backend), defaults LLM/embedding work to OpenAI, and documents a fully local Ollama-compatible path. Its OSS comparison explicitly says user/conversation management and turnkey governance are the developer's responsibility. Telemetry is opt-out and documented as excluding graph content. 【S-GR-01】

**[INFERRED]** Graphiti is valuable when memory questions are relationship/time/provenance questions, not when the only need is “retrieve the latest project convention.” Its LLM extraction, graph database, and derived-summary invalidation add cost and another security boundary. It has no run-level deterministic replay.

### C-010 — None of the studied systems provides magical exactly-once external side effects

**[CITED]** Temporal retries Activities and asks for idempotency. 【S-TMP-03】 LangGraph time travel re-fires API calls. 【S-LG-03】 Restate's own database guide documents the success-without-observation retry window. 【S-RS-03】

**[INFERRED]** DSH must implement an **effect protocol** even if it adopts one of these runtimes:

- allocate a stable `effect_id` before execution;
- bind it to run, tool, normalized arguments, workspace, policy version, and attempt;
- pass it to an idempotent sink or record it transactionally with the sink;
- persist `prepared`, `executing`, `succeeded`, `failed`, and `unknown` states;
- on `unknown`, reconcile with the sink instead of blindly retrying;
- make approval single-use and invalid if arguments, workspace, plugin version, or policy changes.

### C-011 — Checkpoint replay does not automatically roll memory back

**[CITED]** LangGraph checkpoint time travel branches execution state; Temporal replay reconstructs workflow state from Event History; Restate replays journaled context operations. 【S-LG-03】【S-TMP-01】【S-RS-02】 None of those source contracts says an independently written LangGraph Store, Mem0 record, MemFS commit, or Graphiti ingestion is part of the same rollback transaction.

**[INFERRED]** Replaying an agent can re-run a memory-write tool and mutate derived memory twice or in a different order. DSH should either:

1. make memory writes content-addressed and idempotent;
2. store `source_run_id`/`source_event_id` and deduplicate on replay;
3. write untrusted candidate memory first and promote it only after the run commits; or
4. keep memory writes outside replay and branch them explicitly.

### C-012 — Persisted prompts, headers, tool output, and memory are secret-bearing stores

**[CITED]** Restate states that ingress HTTP headers are journaled and recommends stripping infrastructure auth headers before Restate. 【S-RS-05】 LangGraph checkpoints may contain full graph state and support an encrypted serializer. 【S-LG-02】 Temporal supports payload codecs for data encryption, while authorization is separately opt-in. 【S-TMP-06】 Mem0's self-host server has auth/audit but library mode has no API-key layer. 【S-MEM-02】

**[INFERRED]** Security review must cover the persistence layer, not merely the model prompt. Minimum controls are encrypted transport, encrypted or redacted values at rest, secret-pattern redaction before checkpoints, OS user separation, restrictive file/database permissions, bounded retention, export/delete, and redacted diagnostics.

### C-013 — Vendor evidence supports mechanisms, not universal performance or superiority

**[CITED]** Mem0's own README limits transfer of its managed benchmark to OSS. 【S-MEM-03】 Restate's and Graphiti's simplicity/latency language is first-party product material; their detailed lifecycle, database, and security caveats are more decision-relevant than the headline claims. 【S-RS-02】【S-RS-03】【S-GR-01】

**[RECOMMENDED]** Do not put vendor benchmark numbers in an ADR's selection rationale unless the exact OSS version, configuration, model, task set, baseline, raw outputs, and independent reproduction are available.

### C-014 — No adequate independent head-to-head evidence was found

**[OBSERVED]** The primary sources document mechanisms and self-reported results, but this study found no independent benchmark that jointly measures local crash recovery, replayed side effects, secret retention, poisoned-memory resistance, and operator effort for the current versions.

**[INFERRED]** The decision has lower confidence on performance/operational cost and higher confidence on semantic boundaries. The final experiment is therefore mandatory before a framework becomes the DSH default.

### C-015 — Current Letta has repair/concurrency machinery, but it is not a causal run log

**[CITED]** Letta Code 0.32.18 added serialized writers for a memory checkout, silent delegated memory upkeep, and MemFS-v2 initialization; 0.33.0 added post-turn Git conflict repair and background upkeep. Those are implemented repairs to real projection/worktree conflict modes, not merely marketing claims. 【S-LET-06】

**[CITED]** The current Agent SDK says it does **not** replay events missed while disconnected; callers must reconcile with message history/bootstrap state, and an ambiguous `send()` must not be blindly retried because the runtime may already have it. 【S-LET-07】

**[INFERRED]** Git commits provide excellent auditability for memory edits, but MemFS commit history is not a causal record of the external effects that motivated an edit. DSH still needs its own run/effect IDs and promotion boundary.

### C-016 — Graphiti's component version pair is a security boundary

**[CITED]** Graphiti's MCP 1.0.2 security release states that MCP 1.0.1 and earlier had a Cypher-injection vulnerability through `graphiti-core` 0.28.1, and requires `graphiti-core >=0.28.2`. 【S-GR-03】

**[RECOMMENDED]** Pin and test the core/MCP pair, reject known-vulnerable combinations, and treat a current core package alone as insufficient evidence that the installed MCP/server path is safe.

## Framework and memory matrices

### Durable execution frameworks

| Criterion | DSH-native ledger (recommended baseline) | LangGraph OSS (JS 1.4.18 / Python 1.2.12) | Temporal Server 1.32.0 (TS 1.24.0 / Python 1.33.0) | Restate Server 1.7.12 (TS 1.17.2 / Python 1.0.5) |
|---|---|---|---|---|
| Primary abstraction | Append-only events + session/effect tables | Graph super-steps and state channels | Deterministic Workflow + Event History + Activities | Handler invocation journal + K/V objects/workflows |
| Local persistence | SQLite/file store controlled by DSH | Pluggable; SQLite or Postgres 【S-LG-02】 | Separate server; SQLite explicitly dev/test only 【S-TMP-05】【S-TMP-07】 | Single binary; RocksDB backs state, journals, logs, and local loglets 【S-RS-04】【S-RS-08】 |
| Crash resume | Must be implemented against a declared commit/effect protocol | Restores checkpoint; failed nodes/pending writes modeled 【S-LG-02】 | Replays workflow code against Event History 【S-TMP-01】 | Replays journal; prior results supplied to handler 【S-RS-01】【S-RS-02】 |
| Time travel/fork | Custom; natural if event log is immutable | First-class replay and additive fork; downstream effects rerun 【S-LG-03】 | Offline history replay; execution reset/versioning semantics differ from branch UX 【S-TMP-04】 | Inspectable journal and invocation restart APIs; not the same as source-level branch UX 【S-RS-02】 |
| Human pause/resume | Native DSH control | `interrupt` + checkpointer | Signals/Updates/Activities | Signals, awakeables, workflow promises 【S-RS-02】 |
| Long waits/many workers | Custom scheduler | Possible, but graph/runtime is the concern | Strong documented fit | Strong documented fit; smaller service model |
| External side effects | Custom effect protocol | Idempotent tool boundary required; replay fires calls 【S-LG-03】 | Activities may retry; idempotency required 【S-TMP-03】 | Restate-managed calls dedupe; external DB effect window remains 【S-RS-03】 |
| Memory | Keep separate/derived | Checkpoint store separate; LangMem optional 【S-LG-01】 | Payload/history separate from app DB | K/V state can hold context but is execution state, not curated memory |
| Security default | DSH must implement | Python: optional encryption and strict-msgpack guidance; JS serde/encryption must be verified separately 【S-LG-02】【S-LG-04】【S-LG-05】 | Default `noopAuthorizer` allows all reachable APIs; configure auth/TLS/codecs 【S-TMP-06】 | OSS server management auth is external; separate ingress/admin/fabric; headers journaled 【S-RS-05】 |
| Operational cost for one local agent | Lowest if kept small | Low-to-medium library integration | Highest: server, DB, UI, versioning, auth, upgrades | Medium: separate binary/service, SDK discipline, ports; BSL review 【S-RS-04】【S-RS-07】 |
| License | DSH-owned | MIT 【S-LG-05】 | MIT server/SDK boundary 【S-TMP-08】 | BSL 1.1 server; SDK license should be checked separately 【S-RS-07】 |
| Evidence confidence | High on design logic; unmeasured implementation | High on documented semantics | High on documented semantics | High on lifecycle/security; lower on external-effect and product claims |
| DSH fit | **Default** | **Pilot if graph/time travel is needed** | **Scale/distributed path** | **Local durable-service path** |

### Memory systems

| Criterion | Explicit Git/SQLite records (recommended baseline) | Letta Code 0.33.1 MemFS | LangMem 0.0.30 + Store | Mem0 OSS 2.2.0 | Graphiti 0.30.2 |
|---|---|---|---|---|---|
| Representation | Canonical typed records plus Git/Markdown artifacts | Agent-owned Git repo; Markdown + YAML frontmatter; file tree | Semantic items/profiles, episodes, instructions, or prompt text in a `BaseStore` | Extracted facts in vector/history stores; entity matching | Entities, temporal facts/edges, episodes, optional ontology |
| Who writes | DSH policy + reviewed agent candidates | Agent/dreaming using ordinary file tools; commits to Git | Agent tool in hot path or LLM manager in background | LLM extraction from conversation | LLM structured extraction/deduplication from episodes |
| Update/curation | Explicit supersede/tombstone/review workflow | Git diff, commit, backup, reorg; dreaming consolidation | Prompted insert/update/delete/consolidate transforms | Current OSS ADD-only; new facts coexist with old facts 【S-MEM-01】 | New facts invalidate edges while preserving history/provenance 【S-GR-01】 |
| Retrieval | Exact IDs, recency, FTS/vector added later | `system/` always injected; other files by search/read tools | Direct, semantic, metadata search through store 【S-LM-01】 | Semantic + optional BM25/entity boosts 【S-MEM-01】 | Semantic + keyword + graph traversal/time-aware queries |
| Provenance/versioning | First-class fields and event links | Git commit history plus conflict repair; not a causal effect log 【S-LET-06】 | Application-defined; not automatic in core docs | Metadata/history exist, but no run-level replay contract | Episode lineage and fact validity windows are strongest here |
| Local operation | Best; no extra service | Local Git checkout; user backs up local agents 【S-LET-01】 | Storage-agnostic; depends on chosen store | Local Qdrant/history, but defaults call hosted OpenAI; Ollama configurable 【S-MEM-02】 | Local graph DB plus local or hosted models; much heavier 【S-GR-01】 |
| Security default | DSH-controlled | Interactive CLI starts unrestricted; memory guard exists; SDK explicitly does not replay missed events 【S-LET-03】【S-LET-07】 | No agent auth; app owns store/namespace/tool policy | Library has no API auth; self-host server auth on by default 【S-MEM-02】 | No user/conversation management; DB/model endpoints are the boundary; MCP <=1.0.1 requires a core security floor 【S-GR-03】 |
| Poisoning exposure | Low if trusted/untrusted scopes and review enforced | High: `system/` persists and is injected every turn | High if the agent can write trusted policy items | High if corrected/hostile facts accumulate and rank well | High if raw episodes or extracted edges are accepted as trusted facts |
| Deletion/retention | Explicit and auditable | Git history retains deleted content unless history rewritten/purged | Store-specific | ADD-only current data requires supersession/tombstone design; entity cascade exists in server | “Invalidate, do not delete” preserves old facts and episodes by design |
| Replay relationship | Explicitly couple candidates to source event | Git commit is not run rollback | Store writes are not automatically checkpointed | Memory writes are not automatically run rollback | Temporal facts are not run replay |
| Best DSH use | Canonical preferences, task status, project rules, provenance | Editable agent identity/skills/project memory with Git review | Experimental extraction/curation adapter | User-preference/observation retrieval where stale ranking is acceptable | Relationship/time/provenance-heavy knowledge |
| Recommendation | **Default source of truth** | **Good opt-in harness/memory model** | **Pilot behind adapter** | **Derived preference index only** | **Specialized temporal graph only** |

## Security and replay trade-offs

### Threat model

1. **Crash window:** a tool succeeds, but DSH dies before recording success.
2. **Duplicate replay:** a checkpoint fork, Activity retry, or journal replay invokes the tool again.
3. **Authorization drift:** a historical approval is replayed after tool code, arguments, workspace, or policy changed.
4. **Secret persistence:** prompts, environment dumps, HTTP headers, tool output, traces, checkpoints, and memory retain credentials.
5. **Memory poisoning:** untrusted web/file/tool content becomes a durable instruction or project fact.
6. **Tenant/scope escape:** user, agent, project, or shared-memory filters are treated as authorization when they are only query selectors.
7. **Stale memory:** old facts continue to influence behavior after correction or deletion.
8. **Retention failure:** deleting a chat does not delete derived vectors, graph edges, backups, Git objects, traces, or model-provider logs.

### Required controls independent of framework

- **Authorization at the effect boundary:** DSH checks current policy immediately before executing; a checkpoint never grants permission.
- **Approval binding:** approval record includes normalized tool arguments hash, path/workspace, plugin version, policy version, approver, expiry, and one-time effect ID.
- **Idempotency/uncertainty:** `unknown` is a first-class outcome; reconcile before retrying non-idempotent effects.
- **Trust-scoped memory:** candidate observations cannot enter `system/`, policy, permissions, or tool definitions. Promote only through an explicit review rule.
- **Provenance:** every derived item records source event/run/tool, creation time, content hash, writer identity, trust, and supersession/tombstone links.
- **Secret minimization:** structured environment reads are allowlisted; checkpoint serializers redact or encrypt; journals do not receive proxy auth headers; raw tool output is size-bounded.
- **Least privilege:** local DB/Git directories are user-only; servers bind to loopback; Temporal Authorizer, Restate ingress/admin controls, and Mem0 server auth are enabled if those servers are used.
- **Deletability:** canonical delete emits a tombstone, rebuilds derived indexes, prunes histories where possible, and documents what cannot be erased (Git objects/backups/provider retention).
- **Branch isolation:** a replay/fork writes candidate state under a branch ID; it does not silently update global `system/` memory.

## Contradictions and unknowns

1. **“Exactly once” is scope-dependent.** Restate's managed communication and K/V state are strongly journaled, but its own DB examples expose an external-effect retry window. Temporal protects workflow sequencing but Activities can duplicate. LangGraph preserves pending writes but time travel re-fires calls. Treat exactly-once as a property of a bounded protocol, not a framework adjective. 【C-010】
2. **Durability mode is not effect durability.** LangGraph `sync` controls checkpoint persistence before the next step; it does not atomically commit an external API and checkpoint. 【C-002】
3. **Long-term memory is not run state.** Even a git-backed memory repository is not an execution log, and a vector store is not a permission system. 【C-001】【C-011】
4. **Letta naming/version drift is material.** Older examples of core/recall/archival memory describe archived V1 (final release 0.16.8), while current Letta Code 0.33.1 uses MemFS. Any comparison that does not name the branch/package is stale. 【C-005】【S-LET-06】
5. **Letta MemFS is repairable, not replay-complete.** Current release notes add serialized writers and Git conflict repair, while the SDK explicitly does not replay events missed during disconnection. Commit history helps audit memory; it does not recover an ambiguous send or external effect. 【C-015】
6. **Mem0's benchmark is not OSS evidence.** The vendor itself limits transfer of its 2026 numbers. 【C-013】
7. **Graphiti's provenance is derived provenance.** Episode lineage is valuable, but extracted entities/edges and evolving summaries still depend on LLM extraction; raw episode review may be necessary.
8. **Graphiti's security floor is a version-pair rule.** MCP 1.0.1 and earlier were affected by a Cypher-injection issue through core 0.28.1; the patched MCP requires core >=0.28.2. A current core package does not by itself certify the installed server path. 【C-016】
9. **Shared namespaces/filters are not proven authorization boundaries.** Mem0 filters, LangMem namespaces, and Graphiti group IDs organize data but require a separate auth design. This is an inference, not a claim that those products have an isolation vulnerability.
10. **Local encryption varies.** LangGraph and Temporal provide value-encryption mechanisms; Restate's current value codec is TypeScript-only and excludes some metadata. Mem0 and Graphiti inherit security from their database/server/model providers. Letta Git memory has no source found here that establishes application-level encryption-at-rest.
11. **Operational cost is unmeasured.** No primary source or local experiment establishes DSH-specific install size, cold-start time, migration time, disk growth, or upgrade burden.
12. **Language/package parity still needs a pinned spike.** The detailed durability prose above is primarily from Python packages/docs; DSH is Node-based. Current registries identify LangGraph JS 1.4.18, Temporal TS 1.24.0, and Restate TS 1.17.2, but exact serde, versioning, and security behavior must be rechecked in those pinned JavaScript packages before adoption. 【S-LG-05】【S-TMP-10】【S-RS-07】
13. **Rapid release cadence changes conclusions.** LangMem is pre-1.0; Letta, Mem0, and Graphiti changed materially in 2026; Restate changed license posture and SDK compatibility. Pin versions and re-run the experiment on upgrade.

## Recommendation and trade-offs

### Recommended DSH architecture

```text
Human / web client
       |
DSH host policy and approval boundary
       |
append-only run events  ----> materialized session/task state
       |                              (SQLite)
       |
effect ledger (effect_id, args hash, policy hash, status)
       |
idempotent tool adapters / sandbox / local model router
       |
candidate memory records (provenance, trust, review status)
       |
optional derived indexes: FTS/vector (LangMem/Mem0) or temporal graph (Graphiti)
       |
optional opt-in Git/Markdown agent memory (Letta-style MemFS)
```

### Non-negotiable semantics

- The run event log and effect ledger are canonical.
- Checkpoints may be caches/materialized views; they must be rebuildable from canonical records or explicitly versioned.
- Memory facts cannot authorize tools, expand filesystem scope, or bypass approval.
- An LLM call is an effect: record request metadata and result reference; do not blindly replay a billable call.
- A fork/replay uses a branch namespace and does not mutate trusted global memory until promoted.
- Deletes propagate to active derived indexes; immutable audit records use tombstones/redaction according to retention policy.

### Why not one framework end-to-end?

- **Temporal/Restate solve durable orchestration, not trustworthy memory curation.** Coupling both to one memory vendor would make a reversible local adapter expensive.
- **LangGraph is attractive but duplicates DSH orchestration if DSH already owns a graph/runtime.** Adopt it for a bounded workflow or experiment, not by reflex.
- **Letta Code is a harness choice, not a drop-in library choice.** Its permissions, memory, subagents, UI, and self-modification model must align with DSH before adoption.
- **Mem0/LangMem are LLM transformation layers.** They can propose changes but should not be the final authority.
- **Graphiti is a specialized data model.** It earns its cost only if temporal relationship queries and provenance are real requirements.

### Reversible adoption sequence

1. Implement and test the DSH-native event/effect contract.
2. Put memory behind a narrow interface: `propose`, `search`, `promote`, `supersede`, `delete`, `export`.
3. Add a read-only FTS/vector adapter and measure whether it beats exact/tag search.
4. Pilot LangGraph on one interruptible workflow; compare with Temporal/Restate only if the workload crosses the local/distributed boundary.
5. Treat any memory vendor as replaceable until retention, correction, poisoning, and export tests pass.

## Freshness and review triggers

Review this report when any of the following occurs:

- LangGraph Python/JS changes checkpoint saver/serde, strict-msgpack or JavaScript deserialization guidance, durability modes, or time-travel semantics.
- Temporal changes Event History, Worker Versioning, default authorization, persistence guidance, TypeScript workflow sandbox, or local CLI behavior.
- Restate changes BSL terms, journal format, SDK compatibility, encryption support, RocksDB schema, or default local ports/security.
- Letta changes MemFS layout/conflict repair, Agent SDK missed-event or ambiguous-send guarantees, default backend/permission mode, or the archived V1 boundary.
- LangMem reaches 1.0 or changes manager/store contracts.
- Mem0 changes ADD-only behavior, restores graph support to OSS, or changes default providers/auth.
- Graphiti changes episode/fact lineage, supported local graph backends, telemetry/model behavior, or publishes a core/MCP security advisory such as the 1.0.2 Cypher-injection fix. 【S-GR-03】
- A DSH incident shows duplicate effects, secret retention, cross-agent memory access, or stale-memory behavior.
- The experiment below is run and produces a result that changes the recommendation.

## Falsifiable experiment

### Question

Does the recommended DSH-native ledger plus explicit memory materially underperform a durable framework or an automatic memory adapter on the failure modes that matter for a local coding agent?

### Pre-registered hypothesis

**H1:** With identical tool semantics, DSH-native SQLite plus an effect ledger will match durable-framework crash recovery and require less integration code.  
**H2:** Explicit, reviewed memory will have better correction accuracy and policy-write safety than automatic LangMem, Mem0, or Graphiti memory, with a recall advantage no larger than 10 percentage points.  
**H3:** No framework arm will achieve zero duplicate observable effects unless every sink implements the same effect-ID idempotency protocol.

### Arms

**Durability bake-off (same deterministic fake model, same tools, same tests):**

- A: DSH-native SQLite event/effect ledger.
- B: `@langchain/langgraph` 1.4.18 + its pinned SQLite checkpointer, `durability="sync"`, with an approved JavaScript serializer/encryption configuration verified by the raw-byte secret test.
- C: Temporal Server 1.32.0 + TypeScript client/worker 1.24.0 local service.
- D: Restate Server 1.7.12 + TypeScript SDK 1.17.2 local service.

**Memory bake-off (same fixed local model and embeddings):**

- M1: explicit typed SQLite/Git records with review and supersession.
- M2: LangMem 0.0.30 + the same local store.
- M3: Mem0 OSS 2.2.0 with local Qdrant/history and local model/embedding endpoints.
- M4: Graphiti Core 0.30.2 with a patched MCP line (core >=0.28.2), local Neo4j/FalkorDB, and local model/embedding endpoints.

Letta Code is deliberately excluded from this adapter bake-off because it is a whole agent harness with its own runtime, permissions, sessions, and memory rather than a memory adapter. If Letta is shortlisted, run a separate whole-harness pilot against the same workload and thresholds. 【C-005】

Run the same adapters twice: once with the tool sink enforcing `effect_id`, once with a deliberately non-idempotent sink. This makes the exactly-once boundary visible instead of hiding it behind framework marketing.

### Workload

Create a fixed harness with:

- 20 ordinary multi-tool tasks;
- 20 tasks with a human approval pause;
- 20 tasks with two parallel branches and a merge;
- 20 correction tasks where a project fact changes;
- 20 adversarial memory episodes containing prompt-injection text from a “repository issue,” web page, and tool result;
- one synthetic canary secret in each transcript, environment result, HTTP header class, and memory candidate.

Use fixed model output or a recorded local model seed so framework re-execution does not introduce model-quality noise. Do not change prompts between arms.

### Fault injection

For each durability task, kill the worker at seven predefined points:

1. before a tool call;
2. after sink success but before success is journaled;
3. after checkpoint write but before the next node;
4. after one parallel branch succeeds and the other fails;
5. after human approval but before resume;
6. during LLM/tool timeout retry;
7. during process startup before recovery completes.

Repeat each point/task combination three times with recorded seeds. Separately test a code upgrade between checkpoint creation and resume.

### Metrics and thresholds

**Durability decision passes only if all are met:**

- 100% terminal-state equivalence to the fault-free reference run;
- 0 unauthorized tool executions and 0 approvals accepted after argument/policy/plugin hash change;
- 0 canary-secret values in unencrypted checkpoints, journals, traces, or memory indexes;
- 0 pinned package/component pairs with a known high/critical advisory in the official release history at decision time (for example, never use Graphiti MCP <=1.0.1 with core 0.28.1) 【S-GR-03】;
- 0 duplicate observable sink effects when the sink enforces the documented `effect_id` protocol;
- p95 recovery time no more than 2× the no-fault run;
- operator-visible recovery commands and integration code recorded, not estimated.

**Memory decision passes only if all are met:**

- canonical fact precision ≥0.95 and exact correction accuracy ≥0.90;
- cross-session recall ≥0.90;
- 100% of poisoned instructions quarantined from trusted policy/system scope;
- 100% of requested deletions absent from active derived indexes within 5 seconds;
- provenance present for 100% of candidate/promoted memory;
- no canary secret retained in active memory or embeddings.

### Pre-registered interpretation

- **Falsify the native-first durability recommendation** if Temporal, Restate, or LangGraph has zero correctness/security failures, p95 recovery at least 50% faster, and can meet the integration-complexity budget without adding a mandatory always-on service for the local-only workload. Adopt the winner behind the same DSH adapter.
- **Falsify the explicit-memory recommendation** if LangMem, Mem0, or Graphiti improves cross-session recall by at least 10 percentage points while correction accuracy falls by no more than 2 points, trusted-policy writes remain zero, and deletion/provenance tests pass.
- **Falsify every “exactly once by framework” claim** if any framework duplicates an effect after a sink succeeds but before the framework records success, even when the sink lacks idempotency.
- **Do not adopt a system that fails a security threshold to win latency or recall.** A failed secret, authorization, or poison-containment threshold is disqualifying regardless of aggregate score.
- Report raw runs, exact package hashes, model/embedding identifiers, configuration, disk growth, cold start, recovery time, and all failures. A single favorable average cannot override a pre-registered hard security or correctness failure.
