import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
	PROJECT_COOKIE_KEY,
	ProjectProvider,
} from "@/components/projects/project-provider";
import { SessionProvider } from "@/components/session-provider";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ProjectMetadata } from "@/lib/projects/types";
import { DashboardShell } from "./dashboard-shell";

async function getProjects(userId: string): Promise<ProjectMetadata[]> {
	const membership = await prisma.organizationMember.findFirst({
		where: { userId },
		select: { organizationId: true },
	});

	if (!membership) {
		return [];
	}

	const projects = await prisma.project.findMany({
		where: {
			organizationId: membership.organizationId,
			deletedAt: null,
		},
		select: {
			id: true,
			name: true,
			repoUrl: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: { updatedAt: "desc" },
	});
	return projects.map((p) => ({
		id: p.id,
		name: p.name,
		path: p.repoUrl ?? "",
		createdAt: p.createdAt.toISOString(),
		updatedAt: p.updatedAt.toISOString(),
	}));
}

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	const user = session?.user;
	if (!user?.id || !user.email) {
		redirect("/login");
	}

	const projects = await getProjects(user.id);

	const cookieStore = await cookies();
	const selectedProjectCookie = cookieStore.get(PROJECT_COOKIE_KEY);
	const selectedProjectId = selectedProjectCookie?.value ?? null;

	return (
		<SessionProvider session={session}>
			<ProjectProvider
				projects={projects}
				selectedProjectId={selectedProjectId}
			>
				<DashboardShell user={{ ...user, id: user.id, email: user.email }}>
					{children}
				</DashboardShell>
			</ProjectProvider>
		</SessionProvider>
	);
}
