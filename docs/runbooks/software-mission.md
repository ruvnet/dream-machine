# Dream Machine software mission

This is an executable software testbed, not a bedside device. It can be exercised
on supported Node 24 or Node 22.13 and newer within the 22 line. It never flashes,
signs with a production key, connects an actuator or grants device permissions.

## Start on the Mac

Use the dedicated account and permission gates in the
[Mac runbook](mac-studio-codex-desktop-build.md). First review the exact PR commit.
The doctor can run before dependencies are installed:

```sh
node scripts/mission.mjs doctor --profile mac
node scripts/mission.mjs bootstrap
npm run check
npm run mission:simulate -- --seed 43
```

The Mac profile checks Apple Silicon and public npm, Git, Xcode, Rust and Arduino
CLI version availability. It does not select a board, inspect signing identities,
validate entitlements, install missing tools or certify SDK compatibility.
Missing requirements return `INCONCLUSIVE`; arrange human setup before retrying.

## Commands and verdicts

| Command after `node scripts/mission.mjs` | Result |
| --- | --- |
| `doctor` | Sanitized software tool availability |
| `doctor --profile mac` | Additional Mac tool availability, not hardware validation |
| `bootstrap` | Fixed `npm ci --ignore-scripts` dependency acquisition |
| `bootstrap --offline` | Same install from an already primed cache |
| `test` | Independent typecheck, eight builds, lint, all tests and static gates |
| `policy` | Declared test-server policy tripwire |
| `security` | Current online npm advisory result; unavailable service is inconclusive |
| `simulate --seed 43` | Small deterministic nonactuating smoke run |
| `simulate --full --seed 43` | 1,000,000 malformed submissions, 10,000 restarts, 30 synthetic scenario groups |
| `benchmark` | 15,000 parser timing samples in 30 batches; hardware claim inconclusive |
| `run --full --seed 43` | Build/test, simulation, fuzz, benchmarks, inventory, SBOM and online audit bundle |
| `run --full --offline --seed 43` | Same software evidence, advisory refresh explicitly skipped |
| `verify --bundle run-... --expected HEX64` | Exact bundle integrity against a separately trusted manifest digest |

Exit codes are 0 for the requested accepted scope, 1 for rejection or invalid
input, and 2 for an inconclusive scope. Full `run`, `benchmark` and successful
`verify` normally return 2 because they cannot certify complete mission readiness.
Do not suppress arbitrary nonzero exits or translate 2 into release approval.
The CI wrapper checks the specific accepted software gates and the specific
inconclusive gates before it exits successfully.

`run` requires a clean, unchanged commit to accept source provenance. Dirty
worktrees are executable for local diagnosis but their source gate remains
inconclusive. Commit or lockfile changes during the check reject that gate.
Never run the harness on unreviewed code with personal credentials or devices
available. A child process executes within its current account, not a new sandbox.

## Evidence and repeatability

The final JSON names the private run directory under `.dream/evidence`, its
manifest SHA256, per-gate verdicts and integrity result. Save the manifest digest
separately from the mutable directory if using it as a later trust input.
No bundle overwrites another. The verifier rejects mutation, missing or added
files, noncanonical manifests, traversal, symlinks and special files.

Simulation summaries contain seed, exact requested/executed counts, fault-family
counts and fixture/receipt hashes. Same seed and software produce the same
synthetic summary. Timings, audit dates and SBOM metadata are descriptive and
can differ across invocations; the whole evidence bundle is not bit-reproducible.
Synthetic scenario groups cannot satisfy the real-night holdout or research plan.

Memory benchmark:

```sh
node packages/memory/benchmarks/recall.mjs
```

It compares production bounded top K to exact full sorting over the same 10,000
synthetic records, k=5, five queries and 200 samples per path. Compare raw
distributions and oracle equality. Do not use shared-host measurements as a Mac,
Arduino, p99 deadline or end-to-end performance claim.

## Before any real sensing or cue

1. Identify and approve the exact Mac, Xcode/SDK, board, firmware and dependencies.
2. Demonstrate disabled WAN access independently of the harness's offline flag.
3. Implement and validate actual RuVector, authenticated MCP and Apple adapters.
4. Prove controller debug, flash and output isolation under T17/S13, or use an
   independently provisioned controller with an approved interface.
5. Validate power loss, persistent dose, physical mute, watchdog timing and
   calibrated wired output on disconnected fixtures.
6. Obtain separate human authorization for pairing, signing, flashing and each
   supervised live progression. Keep research outcomes separate from promotion.

See [ADR-0106](../adrs/ADR-0106-executable-software-prototype-and-evidence.md)
for implemented contracts and deliberately unresolved gates.
