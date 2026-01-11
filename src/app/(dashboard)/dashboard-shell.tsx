"use client";

import { RobotIcon } from "@phosphor-icons/react";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

export function DashboardShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-background flex flex-col">
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto px-6 h-16 flex items-center justify-between">
					<nav className="flex items-center gap-2">
						<RobotIcon className="h-8 w-8 text-primary" weight="duotone" />
						<ProjectSwitcher />
					</nav>
					<UserMenu />
				</div>
			</header>
			<main className="flex-1 container mx-auto px-6 py-6">{children}</main>
		</div>
	);
}
