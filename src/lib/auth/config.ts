import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { z } from "zod";

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
	providers: [
		GitHub({
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
		}),
		Credentials({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const parsed = loginSchema.safeParse(credentials);
				if (!parsed.success) {
					return null;
				}

				const { email, password } = parsed.data;

				const user = await prisma.user.findUnique({
					where: { email, deletedAt: null },
					include: {
						memberships: {
							include: {
								organization: true,
							},
						},
					},
				});

				if (!user || !user.passwordHash) {
					return null;
				}

				const isValid = await bcrypt.compare(password, user.passwordHash);

				if (!isValid) {
					return null;
				}

				// Update last login
				await prisma.user.update({
					where: { id: user.id },
					data: { lastLoginAt: new Date() },
				});

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.avatarUrl,
				};
			},
		}),
	],
	callbacks: {
		async signIn({ user, account, profile }) {
			try {
				if (account?.provider === "github" && profile?.email) {
					// Check if user exists
					const existingUser = await prisma.user.findUnique({
						where: { email: profile.email },
					});

					if (!existingUser) {
						// User doesn't exist - they need to register first
						// OAuth users can only sign in if they already have an account
						return false;
					}

					// Update user info from GitHub if needed
					await prisma.user.update({
						where: { id: existingUser.id },
						data: {
							name: existingUser.name || profile.name || undefined,
							avatarUrl:
								existingUser.avatarUrl ||
								(profile as { avatar_url?: string }).avatar_url ||
								undefined,
							emailVerified: true,
							lastLoginAt: new Date(),
						},
					});
				}

				return true;
			} catch (error) {
				console.error("Auth signIn error:", error);
				return false;
			}
		},
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
			}
			return token;
		},
		async session({ session, token }) {
			try {
				if (token && session.user) {
					session.user.id = token.id as string;

					// Fetch user's organization memberships
					const user = await prisma.user.findUnique({
						where: { id: token.id as string },
						include: {
							memberships: {
								include: {
									organization: true,
								},
							},
						},
					});

					if (user) {
						// Add organizations to session using type assertion
						const sessionWithOrg = session as unknown as SessionWithOrg;
						sessionWithOrg.organizations = user.memberships.map((m) => ({
							id: m.organization.id,
							name: m.organization.name,
							slug: m.organization.slug,
							role: m.role as "owner" | "admin" | "member",
						}));
					}
				}
				return session;
			} catch (error) {
				console.error("Auth session error:", error);
				return session;
			}
		},
	},
	pages: {
		signIn: "/login",
		error: "/login",
	},
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	trustHost: true,
};

// Extended session type with organization info
export interface SessionWithOrg {
	user: {
		id: string;
		email: string;
		name?: string | null;
		image?: string | null;
	};
	organizations: Array<{
		id: string;
		name: string;
		slug: string;
		role: "owner" | "admin" | "member";
	}>;
	expires: string;
}
