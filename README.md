# Ralph JIRA - AI-Powered Project Management

A local-first project management webapp with autonomous AI task execution. Manage sprints and tasks through a Kanban interface, then let AI autonomously implement them.

## Features

- **Kanban Board**: Drag-and-drop task management across customizable columns
- **Sprint Planning**: Organize tasks into sprints with goals and deadlines
- **AI Assistant**: Generate tasks, improve acceptance criteria, prioritize work
- **Autonomous Runner**: AI executes tasks automatically, running tests and updating status
- **Local-First**: All data stored as JSON files in your repository
- **File Tracking**: View progress logs and planning artifacts
- **Docker Support**: Run webapp and AI runner in containers

## Quick Start

### Prerequisites

- Node.js 20+
- npm or compatible package manager
- OpenAI API key

### Installation

1. Clone or navigate to your project:
```bash
cd your-project
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
```

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:3000

## Usage

### Web Application

The webapp provides several interfaces:

- **Dashboard** (`/`): Overview of all boards and quick navigation
- **Board View** (`/board/[id]`): Kanban interface for task management
- **Settings** (`/settings`): Configure project and AI preferences
- **Files** (`/files`): View planning artifacts and progress logs
- **Assistant** (`/assistant`): AI-powered task generation

#### Managing Tasks

1. Click "New Task" to create a task
2. Fill in description, priority, estimate, and acceptance steps
3. Drag tasks between columns (Backlog → To Do → In Progress → Review → Done)
4. Click a task to edit details or use AI actions:
   - Improve acceptance steps
   - Add edge cases
   - Estimate complexity
   - Suggest files to modify

#### AI Actions

On boards:
- **Generate Tasks**: Describe a feature, AI creates actionable tasks
- **Prioritize**: AI reorders tasks based on criteria
- **Split Sprints**: AI organizes tasks into logical sprints
- **Improve Acceptance**: AI enhances acceptance criteria

### AI Runner (Autonomous Execution)

The runner autonomously executes tasks from your active board and now runs entirely through the web experience.

#### Run Locally
- Open any board and click **Run AI Loop** to enqueue a background job
- Or send `POST /api/runs/start?projectId=current-workspace` with `{ "boardId": "prd" }`
- Monitor progress from the run drawer on the board or the `/runs` history page

#### How It Works

1. Persist run metadata to `plans/runs/<runId>.json` (board, sandbox path, status, etc.)
2. Clone/copy the repo into `.pm/sandboxes/<runId>` and copy `plans/settings.json`
3. Filter the active board down to only `todo` + `in_progress` tasks for the sandbox PRD
4. Run setup commands (`settings.automation.setup`, default `npm ci`)
5. Loop for up to `maxIterations`:
   - Pick the next task (prefers `in_progress`, then `todo`)
   - Generate implementation notes with the Vercel AI SDK
   - Execute `settings.howToTest.commands` inside the sandbox
   - Update sandbox `plans/prd.json` + `progress.txt`, persist run state, check for cancellation
6. Sync task results back to the root PRD (passes → `review`, others → `in_progress`), copy logs to `plans/runs/<runId>.progress.txt`, and append a summary to root `progress.txt`

#### Agent CLI requirements

Install either the `claude` CLI or the `opencode` CLI and ensure it is available on the server that runs the loop:

- `RUN_LOOP_AGENT` (default: `claude`) chooses which CLI to execute each iteration.
- `RUN_LOOP_AGENT_BIN` lets you point to a custom binary name or path (optional).
- `RUN_LOOP_AGENT_EXTRA_ARGS` accepts a JSON array of additional CLI flags (optional).
- `RUN_LOOP_CLAUDE_PERMISSION_MODE` overrides the claude permission mode (defaults to `acceptEdits`).

The runner executes the agent inside the sandbox directory so the CLI can freely edit files, run commands, and update `plans/prd.json` / `progress.txt`. The loop stops when the agent prints `<promise>COMPLETE</promise>` or hits the iteration limit/cancellation flag.

#### Safety Features

- Sandbox-only modifications until the sync step
- Command allowlist (npm, test, lint, typecheck, build)
- Cancellation flag (`plans/runs/<runId>.cancel`) polled between every major step
- Atomic writes for boards/settings/run records
- Append-only progress logs (no hidden reasoning)

#### Current Implementation Note

