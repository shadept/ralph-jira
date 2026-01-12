import {
	ArrowRightIcon,
	CheckCircleIcon,
	GithubLogoIcon,
	KanbanIcon,
	LightningIcon,
	RobotIcon,
	SparkleIcon,
	UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { HeroRotatingText } from "@/components/home/hero-rotating-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";

const features = [
	{
		icon: RobotIcon,
		title: "AI-Powered Task Execution",
		description:
			"Let AI autonomously work on your tasks with multi-iteration support and intelligent progress tracking.",
	},
	{
		icon: KanbanIcon,
		title: "Intuitive Kanban Boards",
		description:
			"Visualize your workflow with drag-and-drop sprint boards, status tracking, and real-time updates.",
	},
	{
		icon: LightningIcon,
		title: "Sprint Planning",
		description:
			"Plan sprints efficiently with AI-assisted task generation, prioritization, and time estimation.",
	},
	{
		icon: UsersIcon,
		title: "Team Collaboration",
		description:
			"Invite team members, assign tasks, and collaborate seamlessly with role-based permissions.",
	},
	{
		icon: SparkleIcon,
		title: "AI Chat",
		description:
			"Ask Ralph to generate tasks, refine requirements, and guide next steps for your project.",
	},
	{
		icon: CheckCircleIcon,
		title: "Progress Tracking",
		description:
			"Monitor task execution in real-time with detailed logs, metrics, and completion tracking.",
	},
];

function formatFeatureKey(key: string): string {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

async function getPlans() {
	try {
		const plans = await prisma.plan.findMany({
			where: { isActive: true },
			orderBy: { monthlyPriceCents: "asc" },
		});

		// Collect all unique feature keys across all plans
		const allFeatureKeys = new Set<string>();
		const planFeatureMaps: Record<string, boolean>[] = [];

		for (const plan of plans) {
			const features = JSON.parse(plan.featuresJson) as Record<string, boolean>;
			planFeatureMaps.push(features);
			for (const key of Object.keys(features)) {
				allFeatureKeys.add(key);
			}
		}

		// Sort features: enabled in more plans first, then alphabetically
		const sortedFeatureKeys = Array.from(allFeatureKeys).sort((a, b) => {
			// Count how many plans have this feature enabled
			const aCount = planFeatureMaps.filter((f) => f[a]).length;
			const bCount = planFeatureMaps.filter((f) => f[b]).length;
			if (bCount !== aCount) return bCount - aCount;
			return formatFeatureKey(a).localeCompare(formatFeatureKey(b));
		});

		return plans.map((plan, index) => {
			const features = planFeatureMaps[index];

			// Sort: enabled first, then disabled
			const sortedFeatures = sortedFeatureKeys.map((key) => ({
				name: formatFeatureKey(key),
				enabled: !!features[key],
			}));

			sortedFeatures.sort((a, b) => {
				if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
				return 0;
			});

			return {
				id: plan.id,
				name: plan.name,
				displayName: plan.displayName,
				description: plan.description,
				monthlyPrice: plan.monthlyPriceCents / 100,
				features: sortedFeatures,
			};
		});
	} catch (error) {
		console.error("Failed to fetch plans:", error);
		return [];
	}
}

export default async function HomePage() {
	const plans = await getPlans();

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto px-6 flex h-16 items-center justify-between">
					<div className="flex items-center gap-2">
						<RobotIcon className="h-8 w-8 text-primary" weight="duotone" />
						<span className="text-xl font-bold">Ralph</span>
					</div>
					<nav className="flex items-center gap-4">
						<Link
							href="#features"
							className="text-sm font-medium text-muted-foreground hover:text-foreground"
						>
							Features
						</Link>
						<Link
							href="#pricing"
							className="text-sm font-medium text-muted-foreground hover:text-foreground"
						>
							Pricing
						</Link>
						<ThemeToggle />
						<Button variant="ghost" asChild>
							<Link href="/login">Log in</Link>
						</Button>
						<Button asChild>
							<Link href="/register">Get Started</Link>
						</Button>
					</nav>
				</div>
			</header>

			{/* Hero Section */}
			<section className="relative overflow-hidden py-24 md:py-32">
				<div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
				<div className="container mx-auto px-6">
					<div className="mx-auto max-w-3xl text-center">
						<p className="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
							Put your backlog on autopilot
						</p>
						<h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
							<HeroRotatingText />
							<br />
							<span className="text-foreground">with autonomous AI</span>
						</h1>
						<p className="mt-6 text-lg text-muted-foreground md:text-xl">
							Ralph combines intuitive sprint planning and Kanban boards with
							AI-powered task execution. Define what you want, let AI handle the
							implementation.
						</p>
						<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Button size="lg" asChild>
								<Link href="/register">
									Start for Free
									<ArrowRightIcon className="ml-2 h-4 w-4" />
								</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="https://github.com/ralph-pm/ralph" target="_blank">
									<GithubLogoIcon className="mr-2 h-4 w-4" />
									View on GitHub
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-24 bg-muted/50 scroll-mt-16">
				<div className="container mx-auto px-6">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							Everything you need to ship faster
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Powerful features designed to streamline your development workflow
							and let AI do the heavy lifting.
						</p>
					</div>
					<div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<Card
								key={feature.title}
								className="border-0 shadow-none bg-background"
							>
								<CardHeader>
									<div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
										<feature.icon
											className="h-6 w-6 text-primary"
											weight="duotone"
										/>
									</div>
									<CardTitle className="text-lg">{feature.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<CardDescription className="text-base">
										{feature.description}
									</CardDescription>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* Pricing Section */}
			<section id="pricing" className="py-24 scroll-mt-16">
				<div className="container mx-auto px-6">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							Simple, transparent pricing
						</h2>
						<p className="mt-4 text-lg text-muted-foreground">
							Start free and scale as your team grows. No credit card required.
						</p>
					</div>
					<div className="mt-16 grid gap-8 md:grid-cols-3">
						{plans.map((plan, index) => {
							const isMiddle = index === Math.floor(plans.length / 2);
							return (
								<Card
									key={plan.id}
									className={
										isMiddle
											? "border-primary border-2 shadow-2xl scale-110 relative z-10 bg-gradient-to-b from-primary/10 to-background -my-4"
											: ""
									}
								>
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle>{plan.displayName}</CardTitle>
											{isMiddle && <Badge variant="default">Popular</Badge>}
										</div>
										<div className="mt-4">
											<span className="text-4xl font-bold">
												${plan.monthlyPrice}
											</span>
											<span className="text-muted-foreground">/month</span>
										</div>
										{plan.description && (
											<CardDescription className="mt-2">
												{plan.description}
											</CardDescription>
										)}
									</CardHeader>
									<CardContent>
										<ul className="space-y-3">
											{plan.features.map((feature) => (
												<li
													key={feature.name}
													className={`flex items-center gap-2 ${
														!feature.enabled ? "text-muted-foreground" : ""
													}`}
												>
													<CheckCircleIcon
														className={`h-5 w-5 ${
															feature.enabled
																? "text-primary"
																: "text-muted-foreground/50"
														}`}
														weight={feature.enabled ? "fill" : "regular"}
													/>
													<span
														className={!feature.enabled ? "line-through" : ""}
													>
														{feature.name}
													</span>
												</li>
											))}
										</ul>
										<Button
											className="mt-8 w-full"
											variant={isMiddle ? "default" : "outline"}
											asChild
										>
											<Link href="/register">
												{plan.monthlyPrice === 0
													? "Get Started"
													: "Start Free Trial"}
											</Link>
										</Button>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24 bg-primary text-primary-foreground">
				<div className="container mx-auto px-6">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							Ready to supercharge your development?
						</h2>
						<p className="mt-4 text-lg opacity-90">
							Join thousands of developers using Ralph to ship faster with AI.
						</p>
						<div className="mt-10">
							<Button
								size="lg"
								variant="secondary"
								className="text-primary"
								asChild
							>
								<Link href="/register">
									Get Started for Free
									<ArrowRightIcon className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t py-12">
				<div className="container mx-auto px-6">
					<div className="flex flex-col items-center justify-between gap-4 md:flex-row">
						<div className="flex items-center gap-2">
							<RobotIcon className="h-6 w-6 text-primary" weight="duotone" />
							<span className="font-semibold">Ralph</span>
						</div>
						<p className="text-sm text-muted-foreground">
							{new Date().getFullYear()} Ralph. All rights reserved.
						</p>
						<div className="flex gap-4">
							<Link
								href="/privacy"
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								Privacy
							</Link>
							<Link
								href="/terms"
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								Terms
							</Link>
							<Link
								href="https://github.com/ralph-pm/ralph"
								target="_blank"
								className="text-sm text-muted-foreground hover:text-foreground"
							>
								GitHub
							</Link>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
