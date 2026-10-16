# Bounded paired model evaluation

`scripts/leash_workloads.py` evaluates two **resident real model workers** on
public, generated toy tasks. It cannot establish realistic Ruflo gain, secret
holdout performance, production suitability, mid-task takeover, or monetary
savings. The names weak and strong identify routes; neither model is assumed to
outperform the other. Fake workers in the tests verify contracts only.

Before either worker produces outputs, call `freeze_manifest(path)` to exclusively
create a manifest. Archive that file before the run. The default seed is 261016;
the manifest freezes 12 reference, 8 calibration, and 16 confirmation task IDs,
prompts, and checker specifications, balanced across two families in every split.
These cases are public synthetic tasks, not undisclosed holdouts. Preserve failed
runs and avoid rerolling seeds or selecting a favorable manifest after inference.
The API checks the canonical manifest before any request; filesystem permissions
or external archival must establish that it was not replaced after observing an
earlier run. The hash alone cannot prove chronological preregistration.

The tool-call family requires an exact JSON object selecting `read_file` or
`list_directory` and precisely the requested path. No tool is actually invoked.
The repository-repair family chooses one replacement token from `+`, `-`, `*`,
or `//` for a fixed trusted arithmetic function. A literal constrained checker
applies that operator to fixed integer test inputs. Model source is never
compiled, evaluated, or executed. Both checkers reject extra keys, duplicate
JSON keys, markdown and prose. Grading specifications remain in the evaluator;
only each task's `prompt` string is passed to inference. Requests describe the
task without appending an expected JSON answer or hidden grading cases.

```python
from leash_workloads import freeze_manifest, run

freeze_manifest("/absolute/path/frozen-manifest.json")
# weak and strong are already-loaded, reviewed local workers.
report = run(weak, strong, "/absolute/path/frozen-manifest.json")
```

Each worker implements `infer(text, max_new_tokens=32)` and returns actual
`text`, last-prompt-token `activation`, `activationMs`, `requestMs`,
`generatedTokens`, and an `identity` matching `leash_probe.identity` (exact model
revision, artifact inventory digest, layer and position). `requestMs` includes
activation extraction and completion generation, excludes resident model load,
and must be at least `activationMs`. Report startup time separately if known.
The driver performs no downloads, paid calls, provider discovery or model setup.
Each worker is invoked once on every task; execution order alternates using the
frozen seed and task index. Identity changes reject the run. Inference errors
abort visibly and must not be converted into made-up labels or timings.

All paired outputs, timings and generated-token counts are retained. Outcome
counts include both-pass, weak-only, strong-only and both-fail for every family
and split. The reference bank requires at least two weak successes and failures;
calibration and confirmation may contain all passes or all failures. Otherwise the verdict is
`INCONCLUSIVE`, with actual outcomes retained and no fabricated classes.

The candidate fits `leash_probe.fit` on reference activations only and calibrates
the frozen 0.5 escalation fraction on calibration only. Confirmation labels never
select a bank or threshold. `leash_probe.evaluate` is deliberately not used: its
cost evaluator requires homogeneous monetary costs, whereas these experiments
retain heterogeneous measured request times. No time-to-dollar conversion is
performed. No routing recommendation grants execution permission.

Confirmation compares the candidate with always-weak, always-strong, fixed-order
and seeded-random routing. Fixed-order assigns strong to the first eligible IDs;
random routing uses the manifest seed. Both match the candidate's strong-call
count within each family, without consulting confirmation outcomes. This is a
call-count comparison, not an equal-dollar or equal-time claim. Random routing is
one preregistered seeded allocation, not a search for a favorable control.

The API already completes the weak request to obtain its activation. Candidate,
fixed and random escalation therefore charge **weak request plus strong
request**, including both generated-token counts. A weak route charges its weak
request. Candidate serving time also includes measured decision overhead; the
simple controls receive zero selection overhead. Activation time is already in
request time and is not charged twice. Always-strong pays only its strong
request. These are measured paired replay estimates of initial-route serving
time, not an online randomized latency trial. Warm-cache, load, order and timing
noise can affect comparisons.

The report includes request sums, completion, p95 serving time, route receipts,
and family-stratified paired bootstrap 95% percentile intervals (default 2,000
resamples, seed plus one) for candidate completion differences and serving-time
saving fractions against each baseline. Intervals resample fixed policies and
their observed outputs, not bank training or random-allocation uncertainty.
They have limited precision with 16 public confirmation cases.

Setup time conservatively includes both workers' reference/calibration requests
and measured bank fitting/calibration. Total paired collection time also includes
the unused confirmation routes for experiment accounting. Setup amortization
reports candidate serving plus setup and the task count needed to break even
against always-strong when the observed per-task saving is positive. It excludes
unknown startup, idle, energy and monetary costs rather than inventing values.

The exploratory gain gate is fixed in code before outputs: each family must also
remain within one percentage point of both always routes. The lower completion
difference bound must be at least -0.01 against both always routes and strictly
positive against fixed and random controls; the lower serving-time saving bound
against always-strong must be at least 0.15; and candidate confirmation serving
plus setup must be below always-strong confirmation serving time. Any failure is
`NO_GAIN`. A passing `BOUNDED_EXPLORATORY_GAIN` remains limited to these synthetic
tasks and authorizes no deployment. Archive the full report, manifest, resident
model receipts, and environment information; do not replace these results with
contract-test success or claim production gain.

Run contract checks with:

```sh
python -m unittest discover -s scripts -p 'test_leash_workloads.py'
```
