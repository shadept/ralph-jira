"use client";

import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CaretDown, Check, Plus } from "@phosphor-icons/react";
import { useProjectContext } from "./project-provider";
import { ProjectManagerDialog } from "./project-manager-dialog";

export function ProjectSwitcher() {
	const { projects, currentProject, selectProject, loading } =
		useProjectContext();
	const [managerOpen, setManagerOpen] = useState(false);

	const hasProjects = projects.length > 0;

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="gap-2" disabled={loading}>
						<span className="text-sm font-medium">
							{currentProject
								? currentProject.name
								: loading
									? "Loading projects..."
									: "No project"}
						</span>
						<CaretDown className="w-4 h-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel>Projects</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{projects.length === 0 && (
						<DropdownMenuItem disabled>
							<span className="text-xs text-muted-foreground">
								No projects yet
							</span>
						</DropdownMenuItem>
					)}
					{projects.map((project) => (
						<DropdownMenuItem
							key={project.id}
							onClick={() => selectProject(project.id)}
							className="flex items-center justify-between"
						>
							<div>
								<p className="text-sm font-medium">{project.name}</p>
								<p className="text-xs text-muted-foreground truncate">
									{project.path}
								</p>
							</div>
							{currentProject?.id === project.id && (
								<Check className="w-4 h-4 text-primary" />
							)}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => setManagerOpen(true)}
						className="gap-2"
					>
						<Plus className="w-4 h-4" />
						Manage Projects
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ProjectManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
		</div>
	);
}
