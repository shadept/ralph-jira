# Architecture Documentation

## System Overview

Ralph is a multi-tenant project management platform with autonomous AI task execution. It consists of three main components:

1. **Next.js Web Application**: User interface for managing sprints, tasks, and settings
2. **AI Integration Layer**: API routes using Vercel AI SDK for intelligent operations
3. **Autonomous Runner**: Background process that executes tasks automatically

## Technology Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth v5 (Credentials + GitHub OAuth)
- **UI Framework**: Tailwind CSS 4, shadcn/ui components, Radix primitives
- **Drag & Drop**: @dnd-kit libraries
- **Forms**: TanStack React Form
- **AI Integration**: Claude Agent SDK, Vercel AI SDK, @ai-sdk/openai
- **Validation**: Zod
- **Notifications**: Sonner (toast notifications)
- **Runtime**: Node.js 20+

## Directory Structure

```
ralph-jira/
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── ralph.db             # SQLite database
│   └── seed.ts              # Database seeding
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API routes
│   │   │   ├── auth/        # NextAuth handlers
│   │   │   ├── projects/    # Project CRUD + nested resources
│   │   │   │   └── [id]/
│   │   │   │       ├── sprints/     # Sprint management
│   │   │   │       ├── tasks/       # Task management
│   │   │   │       ├── runs/        # Run management
│   │   │   │       └── settings/    # Project settings
│   │   │   ├── runs/        # Direct run access
│   │   │   ├── ai/          # AI-powered actions
│   │   │   ├── organizations/
│   │   │   └── register/
│   │   ├── project/         # Project dashboard pages
│   │   │   ├── sprints/[id] # Sprint detail view
│   │   │   └── runs/        # Run history
│   │   ├── organization/    # Organization management
│   │   ├── login/           # Auth pages
│   │   ├── register/
│   │   └── layout.tsx       # Root layout
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── projects/        # Project-specific components
│   │   ├── layout/          # Layout components
│   │   ├── kanban-board.tsx
│   │   ├── kanban-column.tsx
│   │   ├── task-card.tsx
│   │   ├── task-editor-dialog.tsx
│   │   └── sprint-properties-dialog.tsx
│   ├── lib/
│   │   ├── auth/            # NextAuth configuration
│   │   ├── projects/        # Project helpers
│   │   │   ├── db-server.ts # Auth + project context helper
│   │   │   └── types.ts
│   │   ├── runs/            # Run utilities
│   │   ├── schemas.ts       # Zod validation schemas
│   │   ├── db.ts            # Prisma client
│   │   ├── rate-limit.ts    # Rate limiting
│   │   ├── api-response.ts  # Standardized API errors
│   │   └── utils.ts
│   └── proxy.ts             # Request proxy (auth + rate limiting)
├── tools/
│   └── runner/              # Autonomous execution engine
├── CLAUDE.md                # AI assistant guidelines
└── [config files]
```

## Data Layer

### Database (Prisma + SQLite)

All data is stored in SQLite via Prisma ORM. Key models:

#### User & Authentication
- **User**: Accounts with email, password hash, OAuth support
- **Session**: JWT-based sessions with 30-day expiration
- **UserApiKey**: Encrypted API keys per user

#### Organization & Access Control
- **Organization**: Teams/workspaces with slug
- **OrganizationMember**: Users with roles (owner, admin, member)
- **Invitation**: Email-based invite tokens
- **OrganizationApiKey**: Org-level encrypted API keys

#### Billing
- **Plan**: Pricing tiers (free, pro, enterprise)
- **Subscription**: Organization subscriptions
- **UsageRecord**: Monthly usage tracking

#### Projects & Tasks
- **Project**: Belongs to organization, contains sprints
- **ProjectSettings**: JSON configuration (tech stack, AI preferences)
- **Sprint**: Container for tasks with kanban columns
- **SprintColumn**: Kanban columns within sprints
- **Task**: Work items with status, priority, acceptance criteria

#### Execution
- **Run**: AI execution records with progress tracking
- **RunCommand**: Individual commands executed
- **RunLog**: Progress logs/output

### Prisma Client

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

## API Architecture

### Authentication Pattern

All project-scoped routes use the standardized helper:

```typescript
import {
  getProjectContextFromParams,
  handleProjectRouteError,
} from "@/lib/projects/db-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { project, userId } = await getProjectContextFromParams(id);

    // Route logic...

  } catch (error) {
    return handleProjectRouteError(error);
  }
}
```

This helper:
- Validates JWT session
- Fetches project from database
- Verifies user has organization membership
- Returns typed context or throws appropriate error

### Error Response Format

All API errors include a `code` field:

```typescript
{
  error: "Sprint not found",
  code: "SPRINT_NOT_FOUND"
}
```

Standard error codes:
- `UNAUTHORIZED` - Not authenticated
- `ACCESS_DENIED` - No permission
- `PROJECT_NOT_FOUND` - Project doesn't exist
- `SPRINT_NOT_FOUND` - Sprint doesn't exist
- `INVALID_REQUEST` - Bad request data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

