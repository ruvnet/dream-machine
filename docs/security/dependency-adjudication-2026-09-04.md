# Dependency adjudication, 2026-09-04

**Status:** Baseline evidence for the architecture pull request

**Superseded operational disposition:** The subsequent PR 75 review replaces
this dependency graph and repairs the independent typecheck. Preserve this
record as historical evidence, not current clearance or a current Node 20
recommendation. See the [review report](../reviews/2026-09-05-pr75-review.md)
for the replacement lockfile, exact commands, scans, and remaining P1 gates.

**Commit inspected:** `7933c3599abe22df5290f4609d1f93f598feb3de`

**Tool scope:** Ruflo 3.25.6 deep dependency scan, Ruflo CVE list,
`npm audit`, the installed dependency tree, repository test configuration, and
upstream security advisories.

This record adjudicates every critical and high candidate from the Ruflo scan.
It is not a release waiver. A finding classified as unreachable remains true
only while the recorded preconditions remain absent.

## 1. Observed configuration

1. Tests execute as `vitest run` without Vitest UI, Browser Mode, an API host,
   or a network listener.
2. `@vitest/browser` and `@vitest/ui` are optional and are not installed.
3. Vite and esbuild are development-only transitive dependencies. The repository
   has no `vite --host`, exposed Vite server, or esbuild `serve` command.
4. The inspected environment is Linux. The planned development host is macOS.
5. `npm audit --omit=dev --json` completed on 2026-09-04 with zero production
   vulnerabilities across 13 production dependencies. The full audit did not
   complete within 45 seconds and is not used as evidence of absence.
6. Ruflo's dedicated dependency scan and separate CVE listing both reported no
   known vulnerability. Those results conflict with the eight candidates from
   its deep all-type scan and with verified upstream ranges, so neither is
   accepted as clearance.
7. Ruflo STRIDE scanning reported one medium non-HTTPS URL in vendored Three.js.
   The exact value is the inert DOM namespace identifier
   `http://www.w3.org/1999/xhtml`, not a network request or secret sink. This is
   a confirmed scanner false positive; changing the standard namespace would
   corrupt vendored code.

## 2. Ruflo candidate disposition

| Ruflo candidate | Scanner severity | Adjudication | Reachability and required action |
|---|---:|---|---|
| `vitest@2.1.9` | Critical | Confirmed affected | GHSA-5xrq-8626-4rwp affects this version, but its vulnerable UI or API path is not enabled. GHSA-82fw-gwwq-j7x9 also affects this version and requires a reachable development-server WebSocket or Browser Mode RPC. Prohibit those modes and upgrade before any browser or API server work. |
| `@vitest/coverage-v8@2.1.9` | Critical | Indirect attribution | No reviewed advisory names this package directly. It pins the affected `vitest@2.1.9`; apply the same prohibition and upgrade it in lockstep with Vitest. |
| `vite@5.4.21` | High | Confirmed affected | GHSA-fx2h-pf6j-xcff affects this version, but exploitation requires an explicitly exposed development server plus Windows or NTFS path semantics. Neither exists in the recorded workflow. Upgrade before any Vite server or Windows build worker is allowed. |
| `@vitest/mocker@2.1.9` | Medium | Confirmed affected | GHSA-82fw-gwwq-j7x9 affects this version. Its development-server or Browser Mode registration path is absent. Upgrade before enabling either path. |
| `esbuild@0.21.5` | Medium | Confirmed affected | GHSA-67mh-4wv8-2f99 affects esbuild's `serve` feature. The repository uses transformation only. Prohibit `serve` and upgrade to at least 0.25.0 through the parent toolchain. |
| `vite-node@2.1.9` | Medium | Transitive attribution | No reviewed advisory names this package directly. Its installed Vite dependency is affected and receives the Vite disposition. |
| `@eslint/plugin-kit@0.2.8` | Low | Confirmed affected and reachable | GHSA-xffm-g5w8-qvg7 affects configuration-comment parsing. Pull-request linting can process attacker-controlled source, so upgrade to a dependency graph containing `@eslint/plugin-kit` 0.3.4 or later. Apply CI time and memory limits until then. |
| `eslint@9.15.0` | Low | Transitive attribution | No reviewed advisory names this version directly. Its installed plugin-kit dependency is affected and receives the plugin-kit disposition. |

The critical and high candidates are not reachable through the current commands,
are absent from the production dependency set, and therefore do not block this
documentation-only pull request. They do block activating any Vitest UI,
Vitest API, Browser Mode, network-exposed Vite development server, Windows build
worker, or esbuild server with the current lockfile.

## 3. Mandatory remediation gate

Phase P1 must land a dedicated toolchain pull request before runtime or WebUI
implementation starts. It must:

1. Move the development baseline from Node.js 18 to Node.js 20 or newer because
   the first currently patched Vitest line requires Node.js 20.
2. Upgrade `vitest` and `@vitest/coverage-v8` to at least 4.1.11, Vite to a line
   containing the GHSA-fx2h-pf6j-xcff fix, and esbuild to at least 0.25.0.
3. Upgrade ESLint so the resolved `@eslint/plugin-kit` is at least 0.3.4.
4. Regenerate the lockfile, run production and full dependency audits, and rerun
   build, tests, lint, typecheck, secret, source, dependency, and license scans.
5. Add a repository check that rejects Browser Mode, Vitest UI, non-loopback
   test APIs, `vite --host`, and esbuild `serve` unless a later ADR introduces a
   separately authenticated and sandboxed development-service profile.
6. Produce an SBOM and record every remaining critical or high finding with an
   advisory identifier, affected range, call path, owner, deadline, and review.

The gate passes only with zero unresolved critical or high production finding,
zero reachable critical or high development finding, and an explicit human
review of any lower-severity residual risk.

## 4. Advisory evidence

1. [Vitest UI arbitrary file read and execution, GHSA-5xrq-8626-4rwp](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp)
2. [Vitest mock redirect path traversal, GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)
3. [Vitest Browser Mode provider command bypass, GHSA-p63j-vcc4-9vmv](https://github.com/vitest-dev/vitest/security/advisories/GHSA-p63j-vcc4-9vmv)
4. [Vitest Browser Mode CDP exposure, GHSA-g8mr-85jm-7xhm](https://github.com/vitest-dev/vitest/security/advisories/GHSA-g8mr-85jm-7xhm)
5. [Vitest Browser Mode inline script injection, GHSA-2h32-95rg-cppp](https://github.com/vitest-dev/vitest/security/advisories/GHSA-2h32-95rg-cppp)
6. [Vite Windows deny-list bypass, GHSA-fx2h-pf6j-xcff](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)
7. [esbuild development-server request exposure, GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)
8. [ESLint plugin-kit ReDoS, GHSA-xffm-g5w8-qvg7](https://github.com/eslint/rewrite/security/advisories/GHSA-xffm-g5w8-qvg7)

## 5. Decision

Accept the current development-only dependency risk for this architecture and
contract pull request. Do not accept it for a runnable edge, browser, WebUI, or
network service. P1 owns remediation and blocks those capabilities until the
mandatory gate passes.
