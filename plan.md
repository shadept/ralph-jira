# Smarter Sprint Planner AI - Implementation Plan

## Overview

Give the AI sprint planner the ability to read and understand the actual codebase, not just project metadata. This enables informed task generation based on real code structure.

---

## Unified AI Client Architecture

### The Problem

Current AI logic is scattered across multiple API routes:
- `/api/ai/board/route.ts` - generate tasks, prioritize, split sprints
- `/api/ai/task/route.ts` - improve criteria, estimate, suggest files

Each route has its own:
- Prompt construction
- OpenAI/Anthropic call
- No shared tool access
- No repo awareness

### The Solution

A single `AIClient` class that:
1. Has repo tools always available (when repo is connected)
2. Supports multiple use cases via configuration
3. Runs agentic loops (tool calls until done)
4. Returns structured, typed outputs

```
┌─────────────────────────────────────────────────────────────┐
│                        AIClient                             │
├─────────────────────────────────────────────────────────────┤
│  - repoAdapter: RepoAdapter | null                          │
│  - tools: Tool[]                                            │
│  - model: string                                            │
│  - systemPrompt: string                                     │
├─────────────────────────────────────────────────────────────┤
│  + run(userMessage, options): Promise<AIResult>             │
│  + runWithSchema<T>(message, schema): Promise<T>            │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │ Repo Tools  │ │ Task Tools  │ │ Sprint Tools│
   │             │ │             │ │             │
   │ - fileTree  │ │ - create    │ │ - prioritize│
   │ - readFiles │ │ - update    │ │ - split     │
   │ - search    │ │ - estimate  │ │ - plan      │
   │ - glob      │ │             │ │             │
   └─────────────┘ └─────────────┘ └─────────────┘
```

### File Structure

```
src/lib/ai/
├── client.ts              # AIClient class
├── types.ts               # Shared types
├── tools/
│   ├── index.ts           # Tool registry & executor
│   ├── repo.ts            # Repo tools (file tree, read, search, glob)
│   ├── task.ts            # Task tools (create, update, estimate)
│   └── sprint.ts          # Sprint tools (prioritize, split)
├── prompts/
│   ├── base.ts            # Shared context builder
│   ├── task-generator.ts  # "Generate tasks from description"
│   ├── task-improver.ts   # "Improve acceptance criteria"
│   ├── estimator.ts       # "Estimate story points"
│   └── coding-agent.ts    # "Implement this task" (future)
└── schemas/
    ├── task.ts            # Zod schemas for task output
    └── sprint.ts          # Zod schemas for sprint output
```

### AIClient Interface

```typescript
// src/lib/ai/types.ts

interface AIClientConfig {
  model?: string;                    // "gpt-4-turbo" | "claude-3-opus" etc.
  repoAdapter?: RepoAdapter | null;  // For repo tools
  projectContext?: ProjectContext;   // Project settings, tech stack, etc.
  tools?: ToolSet[];                 // Which tool sets to enable
  maxToolCalls?: number;             // Safety limit (default: 20)
}

interface ProjectContext {
  name: string;
  description: string;
  techStack: string[];
  conventions: string;
  testingInfo: string;
}

type ToolSet = "repo" | "tasks" | "sprint";

interface AIResult<T = unknown> {
  output: T;
  toolCalls: ToolCallLog[];  // For debugging/UI
  usage: { promptTokens: number; completionTokens: number };
}

interface ToolCallLog {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  durationMs: number;
}
```

### AIClient Implementation

