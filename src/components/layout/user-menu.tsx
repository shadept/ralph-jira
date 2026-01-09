"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	CaretDown,
	GearSix,
	SignOut,
	SquaresFour,
	UserCircle,
	Bell,
	Sun,
	Moon,
	Monitor,
} from "@phosphor-icons/react";

export function UserMenu() {
	const { setTheme, theme } = useTheme();
	const selectedTheme = theme ?? "system";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
						AJ
					</div>
					<CaretDown className="h-4 w-4 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<DropdownMenuLabel>
					<p className="text-xs text-muted-foreground">Signed in as</p>
					<p className="font-semibold text-foreground">alex.johnson</p>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem>
					<UserCircle className="mr-2 h-4 w-4" />
					Profile
				</DropdownMenuItem>
				<DropdownMenuItem>
					<SquaresFour className="mr-2 h-4 w-4" />
					My Workspace
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Bell className="mr-2 h-4 w-4" />
					Notifications
					<DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
				</DropdownMenuItem>
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
				<DropdownMenuItem>
					<GearSix className="mr-2 h-4 w-4" />
					Settings
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive">
					<SignOut className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
