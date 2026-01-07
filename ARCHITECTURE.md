# Architecture Documentation

## System Overview

Ralph JIRA is a local-first project management system with autonomous AI task execution. It consists of three main components:

1. **Next.js Web Application**: User interface for managing boards, tasks, and settings
2. **AI Integration Layer**: API routes that use Vercel AI SDK v6 for intelligent operations
3. **Autonomous Runner**: CLI tool that executes tasks automatically

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5
- **UI Framework**: Tailwind CSS 4, shadcn/ui components
- **Drag & Drop**: @dnd-kit libraries
- **AI Integration**: Vercel AI SDK v6, @ai-sdk/openai
- **Validation**: Zod v4
- **Date Handling**: date-fns
- **Notifications**: Sonner (toast notifications)
- **Runtime**: Node.js 20+ with tsx for TypeScript execution

## Directory Structure

```
ralph-jira/
├── plans/                    # Source of truth (JSON files)
│   ├── prd.json             # Active board
│   ├── settings.json        # Project configuration
│   └── runs/                # Execution logs (JSON)
├── progress.txt             # Append-only text log
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   │   ├── boards/      # Board CRUD operations
│   │   │   ├── settings/    # Settings management
│   │   │   ├── progress/    # Progress log access
│   │   │   └── ai/          # AI-powered actions
│   │   │       ├── board/   # Board-level AI actions
│   │   │       └── task/    # Task-level AI actions
│   │   ├── board/[id]/      # Dynamic board view
│   │   ├── settings/        # Settings editor
│   │   ├── files/           # Artifact viewer
│   │   ├── assistant/       # AI assistant interface
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Dashboard
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── kanban-board.tsx
│   │   ├── kanban-column.tsx
│   │   ├── task-card.tsx
│   │   └── task-editor-dialog.tsx
│   └── lib/
│       ├── schemas.ts       # Zod validation schemas
│       ├── utils.ts         # Utility functions
│       └── storage/         # Storage abstraction
│           ├── interface.ts
│           ├── local-filesystem.ts
│           └── index.ts
├── runner/
│   ├── index.ts             # Autonomous execution engine
│   └── package.json         # Runner metadata
├── scripts/
│   └── setup.sh             # Setup automation
├── Dockerfile               # Web app container
├── Dockerfile.runner        # Runner container
├── docker-compose.yml       # Orchestration
└── [Next.js config files]
```

## Data Layer

### Storage Adapter Pattern

The storage layer uses an adapter pattern for flexibility and future extensibility.

**Interface** (`StorageAdapter`):
- Defines contract for all storage operations
- Methods for boards, settings, logs, and files
- All methods return Promises (async)

**Implementation** (`LocalFilesystemAdapter`):
- Uses Node.js `fs/promises` for file I/O
- Implements atomic writes (write to temp → rename)
- Validates all data with Zod schemas
- Pretty-prints JSON (2-space indentation)
- Creates directories as needed

**Benefits**:
- Easy to swap implementations (e.g., cloud storage, database)
- Testable (mock adapter for unit tests)
- Type-safe (enforced by TypeScript)
- Single source of truth for storage logic

### Data Schemas

All data structures are defined with Zod schemas in `src/lib/schemas.ts`:

#### Task Schema
Preserves original required fields and extends with Kanban features:

```typescript
{
  // Original (preserved for compatibility)
  category: string
  description: string
  steps: string[]
  passes: boolean

  // Extended for Kanban
  id: string
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimate?: number
  createdAt: string (ISO)
  updatedAt: string (ISO)
  tags: string[]
  assignee?: string
  filesTouched: string[]
  lastRun?: string (ISO)
  failureNotes?: string
}
```

#### Board Schema
```typescript
{
  id: string
  name: string
  goal: string
  deadline: string (ISO)
  status: 'planned' | 'active' | 'completed' | 'archived'
  columns: Column[]
  tasks: Task[]
  createdAt: string (ISO)
  updatedAt: string (ISO)
  metrics?: { velocity, completed, total }
}
```

