"use client";

import { RobotIcon } from "@phosphor-icons/react";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

interface User {
	id: string;
	email: string;
	name?: string | null;
	image?: string | null;
}

interface DashboardShellProps {
	children: React.ReactNode;
	user: User;
}

export function DashboardShell({ children, user }: DashboardShellProps) {
	return (
		<div className="min-h-screen bg-background flex flex-col">
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="mx-auto w-full max-w-[1920px] px-6 h-16 flex items-center justify-between">
					<nav className="flex items-center gap-2">
						<RobotIcon className="h-8 w-8 text-primary" weight="duotone" />
						<ProjectSwitcher />
					</nav>
					<UserMenu user={user} />
				</div>
			</header>
			<main className="mx-auto w-full max-w-[1920px] flex flex-1 flex-col px-6 py-6">
				{children}
			</main>
		</div>
	);
}
