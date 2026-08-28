# Supply-Chain Audit Gating SOTA Report — 2026

## TL;DR

Tonight (2026-08-28, DEEP=security-adversarial, SCAN=redblue,supply-chain, SLOT=3) a fresh `npm ci` on this repo's own lockfile surfaces 8 dependency vulnerabilities (2 critical, 1 high, 3 moderate, 2 low), but CI does not gate on any of them — the exact gap already named by the maintainer in open issue #43. `npm audit --omit=dev --json`, run live tonight, shows those 8 findings are 100% contained in the vitest/vite/esbuild/eslint dev toolchain: 0 of the repo's 13 production dependencies are implicated. This report implements issue #43's proposed policy exactly: a new deterministic classifier (`classifyAuditGate`) + CLI command (`dream-machine audit-gate`) + CI job that fails only on a reachable high/critical **production** finding, and reports (never fails) on dev-only findings. The learning signal `zeroMergeStreak: true` (6/6 nights, `dream-machine ledger signals`) drove the choice of a tiny, single-function, easily reviewable candidate over the larger, riskier vitest-major-version upgrade issue #37 also has open.

## What's new

Nothing novel externally — this is standard "production-reachability gating" practice, not a research contribution. What's new for *this repo* is: (1) actually gating CI on `npm audit` output instead of only reporting it, and (2) trusting npm's own `--omit=dev` dependency-graph walk as the reachability oracle rather than reimplementing it, which is the exact class of mistake PR #19's independent critic caught in a hand-rolled npx-pinning detector on 2026-08-18 (false positives/negatives from re-deriving something a tool already computes correctly).

## Competitors / prior art (grade noted per claim)