#### ProjectSettings Schema
```typescript
{
  projectName: string
  projectDescription: string
  techStack: string[]
  codingStyle: string
  howToTest: { commands: string[], notes: string }
  howToRun: { commands: string[], notes: string }
  aiPreferences: {
    defaultModel: string
    provider: string
    temperature?: number
    maxTokens?: number
    guardrails: string[]
  }
  repoConventions: {
    folders: Record<string, string>
    naming: string
    commitStyle?: string
  }
}
```

## API Routes

### Board Management (`/api/boards`)

**GET `/api/boards`**
- Lists all boards
- Returns: `{ boards: Board[] }`

**POST `/api/boards`**
- Creates new board
- Body: Board object
- Returns: `{ success: true, board: Board }`

**GET `/api/boards/[id]`**
- Fetches single board
- Returns: `{ board: Board }`

**PUT `/api/boards/[id]`**
- Updates board (partial updates supported)
- Body: Partial<Board>
- Returns: `{ success: true, board: Board }`

**DELETE `/api/boards/[id]`**
- Deletes board (except active board)
- Returns: `{ success: true }`

### Settings (`/api/settings`)

**GET `/api/settings`**
- Fetches project settings
- Returns: `{ settings: ProjectSettings }`

**PUT `/api/settings`**
- Updates settings
- Body: ProjectSettings
- Returns: `{ success: true, settings: ProjectSettings }`

### Progress Log (`/api/progress`)

**GET `/api/progress`**
- Reads progress.txt
- Returns: `{ progress: string }`

**POST `/api/progress`**
- Appends entry
- Body: `{ entry: string }`
- Returns: `{ success: true }`

### AI Actions (`/api/ai/board`, `/api/ai/task`)

**POST `/api/ai/board`**
- Board-level AI actions
- Body: `{ action: string, boardId: string, data: any }`
- Actions:
  - `generate-tasks`: Create tasks from description
  - `prioritize`: Reorder by criteria
  - `split-sprints`: Organize into sprints
  - `improve-acceptance`: Enhance criteria

**POST `/api/ai/task`**
- Task-level AI actions
- Body: `{ action: string, boardId: string, taskId: string, data: any }`
- Actions:
  - `improve-steps`: Better acceptance criteria
  - `add-edge-cases`: Identify edge cases
  - `estimate`: Story point estimation
  - `suggest-files`: Files to modify
  - `to-test-cases`: Generate test code

All AI endpoints use Vercel AI SDK v6 with structured outputs (`generateObject`, `generateText`).

## UI Components

### Component Hierarchy

```
Dashboard (page.tsx)
├── Board Cards
└── Quick Links (Settings, Files, Assistant)

Board View (board/[id]/page.tsx)
├── KanbanBoard
│   ├── KanbanColumn (x5: backlog, todo, in_progress, review, done)
│   │   └── TaskCard (draggable)
│   │       ├── Status indicator
│   │       ├── Description
│   │       ├── Priority badge
│   │       ├── Estimate
│   │       └── Tags
│   └── DragOverlay
└── TaskEditorDialog
    ├── Form fields
    ├── Steps editor
    ├── Tags manager
    └── AI action buttons

Settings (settings/page.tsx)
├── Project Info Card
├── Coding Style Card
├── Test Config Card
├── Run Config Card
└── AI Preferences Card

Files (files/page.tsx)
└── Tabs (Progress, PRD, Settings)

Assistant (assistant/page.tsx)
└── Task Generation Form
```

### Drag & Drop Implementation

Uses `@dnd-kit` libraries:
- **DndContext**: Provides drag & drop context
- **SortableContext**: Manages sortable items
- **useSortable**: Hook for draggable items
- **useDroppable**: Hook for drop zones

Flow:
1. User drags TaskCard
2. `onDragStart`: Set active task
3. `onDragEnd`: Update task status, call API
4. Board re-renders with new task positions

## Autonomous Runner

### Architecture

The background loop now lives in `tools/runner/run-loop.mjs`. Instead of a monolithic CLI it consumes a persisted run record (`plans/runs/<runId>.json`) that is created by the web API whenever the "Run AI Loop" button is pressed. The record stores metadata (board, sandbox path, max iterations, cancellation flag, PID, etc.) and is treated as the source of truth for the UI.

