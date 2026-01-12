"use client";

import type { ReactNode } from "react";
import { BackButton } from "./back-button";

type PageHeaderProps = {
	title: ReactNode;
	description?: string;
	actions?: ReactNode;
	backLink?: {
		href?: string;
		label?: string;
	};
};

export function PageHeader({
	title,
	description,
	actions,
	backLink,
}: PageHeaderProps) {
	return (
		<div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between">
			<div className="flex-1 min-w-0 space-y-2">
				{backLink && <BackButton href={backLink.href} label={backLink.label} />}
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">
						{title}
					</h1>
					{description && (
						<p className="text-sm text-muted-foreground mt-1">{description}</p>
					)}
				</div>
			</div>
			{actions && (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			)}
		</div>
	);
}