| Project | Dependency-vulnerability gating in its own CI? | Grade |
|---|---|---|
| npm CLI itself (`npm audit --omit=dev`) | Computes prod/dev/optional dependency-graph separation authoritatively; used here as the oracle, not reimplemented | A (reproduced live tonight, `metadata.dependencies: {prod:13, dev:269, ...}`) |
| GitHub Dependabot / Advisory DB | Surfaces alerts per-repo but does not itself fail a CI run unless the repo adds an explicit gating job (same gap issue #43 names) | B (vendor docs, cross-checked against this repo's own CI behavior tonight — Dependabot PRs #1–#5, #23 are open but nothing blocks merge on their absence) |
| OWASP Dependency-Check / Dependency-Track | Established practice: classify by reachability/exploitability before blocking, not raw CVE count | B (well-known standard, not independently reproduced tonight) |
| Sakana AI Scientist / OpenHands / SWE-agent / DSPy-GEPA / AutoGPT lineage | No evidence any of these publish a supply-chain gating policy for their own evaluation harness as part of their core contribution | C (absence-of-evidence from public repo/paper skim, not exhaustive) |

## Hypothesis (frozen before implementation)

> Given this repo's CI pipeline, which currently reports `npm audit` findings without gating on them, when a deterministic classifier is added that parses `npm audit --omit=dev --json` output and fails CI only on a high/critical finding within that production-scoped report, then CI should correctly distinguish reachable production risk (0 findings, confirmed live) from dev-toolchain risk (8 findings, confirmed live) — subject to: no existing test is modified or weakened, the classifier never re-derives npm's own dependency-graph reachability computation, and it is zero-false-negative against a synthetic high/critical finding (must block) and zero-false-positive against tonight's real dev-only findings (must not block).

## Benchmarks / Evaluation

Real evaluator: `npm test` (vitest, this repo's own `bench` entrypoint).

| | Baseline (parent `7933c359`) | Candidate |
|---|---|---|
| Tests | 98 | 111 (+13, 0 removed/modified) |
| Result | 98 passed | 111 passed |
| Lint | — | clean (`npm run lint`) |
| Build | — | clean (`npm run build`, all 6 packages) |

Live end-to-end receipt (real repo data, not simulated):

```
$ npm audit --omit=dev --json > /tmp/audit-prod.json
$ node packages/cli/dist/bin.js audit-gate --path /tmp/audit-prod.json
audit-gate: clear — 0 findings at any severity (critical=0 high=0 moderate=0 low=0)
exit code: 0

$ node packages/cli/dist/bin.js audit-gate --path /tmp/audit-full.json   # dev-inclusive, same night
audit-gate: blocked — 2 critical + 1 high finding(s) in this audit scope (critical=2 high=1 moderate=3 low=2)
exit code: 1
```

The second call is not part of the CI wiring (CI only ever points the gate at the `--omit=dev` report) — it exists purely as evidence that the gate is not a rubber stamp: pointed at the dev-inclusive report, it correctly blocks.

## Darwin

`DARWIN=not-applicable`. Probed live tonight (`npx @metaharness/darwin evolve --sandbox mock` → real leaderboard, winner `g2_v5`, delta +0.110 over baseline, LIVE) — same rationale as 2026-08-13/ADR-0002 and 2026-08-18/PR#19: no evolvable population exists for a single, already-minimal pure classifier with one fixed policy boundary (high/critical vs. below).

## Reward-Hack Check (self-adversarial, solo session — no separate critic agent available)

- Does not touch any existing test, gold answer, threshold, or the `bench`/`darwin` evaluator entrypoints themselves.
- Does not re-derive production reachability — delegates to npm's own `--omit=dev` graph walk, avoiding PR #19's false-positive/negative class of bug.
- Malformed/partial input (missing severity counts, non-audit JSON, `npm audit` error payloads) classifies as `malformed` (exit 2), never silently `clear` (exit 0) — verified by dedicated tests.
- CI step uses `npm audit --omit=dev --json ... || true` only to stop `npm audit`'s own nonzero exit (which fires on any finding) from short-circuiting before our gate runs; the gate command itself is what determines the job's real exit code — the CI job is not "always green" by construction.
- Boundary cases (single high with all else 0, single critical with all else 0, moderate/low-only) each independently tested to block or clear correctly.

## Security Review

No prompt-injection surface (pure JSON parsing, no LLM calls). No credential exposure. No new network I/O. New filesystem I/O is a single local read of a caller-supplied JSON path (`io.readFile`), consistent with every other CLI command's I/O surface. No change to `io.exec`'s actual shell-exec path.

## Scan findings (redblue, supply-chain)

- **supply-chain**: confirmed live — 8 real advisories in the dev toolchain (`GHSA-5xrq-8626-4rwp` critical, Vitest UI arbitrary file read; `GHSA-fx2h-pf6j-xcff` high, Vite `server.fs.deny` bypass; plus esbuild/vite/eslint-plugin-kit moderate/low), 0 in production. Matches issue #37's independent reachability analysis exactly. Remediation (the actual vitest/vite major-version bump) is issue #37's scope, deliberately left separate tonight per the zeroMergeStreak-driven "tiny candidate" bias and issue #37's own note that it "should land independently."
- **redblue**: not the focus of tonight's candidate; no new redblue-entrypoint work done (PR #19, 2026-08-18, already covers unpinned-npx detection on that surface and remains open/unmerged).

## Recommendation

ACCEPT for human review. This closes the CI-policy half of issue #43 (the classify-and-gate mechanism); the "every current high/critical finding is either removed or demonstrated not to ship" half is already independently true and now provable via `npm audit --omit=dev`. Issue #37 (upgrade vitest/vite past the advisories) remains open as separate, larger follow-up work — deliberately not attempted tonight.

## Next steps

1. Land issue #37's vitest/vite major-version upgrade as its own, separately-evaluated candidate (larger diff, needs its own baseline/candidate test run across Node 18/20/22).
2. Extend `audit-gate` to also assert `metadata.dependencies.prod` matches an expected count, catching a future `--omit=dev` scope regression silently reporting 0 findings because it queried the wrong graph.
3. Wire the same gate into `automerge.yml`'s eligibility check once a human has reviewed this job's first few real CI runs, so a future PR touching production deps can't silently regress past this gate even under the auto-merge path — do not do this unilaterally.

## Witness

`dream-machine witness stamp` hashes this exact file's raw bytes, so the stamp
cannot be written *inside* the file it stamps (editing the file after hashing
would invalidate the hash against the committed bytes — same self-reference
issue documented in the 2026-08-13 and 2026-08-18 security-adversarial
reports). The stamp is computed over this file frozen exactly as it reads at
this point, and published instead in the PR description and the LEDGER.md
row, both of which point back at this file (committed at
`docs/dream-cycle/2026-08-28-security-adversarial-report.md`) by path and
session commit. Anyone can independently reproduce it:

```bash
sha256sum docs/dream-cycle/2026-08-28-security-adversarial-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```
