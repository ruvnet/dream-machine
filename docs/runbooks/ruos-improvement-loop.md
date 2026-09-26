# ruOS improvement evaluation

This opt-in compiler integration describes an independent desktop evaluation boundary.
It does not provision desktops, grant merge permission, or implement a production promotion service.
Existing configurations and their compiled prompts remain unchanged.

## Enable

Add this object to the target's trusted `dream.config` and recompile its routine:

```json
{
  "ruosEvaluation": {
    "enabled": true,
    "machine": "isolated-evaluation-desktop",
    "requireScreenshot": true,
    "maxReceiptAgeSeconds": 3600
  }
}
```

Omit the object to disable. Unknown fields, unsafe machine identifiers, optional screenshots,
and freshness limits outside 60 through 86400 seconds are rejected. The machine identifier
selects a dedicated environment; a label alone is not proof of isolation.

## Execute

1. Freeze baseline, candidate, target, corpus and evaluator policy digests before execution.
2. Provision a disposable desktop using a separate trusted controller. Verify ownership,
   isolation and observation capabilities. Missing capabilities produce INCONCLUSIVE.
3. Run identical baseline and candidate journeys with synthetic data and scoped test credentials.
   Never blindly execute candidate scripts with production secrets or reuse production sessions.
4. Capture actual screenshots, persisted-state assertions, process exit codes and redacted logs.
   Null exit codes and positive prose cannot establish success. Keep private evidence private.
5. Use the trusted `node scripts/ruos-evaluation.mjs observation-or-pair.json trusted-policy.json` command to validate the receipt with
   an externally supplied policy and expected commit bindings. Consult its CLI usage for arguments.
   The researcher must not substitute its own verifier or policy. Locally passing artifacts alone
   do not establish independent provenance; the evaluator controller must protect their creation.
6. Pass verified evidence to the separate protected merge queue. Re-evaluate changed candidates
   and target commits. Branch protection and human approvals remain authoritative.
7. After authorized deployment, run staging and canary journeys; halt on critical invariant
   failure and execute the reviewed rollback procedure. Record customer value only after
   deployment verification, not when a research candidate receives ACCEPT.

## Acceptance

Inject a broken assertion, missing screenshot, stale receipt, incorrect tenant, null exit code,
and changed commit or policy binding. Every case must block promotion. A valid synthetic receipt
checks the contract only; it is not a live desktop or production acceptance test. Enforce production
rollout gates in the separate deployment controller before enabling unattended releases.

## Read-only transport preflight

The host supplies an authenticated, authorized MCP dispatcher. This module has no network
client or credentials and does not discover tools itself:

```js
import { collectRuosPreflight } from './scripts/ruos-preflight.mjs';

// callTool(name, args) resolves to the unmodified MCP result object.
// The host maps these names to its authorized ruOS tools and bounds call duration.
const readiness = await collectRuosPreflight(callTool, 'isolated-evaluation-desktop');
```

The dispatcher receives `desktop_exec` with `{ machine, command: 'true', timeout_secs: 15 }`
and `computer_screenshot` with `{ machine }`. It must not derive structured completion
fields from command stdout or other prose. `exitCode`, `completionVersion: 1` and
`completionVerified: true` must originate from an independently authenticated executor
completion collector. Legacy null exit status remains INCONCLUSIVE even when text says SUCCESS.
JSON text fallback is only serialization of a trusted tool response, never a candidate-authored result.

Preflight checks transport readiness and an image envelope only. It does not prove tenant
isolation, visual correctness, human takeover behavior, task success or promotion eligibility.
The observation evaluator adds structural image and frozen comparison checks; these still
cannot authenticate the collector. A digest binds evidence but is not a signature.
