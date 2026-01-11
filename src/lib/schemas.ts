import { z } from "zod";

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const OrganizationRoleSchema = z.enum(["owner", "admin", "member"]);
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;

export const SubscriptionStatusSchema = z.enum([
	"active",
	"past_due",
	"canceled",
	"trialing",
	"paused",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const BillingPeriodSchema = z.enum(["monthly", "yearly"]);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

export const SprintStatusSchema = z.enum([
	"planning",
	"active",
	"completed",
	"archived",
]);
export type SprintStatus = z.infer<typeof SprintStatusSchema>;

export const TaskStatusSchema = z.enum([
	"backlog",
	"todo",
	"in_progress",
	"review",
	"done",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const RunStatusSchema = z.enum([
	"queued",
	"running",
	"stopped",
	"completed",
	"failed",
	"canceled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunReasonSchema = z.enum([
	"completed",
	"max_iterations",
	"canceled",
	"error",
	"usage_limit",
]);
export type RunReason = z.infer<typeof RunReasonSchema>;

export const ExecutorModeSchema = z.enum(["local", "docker", "cloud"]);
export type ExecutorMode = z.infer<typeof ExecutorModeSchema>;

export const ApiKeyProviderSchema = z.enum(["anthropic", "openai"]);
export type ApiKeyProvider = z.infer<typeof ApiKeyProviderSchema>;

// ============================================================================
// USER & AUTH SCHEMAS
// ============================================================================

export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	name: z.string().nullable().optional(),
	avatarUrl: z.string().nullable().optional(),
	emailVerified: z.boolean().default(false),
	createdAt: z.string(),
	updatedAt: z.string(),
	lastLoginAt: z.string().nullable().optional(),
	deletedAt: z.string().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
	id: z.string(),
	userId: z.string(),
	token: z.string(),
	expiresAt: z.string(),
	ipAddress: z.string().nullable().optional(),
	userAgent: z.string().nullable().optional(),
	createdAt: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

// ============================================================================
// ORGANIZATION & MEMBERSHIP SCHEMAS
// ============================================================================

export const OrganizationSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logoUrl: z.string().nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable().optional(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizationMemberSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	userId: z.string(),
	role: OrganizationRoleSchema.default("member"),
	joinedAt: z.string(),
	updatedAt: z.string(),
});

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const InvitationSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	email: z.string().email(),
	role: OrganizationRoleSchema.default("member"),
	token: z.string(),
	expiresAt: z.string(),
	acceptedAt: z.string().nullable().optional(),
	createdAt: z.string(),
});

export type Invitation = z.infer<typeof InvitationSchema>;

// ============================================================================
// BILLING SCHEMAS
// ============================================================================

export const PlanFeaturesSchema = z.object({
	byokEnabled: z.boolean().default(false),
	prioritySupport: z.boolean().default(false),
	customBranding: z.boolean().default(false),
	advancedAnalytics: z.boolean().default(false),
	allowedAgents: z.array(z.string()).default(["free-agents"]),
	ssoEnabled: z.boolean().default(false),
	auditLogs: z.boolean().default(false),
	apiAccess: z.boolean().default(false),
	maxFileSize: z.number().nullable().optional(),
});

export type PlanFeatures = z.infer<typeof PlanFeaturesSchema>;

export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
	byokEnabled: false,
	prioritySupport: false,
	customBranding: false,
	advancedAnalytics: false,
	allowedAgents: ["free-agents"],
	ssoEnabled: false,
	auditLogs: false,
	apiAccess: false,
	maxFileSize: undefined,
};

