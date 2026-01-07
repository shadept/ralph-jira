import { z } from 'zod';

// Task schema - preserves original fields + extends with Kanban/sprint fields
export const TaskSchema = z.object({
  // Original fields (must be preserved)
  category: z.string(),
  description: z.string(),
  steps: z.array(z.string()),
  passes: z.boolean(),

  // Extended fields for Kanban/sprints
  id: z.string(),
  status: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimate: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()).default([]),
  assignee: z.string().optional(),
  filesTouched: z.array(z.string()).default([]),
  lastRun: z.string().optional(),
  failureNotes: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// Column schema
export const ColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

export type Column = z.infer<typeof ColumnSchema>;

// Board/Sprint schema
export const BoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string(),
  deadline: z.string(),
  status: z.enum(['planned', 'active', 'completed', 'archived']),
  columns: z.array(ColumnSchema),
  tasks: z.array(TaskSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  metrics: z.object({
    velocity: z.number().optional(),
    completed: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
});

export type Board = z.infer<typeof BoardSchema>;

// Project Settings schema
export const CLAUDE_MODELS = ['opus', 'sonnet'] as const;
export const CLAUDE_PERMISSION_MODES = [
  'acceptEdits',
  'bypassPermissions',
  'default',
  'delegate',
  'dontAsk',
  'plan',
] as const;
export const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS[0];
export const DEFAULT_CLAUDE_PERMISSION_MODE = 'acceptEdits';

const AgentAutomationSchema = z.object({
  name: z.enum(['claude', 'opencode']).default('claude'),
  model: z.string().optional(),
  permissionMode: z.string().optional(),
  extraArgs: z.array(z.string()).default([]),
});

export type AgentAutomationSettings = z.infer<typeof AgentAutomationSchema>;

export const DEFAULT_AGENT_SETTINGS: AgentAutomationSettings = {
  name: 'claude',
  model: DEFAULT_CLAUDE_MODEL,
  permissionMode: DEFAULT_CLAUDE_PERMISSION_MODE,
  extraArgs: [],
};

const AutomationSettingsSchema = z.object({
  setup: z.array(z.string()).default([]),
  maxIterations: z.number().int().positive().default(5),
  sandboxRoot: z.string().optional(),
  agent: AgentAutomationSchema.optional(),
  codingStyle: z.string().default(''),
});

export type AutomationSettings = z.infer<typeof AutomationSettingsSchema>;

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  setup: [],
  maxIterations: 5,
  agent: DEFAULT_AGENT_SETTINGS,
  codingStyle: '',
};

export const ProjectSettingsSchema = z.object({
  projectName: z.string(),
  projectDescription: z.string(),
  techStack: z.array(z.string()),
  howToTest: z.object({
    commands: z.array(z.string()),
    notes: z.string(),
  }),
  howToRun: z.object({
    commands: z.array(z.string()),
    notes: z.string(),
  }),
  aiPreferences: z.object({
    defaultModel: z.string(),
    provider: z.string(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    guardrails: z.array(z.string()),
  }),
  repoConventions: z.object({
    folders: z.record(z.string(), z.string()),
    naming: z.string(),
    commitStyle: z.string().optional(),
  }),
  automation: AutomationSettingsSchema.optional(),
});

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export function isKnownClaudeModel(value?: string | null): value is (typeof CLAUDE_MODELS)[number] {
  if (!value) return false;
  return CLAUDE_MODELS.includes(value as (typeof CLAUDE_MODELS)[number]);
}

export function ensureAgentDefaults(agent?: AgentAutomationSettings | null): AgentAutomationSettings {
  const hasCustomExtraArgs = Array.isArray(agent?.extraArgs);
  const extraArgs = hasCustomExtraArgs
    ? [...(agent?.extraArgs as string[])]
    : [...DEFAULT_AGENT_SETTINGS.extraArgs];
  const name = agent?.name ?? DEFAULT_AGENT_SETTINGS.name;
  const model = agent?.model;
  const permissionMode = agent?.permissionMode;

  if (name === 'claude') {
    return {
      name,
      model: model ?? DEFAULT_CLAUDE_MODEL,
      permissionMode: permissionMode ?? DEFAULT_CLAUDE_PERMISSION_MODE,
      extraArgs,
    };
  }

  return {
    name: 'opencode',
    model: model ?? undefined,
    permissionMode: permissionMode ?? undefined,
    extraArgs,
  };
}

export function ensureAutomationDefaults(automation?: AutomationSettings | null): AutomationSettings {
  const base = automation ?? DEFAULT_AUTOMATION_SETTINGS;
  return {
    ...DEFAULT_AUTOMATION_SETTINGS,
    ...base,
    setup: Array.isArray(base.setup) ? [...base.setup] : [],
    maxIterations:
      typeof base.maxIterations === 'number' && base.maxIterations > 0
        ? base.maxIterations
        : DEFAULT_AUTOMATION_SETTINGS.maxIterations,
    codingStyle:
      typeof base.codingStyle === 'string' ? base.codingStyle : DEFAULT_AUTOMATION_SETTINGS.codingStyle,
    agent: ensureAgentDefaults(base.agent),
  };
}

export function withAutomationDefaults(settings: ProjectSettings): ProjectSettings {
  return {
    ...settings,
    automation: ensureAutomationDefaults(settings.automation),
  };
}

export const RunStatusSchema = z.enum(['queued', 'running', 'stopped', 'completed', 'failed', 'canceled']);
export const RunReasonSchema = z.enum(['completed', 'max_iterations', 'canceled', 'error']);

export const RunRecordSchema = z.object({
  runId: z.string(),
  projectId: z.string().optional(),
  boardId: z.string(),
  boardName: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  status: RunStatusSchema,
  reason: RunReasonSchema.optional(),
  boardSourcePath: z.string(),
  sandboxPath: z.string(),
  sandboxBranch: z.string().optional(),
  cancelFlagPath: z.string(),
  logPath: z.string().optional(),
  sandboxLogPath: z.string().optional(),
  maxIterations: z.number().int().positive(),
  currentIteration: z.number().int().nonnegative(),
  selectedTaskIds: z.array(z.string()),
  lastTaskId: z.string().optional(),
  lastMessage: z.string().optional(),
  lastCommand: z.string().optional(),
  lastCommandExitCode: z.number().nullable().optional(),
  errors: z.array(z.string()).default([]),
  lastProgressAt: z.string().optional(),
  executorMode: z.enum(['local', 'docker']).default('local'),
  pid: z.number().optional(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

// Run log schema
export const RunLogSchema = z.object({
  runId: z.string(),
  boardId: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  tasksAttempted: z.array(z.object({
    taskId: z.string(),
    description: z.string(),
    result: z.enum(['pass', 'fail', 'skipped']),
    filesChanged: z.array(z.string()),
    commands: z.array(z.string()),
    output: z.string(),
  })),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  environment: z.object({
    nodeVersion: z.string().optional(),
    platform: z.string().optional(),
  }).optional(),
});

export type RunLog = z.infer<typeof RunLogSchema>;

// AI tool schemas for structured actions
export const GenerateTasksInputSchema = z.object({
  description: z.string(),
  count: z.number().optional(),
  category: z.string().optional(),
});

export const PrioritizeTasksInputSchema = z.object({
  tasks: z.array(z.string()), // task IDs
  criteria: z.string().optional(),
});

export const ImproveTaskInputSchema = z.object({
  taskId: z.string(),
  aspect: z.enum(['steps', 'edge-cases', 'estimate', 'files']),
});
