# Ralph

AI-powered project management platform with sprint planning, kanban boards, and autonomous task execution.

## Features

- **Sprint Management**: Create and manage sprints with kanban boards
- **AI Task Generation**: Generate tasks from feature descriptions using AI
- **Autonomous Execution**: AI agents can work on tasks autonomously
- **Organization & Teams**: Multi-tenant with role-based access control
- **Real-time Progress**: Track run progress with live logs

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite with Prisma ORM
- **Auth**: NextAuth v5 (Credentials + OAuth)
- **UI**: Tailwind CSS 4 + shadcn/ui + Radix
- **AI**: Claude Agent SDK, Vercel AI SDK
- **Forms**: TanStack React Form

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Initialize database
npx prisma migrate dev
npx prisma generate

# Seed initial data (optional)
npx tsx prisma/seed.ts

# Start development server
npm run dev
```

### Environment Variables

```env
# Auth
AUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# GitHub OAuth (optional)
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# AI (optional - users can provide their own keys)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

## Development

See [CLAUDE.md](./CLAUDE.md) for AI assistant guidelines and development patterns.

### API Patterns

All project-scoped routes use the standardized auth helper:

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
    const { project } = await getProjectContextFromParams(id);
    // ... route logic
  } catch (error) {
    return handleProjectRouteError(error);
  }
}
```

### Error Response Format

All API errors include a `code` field:

```json
{
  "error": "Sprint not found",
  "code": "SPRINT_NOT_FOUND"
}
```

### Rate Limiting

Rate limits are enforced via proxy (`src/proxy.ts`):
- Auth endpoints: 5 req/min
- AI endpoints: 20 req/min
- Standard API: 60 req/min

### Database Commands

```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Reset database
npx prisma migrate reset
```

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/            # NextAuth handlers
│   │   ├── projects/        # Project CRUD + nested resources
│   │   ├── runs/            # Run management
│   │   └── ...
│   ├── project/             # Project dashboard pages
│   ├── login/               # Auth pages
│   └── ...
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── projects/            # Project-specific components
│   └── ...
└── lib/
    ├── auth/                # NextAuth configuration
    ├── projects/            # Project helpers (db-server.ts)
    ├── schemas.ts           # Zod schemas
    └── ...
```

## Architecture

### Data Storage

All data is stored in SQLite via Prisma. Key models:

- **User/Organization**: Multi-tenant with role-based access
- **Project**: Belongs to organization, contains sprints and tasks
- **Sprint**: Container for tasks with kanban columns
- **Task**: Work items with status, priority, acceptance criteria
- **Run**: Autonomous execution records with progress logs

### Authentication

NextAuth v5 with:
- Credentials provider (email/password with bcrypt)
- GitHub OAuth (optional)
- JWT sessions with 30-day expiration

### AI Integration

- Claude Agent SDK for autonomous task execution
- Vercel AI SDK for task generation and improvement
- Per-user/organization API key storage (encrypted)

## License

MIT
