import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Get initials from a name or email.
 * - If name has first and last, uses first letter of each (e.g., "John Doe" -> "JD")
 * - If name has only one word, uses first two characters
 * - If only email, uses first two characters
 * - Falls back to "??" if neither is provided
 */
export function getInitials(
	name: string | null | undefined,
	email: string | null | undefined,
): string {
	if (name) {
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
		}
		return name.substring(0, 2).toUpperCase();
	}
	if (email) {
		return email.substring(0, 2).toUpperCase();
	}
	return "??";
}

/**
 * Sanitizes text by replacing smart/curly quotes with straight ASCII quotes.
 * This is needed because AI models sometimes generate Unicode quotation marks
 * (U+201C, U+201D, U+2018, U+2019) which can cause parsing issues downstream.
 */
export function sanitizeQuotes(text: string): string {
	return text
		.replace(/[\u201C\u201D]/g, '"') // Smart double quotes → straight double quote
		.replace(/[\u2018\u2019]/g, "'"); // Smart single quotes → straight single quote
}

/**
 * Sanitizes an array of strings by replacing smart quotes in each element.
 */
export function sanitizeStringArray(arr: string[]): string[] {
	return arr.map(sanitizeQuotes);
}
