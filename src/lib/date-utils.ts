/**
 * Converts a date value to ISO string format.
 * Handles both Date objects and string values (from SQLite adapter).
 */
export function toISOString(date: Date | string): string {
	return typeof date === "string" ? date : date.toISOString();
}

/**
 * Converts an optional date value to ISO string format or null.
 */
export function toISOStringOrNull(
	date: Date | string | null | undefined,
): string | null {
	if (date === null || date === undefined) {
		return null;
	}
	return typeof date === "string" ? date : date.toISOString();
}
