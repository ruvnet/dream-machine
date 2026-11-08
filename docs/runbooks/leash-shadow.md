# LEASH shadow callback adapter

`scripts/leash_shadow.py` is a local Python adapter, not an installed Ruflo hook
or a deployed integration. It wraps an existing synchronous callback and returns
that callback's exact result object, including all provider and extension fields.
Callback exceptions propagate unchanged; shadow validation and probe errors do not
replace the original routing result.

The concrete upstream interface inspected was `ModelRouter.route(task: string,
embedding?: number[]): Promise<ModelRoutingResult>` in
`v3/@claude-flow/cli/src/ruvector/model-router.ts` at Ruflo revision
`1882006a02487590c8c66a7eec8d7504f6af33c3`. The Python boundary expects a
synchronous callback returning the corresponding result dictionary. It validates
the required model, scores, reasoning, alternatives, inference time, cost and
mechanism fields, plus known optional provider/model/backend fields. Unknown
extension fields are preserved and are never copied into receipts.
`EnhancedRouteResult` and its deterministic codemod handlers are outside this
adapter's accepted schema.

`scripts/leash-ruflo-shadow.mjs` supplies the opt-in asynchronous JavaScript
boundary for the actual upstream class. `createRufloShadow(router, {probe})`
returns `routeWithShadow(metadata, ...originalArguments)`. It awaits the original
method with its original receiver and exact arguments, then returns the exact
original result object. It never installs or patches a production router.
The trusted local probe receives only a detached activation/identity pair, never
the original prompt, route result, or reasoning. It must validate the identity
and use the independently fitted bank/calibration. No bank is silently fabricated
when reference outcomes are insufficient.

`createLeashProbe(bank, calibration)` binds a detached, independently fitted bank
to its exact model identity and threshold. It implements the same linear score
as Python, with finite/dimension checks and strict greater-than escalation.
A cross-language contract test replays an actual Python-fitted synthetic bank
in JavaScript. The JS-native probe fingerprint binds its numeric inputs; it is
not Python's differently encoded digest and grants no authority.

```js
const observer = createRufloShadow(existingRouter, { probe: reviewedLocalProbe });
const result = await observer.routeWithShadow({
  taskId: 'public:123', permitted: false, drift: false,
  activation: localActivation, identity: exactModelIdentity,
}, taskText, embedding);
```

The JavaScript adapter retains at most one pending asynchronous probe. A timeout
aborts its signal and abstains; further observations abstain while that probe is
still pending. This bounds backlog even if a probe ignores cancellation. The
timer cannot interrupt synchronous CPU work or establish a hard real-time bound.
Use only reviewed local code. Activation collection is outside this adapter's
timing and permission scope and requires its own explicit data authorization.
Permission denial or declared drift invokes no probe.

`scripts/leash-ruflo-compat.mjs` tests the real upstream class after reviewed local
TypeScript transpilation, with optional neural/trajectory integrations disabled,
an isolated state path, and a credential-free environment. It verifies 24 exact
original-result identities and permission-denied abstentions. This proves the
async interface, not learned routing quality or a production integration.

Local usage after preparing a validated bank/calibration and local activation:

```python
from leash_shadow import ShadowRouter

observer = ShadowRouter(existing_route_callback, bank, calibration,
                        max_receipts=256, timeout_ms=25)
original = observer.route(task_text, embedding, task_id="evaluation:123",
                          activation=activation, model_identity=identity,
                          permitted=False, drift=False)
receipts = observer.receipts
```

The callback receives only its original task/positional/keyword arguments. Shadow
metadata is keyword-only and never passed to it. `permitted` and `drift` must be
actual trusted booleans, and task IDs must be bounded printable identifiers.
Permission denial or declared drift suppresses recommendations. Every receipt
always has `authorized: false`; neither a weak nor a strong recommendation grants
authority. No tools, permissions, provider selection, execution, retries, task
handoffs, schedules, network requests, or production configuration are changed.

Receipts are kept only in a bounded in-memory ring (default 256, maximum 4096).
They contain hashes of task ID/text, activation, identity, bank and calibration;
the original model/tier and optional concrete model ID; a suggested route category;
status; and original/shadow elapsed timing. They contain no raw prompt, activation,
route reasoning, reference labels, or exception text. Hashes are fingerprints,
not encryption, and may permit guessing known inputs. Persistence/export is left
to a separately reviewed caller; this adapter does not write receipt files.

The timeout is an **advisory elapsed budget**, checked after local computation.
An over-budget observation discards its suggestion and records
`timeout_advisory`. It cannot interrupt a stuck callback/probe or guarantee a
wall-clock deadline. The shipped probe is local bounded numeric work; do not
substitute a remote provider or arbitrary blocking callback. Activation extraction
is supplied by the caller and its latency is not included in `shadowMs`.
The existing router and shadow hashing/probe add sequential latency; no latency or
completion improvement is claimed.

Run the focused offline checks with:

```sh
python -m unittest discover -s scripts -p test_leash_shadow.py
```

The fixtures exercise recommendations, actual probe identity rejection, invalid
schema/metadata, denied permissions, declared drift, probe errors, unauthorized
probe output, advisory timeout, bounded/private receipts, argument forwarding,
result identity, and original callback exceptions. JavaScript contracts also
cover async rejection and one-slot backpressure. These checks do not demonstrate
production Ruflo interoperability, drift detection,
mid-task takeover, outcome quality, production latency, or deployment readiness.
