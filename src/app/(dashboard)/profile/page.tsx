import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileClient, type UserProfile } from "./profile-client";

async function getProfile(userId: string): Promise<UserProfile | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			name: true,
			avatarUrl: true,
			emailVerified: true,
			createdAt: true,
			lastLoginAt: true,
			passwordHash: true,
			memberships: {
				select: { role: true },
			},
		},
	});

	if (!user) {
		return null;
	}

	const isOrgOwner = user.memberships.some((m) => m.role === "owner");

	return {
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatarUrl,
		emailVerified: user.emailVerified !== null,
		createdAt: user.createdAt.toISOString(),
		lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
		hasPassword: !!user.passwordHash,
		isOrgOwner,
	};
}

export default async function ProfilePage() {
	const session = await auth();
	if (!session?.user?.id) {
		redirect("/login");
	}

	const profile = await getProfile(session.user.id);
	if (!profile) {
		redirect("/login");
	}

	return <ProfileClient initialUser={profile} />;
}
