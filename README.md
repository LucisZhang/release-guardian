[English](README.md) | [简体中文](README.zh-CN.md)

# Release Guardian — Sanitized Public Replay

A small, deterministic package for inspecting how release-risk evidence can be scored, bounded,
and verified before a publish decision. It exposes a fictional replay plus sanitized evaluation
tables—not the private repository or Release Guardian implementation, not a live model, and not
a reproduction of the private workflow.

## What is public here

- Four fictional change scenarios and a deterministic scoring function.
- A hash-verified evidence manifest and the preserved historical candidate manifest.
- Separate sanitized tables for funded-live evaluation, deterministic-stub evaluation, dated
  cost evidence, and consistency findings.
- Sanitized Mermaid architecture source. No screenshots are included because the source manifest
  retained them as candidates rather than approved publication assets.

The source code, raw evaluation reports, private documentation, internal identifiers, and
workstation metadata are deliberately absent.

## Run the deterministic replay

Requires Node.js 24 or newer.

```bash
npm ci
npm test
npm run verify:evidence
npm run replay -- SYN-AUTH-01
npm run replay -- SYN-SCHEMA-02
```

The authentication fixture returns risk score 25 (`medium`) with no blockers. The destructive
schema fixture returns risk score 90 (`critical`) with rollback, monitoring, and missing-evidence
blockers. These are fixed synthetic rule outputs. They neither call a model nor reproduce the
private LangGraph workflow.

## Evidence that must stay paired

**Funded-live evidence (measured, 2026-07-11; `evidence/data/evaluation-live.csv`): all eight
aggregate gates pass, while 30/44 scenarios are flagged in the strict all-trials outcome view.** The aggregate result is not a
claim that all scenarios pass. The table covers 132 graph runs (44 scenarios × 3 trials), and
the strict view also records one trajectory failure.

**Deterministic-stub evidence (no API keys or GPU; `evidence/data/evaluation-stub.csv`): all
eight aggregate gates pass, while 15/44 scenarios are flagged in the strict all-trials view.** Stub metrics are not funded-live
performance; stub proxy accounting is not API spend or live latency.

The two modes are separate evidence classes and cannot substitute for one another. The replay in
this repository is a third, presentation-layer artifact and is not evidence that either
evaluation can be rerun here.

## Cost evidence labels

`evidence/data/cost-evidence.csv` is a dated 2026-07-08 pre-migration snapshot. Its rows retain
their original classes:

- **Measured:** routed versus all-strong cost over 12 runs was about 0.25% lower at identical
  token counts—not 25%.
- **Estimated:** one evidence-prompt pruning example reduced characters by 49.516% with token
  counts explicitly estimated.
- **Projected:** cache savings depend on the stated 10% cached-input billing assumption.
- **Modeled:** the ReAct comparator is derived from observed trajectory lengths, not measured as
  an executed baseline.

None of these dated rows is a current provider-price claim or a causal performance estimate.

## Integrity and boundaries

`npm run verify:evidence` checks every copied asset against `evidence/manifest.json`, verifies
live/stub separation and residual disclosure, and confirms that the historical source manifest
remains byte-identical. The publication record is additive: it does not rewrite the historical
manifest's candidate status.

This repository is a static evidence snapshot published under the scoped 2026-07-22 publication
record in `evidence/manifest.json`. It is not an actively maintained software project, and no
release cadence, support, or contribution program is implied.

This package does not establish local reproduction, repository-default model alignment,
post-migration full-suite results, production readiness, or complete private-source lineage.
Private raw artifacts remain withheld; their hashes are provenance anchors, not distributed
files. No open-source license is granted; no permission is inferred from publication.

## Repository map

```text
release-guardian/
├── README.md / README.zh-CN.md
├── docs/architecture.mmd
├── evidence/
│   ├── manifest.json
│   ├── source-manifest.json
│   └── data/{evaluation-live,evaluation-stub,cost-evidence,findings}.csv
├── replay/synthetic-scenarios.json
├── scripts/{replay,verify-evidence}.mjs
└── tests/replay.test.mjs
```

## Rights

No open-source license is granted. All rights are reserved pending an explicit license decision.
