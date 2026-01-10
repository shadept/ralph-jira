"use client";

import {
	Buildings,
	CaretDown,
	GearSix,
	Monitor,
	Moon,
	SignOut as SignOutIcon,
	Sun,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(
	name: string | null | undefined,
	email: string | null | undefined,
): string {
	if (name) {
		const parts = name.split(" ");
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
		}
		return name.substring(0, 2).toUpperCase();
	}
	if (email) {
		return email.substring(0, 2).toUpperCase();
	}
	return "??";
}

export function UserMenu() {
	const router = useRouter();
	const { setTheme, theme } = useTheme();
	const { data: session, status } = useSession();
	const selectedTheme = theme ?? "system";

	const handleSignOut = () => {
		signOut({ callbackUrl: "/" });
	};

	// Don't render if not authenticated
	if (status === "loading") {
		return (
			<Button variant="outline" size="sm" className="gap-2" disabled>
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted animate-pulse" />
			</Button>
		);
	}

	if (status === "unauthenticated" || !session?.user) {
		return null;
	}

	const user = session.user;
	const initials = getInitials(user.name, user.email);
	const displayName = user.name || user.email || "User";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					{user.image ? (
						<img
							src={user.image}
							alt={displayName}
							className="h-8 w-8 rounded-full"
						/>
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
							{initials}
						</div>
					)}
					<CaretDown className="h-4 w-4 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					<p className="text-xs text-muted-foreground">Signed in as</p>
					<p className="font-semibold text-foreground">{displayName}</p>
					{user.email && user.name && (
						<p className="text-xs text-muted-foreground">{user.email}</p>
					)}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => router.push("/organization")}>
					<Buildings className="mr-2 h-4 w-4" />
					Organization
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => router.push("/project/settings")}>
					<GearSix className="mr-2 h-4 w-4" />
					Project Settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Sun className="mr-2 h-4 w-4" />
						Theme
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem onClick={() => setTheme("light")}>
							<Sun className="mr-2 h-4 w-4" /> Light
							{selectedTheme === "light" && (
								<span className="ml-auto text-xs text-primary">Active</span>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme("dark")}>
							<Moon className="mr-2 h-4 w-4" /> Dark
							{selectedTheme === "dark" && (
								<span className="ml-auto text-xs text-primary">Active</span>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme("system")}>
							<Monitor className="mr-2 h-4 w-4" /> System
							{selectedTheme === "system" && (
								<span className="ml-auto text-xs text-primary">Active</span>
							)}
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onClick={handleSignOut}>
					<SignOutIcon className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
