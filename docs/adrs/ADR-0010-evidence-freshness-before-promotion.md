# ADR 0010: Evidence freshness — re-verify the read set before promotion

Status: Proposed

Date: 2026-09-07

Related: ADR-0007 (claim-relative evidence receipts), ADR-0009 (discovery evidence before promotion), ADR-0001 (the nightly loop)

## Context

Every evidence gate in this repository freezes a policy *before* outcomes are
visible and then treats the resulting receipt as timeless. `ClaimReceipt` binds
experiment coverage. `DiscoveryEvidenceReceipt` binds scientific criteria.
Neither asks a question that turned out to matter more than either: **is this
evidence still about the tree we are promoting into?**

That assumption is safe when a candidate lands the same night. It is not safe in
the regime this repository actually operates in. Between 2026-08-13 and
2026-09-07, 30+ evaluated candidates accumulated unmerged; the backlog was
landed in a single session on 2026-09-07.

PR #11 made the failure concrete and measurable. It was evaluated on 2026-08-15
against `dream.config.json` as it stood that day, asserting
`withDefaults(selfConfig).autoMerge === true` and golden-snapshotting the
compiled prompt. Its evaluation was honest and passed. Three weeks later the
repository deliberately set `autoMerge: false` and the compiled prompt evolved.
On landing, `main` went red on two tests.

The load-bearing detail is that **git merged #11 cleanly**. There was no
conflict, because `dream.config.json` was never in #11's diff. It was in #11's
*read set*: a file the evaluation depended on but did not modify.

> git protects the WRITE set. Nothing here protected the READ set.

This is not "receipts get old". Age was never the mechanism — a three-week-old
candidate whose dependencies never moved is still valid. The mechanism is an
**undeclared environmental dependency set that nothing re-verifies at promotion
time**.

## Decision

Add a deterministic `EvidenceFreshnessPolicy` / `EvidenceFreshnessReceipt` pair
to `@dream-machine/witness`, and a `dream-machine freshness` CLI that performs
the I/O.

The policy is frozen at evaluation time and contains only bounded metadata:

1. stable policy identity
2. the base commit the evaluation ran against
3. canonical evaluation timestamp
4. the **declared read set** — every path whose content the evaluation's result
   depends on, each with a SHA-256 digest of its content at evaluation time
5. whether an empty read set is rejected (default yes)
6. an optional secondary `maxAgeDays` bound

At promotion time the same paths are re-digested against the target tree and
compared. Verdicts:

- `FRESH` — every declared dependency still has its evaluated content
- `STALE` — one or more drifted, or an explicit age budget was exceeded
- `INDETERMINATE` — a declared path was not observed, or the observation carries
  paths the policy never declared; unverifiable is never treated as fresh
- `INVALID` — malformed input, or the policy no longer matches its anchored digest

Every receipt carries `authority: 'none'`, consistent with ADR-0007/0009. A
FRESH verdict is evidence that an evaluation still applies. It is never
permission to merge.

Three deliberate non-goals, because getting them wrong makes the gate useless:

- **A moved base commit is not staleness.** `main` advances constantly; a gate
  that fires whenever `HEAD != baseCommit` fires always, gets ignored, and
  protects nothing. `baseCommitMoved` is reported as context only.
- **Age is not the primary signal.** It is an optional secondary bound for
  callers who want one, never the mechanism.
- **The witness primitive performs no I/O.** The caller supplies observed
  digests, so the same pure function serves CI, a promotion gate, and tests.

## Consequences

A candidate can now carry, alongside its evaluation receipt, a machine-checkable
claim about the environment that evaluation assumed — and that claim is
re-checked against the tree it would land in.

The cost is that the read set must be declared. An undeclared read set is not
evidence that a candidate has no environmental dependencies; it is evidence that
nobody looked, which is why `requireDeclaredDependencies` defaults to true. Read
sets that are too narrow will still miss drift; this gate raises the floor, it
does not prove independence.

This does not close the promotion loop by itself. It supplies the missing
freshness input that a bounded auto-landing path would need before it could
safely act on a three-week-old ACCEPT verdict.

## Alternatives Considered

- **Re-run the full evaluation at promotion time.** Strictly stronger and
  strictly more expensive; for a 30-candidate backlog it is the thing that does
  not happen, which is how the backlog formed. Freshness is the cheap check that
  says whether the expensive one is needed.
- **Gate on base-commit equality.** Trivially implementable, fires on every
  candidate in a live repository, and would have been switched off within a day.
- **Gate on age alone.** Would have caught #11 (three weeks old) but also blocks
  correct old candidates and passes a one-day-old candidate whose dependencies
  moved. Wrong axis.
- **Rely on git conflict detection.** This is the status quo, and it is exactly
  what missed #11: the diff merged cleanly.

## Test Contract

- `FRESH` when the declared read set is unchanged; unaffected by a moved HEAD or
  by arbitrary age with no drift
- `STALE` reproducing PR #11's exact shape — a clean merge whose read set drifted
- `STALE` when an explicit age budget is exceeded; drift reported alongside age
- `INDETERMINATE` for unobserved declared paths and for undeclared observed paths
- `INVALID` for a policy rewritten after its digest was anchored (the evasion
  path: silently dropping the dependency that drifted)
- rejection of absolute paths, `..` traversal, duplicate paths, malformed
  digests/commits/timestamps, non-boolean and out-of-range runtime values, and
  read sets beyond `MAX_EVIDENCE_DEPENDENCIES`
- receipts contain digests and paths only, never file content
- the CLI validates and anchors the policy **before** reading any dependency, so
  an untrusted policy file cannot be used as a read/existence oracle
- cost bound: sub-quadratic scaling from 512 to 4096 dependencies

Validated end-to-end against real history: stamping `dream.config.json` from
`8ce3857` (PR #11's evaluation base) and verifying against current `main` yields
`STALE`, `driftedPaths: ["dream.config.json"]`, exit 1.

## References

- PR #11, PR #95 (the repair), PR #96 (union-merge damage from the same landing)
- `packages/witness/src/evidence-freshness.ts`
- ADR-0007, ADR-0009