```typescript
// src/lib/ai/client.ts

export class AIClient {
  private config: AIClientConfig;
  private tools: Tool[];

  constructor(config: AIClientConfig) {
    this.config = config;
    this.tools = this.buildTools(config);
  }

  private buildTools(config: AIClientConfig): Tool[] {
    const tools: Tool[] = [];

    // Repo tools always available if adapter provided
    if (config.repoAdapter) {
      tools.push(...createRepoTools(config.repoAdapter));
    }

    // Additional tool sets based on config
    if (config.tools?.includes("tasks")) {
      tools.push(...createTaskTools());
    }
    if (config.tools?.includes("sprint")) {
      tools.push(...createSprintTools());
    }

    return tools;
  }

  /**
   * Run AI with tool loop until completion
   */
  async run(systemPrompt: string, userMessage: string): Promise<AIResult> {
    const messages = [
      { role: "system", content: this.buildSystemPrompt(systemPrompt) },
      { role: "user", content: userMessage },
    ];

    const toolCalls: ToolCallLog[] = [];
    let iterations = 0;

    while (iterations < (this.config.maxToolCalls ?? 20)) {
      const response = await this.callModel(messages);

      if (response.finishReason === "stop") {
        // AI is done
        return { output: response.content, toolCalls, usage: response.usage };
      }

      if (response.finishReason === "tool_calls") {
        // Execute tool calls
        for (const call of response.toolCalls) {
          const start = Date.now();
          const result = await this.executeTool(call.name, call.args);
          toolCalls.push({
            tool: call.name,
            args: call.args,
            result,
            durationMs: Date.now() - start,
          });

          // Add tool result to messages
          messages.push({ role: "assistant", content: null, tool_calls: [call] });
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }

      iterations++;
    }

    throw new Error("Max tool calls exceeded");
  }

  /**
   * Run AI and parse output with Zod schema
   */
  async runWithSchema<T>(
    systemPrompt: string,
    userMessage: string,
    schema: z.ZodSchema<T>
  ): Promise<AIResult<T>> {
    // Use structured output / JSON mode
    // ...
  }

  private buildSystemPrompt(basePrompt: string): string {
    const { projectContext } = this.config;

    let prompt = basePrompt;

    if (projectContext) {
      prompt += `\n\n## Project Context
Project: ${projectContext.name}
Description: ${projectContext.description}
Tech Stack: ${projectContext.techStack.join(", ")}
Conventions: ${projectContext.conventions}
Testing: ${projectContext.testingInfo}`;
    }

    if (this.config.repoAdapter) {
      prompt += `\n\n## Codebase Access
You have access to the project's codebase. Use the repo tools to explore and understand the code before making recommendations.`;
    }

    return prompt;
  }
}
```

### Usage Examples

```typescript
// Task Generation (current /api/ai/board generate-tasks)
const client = new AIClient({
  model: "gpt-4-turbo",
  repoAdapter: await getRepoAdapter(project),
  projectContext: await getProjectContext(project),
});

const result = await client.runWithSchema(
  TASK_GENERATOR_PROMPT,
  `Generate ${count} tasks for: ${description}`,
  taskArraySchema
);

// Tasks now informed by actual codebase!
return result.output;
```

```typescript
// Acceptance Criteria Improvement (current /api/ai/task improve)
const client = new AIClient({
  model: "gpt-4-turbo",
  repoAdapter: await getRepoAdapter(project),
  projectContext: await getProjectContext(project),
});

const result = await client.run(
  CRITERIA_IMPROVER_PROMPT,
  `Improve acceptance criteria for task: ${task.title}\n\nCurrent criteria:\n${task.acceptanceCriteria}`
);

// AI can look at related files before improving!
```

```typescript
// Future: Coding Agent
const client = new AIClient({
  model: "claude-3-opus",
  repoAdapter: await getRepoAdapter(project),
  projectContext: await getProjectContext(project),
  tools: ["repo"],  // Only repo tools, no task/sprint mutation
  maxToolCalls: 50, // More iterations for complex coding
});

const result = await client.run(
  CODING_AGENT_PROMPT,
  `Implement task: ${task.title}\n\nAcceptance Criteria:\n${task.acceptanceCriteria}`
);
```

### Simplified API Routes

After refactor, API routes become thin wrappers:

```typescript
// src/app/api/ai/generate-tasks/route.ts

export async function POST(request: Request) {
  const { project } = await getProjectContext(projectId);
  const { description, count } = await request.json();

  const client = new AIClient({
    repoAdapter: await getRepoAdapter(project),
    projectContext: await buildProjectContext(project),
  });

  const result = await client.runWithSchema(
    TASK_GENERATOR_PROMPT,
    `Generate ${count} tasks for: ${description}`,
    taskArraySchema
  );

  // Save to database
  const tasks = await prisma.task.createMany({ data: result.output });

  return NextResponse.json({ tasks, toolCalls: result.toolCalls });
}
```

---

## Adapter Pattern

Abstract file access behind a `RepoAdapter` interface to support multiple backends:

| Adapter | Use Case | Implementation |
|---------|----------|----------------|
| `LocalRepoAdapter` | Local filesystem repos | Direct `fs` access with path validation |
| `GitHubRepoAdapter` | GitHub remote repos | GitHub REST API via Octokit |
| `GitLabRepoAdapter` | GitLab remote repos | GitLab API (future) |
| `SandboxRepoAdapter` | Untrusted repos | Isolated container (future) |

Adapter type is detected from `project.repoUrl`:
- `/path/to/repo` or `file://...` → Local
- `https://github.com/owner/repo` → GitHub
- `https://gitlab.com/owner/repo` → GitLab

