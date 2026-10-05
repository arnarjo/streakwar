# HC-CATALOG02 — READ-ONLY review

Dispatched to the existing authorized personal-Chrome Claude cloud session.
Base `4274b2cd1ec116b00490c5772920d777c0af0725`, tree
`17ca681b9054d0f91ea619cb022132d31e605a8a`. Single agent, no source/backend
edits, deployments, credentials, dependencies, pushes or PRs. Optional report
`HC-CATALOG02-result.md` only, <=700 words. Scoped read-only repository fetch.

Read AGENTS.md, captured live schema metadata/details and reconciliation,
healthConnect.ts and its polling tests. Review Codex's proposed delta:

- Exercise conflict verification: user + source + external ID, limit(1),
  maybeSingle; recognize existing challenge copies without a multirow error.
- Steps conflict update: only steps, exact count, user/source/external ID
  filters; preserve challenge IDs; fail for zero/null count.
- Existing insertion/fan-out policy unchanged.

Codex independently reproduced multi-challenge unique collision and duplicate
global points in isolated rollback-only SQL; ownership/solo tests passed.
Review conflict swallowing, source isolation, per-type outcomes and races.
Recommend minimal coherent scoring options, including parent deletion SET NULL,
updates, deletions, rankings and achievements; do not choose the pending
privacy policy. Return concrete findings/regressions, no implementation.
