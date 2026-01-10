"use client";

import { useForm } from "@tanstack/react-form";
import { type ChangeEvent, useRef, useState } from "react";

const BROWSER_FOLDER_LIMITATION_MESSAGE = `Chrome can't share the exact folder path. After you approve the "Upload folder" prompt, copy the full path from File Explorer (Alt + D → Ctrl + C) or Finder (⌘ + ⌥ + C) and paste it here.`;

import { TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectContext } from "./project-provider";

interface ProjectManagerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ProjectManagerDialog({
	open,
	onOpenChange,
}: ProjectManagerDialogProps) {
	const { projects, addProject, removeProject, currentProject } =
		useProjectContext();
	const [submitting, setSubmitting] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [needsManualPathEntry, setNeedsManualPathEntry] = useState(false);
	const folderInputRef = useRef<HTMLInputElement | null>(null);
	const manualEntryToastShownRef = useRef(false);

	const form = useForm({
		defaultValues: {
			name: "",
			path: "",
		},
		onSubmit: async ({ value }) => {
			if (!value.name.trim() || !value.path.trim()) {
				toast.error("Please provide both project name and path");
				return;
			}

			try {
				setSubmitting(true);
				await addProject({
					name: value.name.trim(),
					repoUrl: value.path.trim(),
				});
				form.reset();
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to create project",
				);
			} finally {
				setSubmitting(false);
			}
		},
	});

	const handleRemove = async (id: string, name: string) => {
		if (typeof window !== "undefined") {
			const confirmed = window.confirm(`Remove project "${name}" from Ralph?`);
			if (!confirmed) return;
		}

		try {
			setRemovingId(id);
			await removeProject(id);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove project",
			);
		} finally {
			setRemovingId(null);
		}
	};

	const openFolderPicker = () => {
		folderInputRef.current?.click();
	};

	const handleFolderSelected = (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const firstFile = files[0] as File & { path?: string };
		const absolutePath = firstFile.path?.trim();
		const relativePath = firstFile.webkitRelativePath;
		const relativeRoot = relativePath ? relativePath.split(/[\\/]/)[0] : "";
		const fallbackName = relativeRoot || firstFile.name;

		if (absolutePath) {
			form.setFieldValue("path", absolutePath);
			setNeedsManualPathEntry(false);
			manualEntryToastShownRef.current = false;
		} else {
			if (!manualEntryToastShownRef.current) {
				toast.info(BROWSER_FOLDER_LIMITATION_MESSAGE);
				manualEntryToastShownRef.current = true;
			}
			setNeedsManualPathEntry(true);
			const currentPath = form.getFieldValue("path");
			form.setFieldValue("path", currentPath || fallbackName);
			if (typeof window !== "undefined") {
				window.requestAnimationFrame(() => {
					document.getElementById("path")?.focus();
				});
			}
		}

		event.target.value = "";
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>Manage Projects</DialogTitle>
					<DialogDescription>
						Add or remove workspaces tracked by Ralph.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-6 md:grid-cols-2">
					<div className="flex flex-col h-full">
						<h3 className="text-sm font-semibold mb-2">Tracked Projects</h3>
						<ScrollArea className="flex-1 min-h-[240px] rounded-md border p-3">
							{projects.length === 0 && (
								<p className="text-sm text-muted-foreground">
									No projects configured.
								</p>
							)}
							<div className="space-y-3">
								{projects.map((project) => (
									<div
										key={project.id}
										className="border rounded-md p-3 flex flex-col gap-1"
									>
										<div className="flex items-center justify-between">
											<p className="font-medium text-sm">
												{project.name}
												{currentProject?.id === project.id && (
													<span className="ml-2 text-xs text-primary">
														(Active)
													</span>
												)}
											</p>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => handleRemove(project.id, project.name)}
												disabled={removingId === project.id}
											>
												<TrashIcon className="w-4 h-4" />
											</Button>
										</div>
										<p className="text-xs text-muted-foreground break-all">
											{project.path}
										</p>
									</div>
								))}
							</div>
						</ScrollArea>
					</div>

					<form
						className="space-y-4 flex flex-col h-full"
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<form.Field name="name">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Project Name</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="My Project"
										className="mt-1"
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="path">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>Project Root Path</Label>
									<div className="mt-1 flex gap-2">
										<Input
											id={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="C:\\Projects\\my-project"
											className="font-mono text-xs"
											aria-describedby="project-path-help"
											autoComplete="off"
										/>
										<Button
											type="button"
											variant="outline"
											onClick={openFolderPicker}
											title="Chrome may label this action as 'Upload folder'. Ralph never uploads your files."
										>
											Browse…
										</Button>
										<input
											ref={folderInputRef}
											type="file"
											className="hidden"
											onChange={handleFolderSelected}
											{...({
												webkitdirectory: "true",
												directory: "true",
												mozdirectory: "true",
											} as Record<string, string>)}
										/>
									</div>
									<p
										id="project-path-help"
										className="text-xs text-muted-foreground mt-2"
									>
										Chrome will show an &ldquo;Upload folder&rdquo; prompt
										because it scans the folder to infer its path. Ralph never
										uploads your files—everything stays on this device. If the
										picker only returns the folder name, copy the full path from
										your file manager and paste it above.
									</p>

									{needsManualPathEntry && (
										<div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
											{BROWSER_FOLDER_LIMITATION_MESSAGE}
										</div>
									)}
								</div>
							)}
						</form.Field>

						<DialogFooter className="mt-auto">
							<Button type="submit" disabled={submitting}>
								{submitting ? "Adding..." : "Add Project"}
							</Button>
						</DialogFooter>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
