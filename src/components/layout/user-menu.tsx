"use client";

import {
	BuildingsIcon,
	CaretDownIcon,
	GearSixIcon,
	MonitorIcon,
	MoonIcon,
	SignOutIcon,
	SunIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { getInitials } from "@/lib/utils";

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
					<Avatar className="h-8 w-8">
						<AvatarImage src={user.image || undefined} alt={displayName} />
						<AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
							{initials}
						</AvatarFallback>
					</Avatar>
					<CaretDownIcon className="h-4 w-4 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					<div className="flex items-center gap-3">
						<Avatar className="h-10 w-10">
							<AvatarImage src={user.image || undefined} alt={displayName} />
							<AvatarFallback className="bg-primary/10 text-primary">
								{initials}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="font-semibold text-foreground truncate">
								{displayName}
							</p>
							{user.email && (
								<p className="text-xs text-muted-foreground truncate">
									{user.email}
								</p>
							)}
						</div>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => router.push("/profile")}>
					<UserIcon className="mr-2 h-4 w-4" />
					Profile
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => router.push("/organization")}>
					<BuildingsIcon className="mr-2 h-4 w-4" />
					Organization
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => router.push("/project/settings")}>
					<GearSixIcon className="mr-2 h-4 w-4" />
					Project Settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<SunIcon className="mr-2 h-4 w-4" />
						Theme
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem onClick={() => setTheme("light")}>
							<SunIcon className="mr-2 h-4 w-4" /> Light
							{selectedTheme === "light" && (
								<span className="ml-auto text-xs text-primary">Active</span>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme("dark")}>
							<MoonIcon className="mr-2 h-4 w-4" /> Dark
							{selectedTheme === "dark" && (
								<span className="ml-auto text-xs text-primary">Active</span>
							)}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => setTheme("system")}>
							<MonitorIcon className="mr-2 h-4 w-4" /> System
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
