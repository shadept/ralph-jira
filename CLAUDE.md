# Ralph Development Guidelines

This document contains development patterns and conventions for Claude and other AI assistants working on this codebase.

## Project Overview

Ralph is an AI-powered project management platform with sprint planning, kanban boards, and autonomous task execution capabilities. Built with Next.js 16, Prisma, and SQLite.

## Architecture

### Next.js 16 Specifics

**Use `proxy.ts` instead of `middleware.ts`.**

Next.js 16 prefers `src/proxy.ts` over the traditional `src/middleware.ts`. If both files exist, Next.js will error. All request interception (auth, rate limiting, redirects) goes in `proxy.ts`.

```typescript
// src/proxy.ts
export async function proxy(request: NextRequest) {
  // Auth checks, rate limiting, redirects...
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Data Access

**All data access is via Prisma/database.** There is no file-based storage in this version.

```typescript
// Use the centralized Prisma client
import { prisma } from "@/lib/db";
```

### API Route Authentication Pattern

**ALWAYS use the helper function for project-scoped routes:**

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

    // Your route logic here...

  } catch (error) {
    return handleProjectRouteError(error);
  }
}
```

This helper:
- Validates authentication
- Fetches the project
- Verifies user has organization membership
- Throws typed errors that `handleProjectRouteError` handles

**DO NOT manually check auth like this:**
```typescript
// BAD - Don't do this
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const project = await prisma.project.findUnique(...);
const membership = await prisma.organizationMember.findUnique(...);
```

### Error Response Format

All API errors MUST include a `code` field:

```typescript
import { apiError, notFound, unauthorized } from "@/lib/api-response";

// Standard errors
return apiError("Invalid request", "INVALID_REQUEST", { status: 400 });
return notFound("Sprint", "SPRINT_NOT_FOUND");
return unauthorized();

// Or use handleProjectRouteError which formats errors automatically
```

Error codes are defined in `src/lib/api-response.ts`.

### Form Handling

All forms use `@tanstack/react-form`:

```typescript
import { useForm } from "@tanstack/react-form";

const form = useForm({
  defaultValues: { name: "", email: "" },
  onSubmit: async ({ value }) => {
    // Handle submission
  },
});
```

### Rate Limiting

Rate limiting is applied via proxy (`src/proxy.ts`):
- Auth endpoints (login, register): 5 req/min
- AI endpoints: 20 req/min
- Standard API: 60 req/min

Configuration in `src/lib/rate-limit.ts`.

**Note**: Next.js 16 uses `proxy.ts` instead of `middleware.ts`.

## Naming Conventions

### Database vs API vs Frontend

| Database (Prisma) | API Response | Frontend Type |
|-------------------|--------------|---------------|
| `Sprint` | `sprint` | `Sprint` |
| `SprintColumn` | `columns[]` | `Column` |
| `Task` | `task` | `Task` |
| `Run` | `run` | `RunRecord` |

### API Routes

- Project-scoped: `/api/projects/[id]/sprints`
- Direct access: `/api/runs/[runId]`

### File Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── project/       # Project pages
│   └── ...
├── components/
│   ├── ui/            # shadcn/ui components
│   └── ...
└── lib/
    ├── auth/          # NextAuth config
    ├── projects/      # Project helpers
    └── ...
```

## What NOT to Do

1. **Don't create file-based storage** - Use Prisma for all data
2. **Don't duplicate auth logic** - Use `getProjectContextFromParams`
3. **Don't return errors without codes** - Always include `code` field
4. **Don't use legacy Board terminology** - Use Sprint throughout
5. **Don't bypass rate limiting** - It's enforced in middleware

## Testing

Run tests with:
```bash
npm test
```

## Database

SQLite database at `prisma/ralph.db`. Run migrations:
```bash
npx prisma migrate dev
npx prisma generate
```
