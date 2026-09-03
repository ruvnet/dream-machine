# ADR 0003: Claim Relative Evidence Receipts

Status: Proposed

Date: 2026-09-03

Issue: #70

## Context

Dream Machine already binds reports to source commits and uses durable ledgers, deterministic evaluators, witness receipts, and guarded candidate promotion. Those controls prove that retained artifacts have not changed, but they do not prove that the retained evidence is sufficient for a particular claim or that all assignments committed before an experiment are represented.

This distinction matters for perpetual self improvement. A candidate can look supported if inconvenient assignments are omitted, terminal outcomes are missing, or private evidence needed for one claim is withheld while generic logs remain internally consistent.

ClaimReceipt, arXiv:2609.01992, submitted 2026-09-02, formalizes these as separate questions: sufficiency and coverage. The originating team reports exact replay over 1,392 historical records and a prospective epoch where withholding one terminal receipt correctly yields an inconclusive coverage result. The same paper reports that its own frozen specification remains ambiguous to an independent reader. We therefore adopt the primitive, not the external specification as authority.

## Decision

Add a small deterministic claim relative verifier to `@dream-machine/witness`.

The verifier consumes four inputs:

1. An experiment manifest whose complete assignment universe was committed before outcomes were visible.
2. An independently anchored SHA 256 digest of that manifest.
3. A claim specification declaring required field groups, required private openings, and whether terminal coverage is mandatory.
4. Typed evidence records containing opaque assignment identifiers, semantic field group identifiers, evidence digests, opening state, and terminal state.

The verifier returns one of four states:

`PASS` means the declared evidence requirements and committed assignment coverage are satisfied.

`INVALID` means the evidence or commitment is structurally inconsistent, malformed, duplicated, undeclared, or does not match the independently anchored manifest digest.

`INCONCLUSIVE_COVERAGE` means at least one committed assignment lacks terminal evidence when terminal coverage is required.

`INCONCLUSIVE_SUFFICIENCY` means assignment coverage is adequate but evidence required for the specific claim is missing or unavailable to the verifier.

A `PASS` receipt does not establish that the scientific claim is true. It establishes only that the verifier received the evidence that the predeclared claim says is necessary.

Every verification result carries `authority: none`. Evidence identity, statistical confidence, and claim sufficiency do not grant execution rights. RVM remains authoritative for privileged effects.

## Canonicalization

Manifest assignment order is not semantically meaningful. Assignment identifiers are validated, sorted, and hashed with the experiment identifier, protocol version, and canonical ISO 8601 commitment timestamp.

Claim requirements are validated, deduplicated, sorted, and hashed independently. A field requiring a private opening must also be a required field.

Evidence identities are the pair `(assignmentId, fieldGroup)`. Duplicate identities are invalid rather than resolved by first or last writer semantics. Evidence records are sorted before hashing. Digests must be 64 character lowercase SHA 256 hex strings.

## Trust boundary

The expected manifest digest must come from an independent commitment, for example an RVF artifact, RVM anchored policy object, signed external manifest, or append only witness store. If the caller can rewrite both the manifest and the expected digest, omission remains possible.

The receipt intentionally excludes raw prompts, model outputs, private openings, or customer data. It stores opaque identifiers, digests, and verification state.

## Resource bounds

The initial implementation accepts at most 10,000 assignments and 100,000 evidence records per verification call. These bounds prevent an untrusted evaluator payload from turning a governance check into unbounded memory consumption.

## Integration

Dream Machine uses the receipt before treating an experiment as promotion evidence.

MetaHarness independently constructs and attacks manifests and evidence sets.

Core Memory may store receipt metadata and experiment lineage, but not convert receipt status into authority.

RVF can package signed manifests and claim specifications.

RVM can anchor expected manifest digests and enforce that a verifier cannot rewrite its own commitment.

RuVector can index receipts for audit and retrieval while preserving the immutable evidence roots.

## Benchmark protocol

The first benchmark compares generic log presence checks with claim relative verification.

The workload must include complete evidence plus attacks covering omitted terminal assignments, omitted required field groups, withheld openings, undeclared assignments, duplicate evidence identities, malformed digests, rewritten manifests, reordered equivalent manifests, and resource exhaustion.

Report:

1. Baseline and candidate commit SHAs.
2. Node, TypeScript, and Vitest versions.
3. CPU and operating system.
4. Sample size and fixed seed where randomized cases are added.
5. False PASS rate.
6. False INVALID or false inconclusive rate on benign inputs.
7. Median and p95 verification latency.
8. Peak process memory delta.
9. Evidence record count and bytes represented.
10. Every failing or unexpected case.
11. Exact reproduction command.

The production gate is zero false PASS across the declared omission and mutation suite, deterministic replay, no authority expansion, and p95 local verification below 1 ms at 1,000 assignments on a current desktop CPU.

## Security review

Adversarial cases must include:

1. Recompute a digest after deleting an assignment while leaving the independently anchored expected digest unchanged.
2. Insert evidence from an undeclared assignment.
3. Duplicate an evidence identity with conflicting contents.
4. Mark unrelated evidence terminal to try to cover a missing assignment.
5. Withhold all private openings while preserving public evidence.
6. Supply noncanonical timestamps and identifiers.
7. Attempt maximum assignment and record counts.
8. Verify that every output has `authority: none`.

## Rollback

The change is additive. Removing `claim-receipt.ts`, its tests, this ADR, and the export restores previous behavior. No stored data migration is required. Existing witness stamps remain byte compatible.

## Consequences

Positive: omissions become explicit against a committed experiment universe; evidence requirements become claim specific; private evidence can remain unopened unless a claim actually needs it; the primitive is reusable across self improvement, model routing, distributed experiments, and customer audits.

Negative: the verifier cannot decide whether the chosen assignment universe or field groups are scientifically adequate. It can faithfully verify a poorly designed experiment. Independent evaluator design, hidden holdouts, persistent statistical validity, and human review remain necessary.

## Promotion rule

Do not merge solely because unit tests pass. Independent MetaHarness reproduction, repository CI, dependency review, CodeQL, and the declared latency and omission benchmark must all have resolved results. No autonomous merge.