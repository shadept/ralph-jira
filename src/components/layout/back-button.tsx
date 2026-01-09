"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
	href?: string;
	label?: string;
	className?: string;
}

export function BackButton({
	href,
	label = "Back",
	className,
}: BackButtonProps) {
	const router = useRouter();

	const baseProps = {
		variant: "ghost" as const,
		size: "sm" as const,
		className: cn(
			"gap-2 px-0 text-muted-foreground hover:text-foreground",
			className,
		),
	};

	if (href) {
		return (
			<Button {...baseProps} asChild>
				<Link href={href}>
					<ArrowLeft className="h-4 w-4" />
					<span>{label}</span>
				</Link>
			</Button>
		);
	}

	return (
		<Button {...baseProps} onClick={() => router.back()}>
			<ArrowLeft className="h-4 w-4" />
			<span>{label}</span>
		</Button>
	);
}
