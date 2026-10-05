# Claude Code — StreakWar

Read `AGENTS.md`, then `docs/relaunch/CLAUDE-VERKPAKKI.md` on initial setup.
On subsequent turns, read the compact status and the assigned task's handoff;
do not reload the whole repository.

- Arnar's "næsta" means exactly one ready C-task, not the entire backlog.
- Claude owns `docs/relaunch/CLAUDE_STATUS.md` and the leased result/UI paths.
- Codex owns READY/acceptance handoffs, baseline/build configuration, backend,
  Health Connect and `CONTRACTS.md`.
- C01 is a baseline REVIEW. Its handoff may explicitly use
  `Contract: NOT_REQUIRED`; lack of a future contract does not block C01.
- Validate the exact base and target commits from the handoff. Preserve other
  worktrees and branches. Never reset another agent's work.
- REVIEW means no edits to application code, configuration or dependencies.
  Save findings in the assigned result file.
- Use a single agent by default. Do not install orchestration tools or start
  swarms for this workflow.
- Return a concise Icelandic handoff with real checks and pending verification.
  A delivered review is not a production-readiness approval.
