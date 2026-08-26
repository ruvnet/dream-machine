# Independent review checklist

Research role: verify source date, claim scope, baseline, sample size, and whether results are originating-team or independently reproduced.

Implementation role: confirm the API remains additive, deterministic, dependency-free, and does not grant authority or execute tools.

Security role: attempt scope confusion, duplicate evidence identity, trace mutation, malformed hashes, partial claims, replay exceptions, and false external evidence.

Testing role: run the full repository suite plus the ECT unit tests on every supported Node version.

Reproducibility role: rerun the matched fault-injection benchmark from a clean checkout using pinned versions and seeds.

Release role: require human review, green CI, benchmark disclosure, rollback instructions, and no autonomous merge or deployment.