The loop is fully wired up for planning, testing, logging, and syncing. Automated code edits still need tool integration (AST/diff generation) and are marked as TODO, but the end-to-end orchestration now runs exactly as described above.

### Docker Usage

#### Run Webapp

```bash
# Build and start
docker compose up web

# Access at http://localhost:3000
```

#### Runner in Docker Mode

```bash
# Set RUN_LOOP_EXECUTOR=docker for the web container
# Then click "Run AI Loop" (the API will spawn `docker compose run runner node tools/runner/run-loop.mjs ...` automatically)
```

#### Environment Variables

Create `.env` file:
```env
OPENAI_API_KEY=sk-...
```

Docker Compose automatically loads this file.


## Architecture

### Directory Structure

```
ralph-jira/
├── plans/                  # Planning artifacts (source of truth)
│   ├── prd.json           # Active board
│   ├── settings.json      # Project configuration
│   └── runs/              # Execution logs
├── progress.txt           # Append-only progress log
├── src/
│   ├── app/               # Next.js pages and API routes
│   ├── components/        # React components
│   └── lib/
│       ├── schemas.ts     # Zod schemas for validation
│       └── storage/       # Storage abstraction layer
├── tools/
│   └── runner/
│       └── run-loop.mjs  # Background AI loop script
├── .pm/sandboxes/        # Gitignored sandboxes created per run
├── Dockerfile            # Web app container
├── Dockerfile.runner     # Runner container
├── docker-compose.yml    # Orchestration
```


### Storage Adapter

The storage layer uses an **adapter pattern** for flexibility:

- **Interface**: `StorageAdapter` defines operations (read/write boards, settings, logs)
- **Implementation**: `LocalFilesystemAdapter` uses Node.js `fs/promises`
- **Features**:
  - Atomic writes (temp file → rename)
  - JSON validation with Zod schemas
  - Pretty printing (2-space indent)
  - Can be swapped for cloud storage later

All file I/O happens server-side (API routes, runner) for security.

### Data Schemas

Defined in `src/lib/schemas.ts` using Zod:

- **Task**: Preserves original fields (`category`, `description`, `steps`, `passes`) + extends with Kanban fields (`status`, `priority`, `estimate`, `tags`, etc.)
- **Board**: Sprint/board with columns, tasks, metadata
- **ProjectSettings**: Tech stack, coding style, test/run commands, AI preferences
- **RunLog**: Execution history with task attempts and results

### AI Endpoints

API routes in `src/app/api/ai/`:

- **`/api/ai/board`**: Board-level actions (generate tasks, prioritize, split sprints)
- **`/api/ai/task`**: Task-level actions (improve steps, add edge cases, estimate)

Use Vercel AI SDK v6 with structured outputs (`generateObject`, `generateText`).

### Runner Loop Architecture

- Runs from `tools/runner/run-loop.mjs`, triggered by `POST /api/runs/start` (via the "Run AI Loop" button).
- Each run writes a control file to `plans/runs/<runId>.json` plus sandbox logs under `.pm/sandboxes/<runId>/`.
- The runner clones/copies the repo into the sandbox, copies settings/PRD, runs setup (`settings.automation.setup`), then iterates:
  1. Pick the highest-priority task (in_progress → todo) from the sandbox PRD
  2. Call Vercel AI SDK with the system loop prompt for planning notes
  3. Execute `settings.howToTest.commands` inside the sandbox
  4. Update sandbox `plans/prd.json` + `progress.txt`, persist run state, and continue until completion/cancel/max iterations
- On stop it syncs relevant task fields back into `plans/prd.json`, moves passing tasks to `review`, appends a summary to root `progress.txt`, and archives the sandbox log to `plans/runs/<runId>.progress.txt`.
- Two execution modes exist: local (default) and Docker (`RUN_LOOP_EXECUTOR=docker`), both controlled via the same run record so the UI can poll status/log tails in near real time.

## Configuration

### Project Settings

Edit via UI (`/settings`) or directly in `plans/settings.json`:

```json
{
  "projectName": "Your Project",
  "techStack": ["TypeScript", "React", "Next.js"],
  "codingStyle": "Functional, typed, small functions",
  "howToTest": {
    "commands": ["npm test", "npm run typecheck"],
    "notes": "Run tests after each change"
  },
  "howToRun": {
    "commands": ["npm run dev"],
    "notes": "Dev server on port 3000"
  },
  "aiPreferences": {
    "defaultModel": "gpt-4-turbo-preview",
    "provider": "openai",
    "guardrails": [...]
  },
  "automation": {
    "setup": ["npm ci"],
    "maxIterations": 5
  }
}
```