---

## RepoAdapter Interface

```typescript
// src/lib/repo/types.ts

export interface FileNode {
  path: string;           // "src/components/Button.tsx"
  name: string;           // "Button.tsx"
  type: "file" | "directory";
  size?: number;          // bytes (files only)
  children?: FileNode[];  // directories only
}

export interface SearchMatch {
  path: string;
  line: number;
  content: string;        // the matching line
  context?: {
    before: string[];
    after: string[];
  };
}

export interface FileContent {
  path: string;
  content: string;
  truncated?: boolean;    // if we hit size limit
}

export interface RepoAdapter {
  /**
   * Get the file tree structure
   * @param path - Starting path (default: root)
   * @param maxDepth - How deep to traverse (default: 4)
   * @param ignore - Patterns to ignore (default: node_modules, .git, etc.)
   */
  getFileTree(options?: {
    path?: string;
    maxDepth?: number;
    ignore?: string[];
  }): Promise<FileNode[]>;

  /**
   * Read a single file's contents
   * @param maxSize - Max bytes to read (default: 100KB)
   */
  readFile(path: string, options?: {
    maxSize?: number;
  }): Promise<FileContent | null>;

  /**
   * Read multiple files at once
   */
  readFiles(paths: string[], options?: {
    maxSize?: number;
  }): Promise<FileContent[]>;

  /**
   * Find files matching a glob pattern
   * e.g., "src/**/*.tsx", "*.config.js"
   */
  glob(pattern: string, options?: {
    ignore?: string[];
    maxResults?: number;
  }): Promise<string[]>;

  /**
   * Search file contents (like grep)
   * @param pattern - Regex or string to search
   */
  search(pattern: string, options?: {
    glob?: string;        // limit to files matching pattern
    maxResults?: number;
    context?: number;     // lines of context
  }): Promise<SearchMatch[]>;

  /**
   * Check if a path exists
   */
  exists(path: string): Promise<boolean>;
}
```

---

## AI Tools (Function Calling)

The AI gets these tools to explore the codebase:

### 1. get_file_tree

```typescript
{
  name: "get_file_tree",
  description: "Get the project's file/folder structure. Call with a path to explore a specific directory deeper.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory to explore (default: project root). E.g. 'src/components'",
      },
      maxDepth: {
        type: "number",
        description: "How many levels deep to show (default: 3)",
      },
    },
  },
}
```

### 2. read_files

```typescript
{
  name: "read_files",
  description: "Read the contents of one or more files. Use when you need to understand implementation details.",
  parameters: {
    type: "object",
    properties: {
      paths: {
        type: "array",
        items: { type: "string" },
        description: "File paths to read, e.g. ['src/lib/auth.ts']",
      },
    },
    required: ["paths"],
  },
}
```

### 3. find_files

```typescript
{
  name: "find_files",
  description: "Find files matching a pattern. Use to locate relevant files before reading them.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Glob pattern, e.g. 'src/**/*.test.ts' or '**/auth*'",
      },
    },
    required: ["pattern"],
  },
}
```

### 4. search_code

```typescript
{
  name: "search_code",
  description: "Search for text/code patterns across files. Use to find where something is implemented.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Text or regex to search for, e.g. 'useAuth' or 'async function login'",
      },
      filePattern: {
        type: "string",
        description: "Optional: limit search to files matching this glob",
      },
    },
    required: ["query"],
  },
}
```

---

## AI Interaction Flow

```
User: "Create tasks for adding OAuth login"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  AI calls: get_file_tree({ maxDepth: 3 })                   │
│  → Sees project structure                                   │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  AI calls: find_files({ pattern: "**/auth*" })              │
│  → Finds: src/lib/auth.ts, src/app/api/auth/route.ts        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  AI calls: read_files({ paths: ["src/lib/auth.ts"] })       │
│  → Sees current auth implementation                         │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  AI generates informed tasks with specific file references  │
└─────────────────────────────────────────────────────────────┘
```

