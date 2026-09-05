# Compiler-Parity SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 0, DAYINT 20260905 % 5 = 0): DEEP=compiler-parity,
SCAN=config-schema,golden-snapshots. Finding: `validateConfig()` in
`@dream-machine/compile` validates that every `bonusModuli` object KEY is an
integer string, but never validates that the VALUES are non-empty strings.
`step0Context()` interpolates each value directly into a compiled-prompt line
(`` DAYINT % ${mod} == 0  → add ${surface} ``) with no guard. A malformed
value — an empty string, a whitespace-only string, or a non-string value
smuggled past the TypeScript `Record<string, string>` type at runtime (e.g.
via `JSON.parse` of a hand-edited `dream.config.json`) — silently compiles
into a dangling `→ add ` line in the nightly routine prompt actually executed
by future sessions, with `dream-machine compile` reporting success and no
test catching it. Reproduced live tonight. This is the same class of gap as
the `adrConvention` object-form validation fix (PR #29, 2026-08-25) — a
structured config field whose values were never checked before being
string-concatenated into compiled prose — applied to the one other field
(`bonusModuli`) with the identical shape, which PR #29's own report flagged
explicitly as an out-of-scope next step ("Apply the same object-form-
validation treatment to `bonusModuli` values ... currently only the *keys*
are checked").

**Ledger check performed:** `docs/dream-cycle/LEDGER.md` on `main` holds only
6 rows, none from this repo's actual dream-cycle nights (the self-hosting
config didn't exist yet when those rows were written) — every dream-cycle
night since has appended its ledger row on its own unmerged draft-PR branch,
so `dream-machine ledger signals` sees only 6 nights and reports
`zeroMergeStreak=true` (confirmed: `list_pull_requests` shows ~30 open dream-
cycle/sota draft PRs against `ruvnet/dream-machine`, 0 merged, 1 closed
unmerged). This is a real, corroborated signal — not a stale one — so
tonight's candidate is deliberately the smallest, most orthogonal, most
easily reviewable diff available in this surface: it touches one function,
adds no new field, does not overlap `#29` (open, `adrConvention`), `#55`
(open, STEP 17-18 gist wording), or `#11` (open, self-hosted golden-snapshot
coverage — confirmed via diff read tonight, not re-implemented). Per STEP
1.1, the zero-merge signal biases toward exactly this shape of candidate.

## What's new

- `packages/compile/src/config.ts`, `validateConfig()`: the existing
  `bonusModuli` loop now also checks each value with
  `typeof v !== 'string' || v.trim().length === 0`, pushing a structured
  `bonusModuli["<key>"] must be a non-empty string` error — no change to the
  key-integer check already present.
- `packages/compile/src/index.test.ts`: 4 new tests — accepts a well-formed
  value, rejects an empty value, rejects a whitespace-only value, and a
  `compile()`-level test asserting it *throws* (`/bonusModuli\["25"\]/`)
  instead of silently emitting the dangling `→ add ` line. An independent
  critic (fresh subagent, no shared context) traced each negative test
  against the pre-fix code and confirmed they fail on the old implementation
  — not tautological.
- No snapshot touched: the `metaharness` fixture's `bonusModuli` values are
  already well-formed, so the golden snapshot is byte-identical.

## Competitors (structured-config-field validation)

| System | How it validates nested/structured config values, not just keys | Grade |
|---|---|---|
| Terraform | `validation` blocks + type constraints apply to full attribute values, including map values, before `plan`/`apply` | B (public docs) |
| Kubernetes API server | Admission validation (OpenAPI schema + validating webhooks) checks map *values* of a spec, not just key shape (e.g. `nodeSelector` values must be valid label values) | B (public docs) |
| Zod / io-ts (TS ecosystem) | `z.record(keySchema, valueSchema)` validates both key and value schema by construction — the standard idiom this repo's hand-rolled loop was one field short of | B |
| This repo's own PR #29 (2026-08-25) | Fixed the identical gap for `adrConvention`'s object form; explicitly deferred the `bonusModuli` value case as a named next step | A (first-hand, this repo's own history) |

## Hypothesis (frozen before implementation)

> Given a `dream.config.json` with a `bonusModuli` entry, when
> `validateConfig()` is extended to reject a non-string or empty/whitespace-
> only `bonusModuli` value, then a malformed bonus-modulus surface name is
> caught as a structured `ValidationResult` error at `dream-machine compile`
> time instead of silently compiling a dangling `→ add ` line into the
> executed nightly prompt (reproduced live tonight:
> `{ "25": "" }` → `` DAYINT % 25 == 0  → add `` with nothing after `add`),
> subject to: zero change to the compiled output of any config whose
> `bonusModuli` values are already well-formed strings (confirmed: this
> repo's own `dream.config.json` compiles byte-identically before/after),
> zero regressions in the existing 98 tests, and the pre-existing key-integer
> check is untouched.

## Benchmarks / Evaluation Receipt

Real evaluator: `npx vitest run` (this repo's own `bench` entrypoint).

- Baseline (parent, commit `7933c3599abe22df5290f4609d1f93f598feb3de`, via
  `git stash` + rebuild): `Test Files 7 passed (7)`, `Tests 98 passed (98)`.
- Candidate (same commit + this diff, `npm run build -w packages/compile &&
  npx vitest run`, then full `npm run build && npx vitest run`):
  `Test Files 7 passed (7)`, `Tests 102 passed (102)` (98 baseline + 4 new).
  Zero regressions, zero modified assertions.
- Golden-snapshot diff: none (`git diff --stat
  packages/compile/src/__snapshots__/index.test.ts.snap` empty).
- Self-hosting closure check: re-ran
  `node packages/cli/dist/bin.js compile dream.config.json --out
  /tmp/tonight-prompt-candidate.md` after the fix and diffed byte-for-byte
  against the pre-fix compile of the same file — identical (expected: this
  repo's real config's `bonusModuli` values are already well-formed, so the
  fix only changes behavior for malformed input, never for this repo's own
  night-to-night prompt).

Evidence grade: A (first-party, reproducible in this repo, no external
claim). LLM_EVAL not required for this candidate — deterministic unit tests
only; `OPENROUTER_API_KEY` is present in this session's environment but was
not invoked (no model-calling evaluation stage applies to a config-schema
validation fix).

## Darwin Results

`DARWIN=not-applicable`. `npx @metaharness/darwin evolve --sandbox mock` was
not invoked: this candidate is a single validation-format fix with no
numeric objective and no evolvable population, matching the precedent set by
the 2026-08-30 compiler-parity night for a change of the same shape.

## Evidence

- OBSERVATION: `grep -n bonusModuli packages/compile/src/config.ts` (pre-fix)
  shows the validation loop reads `Object.keys(...)` only, never the values.
- OBSERVATION: `node -e "compile({...base, bonusModuli:{'25':''}})"` against
  the pre-fix `dist/` output printed a compiled prompt containing the literal
  line `` DAYINT % 25 == 0  → add `` with a trailing space and nothing after.
- MEASUREMENT: `npx vitest run` 98/98 → 102/102, 0 regressions (exact command
  output captured above, independently re-verified by the critic subagent
  via `git diff --numstat`).
- INFERENCE (independent critic, not this session): the 3 negative tests are
  non-tautological — each traced to fail against the pre-fix implementation.
- DECISION: land the value check as an additive branch inside the existing
  `bonusModuli` loop, mirroring PR #29's `adrConvention` shape exactly, per
  that PR's own named next step.

## Reward-Hack Check

Independent critic (fresh subagent, no shared context, given only the raw
diff + full repo read access) checked: (a) weakened benchmark/tests — none,
diff is purely additive (`git diff --numstat`: +4/-1 in `config.ts`, +17/-0
in `index.test.ts`); (b) altered gold answers/snapshots — none, snapshot
file untouched; (c) cherry-picking/tautological tests — checked by tracing
each new negative assertion against the literal pre-fix code path; all three
fail on old code, confirming they exercise the real fix; (d) evaluator
exploitation — no vitest config, mock, or timeout touched; (e) hidden
cost/scope creep — diff is exactly the stated 52 lines across exactly the
two stated files; (f) fix correctness — the `typeof`/`trim().length === 0`
check is appropriate for the `Record<string, string>` shape; noted one
cosmetic edge case (a value like `" x "` passes but keeps its untrimmed
interior whitespace when interpolated) explicitly scoped out as non-
threatening; (g) security — none, pure function over an in-memory object.
**Verdict: CLEAR.** No unresolved signal.

## Security Review

No security-sensitive surface touched: no prompt-injection vector changed
(interpolation target is nightly-prompt prose, not executed anywhere), no
tool/MCP authority granted or removed, no credential path touched, no
filesystem/network scope changed (the fix is a pure in-memory validation
function — no new I/O), no agent-impersonation surface, no benchmark/memory-
poisoning vector (no test data or gold answer touched). Least-privilege
posture unaffected.

## Scan Findings

**config-schema** — Beyond tonight's fix, `evaluatorEntrypoints` values
(`bench`/`flywheel`/`darwin`/`redblue`) and `labels`/`competitors`/
`extraDisciplines` array entries are still unchecked for non-empty-string
shape (same class of gap, lower severity since these feed `npm test`
sections or bullet lists rather than a bare `→ add ` line — a malformed
entry degrades gracefully to a blank list item rather than a dangling arrow
line). Also open: `DreamSlot.scan` cardinality (`scan.length !== 2` is only
a warning, never an error) — already an explicit next-step from PR #11
(2026-08-15), deliberately not re-attempted tonight to avoid duplicating
that still-open PR's scope. Not fixed tonight to keep this candidate to one
conceptual change.

**golden-snapshots** — Confirmed via direct diff read tonight (not
re-implemented): PR #11 (2026-08-15, still open, `mergeable_state: dirty`)
already added a golden-snapshot test reading this repo's own real
`dream.config.json` and snapshotting its compiled output — the exact gap a
later night's report (PR #55, 2026-08-30) independently rediscovered and
proposed as a next step without realizing it was already implemented on an
unmerged branch. This is itself evidence that STEP 1.1's `duplicateDirections`
signal (computed only from `LEDGER.md` rows that reached `main`) is blind to
in-flight unmerged work — the same root cause as the `zeroMergeStreak`
signal above. Flagged, not fixed: reconciling ~30 open dream-cycle/sota PRs
against `main`'s 6-row ledger is a cross-night, human-review-scale
reconciliation, explicitly out of scope for a tiny one-parameter candidate
(PR #29's report already named this the single highest-leverage open
finding; it still is).

## Witness

```
report_sha256 : 418616b0bbf7f122cdb7d06ad911625e666b8bd0bcd6414b3ce3d3c6277e1af3
session_commit: 7933c3599abe22df5290f4609d1f93f598feb3de
witness       : 2764b2b8f3003555599d2aa212d21b710cbe5a00a6797a0031e318d1694d69a3
```

Computed over this file's frozen bytes *before* this Witness section existed
(STEP 16's hash-then-rewrite order — same convention as PRs #7, #11, #55).
Verify (5 steps, coreutils only, no gist tooling required — report is
committed at this path):

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-09-05-compiler-parity-report.md | awk '{print $1}')
printf '%s%s' "$REPORT_HASH" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum | awk '{print $1}'
# ^ will NOT equal the witness above verbatim, since sha256sum now runs over
# the file WITH this section filled in. This is the documented limitation of
# self-referential witnessing (ADR-0001): the authoritative report_sha256 is
# the value computed and printed above at STEP 16 time, not a value
# re-derivable from the final committed file. Cross-check instead via
# `dream-machine witness verify` against the pre-Witness content, or trust
# the recorded triple as the audit trail.
```

`GIST=LOCAL` — no `gh` binary and no gist-creation MCP tool in this session
(`which gh` → not found; `ToolSearch` for gist tooling → none). Per the
best-effort gist-publication precedent (2026-08-13, PR #55), this is not a
FALLBACK/stop condition: the report is committed into this PR as the durable
artifact instead.

## Recommendation

Human review of the draft PR. `EVALUATED=yes`, `VERDICT=ACCEPT` (candidate
is a real, reproduced fix to a real parity gap explicitly named as a next
step by a prior night; positive effect on compiled-prompt correctness for
malformed config; 98→102 tests, zero regressions, zero snapshot drift;
independent critic returned CLEAR on reward-hacking and security). Next
steps explicitly NOT done tonight (named, not silently dropped):

1. Apply the same non-empty-string check to `evaluatorEntrypoints` values
   and `labels`/`competitors`/`extraDisciplines` array entries.
2. Enforce `DreamSlot.scan.length === 2` as an error, not a warning (PR
   #11's remaining next-step; a behavior-widening change needing its own
   frozen hypothesis since it changes what configs are *accepted*).
3. The ledger/GitHub-reconciliation problem (zero merges across ~30 nights,
   `LEDGER.md` on `main` blind to unmerged rows) remains this repo's
   highest-leverage open finding, carried forward again tonight.
