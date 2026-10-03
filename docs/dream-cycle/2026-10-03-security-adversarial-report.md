# Security-Adversarial / Supply-Chain SOTA Report — 2026-10-03

## TL;DR

`scripts/benchmark-ticket-codec.mjs`'s `withReference()` hardcodes a single
"reviewed reference" commit (`BASELINE_COMMIT`) and fetches it with
`git show <sha>:<path>` specifically so no caller-supplied revision can be
substituted — an intentional anti-tamper control. On a **shallow** git
checkout whose fetched history does not reach that commit (reproduced live
tonight: this session's own fresh Claude Code Remote checkout, default
depth), the control fails *closed* but *opaquely* — a bare
`execFileSync` stderr dump with no diagnosis and no remediation — and is not
self-healing even though the target is a fixed, non-attacker-controllable
literal that could safely be fetched on demand. Candidate: detect the
missing-object case and attempt one scoped `git fetch --depth 1 origin
<BASELINE_COMMIT>` (the hardcoded literal only, never an interpolated
value) before falling back to a clear, actionable error. `BASELINE_COMMIT`
itself is never made configurable — the security property is unchanged.

## What's new

- Live-reproduced tonight (not simulated): on this session's fresh clone,
  `npm test` baseline shows 3/150 governance tests failing
  (`scripts/benchmark-ticket-codec.test.mjs`'s "pinned reviewed reference"
  suite, which exercises `withReference()` in
  `scripts/benchmark-ticket-codec.mjs`) with `Command failed: git show
  35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf:packages/edge-contracts/src/index.ts`.
  `git cat-file -e 35c9fd31...` confirms the object is simply absent —
  this repo's own CI already works around the identical fragility by
  pinning `fetch-depth: 0` on the two jobs that run this suite
  (`.github/workflows/ci.yml:26,81`, comment: "Pinned historical codec
  differential oracle"), and the nightly dream workflow does the same
  (`.github/workflows/dream-nightly.yml:43`). No equivalent exists for an
  ad hoc dev checkout or an agent session using a shallower default.
- The failure mode matters specifically *tonight's own pipeline*: STEP 20
  of this very prompt requires classifying a failing test
  caused-by-candidate / preexisting / environmental. An opaque `git show`
  stderr dump gives an automated agent (this one, or a future run) no
  signal to make that call correctly without manual `git cat-file`
  spelunking — which is exactly what this run had to do by hand.

## Evidence grading

- A (reproducible, this session, live): the 3-test baseline failure, the
  `git cat-file -e` confirmation of the missing object, and the CI
  workflow's own `fetch-depth: 0` precedent (`.github/workflows/ci.yml`,
  `.github/workflows/dream-nightly.yml`).
- A (official docs via search): GitHub's `actions/checkout` defaults to
  `fetch-depth: 1`; anything needing older history must opt into a deeper
  or full fetch. This is the documented, expected shape of the failure
  class, not a fluke of this one environment.
- C (no evidence found): whether SWE-agent/OpenHands-class coding-agent
  harnesses specifically self-heal a missing pinned historical reference
  inside their sandboxes. Search returned general sandbox-isolation and
  reward-hacking-avoidance material (e.g. OpenHands masking `git pull` in
  training traces to avoid reward hacking) but nothing on this exact
  failure mode — reported honestly as absent, not inferred.

## Competitors (how adjacent systems treat reproducible historical oracles)

| System | Relevant mechanism | Shallow-clone / pinned-history handling | Grade |
|---|---|---|---|
| Sakana AI Scientist | Fully regenerates experiment code each run; no fixed historical-commit oracle | N/A — different design, no comparable control | C (design inference, not confirmed firsthand) |
| OpenHands | Docker-sandboxed execution; dataset cleaning masks `git pull` to block reward hacking | No public evidence of a pinned-commit reproducibility oracle or shallow-clone self-heal | C |
| SWE-agent | Issue-resolution trajectories over full repo checkouts in its benchmark harness | Benchmark harnesses typically assume full/deep clones are provided by the dataset, sidestepping this class of bug rather than solving it | C |
| DSPy/GEPA | Optimizes prompts/programs against held-out eval sets, not git history | N/A — no git-level provenance oracle | C |
| AutoGPT lineage | General autonomous task loops, no benchmark-reproducibility apparatus | N/A | C |
| **This repo (baseline)** | `withReference()` pins `BASELINE_COMMIT`, fetches via `git show <sha>:<path>`, explicitly refuses an "arbitrary revision argument" | Opaque failure, no self-heal, relies on callers remembering `fetch-depth: 0` | A (reproduced) |

None of the named competitors publish a comparable fixed-commit
differential-oracle mechanism to benchmark against directly — this is a
repo-specific control, so the honest comparison is "this repo's own CI
workaround" vs. "every other checkout path," not a cross-project metric.

## Hypothesis (frozen before implementation)