---

## Token Budget / Safety Limits

```typescript
interface RepoLimits {
  maxFileSize: number;      // 50KB per file
  maxTotalSize: number;     // 200KB total per request
  maxSearchResults: number; // 20 matches
  maxTreeDepth: number;     // 4 levels
  maxFilesPerRead: number;  // 10 files at once
}

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "*.lock",
  "*.log",
];
```

---

## File Structure

```
src/lib/repo/
├── types.ts              # Interfaces: RepoAdapter, FileNode, etc.
├── index.ts              # Factory: detectAdapter(), createRepoAdapter()
├── limits.ts             # Constants: DEFAULT_IGNORE, size limits
├── utils.ts              # Helpers: formatTree(), truncateContent()
├── adapters/
│   ├── local.ts          # LocalRepoAdapter (filesystem)
│   └── github.ts         # GitHubRepoAdapter (API) - later
```

---

## Implementation Steps

### Phase 1: Repo Adapter Infrastructure
- [ ] Create `src/lib/repo/types.ts` - RepoAdapter interface, FileNode, etc.
- [ ] Create `src/lib/repo/limits.ts` - DEFAULT_IGNORE, size limits
- [ ] Create `src/lib/repo/index.ts` - detectAdapter(), createRepoAdapter()
- [ ] Create `src/lib/repo/adapters/local.ts` - LocalRepoAdapter
- [ ] Write tests for LocalRepoAdapter

### Phase 2: Unified AI Client
- [ ] Create `src/lib/ai/types.ts` - AIClientConfig, AIResult, ToolCallLog
- [ ] Create `src/lib/ai/tools/repo.ts` - Repo tool definitions & executor
- [ ] Create `src/lib/ai/tools/index.ts` - Tool registry
- [ ] Create `src/lib/ai/client.ts` - AIClient class with agentic loop
- [ ] Create `src/lib/ai/prompts/base.ts` - Shared context builder

### Phase 3: Migrate Existing AI Routes
- [ ] Create `src/lib/ai/prompts/task-generator.ts`
- [ ] Create `src/lib/ai/prompts/task-improver.ts`
- [ ] Create `src/lib/ai/schemas/task.ts` - Zod schemas
- [ ] Refactor `/api/ai/board/route.ts` to use AIClient
- [ ] Refactor `/api/ai/task/route.ts` to use AIClient
- [ ] Delete old duplicated prompt/logic code

### Phase 4: UI Updates
- [ ] Add repo URL field to project settings (if not already there)
- [ ] Show "codebase connected" indicator
- [ ] Show tool calls in assistant UI (expandable log)

### Phase 5: GitHub App Integration
- [ ] Create GitHub App on GitHub (see setup section below)
- [ ] Add environment variables
- [ ] Create `GitHubInstallation` + `ProjectGitHubRepo` models
- [ ] Build `/api/github/callback` route
- [ ] Build installation flow UI (connect repo button)
- [ ] Implement token management (installation tokens via Octokit App)
- [ ] Create `src/lib/repo/adapters/github.ts` - GitHubRepoAdapter

---

## GitHub App Setup

### Why GitHub App (not OAuth App)
- **Granular permissions** - request only what's needed per repo
- **Per-repo installation** - users choose specific repos, not all-or-nothing
- **Higher rate limits** - 5,000+ req/hr per installation
- **Unified access** - same setup for reading code AND coding agent pushing branches
- **Future-proof** - can add webhooks, status checks, etc.

### Create the App

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**

2. Basic info:
   ```
   Name: Ralph PM
   Description: AI-powered project management with autonomous coding
   Homepage URL: https://ralph.app
   ```

3. Callback & Webhook:
   ```
   Callback URL: https://ralph.app/api/github/callback
   Setup URL: https://ralph.app/api/github/setup (optional)
   Webhook URL: https://ralph.app/api/github/webhook (optional, for push events)
   Webhook secret: (generate random string)
   ```

4. **Permissions** (Repository):
   ```
   Contents:        Read & Write  (read code, push branches)
   Pull requests:   Read & Write  (create PRs)
   Metadata:        Read          (required)
   ```

