# Continuum Acceptance Matrix

This matrix distinguishes executed evidence from deferred DSH crash-boundary work. A green local source test is not presented as a production crash-recovery proof.

| Gate | Status | Evidence | Limitation |
|---|---|---|---|
| WCS schema/structure doctor | PASS | `./bin/continuum-workspace doctor --strict` | Depends on local PyYAML/jsonschema; strict mode fails closed without them |
| WCS unit/adversarial tests | PASS | `python3 -B -m unittest discover -s .agent-workspace/tests -v` (36 tests) plus `node plugins/continuum-handoff.test.mjs` | Synthetic fixtures, not a full DSH process |
| Dynamic plugin activation | PASS | `cordis_inspect_self(hand-3,pkg-14)` Host running, no waiting services | Dynamic package is process-local and disappears on restart |
| Handoff redaction | PASS | Plugin source test and context secret test | No claim that arbitrary upstream redaction is perfect |
| Fork guards | PASS | Node regression: missing services, running turn, open turn, active job, active/paused goal, mutex, process-local outcome key, inspect-failure retry, idempotency, child identity/workspace/preset | Uses a fake Host seam; product API behavior still needs a real child smoke |
| Real loader preset mount | PASS | `agentPresets.standingKeyFor` for `continuum` and `continuum-curator` | Existing standing generations are not reclaimed by a preset edit |
| Crash before/during/after every tool/approval boundary | DEFERRED | Not run in this synthetic workspace | Must run against a disposable DSH profile with controlled fault injection |
| Fresh-agent recovery from generated context | PARTIAL | Context pack now includes task, state, validation, events, latest handoff, ADRs, research, Git identity, redaction, and emitted hashes | Requires a separate fresh Session smoke run |
| Cross-session authorization/duplicate effects | DEFERRED | Source-level guard tests only | Requires real workspace fork, approval pause, and sink idempotency tests |
| Validation profile execution | DEFERRED | Doctor validates argv/timeout/mutation and the ledger records configured steps | CLI does not execute arbitrary profile commands; run them in a disposable profile before release |
| Monorepo package-scope depth | DEFERRED | Doctor validates scope ids, paths, dependencies, and cycles | It does not yet validate package manifests against every scope; add that adapter before multi-package production use |

## Release rule

Do not enable automatic archiving, autonomous memory writes, or unattended recycling until every DEFERRED row has an artifact, exact package/config version, Git commit, and reproducible result. The current release supports explicit human handoff and guarded fork only.
