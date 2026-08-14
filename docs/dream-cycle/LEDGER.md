| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-13 | security-adversarial | redblue evaluator entrypoint silently no-ops (npx bin-symlink isMain footgun); added classifyEntrypointResult + verify-entrypoint | #6 | #7 | yes | ACCEPT | npm test 85->96, 0 regressions | ec2052aa | first real night (demo seed rows removed 2026-08-13; see #6) |
| 2026-08-14 | developer-experience | ledger signals zeroMergeStreak is an unverified worst-case default (never wired mergedPrNumbers); added --merged flag | #8 | #9 | yes | ACCEPT | npm test 96->101, 0 regressions | e55f6413 | PR #7 merged by human 2026-08-13 (ironic: the exact merge the buggy signal missed) |