At startup the loop performs the following:

1. Clone or copy the current repo into `.pm/sandboxes/<runId>` (git clone `--local` first, fs copy as a fallback).
2. Copy `plans/settings.json` and generate a sandbox `plans/prd.json` that only includes `todo` or `in_progress` tasks from the active board.
3. Run sandbox setup commands defined in `plans/settings.json.automation.setup` (defaults to `npm ci`).
4. Iterate up to `maxIterations`, launching the configured CLI agent (`claude` or `opencode`) with the shared loop prompt so it can decide what to build, run whatever commands/tests it needs, update files, and append its own notes to `progress.txt`. The runner captures stdout/stderr for observability and watches for `<promise>COMPLETE</promise>` to know when to stop.
5. Respect cancellation by checking for `plans/runs/<runId>.cancel` between every major step.
6. On completion/cancel/error copy the sandbox log to `plans/runs/<runId>.progress.txt`, sync task fields back into the root `plans/prd.json`, append a summary to the root `progress.txt`, and update the run record with final status + reason (`completed`, `max_iterations`, `canceled`, or `error`).

Two execution modes are supported:
- **Local** (default): the API spawns `node tools/runner/run-loop.mjs --runId <id> --projectPath <root>` as a detached child process.
- **Docker**: set `RUN_LOOP_EXECUTOR=docker` and the API will spawn `docker compose run runner node tools/runner/run-loop.mjs --runId <id> --projectPath /workspace`. The compose file mounts the repo so state stays in sync.

### Task Selection & Loop Logic

- Only `todo` and `in_progress` tasks from the active board are loaded into the sandbox PRD.
- Each iteration updates the run record with `currentIteration`, `lastTaskId`, `lastMessage`, `lastCommand`, and command exit codes for live UI feedback.
- Tasks marked `passes=true` in the sandbox are synced back to the root PRD with `status=review`. Remaining selected tasks are forced into `status=in_progress` so reviewers know the loop attempted them.
- The loop stops when all sandbox tasks pass, the max iteration count is reached, a cancellation file appears, or a fatal error occurs.

### Logging & Persistence

- `.pm/sandboxes/<runId>/progress.txt` receives detailed per-iteration sections (timestamp, task, AI notes, commands, pass/fail results). The tail of this file is streamed into the UI.
- `plans/runs/<runId>.progress.txt` stores the preserved log once the run finalizes.
- `plans/runs/<runId>.json` is the authoritative run record used by the UI, history pages, and the runner itself. It includes timestamps, status, reason, executor mode, PID, and any errors.
- Root `progress.txt` gets a short summary per run so humans have a linear audit log.

### Safety Guardrails

- Sandbox-only mutations: root repo is untouched until the post-run sync step.
- Runner-executed commands are limited to setup steps plus the single agent CLI; all other shell activity happens inside the sandbox under the agent's control.
- Cancellation flag checked between setup commands, between every agent iteration, and before each loop cycle.
- Atomic JSON writes for boards, settings, and run files to prevent corruption.
- Logs never include hidden reasoning; they stay factual for handoff purposes.

## Docker Deployment

### Web Container (`Dockerfile`)

Multi-stage build:
1. **deps**: Install dependencies
2. **builder**: Build Next.js app
3. **runner**: Production image with standalone output

Optimizations:
- Minimal base image (node:20-slim)
- Non-root user (nextjs:nodejs)
- Only production files copied

### Runner Container (`Dockerfile.runner`)

Simple image:
- Node.js 20 + git
- Global tsx for TypeScript execution
- Mounts repository as volume
- Can modify files in workspace

### Orchestration (`docker-compose.yml`)

Services:
- **web**: Always running, port 3000
- **runner**: On-demand (profile: runner)

Volumes:
- Web: mounts `plans/` and `progress.txt`
- Runner: mounts entire repo (needs write access)

## Security Considerations

### Current Implementation

