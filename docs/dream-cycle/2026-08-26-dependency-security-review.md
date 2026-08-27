# Evidence Carrying Termination dependency and security review

## Dependency review

The implementation adds no third-party dependency. It uses Node's existing `node:crypto` SHA-256 implementation and the repository's existing TypeScript and Vitest toolchain.

## Security boundaries

1. Evidence scope is data, not authority. A caller cannot gain a capability by placing a scope string in a trace.
2. Certificates contain hashes and identifiers, not secret values.
3. Closed replay receives only evidence explicitly cited by each claim through the ECT API.
4. Duplicate evidence identities are rejected to avoid ambiguous replay.
5. Any failed claim forces RECOVER and no partial certificate is emitted.
6. A full-trace hash detects mutation after certificate issuance.
7. Deterministic canonical JSON rejects non-finite numbers and sorts object keys before hashing.

## Residual risks

1. A compromised tool can produce a false value that replay faithfully reconstructs.
2. A malicious replay function can encode incorrect semantics.
3. SHA-256 hashing alone does not authenticate the producer. RVF or RVM signatures are required when producer identity matters.
4. Trace hashes do not guarantee trace availability. Durable storage and retention remain separate concerns.
5. Scope names require authoritative enforcement outside the witness package.

## Fix path

Keep ECT as a narrow support certificate. Pair it with RVM capability checks, signed RVF receipts, independent benchmark-owned evaluators, and Core Memory provenance where the deployment requires stronger guarantees.
