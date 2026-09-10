# Dream constellation portfolio report — 2026-09-05

## Executive summary

This cycle inventoried 316 accessible repositories owned by the authenticated user: 214 public and 102 private, with zero archived repositories. Private repositories are represented only by aggregates. Of the inventory, 278 repositories were indexed, 38 were unindexed, and 11 were empty. Since the previous evidence window, 15 default-branch commits were observed across two public repositories; private activity was zero in aggregate. Open-state searches reached connector limits at at least 100 open pull requests and 100 open issues, so those totals are lower bounds.

Five active repositories received deep review: dream-machine, ruflo, midstream, RuView, and core-memory. The portfolio result is one ACCEPT, two REJECT, and two INCONCLUSIVE. No new remotely exploitable critical or high production vulnerability was confirmed.

Actions were deliberately bounded to five exact-head reviews and this evidence update. No new issue, implementation pull request, direct push, merge, release, automerge change, or public vulnerability disclosure was made.

## Execution contract and selection

The default branch of ruvnet/dream-machine was read first at `7933c3599abe22df5290f4609d1f93f598feb3de`. README.md, SECURITY.md, dream.config.json, ADR-0001, the compiled pipeline, dependency manifests and lockfile, CI configuration, tests, release state, and the durable ledger supplied the contract.

Repositories were ranked using security 35%, functionality and production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%. New security/functionality changes and neglected validation debt were rotated above unchanged prior heads. Archived repositories were excluded from mutation.

## Deep reviews

### 1. dream-machine — bounded retrieval selection

**Frozen hypothesis.** The candidate's bounded top-K portfolio selection produces results exactly equal to full sorting while reducing the measured selection cost by at least 25%, and its governance wrapper refuses to promote unvalidated physical, MCP, or real-RuVector claims.

**Baseline and threshold.** The submitted benchmark records full sorting at 1.6964 ms. Acceptance requires exact top-K equality on every frozen query, at least 25% lower measured selection cost, all repository tests, CI, and CodeQL green, and explicit abstention outside the tested software envelope.

