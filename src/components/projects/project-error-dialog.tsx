"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface ProjectErrorDialogProps {
	projectName?: string;
	projectId: string;
	message: string;
	details?: string;
	onClose: () => void;
	onRegenerate: () => Promise<void>;
	onRemove: () => Promise<void>;
}

export function ProjectErrorDialog({
	projectName,
	projectId,
	message,
	details,
	onClose,
	onRegenerate,
	onRemove,
}: ProjectErrorDialogProps) {
	const [pendingAction, setPendingAction] = useState<
		"regenerate" | "remove" | null
	>(null);

	const handleRegenerate = async () => {
		try {
			setPendingAction("regenerate");
			await onRegenerate();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to regenerate project",
			);
		} finally {
			setPendingAction(null);
		}
	};

	const handleRemove = async () => {
		try {
			setPendingAction("remove");
			await onRemove();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove project",
			);
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && pendingAction === null) onClose();
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
					<Button
						variant="outline"
						onClick={onClose}
						disabled={pendingAction !== null}
					>
						Close
					</Button>
					<Button
						variant="destructive"
						onClick={handleRemove}
						disabled={pendingAction === "regenerate"}
					>
						{pendingAction === "remove" ? "Removing..." : "Remove Project"}
					</Button>
					<Button
						onClick={handleRegenerate}
						disabled={pendingAction === "remove"}
					>
						{pendingAction === "regenerate"
							? "Regenerating..."
							: "Regenerate Project"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
