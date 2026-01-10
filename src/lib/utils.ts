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
