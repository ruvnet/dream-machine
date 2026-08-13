| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14 | compiler-parity | golden snapshot drift guard | #3 | #4 | yes | ACCEPT | 0 drift | a1b2c3d4 | first night |
| 2026-08-15 | ledger-signals | zero-merge bias tuning | #6 | NONE | blocked | INCONCLUSIVE | - | b2c3d4e5 | PR#4 MERGED |
| 2026-08-16 | evaluation-adapters | flywheel receipt replay wiring | #9 | #10 | yes | REJECT | no lift | c3d4e5f6 | PR#4 MERGED |
| 2026-08-17 | security-adversarial | redblue indirect-injection family | #12 | #13 | yes | ACCEPT | n=6 | d4e5f607 | PR#10 CLOSED |
| 2026-08-18 | developer-experience | tui verdict distribution panel | #15 | #16 | yes | ACCEPT | +ux | e5f60718 | PR#13 MERGED |
| 2026-08-19 | compiler-parity | config schema validation gaps | #18 | NONE | no | INCONCLUSIVE | - | f6071829 | PR#16 MERGED |
| 2026-08-13 | security-adversarial | redblue evaluator entrypoint silently no-ops (npx bin-symlink isMain footgun); added classifyEntrypointResult + verify-entrypoint | #6 | #7 | yes | ACCEPT | npm test 85->96, 0 regressions | ec2052aa | rows dated 2026-08-14..2026-08-19 are unverifiable seed data (see #6); real repo had 0 dream-cycle issues/PRs before tonight |
