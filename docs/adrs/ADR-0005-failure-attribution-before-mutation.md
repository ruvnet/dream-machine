# ADR 0005: Attribute Failure Before Mutation

Status: Proposed
Date: 2026-09-03

## Context

Self improvement loops can waste evaluation budget and increase regression risk when they mutate memory, skills, prompts, tools, or harness behavior before identifying which stage actually failed.

## Decision

Dream Machine will treat failure attribution as a first class experimental artifact before any adaptive mutation is promoted.

The initial taxonomy is deliberately small and deterministic:

* planning
* execution
* memory retrieval
* memory write
* tool selection
* tool execution
* verification
* environment or dependency
* unknown

Each failed trajectory receives a `FailureAttributionReceipt` containing trajectory digest, evaluator digest, attributed stage, evidence references, confidence, candidate mutation surface, and authority set to none.

## Experiment

Compare four matched conditions:

1. current Dream Machine behavior
2. deterministic stage attribution
3. model based attribution
4. stage attribution plus skill level credit assignment

Hold model, tasks, seeds, evaluator, token budget, and experiment budget constant.

## Promotion gate

A new attribution mechanism advances only if it produces at least 5 absolute percentage points higher held out task success, or equal task success with at least 25 percent fewer mutation evaluations, while protected slices regress no more than 2 points.

A deterministic taxonomy wins by default when it performs within variance of a model based attribution method.

## Governance

Attribution is evidence, never execution authority. Evaluators remain immutable during a claim family. Failed and null experiments remain in the Dream Machine ledger. No autonomous merge or deployment is permitted.

## Rollback

The feature is additive. Disabling attribution returns candidate generation to the current baseline without data migration.

Tracks issue #73.
