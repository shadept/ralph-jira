"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileXIcon, HouseIcon } from "@phosphor-icons/react";

/**
 * This page has been permanently removed (HTTP 410 Gone equivalent).
 * The Files & Artifacts feature was deprecated as it exposed internal
 * implementation details (plans/*.json) that are not relevant to end users.
 *
 * Related features are now accessible via:
 * - PRDs: /project/prds
 * - Sprints: /project/sprints
 * - Settings: /project/settings
 * - Progress: Available within sprint run views
 */
export default function FilesRemovedPage() {
	return (
		<>
			<PageHeader
				title="Feature Removed"
				description="This page is no longer available"
				backLink={{ href: "/project", label: "Back to Project" }}
			/>
			<Card className="max-w-2xl">
				<CardHeader>
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-muted p-3">
							<FileXIcon className="h-6 w-6 text-muted-foreground" />
						</div>
						<CardTitle>Files &amp; Artifacts has been removed</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground">
						The Files &amp; Artifacts feature has been permanently removed from
						Ralph. The functionality you&apos;re looking for is now available in
						other areas:
					</p>
					<ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
						<li>
							<strong>PRDs</strong> – View and manage requirements at{" "}
							<Link href="/project/prds" className="text-primary underline">
								/project/prds
							</Link>
						</li>
						<li>
							<strong>Sprints</strong> – View sprint details and progress at{" "}
							<Link href="/project/sprints/prd" className="text-primary underline">
								/project/sprints
							</Link>
						</li>
						<li>
							<strong>Settings</strong> – Configure project settings at{" "}
							<Link href="/project/settings" className="text-primary underline">
								/project/settings
							</Link>
						</li>
					</ul>
					<div className="pt-4">
						<Button asChild>
							<Link href="/project">
								<HouseIcon className="mr-2 h-4 w-4" />
								Go to Project Home
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</>
	);
}