> Given a git checkout of `ruvnet/dream-machine` whose local history does
> not reach the hardcoded `BASELINE_COMMIT`
> (`35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf`) — the realistic case for a
> shallow clone such as this session's own checkout, or any `git clone
> --depth N` — when `withReference()` in
> `scripts/benchmark-ticket-codec.mjs` is changed to attempt one scoped
> `git fetch --depth 1 origin <BASELINE_COMMIT>` (the literal, compile-time
> constant only — never interpolated from any caller-supplied value) before
> its existing `git show`, then: (a) with network access to `origin`, the
> previously-failing governance tests pass without any other change; (b)
> without network access, the same tests fail with a named, actionable
> diagnostic (naming the missing commit and the remediation:
> `git fetch --depth 1 origin <sha>` or `fetch-depth: 0`) instead of the
> current bare `execFileSync` stderr dump — subject to: `BASELINE_COMMIT`
> must remain a hardcoded literal, never configurable, and the golden
> comparison logic itself must not change.

## Benchmarks / Evaluation

Real evaluator: `npm test` (`vitest run && npm run test:governance`).
Baseline (parent, stashed candidate) measured live on this session's own
shallow checkout before any candidate change, then the identical command
re-run with the candidate applied:

| | vitest | governance (`node --test scripts/*.test.mjs`) |
|---|---|---|
| Parent (baseline) | 769 passed | 150 run, **147 pass / 3 fail** (the 3 "pinned reviewed reference" subtests, all failing with the opaque `git show` error) |
| Candidate | 769 passed (unchanged) | 152 run (+2 new), **152 pass / 0 fail** |

`npm run typecheck` and `npm run lint` clean on the candidate. Independent
critic (separate agent, no authorship stake) reviewed the full diff
adversarially for reward-hacking, security weakening, masked failures,
hidden cost, and side-effect safety — verdict **CLEAR**, with one adopted
nitpick (silence `git cat-file -e`'s stderr on a miss, applied).

**Darwin:** `evaluatorEntrypoints.darwin` (`npx @metaharness/darwin ...`)
responded to `--version` (control-plane probe), so the entrypoint is
*available*, but this session's own sandbox permission classifier denied
the bounded `evolve` invocation as "Code from External" — i.e. this
session's own safety policy refused to execute unpinned third-party code
pulled live from the registry. That denial is not worked around (per this
session's own operating rules) and is itself corroborating, first-hand
evidence for this repo's already-documented, still-open finding that
`evaluatorEntrypoints.darwin` is an unpinned `npx` supply-chain exposure
(`packages/compile/src/supplychain.ts`). `DARWIN=blocked`, recorded rather
than fabricated; not required for tonight's verdict (STEP 10-14 marks
Darwin optional, "only if available").

**Security review:** no prompt-injection, MCP-authority, or credential
surface touched. Filesystem scope: the fix's only side effect is
`git fetch --depth 1 origin <fixed-sha>`, which writes new objects/refs
into this checkout's own `.git` — content-addressed, so the fetched bytes
are cryptographically bound to the literal SHA already hardcoded in the
file; nothing about this lets a caller substitute a different commit.
Network scope: outbound to `origin` only, same remote the checkout itself
came from. No production/runtime code path changed — the touched file is
test/benchmark infrastructure only.

**Reward-hack check:** no fixture, golden answer, threshold, seed, or
iteration count was touched; the 3 previously-failing assertions are
untouched and now simply get to run (they were never reached before, not
weakened). Confirmed by the independent critic above.

## Witness

Computed over this report's canonical bytes (everything above this
heading) plus the session commit, per `@dream-machine/witness`'s report-
witness canonical-exclusion convention (PR #120 precedent — hashing happens
before this section exists, so this section itself is excluded from the
hash, and the triple below is reproducible from this exact committed file
forever after).

```
report_sha256 : ae3f612f711f83ee1035e49c6d5c03808b291a82bab03189e7239c5edf5a5522
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : 3c3dc0728d1b327253b66d0021e80ffd0d5084056644f7f424baf31206ba416f
```

Reproduce: `node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-03-security-adversarial-report.md --commit 23a577082aad39750051dc7ef0ec9d0d72900adf`

## Next steps

1. If the self-heal `git fetch` itself has no network (fully offline CI
   runners, air-gapped mirrors), the clear-error path is the only
   remaining option — worth a follow-up ADR on whether `BASELINE_COMMIT`
   should ever be allowed to move from `git show` to a committed,
   content-addressed snapshot (e.g. a checked-in hash-verified fixture)
   to remove the git-history dependency entirely. Explicitly not done
   tonight — would change the security property, needs human review.
2. Audit every other place in the repo that references a fixed historical
   SHA (`grep -rn` found only this one `BASELINE_COMMIT`; worth re-checking
   after future ADRs add new oracles).
3. Consider adding `fetch-depth: 0` (or at least a documented minimum
   depth) to this repo's own `dream.config.json`-driven "fresh checkout"
   instructions (STEP 0.5 of the compiled nightly prompt itself), since
   tonight's run hit this exact gap from the inside.
