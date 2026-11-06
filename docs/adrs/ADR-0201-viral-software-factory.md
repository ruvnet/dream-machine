# ADR 0201: Evidence driven daily software portfolio

Status: Accepted design, with live integration status recorded per sweep.
Date: 2026-10-11

## Context

The owner authorized a daily factory that can research demand, create repositories, build and optimize useful products, publish to npm or PyPI, and prepare promotion. A popular story is a lead, not proof of demand, accuracy, novelty or future adoption. Shipping low value packages every day would create maintenance cost without customer value.

## Decision

Extend the existing scheduled coordinator with a bounded discovery stage. Do not add a competing daemon. `factory-discovery.mjs` retrieves fixed public endpoints for Hacker News top stories and at most twenty story records, Hugging Face papers, arXiv, ruvnet Ruflo, MetaHarness and Autogenous releases, plus an optional Product Hunt public feed. Some repositories or feeds may be unavailable; failures stay visible in the receipt. No credentials are used. Each response has a ten second timeout and a 256 KiB limit. Redirects and destinations supplied by source content are rejected.

Records contain fetch time, response digest and source publication date where present. HN points and comments are recorded as demand signals. Research, trends, integration releases and launch evidence have separate types. Missing dates stay unknown. Only recent HN evidence can nominate one of the initial three product hypotheses. Scores are an explicit equal weight heuristic for utility, demand, feasibility, reuse and novelty. Editorial priors are not empirical measurements. The canonical serialized candidate plan is SHA256 bound; changing inputs or choices requires a new plan receipt.

The first hypotheses are README verification, agent budget receipts and MCP contract verification. README verification has the strongest feasibility prior because its failures are directly testable and it can deliver value as a local CLI. Candidate selection remains evidence dependent. No supported candidate means no publication.

## Execution and identity

Each product must register its exact repository, package identity, registry, source commit and release artifact checksum before the trusted coordinator can publish. The existing Dream Machine publisher remains narrowly scoped. Discovery JSON never authorizes execution, credential access or publication. Repository creation and publishing are separate actions performed by the already authorized coordinator.

Choose npm for a JavaScript or TypeScript product, PyPI for a Python product, and Rust bindings only when measured value warrants the extra build matrix. A UI, TUI, MCP server, Claude or Codex skill or plugin is delivered only when it improves that product. Do not invent compatibility claims or install every ecosystem library to satisfy a checklist.

MetaHarness evaluation and Autogenous proposal or selection adapters are planned integration seams until their exact available APIs are inspected and a real invocation is recorded. Apply the same principle to RVF and RVM. A JSON manifest with a `ruv://` URI is not a valid RVF container, an RVM execution receipt, or a verified resolver. Register real MCP resources with read handlers and verify the resulting protocol interaction before claiming them.

## Promotion

Produce a launch draft with actual screenshots, one measured result, installation instructions and limitations. Product Hunt is a launch channel, not proof of demand. Browser login, account identity and current submission capability must be verified before publication. Record an observed submission URL or leave promotion in draft state. Never claim a scheduled draft was posted, manufacture votes, spam discussions or promise virality.

## Gates and limits

At most one candidate per day, two optimization rounds, forty five minutes and ten USD inference. These are ceilings, not new spending authority; lower existing limits prevail. Run baseline and candidate against identical held out fixtures, record fixture and environment hashes, all raw repetitions and uncertainty. Retain negative results. Require independent review, regression tests, security checks and actual fresh registry installation. A failed optimization does not require abandoning a useful correct product, but it must not be described as an improvement.

Generate README, ADR, animated introduction and explanatory SVGs with reduced motion behavior, launch material and a reproducibility receipt. Public README image URLs must load from both GitHub and the registry. Publication completes only after registry integrity and installed CLI or API behavior are independently checked. Promotion is an additional separately verified state.

## Consequences

The coordinator can build a useful portfolio without forcing daily package churn. Retrieval is bounded and reproducible but discovery coverage is intentionally narrow. The initial ranking does not automatically invent arbitrary product ideas. Additional candidates and sources require reviewed code changes. Unavailable external services and unverified library adapters remain explicit limitations.
