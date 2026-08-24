| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-13 | security-adversarial | redblue evaluator entrypoint silently no-ops (npx bin-symlink isMain footgun); added classifyEntrypointResult + verify-entrypoint | #6 | #7 | yes | ACCEPT | npm test 85->96, 0 regressions | ec2052aa | first real night (demo seed rows removed 2026-08-13; see #6) |
| 2026-08-24 | developer-experience | zero-merge learning signal never wired to real GitHub state (CLI+TUI) | #26 | #27 | yes | ACCEPT | npm test 96->101, 0 regressions; zeroMergeStreak flips true->false with real merge state | 8218bdaf | issue #6 CLOSED, PR #7 MERGED (2026-08-13 night) |