export const PlanSchema = z.object({
	id: z.string(),
	name: z.string(),
	displayName: z.string(),
	description: z.string().nullable().optional(),
	maxUsers: z.number().nullable().optional(),
	maxProjects: z.number().nullable().optional(),
	maxAiRunsPerWeek: z.number().nullable().optional(),
	maxIterationsPerRun: z.number().default(5),
	monthlyPriceCents: z.number().default(0),
	yearlyPriceCents: z.number().default(0),
	features: PlanFeaturesSchema.optional(),
	stripeMonthlyPriceId: z.string().nullable().optional(),
	stripeYearlyPriceId: z.string().nullable().optional(),
	isActive: z.boolean().default(true),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Plan = z.infer<typeof PlanSchema>;

export const SubscriptionSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	planId: z.string(),
	status: SubscriptionStatusSchema.default("active"),
	billingPeriod: BillingPeriodSchema.default("monthly"),
	currentPeriodStart: z.string(),
	currentPeriodEnd: z.string(),
	trialEndsAt: z.string().nullable().optional(),
	featureOverrides: z.record(z.string(), z.any()).default({}),
	stripeCustomerId: z.string().nullable().optional(),
	stripeSubscriptionId: z.string().nullable().optional(),
	cancelAtPeriodEnd: z.boolean().default(false),
	canceledAt: z.string().nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const UsageRecordSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	periodStart: z.string(),
	periodEnd: z.string(),
	aiRunsCount: z.number().default(0),
	iterationsCount: z.number().default(0),
	overageRunsCount: z.number().default(0),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type UsageRecord = z.infer<typeof UsageRecordSchema>;

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

export const UserApiKeySchema = z.object({
	id: z.string(),
	userId: z.string(),
	provider: ApiKeyProviderSchema,
	name: z.string(),
	keyHash: z.string(),
	lastUsedAt: z.string().nullable().optional(),
	usageCount: z.number().default(0),
	isActive: z.boolean().default(true),
	createdAt: z.string(),
	deletedAt: z.string().nullable().optional(),
});

export type UserApiKey = z.infer<typeof UserApiKeySchema>;

export const OrganizationApiKeySchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	provider: ApiKeyProviderSchema,
	name: z.string(),
	keyHash: z.string(),
	lastUsedAt: z.string().nullable().optional(),
	usageCount: z.number().default(0),
	isActive: z.boolean().default(true),
	createdAt: z.string(),
	deletedAt: z.string().nullable().optional(),
});

export type OrganizationApiKey = z.infer<typeof OrganizationApiKeySchema>;

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const ProjectSchema = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	slug: z.string(),
	description: z.string().nullable().optional(),
	repoUrl: z.string().nullable().optional(),
	repoBranch: z.string().nullable().default("main"),
	createdAt: z.string(),
	updatedAt: z.string(),
	archivedAt: z.string().nullable().optional(),
	deletedAt: z.string().nullable().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

// Project Settings (automation settings)
export const CLAUDE_MODELS = ["opus", "sonnet"] as const;
export const CLAUDE_PERMISSION_MODES = [
	"acceptEdits",
	"bypassPermissions",
	"default",
	"delegate",
	"dontAsk",
	"plan",
] as const;
export const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS[0];
export const DEFAULT_CLAUDE_PERMISSION_MODE = "bypassPermissions";

const AgentAutomationSchema = z.object({
	name: z.enum(["claude", "opencode"]).default("claude"),
	model: z.string().optional(),
	permissionMode: z.string().optional(),
	extraArgs: z.array(z.string()).default([]),
});

export type AgentAutomationSettings = z.infer<typeof AgentAutomationSchema>;

export const DEFAULT_AGENT_SETTINGS: AgentAutomationSettings = {
	name: "claude",
	model: DEFAULT_CLAUDE_MODEL,
	permissionMode: DEFAULT_CLAUDE_PERMISSION_MODE,
	extraArgs: [],
};

const AutomationSettingsSchema = z.object({
	setup: z.array(z.string()).default([]),
	maxIterations: z.number().int().positive().default(5),
	sandboxRoot: z.string().optional(),
	agent: AgentAutomationSchema.optional(),
	codingStyle: z.string().default(""),
});

export type AutomationSettings = z.infer<typeof AutomationSettingsSchema>;

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
	setup: [],
	maxIterations: 5,
	agent: DEFAULT_AGENT_SETTINGS,
	codingStyle: "",
};

// AI Preferences schema (extracted for reuse)
export const AiPreferencesSchema = z.object({
	defaultModel: z.string().default("gpt-4-turbo"),
	provider: z.string().default("openai"),
	temperature: z.number().optional(),
	maxTokens: z.number().optional(),
	guardrails: z.array(z.string()).default([]),
});

export type AiPreferences = z.infer<typeof AiPreferencesSchema>;

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
	defaultModel: "gpt-4-turbo",
	provider: "openai",
	guardrails: [],
};

// Tech stack schema
export const TechStackSchema = z.array(z.string()).default([]);

// How to test/run schemas
export const HowToSchema = z.object({
	commands: z.array(z.string()).default([]),
	notes: z.string().default(""),
});

export type HowTo = z.infer<typeof HowToSchema>;