### Rate Limiting

Applied via `src/proxy.ts`:

| Endpoint Type | Limit |
|--------------|-------|
| Auth (login, register) | 5 req/min |
| AI endpoints | 20 req/min |
| Standard API | 60 req/min |

### API Routes

#### Projects
- `GET/POST /api/projects` - List/create projects
- `GET/PUT/DELETE /api/projects/[id]` - Project CRUD
- `GET/PUT /api/projects/[id]/settings` - Project settings

#### Sprints
- `GET/POST /api/projects/[id]/sprints` - List/create sprints
- `GET/PUT/DELETE /api/projects/[id]/sprints/[sprintId]` - Sprint CRUD

#### Tasks
- `GET/POST /api/projects/[id]/tasks` - List/create tasks
- `GET/PUT/DELETE /api/projects/[id]/tasks/[taskId]` - Task CRUD

#### Runs
- `GET/POST /api/projects/[id]/runs` - List runs
- `POST /api/projects/[id]/runs/start` - Start new run
- `GET /api/runs/[runId]` - Run details + logs
- `POST /api/runs/[runId]/cancel` - Cancel run
- `POST /api/runs/[runId]/retry` - Retry run

#### AI Actions
- `POST /api/ai/board` - Sprint-level AI (generate tasks, prioritize)
- `POST /api/ai/task` - Task-level AI (improve criteria, estimate)

## Request Flow

### Next.js 16 Proxy

Next.js 16 uses `proxy.ts` instead of `middleware.ts`:

```typescript
// src/proxy.ts
export async function proxy(request: NextRequest) {
  // 1. Skip static assets
  // 2. Apply rate limiting for API routes
  // 3. Allow public routes (login, register)
  // 4. Check authentication
  // 5. Redirect or return 401
  return NextResponse.next();
}
```

### Session Management

Session is fetched server-side in layout and passed to SessionProvider:

```typescript
// src/app/layout.tsx
export default async function RootLayout({ children }) {
  const session = await auth();

  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
```

This prevents duplicate `/api/auth/session` requests on the client.

## UI Components

### Component Hierarchy

```
RootLayout
├── SessionProvider (with server-side session)
├── ThemeProvider
└── ProjectProvider
    └── Pages...

Project Dashboard (project/page.tsx)
├── Sprint Cards
└── Create Sprint Dialog

Sprint View (project/sprints/[id]/page.tsx)
├── KanbanBoard
│   ├── KanbanColumn (x5: backlog, todo, in_progress, review, done)
│   │   └── TaskCard (draggable)
│   └── DragOverlay
├── TaskEditorDialog
├── SprintPropertiesDialog
└── Run Drawer (live logs)
```

### Drag & Drop

Uses `@dnd-kit`:
- **DndContext**: Provides drag & drop context
- **SortableContext**: Manages sortable items
- **useSortable**: Hook for draggable items

Flow:
1. User drags TaskCard
2. `onDragStart`: Set active task
3. `onDragEnd`: Update task status via API
4. Sprint re-renders with new positions

## Autonomous Runner

### Architecture

The runner lives in `tools/runner/run-loop.mjs` and is spawned by the API when "Run AI Loop" is clicked.

### Execution Flow

1. Create git worktree on specified branch
2. Copy settings and generate sandbox sprint with eligible tasks
3. Run setup commands from settings
4. Loop up to `maxIterations`:
   - Pick next task (in_progress → todo priority)
   - Launch AI agent (Claude or OpenCode CLI)
   - Capture output, update progress
   - Check for completion or cancellation
5. Sync results back to main sprint
6. Clean up worktree

### Execution Modes

- **Local** (default): Spawns as detached child process
- **Docker**: Uses `docker compose run runner`

## Security

### Implemented

- **Authentication**: NextAuth v5 with JWT sessions
- **Authorization**: Organization membership checks
- **Rate Limiting**: Tiered limits in proxy
- **Input Validation**: Zod schemas on all inputs
- **Password Hashing**: bcrypt with cost factor 12
- **Soft Deletes**: `deletedAt` timestamps for recovery

### Session Security

- JWT strategy with 30-day expiration
- Session data fetched server-side
- No sensitive data in client-accessible session

## Performance

### Optimizations

- **Server-side session**: Prevents duplicate auth requests
- **React Compiler**: Automatic memoization
- **Standalone output**: Smaller Docker images
- **Prisma query optimization**: Select only needed fields

### Caching Strategy

- Session cached in SessionProvider
- Project list cached in ProjectProvider
- No aggressive caching (data freshness prioritized)

## Development Guidelines

See [CLAUDE.md](./CLAUDE.md) for:
- API authentication patterns
- Error response format
- Form handling conventions
- Rate limiting details
- Naming conventions

---

**Last Updated**: 2026-01-10
**Version**: 2.0.0
