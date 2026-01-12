import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { loadPrdById } from "@/lib/prds/server";
import { PrdDetailClient } from "./prd-detail-client";

interface PrdDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function PrdDetailPage({ params }: PrdDetailPageProps) {
	const { id } = await params;

	const result = await loadPrdById(id);

	if (result.status === "unauthorized") {
		redirect("/login");
	}

	if (result.status === "not_found") {
		return (
			<>
				<PageHeader
					title="PRD Not Found"
					backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				/>
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">PRD not found</p>
					<p className="text-sm text-muted-foreground max-w-md">
						This PRD may have been deleted or you don't have access to it.
					</p>
					<Button asChild className="mt-2">
						<a href="/project/prds">Back to PRDs</a>
					</Button>
				</div>
			</>
		);
	}

	if (result.status === "no_access") {
		return (
			<>
				<PageHeader
					title="Access Denied"
					backLink={{ href: "/project/prds", label: "Back to PRDs" }}
				/>
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">Access denied</p>
					<p className="text-sm text-muted-foreground max-w-md">
						You don't have permission to view this PRD.
					</p>
					<Button asChild className="mt-2">
						<a href="/project/prds">Back to PRDs</a>
					</Button>
				</div>
			</>
		);
	}

	return <PrdDetailClient initialPrd={result.prd} prdId={id} initialLinkedSprints={result.linkedSprints} />;
}
