# AI Run Loop Reference

This document explains how the background runner works end-to-end, how to operate it locally or in Docker, and what assumptions were made while implementing the first version.

## Lifecycle Recap

1. **Create run record** – The web API (`POST /api/runs/start`) writes `plans/runs/<runId>.json` with board metadata, sandbox paths, iteration limits, PID, etc. The UI immediately starts polling this file.
2. **Spawn runner** – Locally we execute `node tools/runner/run-loop.mjs --runId <id> --projectPath <root>`. If `RUN_LOOP_EXECUTOR=docker` the API shells out to `docker compose run runner node tools/runner/run-loop.mjs --runId <id> --projectPath /workspace`.
3. **Collect branch name** – The Run AI dialog now prompts for the git branch that will back the worktree (e.g. `landing-page-run-3`). It pre-fills a kebab-case version of the board name plus an incrementing counter, and this value is stored in the run record so humans can review the branch later.
4. **Sandbox checkout** – The script creates a git worktree at `.pm/sandboxes/<runId>` on the operator-provided branch so each run operates from a clean copy of the repo without duplicating object data.
5. **Sandbox plans** – Copy `plans/settings.json` and create a sandbox `plans/prd.json` that only includes `todo` and `in_progress` tasks. Tasks keep their original IDs so the sync step knows what to update in the root PRD.
6. **Setup** – Run the commands configured in `settings.automation.setup`. If no commands are provided, the runner skips this step. Cancellation is checked between each command.
7. **Iterate** – Up to `maxIterations` times:
   - Launch the configured CLI agent (`claude` or `opencode`) inside the sandbox with the shared loop prompt (`@plans/prd.json @progress.txt ...`).
   - Let the agent decide which task to tackle, edit files, run tests, and log its reasoning. The runner captures stdout/stderr and appends it to the sandbox `progress.txt`.
   - Stop immediately if the agent prints `<promise>COMPLETE</promise>`, otherwise continue until cancellation or iteration limit.
   - Persist the sandbox PRD, sandbox log, and run record between iterations.
8. **Sync & archive** – After the loop stops (completed, canceled, max iterations, or error) the script:
   - Copies sandbox task fields (passes, status, failure notes, lastRun) back into the root `plans/prd.json`.
   - Forces passing tasks to `status=review`, everything else to `status=in_progress` per spec.
   - Copies `.pm/sandboxes/<runId>/progress.txt` to `plans/runs/<runId>.progress.txt` for historical viewing.
   - Appends a short summary to the root `progress.txt`.
   - Updates `plans/runs/<runId>.json` with `finishedAt`, `status`, `reason`, `errors`, etc.
   - Removes the git worktree sandbox (only if the run branch is clean and fully pushed) so `.pm/sandboxes` stays small and ephemeral while leaving the operator-provided branch available for review/merge.

## Operating Modes

| Mode   | How to enable | Spawned command |
|--------|---------------|-----------------|
| Local  | default       | `node tools/runner/run-loop.mjs --runId <id> --projectPath <abs-path>` |
| Docker | Set `RUN_LOOP_EXECUTOR=docker` in the web container env | `docker compose run runner node tools/runner/run-loop.mjs --runId <id> --projectPath /workspace` |

Notes:
- The Docker runner image now idles (`tail -f /dev/null`) until the web container launches it via `docker compose run runner …`.
- Both modes share the same run record and sandbox directories because the repo is mounted into the runner container at `/workspace`.

## File Layout

```
plans/
  prd.json            # Active board (source of truth)
  settings.json       # Project + automation settings
  runs/
    run-*.json        # Run records (UI + runner source of truth)
    run-*.progress.txt# Archived sandbox logs
.pm/
  sandboxes/
    run-*/            # Gitignored worktrees (ephemeral sandboxes)
        plans/prd.json
        plans/settings.json
        progress.txt  # Live log tail streamed to UI
```

## Key Assumptions

- **Git worktrees required.** The runner shells out to `git worktree add/remove` for sandbox management, so git must be installed wherever runs execute.
- **Run branches must be pushed.** Each sandbox runs on `run-<runId>`; the runner refuses to delete the worktree if there are uncommitted files or commits that haven’t been pushed to `origin`.
- **Agent CLI available.** Either the `claude` or `opencode` CLI is installed on the host (or inside the Docker runner) and authenticated so it can edit files and run commands.
- **Project settings define automation.** We introduced `settings.automation` for setup commands, agent preferences, and iteration defaults. If `automation.setup` is omitted, the setup phase is skipped; `maxIterations` still defaults to 5.
- **Agent handles tests/commits.** The runner itself does not execute `settings.howToTest.commands`; the agent is expected to follow the loop prompt and run `npm run typecheck`, `npm test`, commits, etc. as needed.
- **Sandbox state is disposable.** Sandboxes are not cleaned up automatically so you can inspect them after a run. Delete `.pm/sandboxes/<runId>` manually if needed.
- **Run records are append-only.** The UI and runner never mutate past runs except for the current one being processed to keep history auditable.
- **Cancellation granularity.** We check for `plans/runs/<runId>.cancel` between setup commands and before every agent iteration. Long-running commands (like `npm ci` or the agent invocation) cannot be interrupted mid-process.

## Agent configuration

- `settings.automation.agent.name` selects the CLI (`claude` or `opencode`).
- `settings.automation.agent.model` supplies the model identifier (claude defaults to `opus-4.5`).
- `settings.automation.agent.bin`, `permissionMode`, and `extraArgs` customize the CLI invocation on a per-project basis.
- `RUN_LOOP_AGENT`, `RUN_LOOP_AGENT_BIN`, `RUN_LOOP_AGENT_MODEL`, `RUN_LOOP_AGENT_EXTRA_ARGS`, and `RUN_LOOP_CLAUDE_PERMISSION_MODE` override the settings file when present.
- `RUN_LOOP_EXECUTOR` remains available to switch between local and Docker execution modes.

## Triggering & Monitoring

- **Via UI** – Click **Run AI Loop** on the board page. The drawer shows status, iteration counts, last message, and a 120-line log tail. Cancel directly from the drawer.
- **Via API** – `POST /api/runs/start?projectId=<id>` with `{ "boardId": "prd", "maxIterations": 5 }`. Poll `/api/runs/<runId>?tail=200` for status/log output or list everything via `GET /api/runs`.
- **Run history** – `/runs` lists every run and links to `/runs/<runId>` for deeper inspection, cancellation, and log review.

## Cancellation Flow

1. UI calls `POST /api/runs/<runId>/cancel`.
2. API writes `plans/runs/<runId>.cancel` and updates the run record with a "Cancellation requested" message.
3. Runner sees the flag, sets status to `canceled`, syncs current sandbox state, and finalizes logs.

## Limitations & Next Steps

- **Code changes** – Future work should integrate diff tooling so AI suggestions can be applied automatically.
- **Task prioritization** – Currently based purely on column order (in_progress → todo). Add more sophisticated heuristics later (priority score, tags, etc.).
- **Streaming logs** – UI polls every 4 seconds. Converting to Server-Sent Events or WebSocket streaming would provide lower-latency feedback.
- **Sandbox cleanup** – Consider pruning `.pm/sandboxes` after syncing to keep disk usage low.

Feel free to expand this file as the loop gains capabilities.
