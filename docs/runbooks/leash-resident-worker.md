# Resident CPU worker and negative paired result

Status: experimental, no production hook or promotion. Updated 2026-10-16.

The worker now loads the local tokenizer and safetensors model once, hashes its
materialized artifact inventory once, and retains the model across sequential
requests. Every request checks inventory stat metadata, formats the chat prompt,
tokenizes it, runs the model and converts the activation. Changed stat metadata
requires reload and recalibration. Stat checks are not a cryptographic guarantee
against a malicious writer preserving metadata: run only reviewed, operator-owned
model directories and immutable inputs. No downloads, pickle weights, remote code,
provider requests, or inherited credential names are permitted.

`ActivationWorker.infer(text, max_new_tokens=0)` measures activation-only requests.
Positive generation limits return a completion and its initial last-prompt-token
activation. It does not pretend that full weak completion generation is free.
Requests are bounded by input tokens, generation tokens and a lifetime request
ceiling. Concurrent calls are rejected instead of queued. `close()` drops the
resident model; use a parent process hard timeout because Python computation is
not forcibly interrupted by the worker.

The optional `--serve --max-requests 128` CLI uses bounded newline-delimited JSON
on stdin/stdout and exits on EOF or its request ceiling. It opens no network port.
Its default requests extract activations without completion generation. A caller
must measure transport and application queues separately. Internal `requestMs`
includes stat checks, formatting, tokenization, forward work and conversion;
it excludes startup, JSON serialization and process transport.

The first resident CPU run is preserved under `docs/research/leash-resident-20261016/`.
It used pinned Apache-2.0 SmolLM2 135M and 360M Instruct artifacts, greedy decoding,
32 output tokens, 256 input tokens, two CPU threads per worker and no provider
calls. The names weak/strong are route labels, not measured capability claims.
The 36-task public synthetic manifest was created before inference and fixed
12 reference, 8 calibration and 16 confirmation cases across exact JSON tool calls
and constrained arithmetic repairs. No candidate text was executed.

Both models failed the strict output contract on all 36 cases. Outputs commonly
gave code or prose instead of the exact requested JSON. These failures were not
rescored with a more permissive parser. Insufficient weak successes prevented
bank fitting, so the verdict is `INCONCLUSIVE`; there is no learned routing policy,
confidence interval, cost saving or useful self-improvement claim from this run.
The implementation includes controls and exploratory intervals when a valid bank
can be fitted, but this failed run cannot manufacture those results.

Warm activation-only latency was 198.51 ms median and 248.38 ms p95 on 24 requests
after three warmups, with no response caching and exact repeated-input activation
equality. This misses the 150 ms added-latency target even before transport and
scoring. Model startup was 4.775 s plus 6.581 s; paired requests consumed 197.751 s;
the complete measured benchmark was 214.941 s including startup and warm checks.
This is one CPU executor, not a device performance claim. Energy, idle hardware
and dollar costs are unknown. No paid calls or remote desktop wakeups occurred.

Work Desktop was asleep for this follow-up. Earlier ruOS activation-only evidence
in `leash-runtime-20261016.json` remains separate; it does not verify this revision.
Next useful experiment: improve structured-output compatibility on training-only
examples, then freeze new independent confirmation cases before evaluation. Keep
these failures and the strict checker. Do not reroll seeds or relax acceptance
to manufacture a gain. A stronger representative model and real repository tasks
are prerequisites to a production-relevant routing claim. No schedule changes,
provider spending, merge or deployment are authorized by these scripts.
