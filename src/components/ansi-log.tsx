"use client";

import type React from "react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface AnsiLogProps {
	content: string | string[];
	className?: string;
}

/**
 * A regex to split the text into chunks of plain text and ANSI escape sequences.
 * Matches: \x1b [ (any number of digits or ;) (m)
 */
const ANSI_REGEX = /(\x1b\[[0-9;]*m)/;

/**
 * Mapping of ANSI color codes to Tailwind/CSS variables.
 */
const ANSI_STYLES: Record<string, string> = {
	// Reset
	"0": "",
	// Styles
	"1": "font-bold",
	"2": "opacity-70", // Dim
	"4": "underline",
	// Foreground Colors
	"30": "text-slate-950 dark:text-slate-400", // Black
	"31": "text-red-600 dark:text-red-400", // Red
	"32": "text-emerald-600 dark:text-emerald-400", // Green
	"33": "text-amber-600 dark:text-amber-400", // Yellow
	"34": "text-blue-600 dark:text-blue-400", // Blue
	"35": "text-purple-600 dark:text-purple-400", // Magenta
	"36": "text-cyan-600 dark:text-cyan-400", // Cyan
	"37": "text-slate-200 dark:text-slate-100", // White
	// Bright Foreground
	"90": "text-slate-500",
	"91": "text-red-500",
	"92": "text-emerald-500",
	"93": "text-amber-500",
	"94": "text-blue-500",
	"95": "text-purple-500",
	"96": "text-cyan-500",
	"97": "text-white",
	// Background Colors
	"40": "bg-slate-900",
	"41": "bg-red-900/20",
	"42": "bg-emerald-900/20",
	"43": "bg-amber-900/20",
	"44": "bg-blue-900/20",
	"45": "bg-purple-900/20",
	"46": "bg-cyan-900/20",
	"47": "bg-slate-100 dark:bg-slate-800",
};

export function AnsiLog({ content, className }: AnsiLogProps) {
	const fullText = Array.isArray(content) ? content.join("\n") : content;

	const rendered = useMemo(() => {
		if (!fullText) return null;

		const parts = fullText.split(ANSI_REGEX);
		const result: React.ReactNode[] = [];
		const activeStyles = new Set<string>();

		parts.forEach((part, index) => {
			if (ANSI_REGEX.test(part)) {
				// Parse the ANSI escape sequence
				const codes = part.match(/[0-9]+/g) || ["0"];

				codes.forEach((code) => {
					if (code === "0") {
						activeStyles.clear();
					} else {
						activeStyles.add(code);
					}
				});
			} else if (part) {
				// Normal text, apply the current active styles
				const classNames = Array.from(activeStyles)
					.map((code) => ANSI_STYLES[code])
					.filter(Boolean)
					.join(" ");

				if (classNames) {
					result.push(
						<span key={index} className={classNames}>
							{part}
						</span>,
					);
				} else {
					result.push(part);
				}
			}
		});

		return result;
	}, [fullText]);

	return (
		<pre className={cn("font-mono whitespace-pre-wrap break-words", className)}>
			{rendered}
		</pre>
	);
}