- **Server-side only file I/O**: Client cannot write files directly
- **No authentication**: Designed for local/trusted use
- **Command restrictions**: Runner limits shell commands
- **Input validation**: All data validated with Zod

### Production Recommendations

If deploying publicly:
1. Add authentication (NextAuth.js, Clerk, etc.)
2. Implement authorization (user can only access their boards)
3. Rate limit AI endpoints
4. Sanitize all user inputs
5. Use HTTPS
6. Set CSP headers

## Testing Strategy

### Current State

No automated tests included (single-shot implementation).

### Recommended Approach

1. **Unit Tests**:
   - Schema validation (Zod)
   - Storage adapter methods
   - Utility functions

2. **Integration Tests**:
   - API routes (Next.js testing)
   - Runner task selection logic
   - AI action flows

3. **E2E Tests**:
   - Playwright for UI flows
   - Board creation and task management
   - Drag & drop interactions

4. **Manual Testing**:
   - Create `.env.local` with test API key
   - Run `npm run dev`
   - Test all UI flows
   - Trigger the loop via the "Run AI Loop" button or `POST /api/runs/start` and monitor `/runs`

## Performance Considerations

### Current Optimizations

- **Atomic writes**: Prevent file corruption
- **JSON validation**: Catch errors early
- **Standalone Next.js output**: Smaller Docker images
- **Component memoization**: React Compiler enabled

### Future Optimizations

- [ ] Lazy load board tasks (pagination)
- [ ] Cache AI responses (for identical prompts)
- [ ] Stream runner output (Server-Sent Events)
- [ ] Incremental static regeneration for dashboard
- [ ] Database for faster queries (if needed)

## Extension Points

### Adding New Storage Backend

1. Implement `StorageAdapter` interface
2. Handle async operations
3. Maintain atomicity guarantees
4. Update `src/lib/storage/index.ts` to export new adapter

Example: S3 storage, Supabase, PlanetScale, etc.

### Adding Custom AI Actions

1. Define new action in `/api/ai/board` or `/api/ai/task`
2. Create Zod schema for input/output
3. Use `generateObject` or `generateText`
4. Update UI to trigger action

### Extending Task Schema

1. Add fields to `TaskSchema` in `schemas.ts`
2. Update TypeScript types (auto-generated from Zod)
3. Add UI fields in `TaskEditorDialog`
4. Update API routes if needed

### Custom Runner Tools

To add file modification capability:
1. Define tools in runner with Zod schemas
2. Implement tool handlers (readFile, writeFile, etc.)
3. Pass tools to AI SDK `generateText` call
4. AI will call tools as needed

## Troubleshooting

### Common Issues

**TypeScript Errors**:
- Run `npm run typecheck` to identify issues
- Ensure Zod schemas match usage
- Check for missing `await` keywords

**Storage Errors**:
- Verify `plans/` directory exists
- Check JSON file validity: `node -e "JSON.parse(require('fs').readFileSync('plans/prd.json'))"`
- Ensure file permissions allow read/write

**AI Errors**:
- Verify `OPENAI_API_KEY` is set
- Check API key has sufficient credits
- Review error messages in console/logs
- Try different model if quota exceeded

**Runner Not Executing Tasks**:
- Ensure tasks have `passes: false`
- Check task status is not `done`
- Verify test commands in settings are correct
- Review `progress.txt` for error details

## Future Architecture Considerations

### Scalability

Current architecture is designed for:
- Single user or small team
- Local/self-hosted deployment
- Moderate task volumes (<1000 tasks per board)

For scale:
- Move to database (PostgreSQL, MongoDB)
- Add caching layer (Redis)
- Queue system for AI requests (BullMQ)
- Horizontal scaling with session store

### Multi-Tenancy

To support multiple projects:
- Add project/workspace concept
- Namespace boards and settings
- Implement user authentication
- Project-based permissions

### Real-Time Collaboration

To enable live updates:
- WebSocket server (Socket.io, Pusher)
- Optimistic UI updates
- Conflict resolution strategy
- Presence indicators

---

**Last Updated**: 2026-01-07
**Version**: 1.0.0
