"use client";

import { ReactNode } from "react";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { BackButton } from "./back-button";
import { UserMenu } from "./user-menu";

interface AppLayoutProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	fluid?: boolean;
	backLink?: {
		href?: string;
		label?: string;
	};
}

export function AppLayout({
	title,
	description,
	actions,
	children,
	fluid = false,
	backLink,
}: AppLayoutProps) {
	const wrapperClass = fluid ? "w-full px-6" : "container mx-auto px-6";

	return (
		<div className="min-h-screen bg-background flex flex-col">
			<header className="border-b bg-card/50">
				<div className="container mx-auto px-6 flex flex-col gap-4 py-5 md:flex-row md:items-start md:justify-between">
					<div className="flex-1 min-w-0 space-y-3">
						{backLink ? (
							<BackButton href={backLink.href} label={backLink.label} />
						) : null}
						<div>
							<h1 className="text-3xl font-bold tracking-tight text-foreground">
								{title}
							</h1>
							{description ? (
								<p className="text-sm text-muted-foreground mt-1">
									{description}
								</p>
							) : null}
						</div>
						{actions ? (
							<div className="flex flex-wrap items-center gap-2">{actions}</div>
						) : null}
					</div>
					<div className="flex items-center gap-2 self-stretch md:self-auto">
						<ProjectSwitcher />
						<UserMenu />
					</div>
				</div>
			</header>

			<main className={`${wrapperClass} py-6 flex flex-1 flex-col`}>
				{children}
			</main>
		</div>
	);
}