// Repo conventions schema
export const RepoConventionsSchema = z.object({
	folders: z.record(z.string(), z.string()).default({}),
	naming: z.string().default(""),
	commitStyle: z.string().optional(),
});

export type RepoConventions = z.infer<typeof RepoConventionsSchema>;

export const ProjectSettingsSchema = z.object({
	projectName: z.string(),
	projectDescription: z.string(),
	techStack: TechStackSchema,
	howToTest: HowToSchema,
	howToRun: HowToSchema,
	aiPreferences: AiPreferencesSchema,
	repoConventions: RepoConventionsSchema,
	automation: AutomationSettingsSchema.optional(),
});

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

/**
 * Safely parse AI preferences from JSON string with defaults
 */
export function parseAiPreferences(
	json: string | null | undefined,
): AiPreferences {
	if (!json) return DEFAULT_AI_PREFERENCES;
	try {
		const parsed = JSON.parse(json);
		return AiPreferencesSchema.parse(parsed);
	} catch {
		return DEFAULT_AI_PREFERENCES;
	}
}

/**
 * Safely parse tech stack from JSON string
 */
export function parseTechStack(json: string | null | undefined): string[] {
	if (!json) return [];
	try {
		return TechStackSchema.parse(JSON.parse(json));
	} catch {
		return [];
	}
}

/**
 * Safely parse HowTo (test/run) from JSON string
 */
export function parseHowTo(json: string | null | undefined): HowTo {
	const defaults: HowTo = { commands: [], notes: "" };
	if (!json) return defaults;
	try {
		return HowToSchema.parse(JSON.parse(json));
	} catch {
		return defaults;
	}
}

/**
 * Safely parse repo conventions from JSON string
 */
export function parseRepoConventions(
	json: string | null | undefined,
): RepoConventions {
	const defaults: RepoConventions = { folders: {}, naming: "" };
	if (!json) return defaults;
	try {
		return RepoConventionsSchema.parse(JSON.parse(json));
	} catch {
		return defaults;
	}
}

export function isKnownClaudeModel(
	value?: string | null,
): value is (typeof CLAUDE_MODELS)[number] {
	if (!value) return false;
	return CLAUDE_MODELS.includes(value as (typeof CLAUDE_MODELS)[number]);
}

export function ensureAgentDefaults(
	agent?: AgentAutomationSettings | null,
): AgentAutomationSettings {
	const hasCustomExtraArgs = Array.isArray(agent?.extraArgs);
	const extraArgs = hasCustomExtraArgs
		? [...(agent?.extraArgs as string[])]
		: [...DEFAULT_AGENT_SETTINGS.extraArgs];
	const name = agent?.name ?? DEFAULT_AGENT_SETTINGS.name;
	const model = agent?.model;
	const permissionMode = agent?.permissionMode;

	if (name === "claude") {
		return {
			name,
			model: model ?? DEFAULT_CLAUDE_MODEL,
			permissionMode: permissionMode ?? DEFAULT_CLAUDE_PERMISSION_MODE,
			extraArgs,
		};
	}

	return {
		name: "opencode",
		model: model ?? undefined,
		permissionMode: permissionMode ?? undefined,
		extraArgs,
	};
}

export function ensureAutomationDefaults(
	automation?: AutomationSettings | null,
): AutomationSettings {
	const base = automation ?? DEFAULT_AUTOMATION_SETTINGS;
	return {
		...DEFAULT_AUTOMATION_SETTINGS,
		...base,
		setup: Array.isArray(base.setup) ? [...base.setup] : [],
		maxIterations:
			typeof base.maxIterations === "number" && base.maxIterations > 0
				? base.maxIterations
				: DEFAULT_AUTOMATION_SETTINGS.maxIterations,
		codingStyle:
			typeof base.codingStyle === "string"
				? base.codingStyle
				: DEFAULT_AUTOMATION_SETTINGS.codingStyle,
		agent: ensureAgentDefaults(base.agent),
	};
}

export function withAutomationDefaults(
	settings: ProjectSettings,
): ProjectSettings {
	return {
		...settings,
		automation: ensureAutomationDefaults(settings.automation),
	};
}

// ============================================================================
// SPRINT & TASK SCHEMAS
// ============================================================================

// Column schema for frontend (simplified, no sprintId needed)
export const ColumnSchema = z.object({
	id: z.string(),
	name: z.string(),
	order: z.number(),
});

