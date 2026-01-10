"use client";

import { useState } from "react";
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

export interface ProjectErrorDialogProps {
	projectName?: string;
	projectId: string;
	message: string;
	details?: string;
	onClose: () => void;
	onRemove: () => Promise<void>;
}

export function ProjectErrorDialog({
	projectName,
	projectId,
	message,
	details,
	onClose,
	onRemove,
}: ProjectErrorDialogProps) {
	const [removing, setRemoving] = useState(false);

	const handleRemove = async () => {
		try {
			setRemoving(true);
			await onRemove();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove project",
			);
		} finally {
			setRemoving(false);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !removing) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Unable to load project</DialogTitle>
					<DialogDescription>{projectName || projectId}</DialogDescription>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">{message}</p>
				{details && (
					<pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
						{details}
					</pre>
				)}
				<DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
					<Button variant="outline" onClick={onClose} disabled={removing}>
						Close
					</Button>
					<Button
						variant="destructive"
						onClick={handleRemove}
						disabled={removing}
					>
						{removing ? "Removing..." : "Remove Project"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
