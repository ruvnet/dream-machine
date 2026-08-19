| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-13 | security-adversarial | redblue evaluator entrypoint silently no-ops (npx bin-symlink isMain footgun); added classifyEntrypointResult + verify-entrypoint | #6 | #7 | yes | ACCEPT | npm test 85->96, 0 regressions | ec2052aa | first real night (demo seed rows removed 2026-08-13; see #6) |
| 2026-08-19 | developer-experience | tui pad() used raw string length not display width; fixed with Unicode-aware displayWidth/pad, preserved literal newlines in truncation per adversarial critique | #20 | #21 | yes | ACCEPT | npm test 96->103, 0 regressions | 25a4b37f | #7:MERGED #9:OPEN #11:OPEN #15:OPEN #17:OPEN #19:OPEN |
