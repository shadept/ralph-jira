"use client";

import { type ComponentProps, useMemo } from "react";

type LocalCurrencyProps = ComponentProps<"span"> & {
	/** Amount in cents */
	cents: number;
	/** Currency code (default: USD) */
	currency?: string;
};

/**
 * Formats cents as currency with locale-aware formatting.
 */
export function LocalCurrency({
	cents,
	currency = "USD",
	className,
	...props
}: LocalCurrencyProps) {
	const formatted = useMemo(
		() =>
			new Intl.NumberFormat(undefined, {
				style: "currency",
				currency,
			}).format(cents / 100),
		[cents, currency],
	);

	return (
		<span className={className} {...props}>
			{formatted}
		</span>
	);
}
