import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import {
	PROJECT_COOKIE_KEY,
	ProjectProvider,
} from "@/components/projects/project-provider";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ProjectMetadata } from "@/lib/projects/types";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Ralph JIRA - AI Project Management",
	description:
		"Local-first project management with autonomous AI task execution",
};

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

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth();

	// Fetch projects server-side if authenticated
	let initialProjects: ProjectMetadata[] | undefined;
	let initialSelectedProjectId: string | null = null;

	if (session?.user?.id) {
		initialProjects = await getProjects(session.user.id);

		// Read selected project from cookie
		const cookieStore = await cookies();
		const selectedProjectCookie = cookieStore.get(PROJECT_COOKIE_KEY);
		if (selectedProjectCookie?.value) {
			initialSelectedProjectId = selectedProjectCookie.value;
		}
	}

	return (
		<html lang="en" className={inter.variable} suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<SessionProvider session={session}>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<ProjectProvider
							initialProjects={initialProjects}
							initialSelectedProjectId={initialSelectedProjectId}
						>
							{children}
							<Toaster />
						</ProjectProvider>
					</ThemeProvider>
				</SessionProvider>
			</body>
		</html>
	);
}
