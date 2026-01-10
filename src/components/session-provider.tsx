"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

interface Props {
	children: React.ReactNode;
	session?: Session | null;
}

export function SessionProvider({ children, session }: Props) {
	return (
		<NextAuthSessionProvider
			session={session}
			// Disable refetching on window focus to reduce requests
			refetchOnWindowFocus={false}
		>
			{children}
		</NextAuthSessionProvider>
	);
}