export type Column = z.infer<typeof ColumnSchema>;

// Sprint Column schema (database model, includes sprintId)
export const SprintColumnSchema = z.object({
	id: z.string(),
	sprintId: z.string(),
	columnId: z.string(),
	name: z.string(),
	order: z.number(),
});

export type SprintColumn = z.infer<typeof SprintColumnSchema>;

// Task schema - belongs to Project, assigned to Sprint
export const TaskSchema = z.object({
	id: z.string(),
	projectId: z.string().optional(), // Optional for legacy compatibility
	sprintId: z.string().nullable().optional(),

	// Core fields
	category: z.string(),
	title: z.string(), // Required short summary title
	description: z.string().nullable().optional(), // Optional long-form description/plan
	acceptanceCriteria: z.array(z.string()),

	// Status & tracking
	status: TaskStatusSchema.default("backlog"),
	priority: TaskPrioritySchema.default("medium"),
	passes: z.boolean().default(false),
	estimate: z.number().nullable().optional(),
	deadline: z.string().nullable().optional(),

	// Metadata
	tags: z.array(z.string()).default([]),
	filesTouched: z.array(z.string()).default([]),

	// Assignment
	assigneeId: z.string().nullable().optional(),
	createdById: z.string().nullable().optional(),

	// Run tracking
	lastRun: z.string().nullable().optional(),
	failureNotes: z.string().nullable().optional(),

	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

// Sprint schema
export const SprintSchema = z.object({
	id: z.string(),
	projectId: z.string().optional(), // Optional for frontend (comes from context)
	name: z.string(),
	goal: z.string().nullable().optional(),
	deadline: z.string(),
	status: SprintStatusSchema.default("planning"),
	metrics: z
		.object({
			velocity: z.number().optional(),
			completed: z.number().optional(),
			total: z.number().optional(),
		})
		.optional(),
	columns: z.array(ColumnSchema).optional(),
	tasks: z.array(TaskSchema).optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
	archivedAt: z.string().nullable().optional(),
});

export type Sprint = z.infer<typeof SprintSchema>;

// ============================================================================
// RUN SCHEMAS
// ============================================================================

export const CommandRecordSchema = z.object({
	command: z.string(),
	args: z.array(z.string()),
	cwd: z.string(),
	exitCode: z.number().nullable().optional(),
	startedAt: z.string(),
	finishedAt: z.string().optional(),
});

export type CommandRecord = z.infer<typeof CommandRecordSchema>;

export const RunRecordSchema = z.object({
	runId: z.string(),
	projectId: z.string(),
	sprintId: z.string(),
	sprintName: z.string().optional(),
	createdAt: z.string(),
	startedAt: z.string().nullable(),
	finishedAt: z.string().nullable(),
	status: RunStatusSchema,
	reason: RunReasonSchema.optional(),
	sandboxPath: z.string(),
	sandboxBranch: z.string().optional(),
	maxIterations: z.number().int().positive(),
	currentIteration: z.number().int().nonnegative(),
	executorMode: ExecutorModeSchema.default("local"),
	selectedTaskIds: z.array(z.string()),
	lastTaskId: z.string().optional(),
	lastMessage: z.string().optional(),
	lastCommand: z.string().optional(),
	lastCommandExitCode: z.number().nullable().optional(),
	errors: z.array(z.string()).default([]),
	lastProgressAt: z.string().optional(),
	pid: z.number().optional(),
	prUrl: z.string().optional(),
	cancellationRequestedAt: z.string().optional(),
	commands: z.array(CommandRecordSchema).default([]),
	triggeredById: z.string().optional(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

export const RunCommandSchema = z.object({
	id: z.string(),
	runId: z.string(),
	command: z.string(),
	args: z.array(z.string()),
	cwd: z.string(),
	exitCode: z.number().nullable().optional(),
	startedAt: z.string(),
	finishedAt: z.string().nullable().optional(),
});

export type RunCommand = z.infer<typeof RunCommandSchema>;

export const RunLogEntrySchema = z.object({
	id: z.string(),
	runId: z.string(),
	entry: z.string(),
	createdAt: z.string(),
});

export type RunLogEntry = z.infer<typeof RunLogEntrySchema>;

// ============================================================================
// AI TOOL SCHEMAS
// ============================================================================

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
	aspect: z.enum(["acceptance-criteria", "edge-cases", "estimate", "files"]),
});
