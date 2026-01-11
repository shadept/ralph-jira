"use client";

import {
	ArrowRightIcon,
	CheckIcon,
	ClockIcon,
	CreditCardIcon,
	FolderIcon,
	InfinityIcon,
	LightningIcon,
	UsersIcon,
	WarningIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type Plan = {
	id: string;
	name: string;
	displayName: string;
	description: string | null;
	maxUsers: number | null;
	maxProjects: number | null;
	maxAiRunsPerWeek: number | null;
	maxIterationsPerRun: number;
	monthlyPriceCents: number;
	yearlyPriceCents: number;
	features: Record<string, unknown>;
};

export type Subscription = {
	id: string;
	status: string;
	billingPeriod: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	trialEndsAt: string | null;
	cancelAtPeriodEnd: boolean;
	canceledAt: string | null;
	featureOverrides: Record<string, unknown>;
	createdAt: string;
	plan: Plan;
};

export type Usage = {
	members: number;
	projects: number;
	aiRunsThisWeek: number;
};

export type SubscriptionData = {
	organization: { id: string; name: string };
	subscription: Subscription | null;
	usage: Usage;
	availablePlans: Plan[];
	currentUserRole: "owner" | "admin" | "member";
};

const statusColors: Record<string, string> = {
	active: "bg-green-500/10 text-green-700 dark:text-green-400",
	trialing: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
	past_due: "bg-red-500/10 text-red-700 dark:text-red-400",
	canceled: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
	paused: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
};

const statusLabels: Record<string, string> = {
	active: "Active",
	trialing: "Trial",
	past_due: "Past Due",
	canceled: "Canceled",
	paused: "Paused",
};

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function getDaysRemaining(endDate: string): number {
	const end = new Date(endDate);
	const now = new Date();
	const diff = end.getTime() - now.getTime();
	return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function UsageBar({
	label,
	icon: Icon,
	current,
	max,
}: {
	label: string;
	icon: React.ElementType;
	current: number;
	max: number | null;
}) {
	const percentage = max ? Math.min(100, (current / max) * 100) : 0;
	const isUnlimited = max === null;
	const isNearLimit = max && percentage >= 80;
	const isAtLimit = max && current >= max;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-sm">
				<div className="flex items-center gap-2">
					<Icon className="w-4 h-4 text-muted-foreground" />
					<span>{label}</span>
				</div>
				<span className={isAtLimit ? "text-red-600 font-medium" : ""}>
					{current} /{" "}
					{isUnlimited ? <InfinityIcon className="w-4 h-4 inline" /> : max}
				</span>
			</div>
			{!isUnlimited && (
				<Progress
					value={percentage}
					className={
						isAtLimit
							? "[&>div]:bg-red-500"
							: isNearLimit
								? "[&>div]:bg-yellow-500"
								: ""
					}
				/>
			)}
			{isUnlimited && (
				<div className="h-2 bg-muted rounded-full overflow-hidden">
					<div className="h-full w-full bg-gradient-to-r from-green-500/20 to-green-500/40" />
				</div>
			)}
		</div>
	);
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
	return (
		<div className="flex items-center gap-2 text-sm">
			{enabled ? (
				<CheckIcon className="w-4 h-4 text-green-600" weight="bold" />
			) : (
				<XIcon className="w-4 h-4 text-muted-foreground" />
			)}
			<span className={enabled ? "" : "text-muted-foreground"}>{label}</span>
		</div>
	);
}

type SubscriptionClientProps = {
	initialData: SubscriptionData;
};

export function SubscriptionClient({
	initialData,
}: SubscriptionClientProps) {
	const _router = useRouter();
	const [data] = useState<SubscriptionData>(initialData);

	const isOwner = data.currentUserRole === "owner";
	const sub = data.subscription;
	const plan = sub?.plan;
	const usage = data.usage;

	if (!sub) {
		return (
			<>
				<PageHeader
					title="Subscription"
					description={data.organization.name}
					backLink={{ href: "/organization", label: "Back to Organization" }}
				/>
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<CreditCardIcon className="w-12 h-12 text-muted-foreground" />
					<p className="text-lg font-semibold">No active subscription</p>
					<p className="text-sm text-muted-foreground">
						This organization doesn't have an active subscription.
					</p>
					{isOwner && (
						<Button className="mt-2">
							Choose a Plan
							<ArrowRightIcon className="w-4 h-4 ml-2" />
						</Button>
					)}
				</div>
			</>
		);
	}

	const daysRemaining = getDaysRemaining(sub.currentPeriodEnd);
	const isTrialing = sub.status === "trialing";
	const isCanceling = sub.cancelAtPeriodEnd;
	const isPastDue = sub.status === "past_due";
	const features = plan?.features || {};
	const overrides = sub.featureOverrides || {};
	const effectiveFeatures = { ...features, ...overrides };

	return (
		<>
			<PageHeader
				title="Subscription"
				description={data.organization.name}
				backLink={{ href: "/organization", label: "Back to Organization" }}
			/>
			<div className="space-y-6">
				{isPastDue && (
					<Card className="border-red-500/50 bg-red-500/5">
						<CardContent className="flex items-center gap-3 py-4">
							<WarningIcon className="w-5 h-5 text-red-600" weight="fill" />
							<div>
								<p className="font-medium text-red-600">Payment Past Due</p>
								<p className="text-sm text-muted-foreground">
									Please update your payment method to avoid service
									interruption.
								</p>
							</div>
							{isOwner && (
								<Button variant="destructive" size="sm" className="ml-auto">
									Update Payment
								</Button>
							)}
						</CardContent>
					</Card>
				)}

				{isCanceling && (
					<Card className="border-yellow-500/50 bg-yellow-500/5">
						<CardContent className="flex items-center gap-3 py-4">
							<ClockIcon className="w-5 h-5 text-yellow-600" />
							<div>
								<p className="font-medium text-yellow-700 dark:text-yellow-400">
									Subscription Ending
								</p>
								<p className="text-sm text-muted-foreground">
									Your subscription will end on{" "}
									{formatDate(sub.currentPeriodEnd)}. You'll lose access to
									premium features after this date.
								</p>
							</div>
							{isOwner && (
								<Button variant="outline" size="sm" className="ml-auto">
									Resume Subscription
								</Button>
							)}
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									{plan?.displayName} Plan
									<Badge
										className={statusColors[sub.status] || statusColors.active}
									>
										{statusLabels[sub.status] || sub.status}
									</Badge>
								</CardTitle>
								<CardDescription>
									{plan?.description || "Your current subscription plan"}
								</CardDescription>
							</div>
							{isOwner && (
								<span title="Coming soon">
									<Button variant="outline" disabled>
										{plan?.name === "enterprise"
											? "Contact Sales"
											: "Change Plan"}
									</Button>
								</span>
							)}
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Billing Period</p>
								<p className="font-medium capitalize">{sub.billingPeriod}</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">Current Period</p>
								<p className="font-medium">
									{formatDate(sub.currentPeriodStart)} -{" "}
									{formatDate(sub.currentPeriodEnd)}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">
									{isCanceling ? "Access Ends In" : "Next Billing Date"}
								</p>
								<p className="font-medium">
									{daysRemaining} days ({formatDate(sub.currentPeriodEnd)})
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm text-muted-foreground">
									{sub.billingPeriod === "yearly" ? "Yearly" : "Monthly"} Cost
								</p>
								<p className="font-medium">
									{plan && plan.monthlyPriceCents === 0
										? "Free"
										: formatPrice(
												sub.billingPeriod === "yearly"
													? plan?.yearlyPriceCents || 0
													: plan?.monthlyPriceCents || 0,
											)}
									{plan && plan.monthlyPriceCents > 0 && (
										<span className="text-muted-foreground text-sm">
											/{sub.billingPeriod === "yearly" ? "year" : "month"}
										</span>
									)}
								</p>
							</div>
						</div>

						{isTrialing && sub.trialEndsAt && (
							<div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
								<p className="text-sm text-blue-700 dark:text-blue-400">
									<ClockIcon className="w-4 h-4 inline mr-1" />
									Trial ends on {formatDate(sub.trialEndsAt)}. Add a payment
									method to continue after your trial.
								</p>
							</div>
						)}

						{!!effectiveFeatures.founderPlan && (
							<div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
								<p className="text-sm text-amber-700 dark:text-amber-400">
									<LightningIcon
										className="w-4 h-4 inline mr-1"
										weight="fill"
									/>
									Founder Plan - Zero-cost Enterprise subscription with all
									features enabled.
								</p>
							</div>
						)}

						{!!effectiveFeatures.byokEnabled && (
							<div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
								<p className="text-sm text-purple-700 dark:text-purple-400">
									<LightningIcon
										className="w-4 h-4 inline mr-1"
										weight="fill"
									/>
									BYOK Enabled - Unlimited AI runs using your own API keys.
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Current Usage</CardTitle>
						<CardDescription>
							Your organization's resource usage this billing period
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{usage && plan && (
							<>
								<UsageBar
									label="Team Members"
									icon={UsersIcon}
									current={usage.members}
									max={plan.maxUsers}
								/>
								<UsageBar
									label="Projects"
									icon={FolderIcon}
									current={usage.projects}
									max={plan.maxProjects}
								/>
								<UsageBar
									label="AI Runs (this week)"
									icon={LightningIcon}
									current={usage.aiRunsThisWeek}
									max={
										effectiveFeatures.byokEnabled ? null : plan.maxAiRunsPerWeek
									}
								/>
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Plan Features</CardTitle>
						<CardDescription>
							Features included in your {plan?.displayName} plan
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
							<FeatureRow
								label="Priority Support"
								enabled={!!effectiveFeatures.prioritySupport}
							/>
							<FeatureRow
								label="Custom Branding"
								enabled={!!effectiveFeatures.customBranding}
							/>
							<FeatureRow
								label="Advanced Analytics"
								enabled={!!effectiveFeatures.advancedAnalytics}
							/>
							<FeatureRow
								label="SSO / SAML"
								enabled={!!effectiveFeatures.ssoEnabled}
							/>
							<FeatureRow
								label="Audit Logs"
								enabled={!!effectiveFeatures.auditLogs}
							/>
							<FeatureRow
								label="API Access"
								enabled={!!effectiveFeatures.apiAccess}
							/>
							<FeatureRow
								label="Bring Your Own Key (BYOK)"
								enabled={!!effectiveFeatures.byokEnabled}
							/>
						</div>

						<div className="mt-6 pt-4 border-t">
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<p className="text-sm text-muted-foreground">
										Max Iterations per AI Run
									</p>
									<p className="font-medium">
										{plan?.maxIterationsPerRun || 5}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Max File Size</p>
									<p className="font-medium">
										{effectiveFeatures.maxFileSize
											? `${Math.round((effectiveFeatures.maxFileSize as number) / 1024 / 1024)} MB`
											: "Unlimited"}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Subscription Details</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid gap-4 md:grid-cols-2 text-sm">
							<div>
								<dt className="text-muted-foreground">Subscription ID</dt>
								<dd className="font-mono text-xs">{sub.id}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd>{formatDate(sub.createdAt)}</dd>
							</div>
							{sub.canceledAt && (
								<div>
									<dt className="text-muted-foreground">Canceled On</dt>
									<dd>{formatDate(sub.canceledAt)}</dd>
								</div>
							)}
						</dl>
					</CardContent>
				</Card>

				{isOwner && sub.status === "active" && !isCanceling && (
					<Card className="border-destructive/50">
						<CardHeader>
							<CardTitle className="text-destructive">Danger Zone</CardTitle>
							<CardDescription>
								Irreversible actions for your subscription
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Cancel Subscription</p>
									<p className="text-sm text-muted-foreground">
										Your subscription will remain active until the end of the
										current billing period.
									</p>
								</div>
								<Button variant="destructive">Cancel Subscription</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{!isOwner && (
					<p className="text-sm text-muted-foreground text-center">
						Only the organization owner can make changes to the subscription.
					</p>
				)}
			</div>
		</>
	);
}

export function NoSubscription() {
	return (
		<>
			<PageHeader
				title="Subscription"
				description="Manage your subscription"
				backLink={{ href: "/organization", label: "Back to Organization" }}
			/>
			<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
				<CreditCardIcon className="w-12 h-12 text-muted-foreground" />
				<p className="text-lg font-semibold">No subscription found</p>
				<p className="text-sm text-muted-foreground">
					You're not a member of any organization.
				</p>
			</div>
		</>
	);
}