5. **Where can this app be installed?**
   - "Any account" (for SaaS)
   - "Only on this account" (for testing)

6. Create → Download **Private Key** (.pem file)

7. Note down:
   - `App ID`
   - `Client ID`
   - `Client Secret`
   - Private Key file

### Environment Variables

```env
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.xxxxxxxx
GITHUB_APP_CLIENT_SECRET=xxxxxxxx
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=random-secret-string
```

### Database Model

```prisma
model GitHubInstallation {
  id              String   @id @default(cuid())

  installationId  Int      @unique  // GitHub's installation ID
  accountLogin    String   // "acme-corp" or "username"
  accountType     String   // "Organization" or "User"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // One installation can be linked to multiple projects
  projects        ProjectGitHubRepo[]
}

model ProjectGitHubRepo {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  installationId  String
  installation    GitHubInstallation @relation(fields: [installationId], references: [id])

  repoOwner       String   // "acme-corp"
  repoName        String   // "my-app"
  defaultBranch   String   @default("main")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Auth Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User clicks "Connect GitHub Repository"                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Redirect to GitHub App installation page                   │
│  https://github.com/apps/ralph-pm/installations/new         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  User selects account (personal or org)                     │
│  User selects repos to grant access to                      │
│  User clicks "Install"                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub redirects to callback with:                         │
│  - installation_id                                          │
│  - setup_action ("install" | "update")                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Your app:                                                  │
│  1. Stores installation_id                                  │
│  2. Fetches list of repos user granted access to            │
│  3. Shows repo picker to link to project                    │
└─────────────────────────────────────────────────────────────┘
```

### Token Management

GitHub App uses **installation access tokens** (not user tokens):

```typescript
// src/lib/github/auth.ts
import { App } from "octokit";

const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
});

export async function getInstallationOctokit(installationId: number) {
  // Returns an Octokit instance authenticated as the installation
  // Tokens are auto-managed (created on demand, refreshed when expired)
  return app.getInstallationOctokit(installationId);
}
```

Usage:
```typescript
const octokit = await getInstallationOctokit(installation.installationId);

// Read file
const { data } = await octokit.repos.getContent({
  owner: "acme",
  repo: "my-app",
  path: "src/lib/auth.ts",
});

// Create branch
await octokit.git.createRef({
  owner: "acme",
  repo: "my-app",
  ref: "refs/heads/feature/oauth-login",
  sha: baseSha,
});

// Create PR
await octokit.pulls.create({
  owner: "acme",
  repo: "my-app",
  title: "Add OAuth login",
  head: "feature/oauth-login",
  base: "main",
  body: "Implemented by Ralph AI",
});
```

---

## Security Considerations

### LocalRepoAdapter
- **Path traversal**: Validate all paths stay within repo root
- **Symlinks**: Don't follow symlinks outside repo
- **File size**: Enforce max file size limits
- **Ignore patterns**: Skip sensitive files (.env, secrets, etc.)

### GitHubRepoAdapter
- **OAuth scopes**: Request minimal permissions (repo:read)
- **Rate limits**: Respect GitHub API limits, implement backoff
- **Token storage**: Encrypt at rest

### SandboxAdapter (Future)
- **Isolation**: Run in container with no network
- **Resource limits**: CPU, memory, disk quotas
- **Timeout**: Kill long-running operations

---

## Example: LocalRepoAdapter

```typescript
class LocalRepoAdapter implements RepoAdapter {
  constructor(private repoPath: string) {
    // Validate repoPath exists and is a directory
  }

  private resolvePath(relativePath: string): string {
    const resolved = path.resolve(this.repoPath, relativePath);
    // Security: ensure resolved path is within repoPath
    if (!resolved.startsWith(this.repoPath)) {
      throw new Error("Path traversal detected");
    }
    return resolved;
  }

  async getFileTree(options?: { path?: string; maxDepth?: number }) {
    const startPath = options?.path
      ? this.resolvePath(options.path)
      : this.repoPath;
    // Recursively build tree with depth limit
  }

  async readFile(filePath: string) {
    const resolved = this.resolvePath(filePath);
    const content = await fs.readFile(resolved, "utf-8");
    // Truncate if over size limit
  }

  // ... other methods
}
```