**Evidence.** Draft PR [#75](https://github.com/ruvnet/dream-machine/pull/75) at `35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf` reports bounded selection at 0.7558 ms, a 55.4% reduction or approximately 2.24× speedup. Five frozen queries produce exact equality. The 446-test suite, CI, and CodeQL pass. The wrapper leaves hardware, physical-system, MCP-transport, and real RuVector/RVF validation INCONCLUSIVE rather than converting a software pass into portfolio promotion. Adversarial review found no evidence of baseline substitution or threshold relaxation.

Verdict: **ACCEPT**

### 2. ruflo — fail-safe injection detection

**Frozen hypothesis.** PR #3177 removes catastrophic backtracking and stateful PII matching without reducing the adversarial detection corpus, while a clean exact install and all required security, verification, integration, signing, witness, and cross-agent gates pass.

**Baseline and threshold.** The candidate must preserve all focused detector tests, eliminate regex state leakage, install from the committed dependency graph, leave the full bypass corpus no worse than baseline, and pass every required exact-head workflow.

**Evidence.** PR [#3177](https://github.com/ruvnet/ruflo/pull/3177) at `59b05364849b2500d6b3ba79bcaa60d37a326453` replaces two backtracking-prone expressions, removes the global PII regex flag, and reduces confidence aggregation from quadratic work. Focused type checking and 19 tests pass, and CodeQL is green. The broader detector still misses 48 of 55 documented bypass cases. Five workflow groups fail at the root dependency/install boundary, preventing CVE, verification, signing, witness, integration, and cross-agent acceptance. The patch is promising but cannot be promoted from focused evidence.

Verdict: **INCONCLUSIVE**

### 3. midstream — detection must control execution

**Frozen hypothesis.** PR #105 causes every tool-invocation injection detected at HIGH or CRITICAL severity to fail closed at the execution gateway, while preserving benign traffic and passing the repository's clean-install, test, type, and security gates.

**Baseline and threshold.** The supplied adversarial corpus improves from 7/55 detections only if every detected high-impact case is actually denied, at least 28/30 benign cases remain accepted, the clean committed dependency graph installs, and all test and security gates pass.

**Evidence.** PR [#105](https://github.com/ruvnet/midstream/pull/105) at `2bb5f27d18d8381c68d8d061d70a97b3a116ee21` reports 55/55 pattern detection and 28/30 benign acceptance. Reachable gateway code still permits a verified request whenever severity is below CRITICAL; at least one motivating tool-invocation rule is HIGH, and the submitted integration test explicitly expects that request to remain allowed. The full test result is 114 passed and 9 failed, the main lockfile is not reproducible without mutation, and supply-chain/Rust security gates fail. The candidate improves classification but does not establish enforcement.

Verdict: **REJECT**

### 4. RuView — secret-state migration and handoff

**Frozen hypothesis.** PR #1832 removes Wi-Fi and OTA secrets from persisted application state and from observable child-process arguments across legacy load, save, reconnect, missing-secret, and failure paths, with targeted regressions and all exact-head workflows green.

**Baseline and threshold.** Acceptance requires zero secret values in serialized state and process arguments, regression coverage for legacy state and all error paths, and green exact-head CI, security, firmware, QEMU, fix-marker, and data-policy gates.

**Evidence.** PR [#1832](https://github.com/ruvnet/RuView/pull/1832) at `ab3f2edeaa99a4bde06fc523aab728990418d1f4` excludes the sensitive fields from state merge/save and adds file-based inputs at the outer wrapper. All six exact-head workflow groups pass. No targeted regression tests were added for legacy state, serialization, missing-secret, or failure behavior, and the wrapper still passes the Wi-Fi password and OTA pre-shared key to a child through command-line arguments. MITRE CWE-214 documents that sensitive command arguments may be visible to other processes. The persistence improvement is real, but the complete secrecy hypothesis is unproven.

Verdict: **INCONCLUSIVE**

### 5. core-memory — pinned workflow provenance

**Frozen hypothesis.** PR #53 restores a least-privilege, immutable CI and CodeQL envelope: every external action is commit-pinned, checkout credentials are not persisted, job permissions are minimal, dependency auditing passes, and CodeQL publishes a successful result.

**Baseline and threshold.** Both supported Node matrices and all 56 tests must pass, dependency audit must be green, and the exact-head security workflow must complete successfully including CodeQL publication.

**Evidence.** Draft PR [#53](https://github.com/ruvnet/core-memory/pull/53) at `be5650f670e1e8ee787ac4e521a5d60d4636b756` pins official checkout, setup-node, and CodeQL actions to full commits, disables persisted checkout credentials, and narrows job permissions. CI passes on Node 22 and 24 with 56 tests and benchmarks. The exact-head security workflow remains red: dependency audit does not pass and CodeQL cannot publish its result. The candidate improves provenance but does not meet its stated restoration criterion.

Verdict: **REJECT**

## Security and functionality findings

- No new remotely exploitable critical or high production vulnerability was confirmed.
- Midstream's submitted pattern pack improves detection substantially, but reachable policy does not consistently turn high-impact detection into denial. Existing issue [#103](https://github.com/ruvnet/midstream/issues/103) and PR #105 remain the correct remediation path.
- Ruflo's focused regular-expression hardening is supported, but its clean-install and broader security envelope remain red; no production safety claim was made.
- RuView removes secrets from persisted state but retains command-line exposure and lacks targeted migration regressions.
- Core Memory improves CI provenance, but the exact-head security workflow remains unsuccessful.
- No secrets or private-repository details were included in public artifacts.

## SOTA and authoritative gates

- The [MCP tools specification dated 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires server-side input validation, access control, rate limiting, output sanitization, and client-side confirmation/audit controls. It applies directly to Ruflo and Midstream tool execution; the expected benefit is turning classification evidence into enforceable, auditable runtime policy.
- The [MCP authorization security considerations dated 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations) supply the current trust-boundary standard for constellation services.
- [Agent Safety Should Be a Runtime Contract, submitted 2026-08-11](https://arxiv.org/abs/2608.11274), supports the falsifiable requirement that policy must mediate the actual effectful path rather than only classify input.
- The [OWASP GenAI/LLM Top 10 2026, published 2026-08-03](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/), provides the current adversarial taxonomy for prompt injection and agentic trust boundaries.
- [MITRE CWE-214](https://cwe.mitre.org/data/definitions/214.html), updated 2026-04-30, and the [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) ground RuView's argv-safe handoff gate. The expected benefit is eliminating local process-list disclosure while preserving file-based secret provisioning.
- The official [actions/checkout v7.0.1 release](https://github.com/actions/checkout/releases/tag/v7.0.1) from 2026-07-20 and [actions/setup-node v7.0.0 release](https://github.com/actions/setup-node/releases/tag/v7.0.0) from 2026-07-14 support Core Memory's immutable workflow update; exact-head security success remains the acceptance condition.

## Constellation relationships and reusable learning

Dream Machine supplied the governed ranking, falsifiable hypotheses, bounded-action policy, and durable ledger. Ruflo and Midstream expose a shared lesson: detector recall is not an execution-control guarantee, so future evidence must bind detection receipts to the effectful gateway and prove zero side effects for denied cases. RuView contributes sensor and field-service integration, with secret handoff now an explicit acceptance gate. Core Memory receives only the redacted portfolio checkpoint. RuVector native/WASM/RVF parity remains required for any real persistent-memory claim; no fresh real-adapter execution was available. MetaHarness-style adversarial controls shaped all five gates, but no fresh MetaHarness run is claimed without a runnable checkout.

Reusable prioritization rule: any candidate that improves a classifier, receipt, or detector must demonstrate enforcement at the final side-effect boundary; green focused tests cannot outweigh a failed clean install or a required red security workflow.

## Evidence, commands, and blockers

Read-only evidence included authenticated paginated repository inventory, default-branch commit searches, open issue/PR searches, repository instruction and manifest review, exact-head PR diffs, exact-head workflow inspection, test/benchmark receipt inspection, and authoritative-source verification. Five exact-head review comments record the frozen hypotheses, observed evidence, acceptance thresholds, reward-hack checks, and verdicts.

Blockers were unavailable runnable repository checkouts, author-only or failed workflows, no hardware or field validation, no fresh real RuVector native/WASM/RVF replay, and no governed signed Core Memory federation endpoint. Open-state totals remain lower bounds because search results reached connector caps.

## Actions and next cohort

Actions: five exact-head reviews; one dated report and one ledger row; zero new issues, implementation PRs, direct pushes, merges, releases, or automerge changes.

Next cohort:

1. Midstream fail-closed gateway enforcement plus exact-lockfile recovery.
2. Ruflo root-install recovery and the full 55-case bypass corpus.
3. RuView targeted state migration tests and argv-safe secret handoff.
4. Core Memory dependency/CodeQL recovery.
5. Dream Machine real RuVector/RVF/MCP and physical-system evidence.
