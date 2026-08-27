# Deterministic ECT fault fixtures

These fixtures define the minimum no-model fault matrix for the Evidence Carrying Termination gate.

1. clean supported completion
2. missing cited evidence
3. out-of-scope cited evidence
4. empty evidence set
5. malformed claimed value hash
6. deterministic replay mismatch
7. replay exception
8. duplicate evidence identifier
9. full-trace mutation after certificate issuance
10. partial multi-claim support where one claim closes and one does not

Expected invariant: cases 2 through 10 return RECOVER and emit no partial completion certificate. Case 1 returns COMPLETE with a stable trace hash and certificate hash.
