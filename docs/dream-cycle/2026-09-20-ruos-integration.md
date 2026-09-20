# ruOS governed evaluation integration

Date: 2026-09-20

## Delivered candidate

Optional compiler configuration adds an independent ruOS evaluation boundary without
changing existing routine output or merge policy. Dependency-free Node evaluators
validate frozen observation and paired-regression contracts. A host-injected MCP
preflight calls only a fixed harmless command and screenshot tool.

Receipts bind the policy and observations, the actual baseline/candidate execution
commit, run nonce, evaluator, workload, environment and freshness. They reject
failed assertions, incorrect tenants, stale commit bindings, malformed metrics,
missing screenshot bytes, and unverified completion. All receipts explicitly carry
no authority and cannot authorize merging. Hashes do not authenticate a collector.

## Validation

The unmodified parent is `3edd426f6c9c4b1e80235f7447dc863e749345cc`.
Its full `npm run check` passed: 616 Vitest tests and 81 Node governance tests.
Candidate validation includes the full same check, focused adversarial tests,
typechecking, build, lint, Edge contracts and development policy. Existing tests
and golden snapshots were not weakened. No dependencies were added.

Reproduce:

```sh
npm ci --ignore-scripts
npm run check
node --test scripts/ruos-evaluation.test.mjs scripts/ruos-preflight.test.mjs
npm audit --omit=dev --audit-level=high
```

The production dependency audit reported zero vulnerabilities in this environment.
This is a scoped dependency result, not a complete security certification.

## Live readiness result

A real authorized ruOS desktop returned actual screenshot bytes. Its command
response did not supply the completion metadata required by this contract.
Running `inspectRuosPreflight` on those actual MCP results returned:

```json
{
  "scope": "transport-readiness-only",
  "verdict": "INCONCLUSIVE",
  "reasons": ["EXIT_CODE_MISSING", "COMPLETION_UNVERIFIED"],
  "authority": "none",
  "mergeEligible": false
}
```

Machine identifiers, raw images, command transcripts and private implementation
details are excluded. Readiness does not establish tenant isolation, human takeover,
application functionality, workload improvement or production release success.

## Deployment and rollback

Three existing recurring improvement routines were updated to require ruOS evidence
for relevant user-facing changes, prioritize integration backlog, and retain their
existing repository and disclosure permissions. Updates were read back successfully.
That is a deployment of routine guidance, not an autonomous promotion service.

The live promotion pilot remains blocked until trusted executor completion,
independent collector identity, isolation, and exact-revision CI are established.
No production rollout or automatic merging is claimed. The integration adds no
network listener or production credentials. Rollback removes the optional config
and appended routine guidance; existing compiler behavior is preserved by default.
