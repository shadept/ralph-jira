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

The runner autonomously executes tasks from your active board.

#### Run Locally

```bash
# Run with defaults (active board, max 25 iterations)
npm run pm:run

# Specify options
npm run pm:run -- --board prd --max-iterations 10

# See all options
npm run pm:run:help
```

#### How It Works

1. Loads active board (`plans/prd.json`) and project settings
2. Selects next task (priority: in_progress → todo → backlog)
3. For each task:
   - Uses AI to create implementation plan
   - (In production: modifies files based on plan)
   - Runs test commands from settings
   - Updates task status (pass → done, fail → review)
   - Appends detailed log to `progress.txt`
4. Continues until all tasks done or max iterations reached
5. Saves run summary to `plans/runs/`

#### Safety Features

The runner enforces guardrails:
- No file deletions without explicit requirement
- Shell commands restricted to: package managers, test runners, typecheck, lint
- No unknown network requests
- Respects `.gitignore`
- All changes logged

#### Current Implementation Note

The runner is **fully scaffolded** with:
- Task selection logic
- AI planning generation
- Test execution
- Status updates and logging

**File modification capability** is outlined but requires integration of code generation tools (marked with TODO). The scaffold demonstrates the complete autonomous loop architecture.

### Docker Usage

#### Run Webapp

```bash
# Build and start
docker compose up web

# Access at http://localhost:3000
```

#### Run AI Runner in Docker

```bash
# One-time run
docker compose run runner

# With custom options
docker compose run runner npm run pm:run -- --max-iterations 5
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
├── runner/
│   └── index.ts          # Autonomous AI execution engine
├── Dockerfile            # Web app container
├── Dockerfile.runner     # Runner container
└── docker-compose.yml    # Orchestration
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

The autonomous runner (`runner/index.ts`):

1. **Initialization**: Load board and settings
2. **Task Selection**: Priority-based queue (in_progress > todo > backlog)
3. **Execution**: For each task:
   - AI generates implementation plan
   - (Planned) Apply code changes
   - Run test commands
   - Update task status and log
4. **Termination**: All tasks done or max iterations
5. **Logging**: Detailed progress to `progress.txt` and structured run log

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
