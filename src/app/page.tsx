"use client";

import {
	ArrowRight,
	CheckCircle,
	GithubLogo,
	Kanban,
	Lightning,
	Robot,
	Sparkle,
	Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

interface Plan {
	id: string;
	name: string;
	displayName: string;
	description: string | null;
	maxUsers: number | null;
	maxProjects: number | null;
	maxAiRunsPerWeek: number | null;
	maxIterationsPerRun: number;
	monthlyPrice: number;
	yearlyPrice: number;
	features: Record<string, boolean>;
}

const features = [
	{
		icon: Robot,
		title: "AI-Powered Task Execution",
		description:
			"Let AI autonomously work on your tasks with multi-iteration support and intelligent progress tracking.",
	},
	{
		icon: Kanban,
		title: "Intuitive Kanban Boards",
		description:
			"Visualize your workflow with drag-and-drop sprint boards, status tracking, and real-time updates.",
	},
	{
		icon: Lightning,
		title: "Sprint Planning",
		description:
			"Plan sprints efficiently with AI-assisted task generation, prioritization, and time estimation.",
	},
	{
		icon: Users,
		title: "Team Collaboration",
		description:
			"Invite team members, assign tasks, and collaborate seamlessly with role-based permissions.",
	},
	{
		icon: Sparkle,
		title: "AI Assistant",
		description:
			"Chat with AI to manage your project, generate acceptance criteria, and get intelligent suggestions.",
	},
	{
		icon: CheckCircle,
		title: "Progress Tracking",
		description:
			"Monitor task execution in real-time with detailed logs, metrics, and completion tracking.",
	},
];

export default function HomePage() {
	const [plans, setPlans] = useState<Plan[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchPlans() {
			try {
				const res = await fetch("/api/plans");
				const data = await res.json();
				if (data.success) {
					setPlans(data.data);
				}
			} catch (error) {
				console.error("Failed to fetch plans:", error);
			} finally {
				setLoading(false);
			}
		}
		fetchPlans();
	}, []);

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto px-6 flex h-16 items-center justify-between">
					<div className="flex items-center gap-2">
						<Robot className="h-8 w-8 text-primary" weight="duotone" />
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
						<Badge variant="outline" className="mb-4">
							AI-Powered Project Management
						</Badge>
						<h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
							Ship faster with{" "}
							<span className="text-primary">autonomous AI</span> task execution
						</h1>
						<p className="mt-6 text-lg text-muted-foreground md:text-xl">
							Ralph is a local-first project management tool that combines
							intuitive Kanban boards with AI-powered autonomous task execution.
							Let AI handle the implementation while you focus on what matters.
						</p>
						<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Button size="lg" asChild>
								<Link href="/register">
									Start for Free
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="https://github.com/ralph-pm/ralph" target="_blank">
									<GithubLogo className="mr-2 h-4 w-4" />
									View on GitHub
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-24 bg-muted/50">
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
			<section id="pricing" className="py-24">
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
						{loading ? (
							[1, 2, 3].map((i) => (
								<Card key={i} className="animate-pulse">
									<CardHeader>
										<div className="h-6 w-20 bg-muted rounded" />
										<div className="h-10 w-32 bg-muted rounded mt-4" />
									</CardHeader>
									<CardContent>
										<div className="space-y-3">
											{[1, 2, 3, 4].map((j) => (
												<div key={j} className="h-4 bg-muted rounded" />
											))}
										</div>
									</CardContent>
								</Card>
							))
						) : plans.length > 0 ? (
							plans.map((plan, index) => (
								<Card
									key={plan.id}
									className={index === 1 ? "border-primary shadow-lg" : ""}
								>
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle>{plan.displayName}</CardTitle>
											{index === 1 && <Badge variant="default">Popular</Badge>}
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
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>
													{plan.maxUsers
														? `Up to ${plan.maxUsers} team members`
														: "Unlimited team members"}
												</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>
													{plan.maxProjects
														? `Up to ${plan.maxProjects} projects`
														: "Unlimited projects"}
												</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>
													{plan.maxAiRunsPerWeek
														? `${plan.maxAiRunsPerWeek} AI runs/week`
														: "Unlimited AI runs"}
												</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>
													{plan.maxIterationsPerRun} iterations per run
												</span>
											</li>
											{Object.entries(plan.features).map(([key, enabled]) => (
												<li
													key={key}
													className={`flex items-center gap-2 ${
														!enabled && "text-muted-foreground line-through"
													}`}
												>
													<CheckCircle
														className={`h-5 w-5 ${
															enabled ? "text-primary" : "text-muted"
														}`}
														weight={enabled ? "fill" : "regular"}
													/>
													<span>
														{key
															.replace(/([A-Z])/g, " $1")
															.replace(/^./, (str) => str.toUpperCase())}
													</span>
												</li>
											))}
										</ul>
										<Button
											className="mt-8 w-full"
											variant={index === 1 ? "default" : "outline"}
											asChild
										>
											<Link href="/register">
												{plan.monthlyPrice === 0
													? "Get Started Free"
													: "Start Free Trial"}
											</Link>
										</Button>
									</CardContent>
								</Card>
							))
						) : (
							// Default plans if none in database
							<>
								<Card>
									<CardHeader>
										<CardTitle>Free</CardTitle>
										<div className="mt-4">
											<span className="text-4xl font-bold">$0</span>
											<span className="text-muted-foreground">/month</span>
										</div>
										<CardDescription className="mt-2">
											Perfect for getting started
										</CardDescription>
									</CardHeader>
									<CardContent>
										<ul className="space-y-3">
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>Up to 3 team members</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>2 projects</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>10 AI runs/week</span>
											</li>
										</ul>
										<Button className="mt-8 w-full" variant="outline" asChild>
											<Link href="/register">Get Started Free</Link>
										</Button>
									</CardContent>
								</Card>
								<Card className="border-primary shadow-lg">
									<CardHeader>
										<div className="flex items-center justify-between">
											<CardTitle>Pro</CardTitle>
											<Badge variant="default">Popular</Badge>
										</div>
										<div className="mt-4">
											<span className="text-4xl font-bold">$29</span>
											<span className="text-muted-foreground">/month</span>
										</div>
										<CardDescription className="mt-2">
											For growing teams
										</CardDescription>
									</CardHeader>
									<CardContent>
										<ul className="space-y-3">
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>Up to 10 team members</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>Unlimited projects</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>100 AI runs/week</span>
											</li>
										</ul>
										<Button className="mt-8 w-full" asChild>
											<Link href="/register">Start Free Trial</Link>
										</Button>
									</CardContent>
								</Card>
								<Card>
									<CardHeader>
										<CardTitle>Enterprise</CardTitle>
										<div className="mt-4">
											<span className="text-4xl font-bold">Custom</span>
										</div>
										<CardDescription className="mt-2">
											For large organizations
										</CardDescription>
									</CardHeader>
									<CardContent>
										<ul className="space-y-3">
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>Unlimited team members</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>Unlimited everything</span>
											</li>
											<li className="flex items-center gap-2">
												<CheckCircle
													className="h-5 w-5 text-primary"
													weight="fill"
												/>
												<span>Priority support</span>
											</li>
										</ul>
										<Button className="mt-8 w-full" variant="outline" asChild>
											<Link href="mailto:sales@ralph.app">Contact Sales</Link>
										</Button>
									</CardContent>
								</Card>
							</>
						)}
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
									<ArrowRight className="ml-2 h-4 w-4" />
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
							<Robot className="h-6 w-6 text-primary" weight="duotone" />
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
