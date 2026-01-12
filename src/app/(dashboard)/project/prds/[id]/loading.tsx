import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PrdDetailLoading() {
	return (
		<>
			<PageHeader
				title="Loading PRD..."
				backLink={{ href: "/project/prds", label: "Back to PRDs" }}
			/>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Main content skeleton */}
				<div className="lg:col-span-3 space-y-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0">
							<Skeleton className="h-6 w-24" />
							<Skeleton className="h-4 w-32" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-[300px] w-full" />
						</CardContent>
					</Card>
				</div>

				{/* Sidebar skeleton */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<Skeleton className="h-4 w-16" />
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Skeleton className="h-3 w-12 mb-1" />
								<Skeleton className="h-8 w-full" />
							</div>
							<div>
								<Skeleton className="h-3 w-12 mb-1" />
								<Skeleton className="h-8 w-full" />
							</div>
							<div>
								<Skeleton className="h-3 w-8 mb-1" />
								<div className="flex gap-1 mb-2">
									<Skeleton className="h-5 w-12" />
									<Skeleton className="h-5 w-16" />
								</div>
								<Skeleton className="h-7 w-full" />
							</div>
							<div className="pt-2 border-t">
								<Skeleton className="h-3 w-16 mb-1" />
								<Skeleton className="h-4 w-32" />
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