### Board Structure

Active board (`plans/prd.json`):

```json
{
  "id": "initial-sprint",
  "name": "Sprint Name",
  "goal": "Sprint goal",
  "status": "active",
  "columns": [
    { "id": "backlog", "name": "Backlog", "order": 0 },
    { "id": "todo", "name": "To Do", "order": 1 },
    ...
  ],
  "tasks": [
    {
      "id": "task-001",
      "description": "User can create a task",
      "category": "functional",
      "steps": ["Navigate to board", "Click new task", ...],
      "passes": false,
      "status": "todo",
      "priority": "high",
      "estimate": 3,
      "tags": ["ui", "crud"],
      ...
    }
  ]
}
```

## Development

### Build for Production

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Environment Variables

Required:
- `OPENAI_API_KEY`: Your OpenAI API key

Optional:
- `DEFAULT_AI_MODEL`: Override default AI model (default: from settings)
- `RUN_LOOP_EXECUTOR`: Set to `docker` to spawn the loop via `docker compose run runner`
- `RUN_LOOP_AGENT`: Choose `claude` (default) or `opencode` as the CLI agent
- `RUN_LOOP_AGENT_BIN`: Override the CLI binary name/path for the agent
- `RUN_LOOP_AGENT_EXTRA_ARGS`: JSON array of extra flags passed to the agent CLI
- `RUN_LOOP_CLAUDE_PERMISSION_MODE`: Customize Claude's `--permission-mode` (defaults to `acceptEdits`)

## Deployment

### Vercel (Web Only)

1. Connect repository to Vercel
2. Add `OPENAI_API_KEY` environment variable
3. Deploy

Note: AI runner cannot run on Vercel (requires long-running process). Use Docker for runner.

### Docker on VPS/Cloud

1. Install Docker and Docker Compose
2. Clone repository
3. Create `.env` with `OPENAI_API_KEY`
4. Run:
```bash
docker compose up -d web
```

For automated runs, set up cron or systemd timer:
```bash
# Cron example (every 4 hours)
0 */4 * * * cd /path/to/ralph-jira && docker compose run --rm runner
```

## Troubleshooting

### Runner fails to start

- Check `OPENAI_API_KEY` is set
- Ensure `plans/prd.json` exists and is valid JSON
- Check `plans/settings.json` exists

### Tasks not updating

- Verify board ID is correct (`prd` for active board)
- Check browser console for API errors
- Ensure JSON files aren't corrupted

### Tests failing in runner

- Verify test commands in settings are correct
- Check commands work manually: `npm test`
- Review `progress.txt` for detailed error output

## Contributing

This is a generated single-shot implementation. To extend:

1. **Add new storage backends**: Implement `StorageAdapter` interface
2. **Enhance runner**: Add code generation tools to complete file modification
3. **Add authentication**: Protect routes if deploying publicly
4. **Custom columns**: Edit board column definitions
5. **Multiple projects**: Add project switching to UI

## Architecture Decisions

### Why Local-First?

- **Transparency**: All data is readable JSON in your repo
- **Version Control**: Track planning changes with git
- **No Lock-In**: Easily migrate or integrate with other tools
- **Simplicity**: No database setup required

### Why Append-Only Progress Log?

- **Auditability**: Full history of AI actions
- **Debugging**: Trace what happened during autonomous runs
- **Trust**: See AI's "thinking" and decisions

### Assumptions Made

- Single active board per project (can create multiple but runner uses `prd.json`)
- Tests are non-destructive and idempotent
- Tasks are independent (no explicit dependency graph)
- Team uses story points for estimation
- Git repository is already initialized

## License

MIT (or your project's license)

## Roadmap (Future Enhancements)

- [ ] Complete file modification in runner (integrate code generation)
- [ ] Task dependencies and blockers
- [ ] Sprint metrics (velocity, burndown charts)
- [ ] Multi-project support
- [ ] Real-time collaboration
- [ ] GitHub integration (sync issues, PRs)
- [ ] Custom AI model support (local LLMs)
- [ ] Test result parsing and visualization
- [ ] Rollback on failed tasks

---

Built with Next.js, Tailwind CSS, shadcn/ui, and Vercel AI SDK.
