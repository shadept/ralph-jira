"use client";

import {
	BuildingsIcon,
	GearSixIcon,
	MonitorIcon,
	MoonIcon,
	SignOutIcon,
	SunIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";

interface User {
	id: string;
	email: string;
	name?: string | null;
	image?: string | null;
}

interface UserMenuProps {
	user: User;
}

export function UserMenu({ user }: UserMenuProps) {
	const router = useRouter();
	const { setTheme, theme, resolvedTheme } = useTheme();
	const selectedTheme = theme ?? "system";

	const handleSignOut = () => {
		signOut({ callbackUrl: "/" });
	};

	const initials = getInitials(user.name, user.email);
	const displayName = user.name || user.email;

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							className="relative h-9 w-9 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							asChild
						>
							<Avatar className="h-9 w-9">
								<AvatarImage src={user.image || undefined} alt={displayName} />
								<AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
									{initials}
								</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">Open user navigation menu</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					<div className="flex items-center gap-3">
						<Avatar className="h-9 w-9">
							<AvatarImage src={user.image || undefined} alt={displayName} />
							<AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
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
						{resolvedTheme === "light" && <SunIcon className="mr-2 h-4 w-4" />}
						{resolvedTheme === "dark" && <MoonIcon className="mr-2 h-4 w-4" />}
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
