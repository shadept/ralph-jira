"use client";

import { useEffect, useState } from "react";

type LocalCurrencyProps = {
	/** Amount in cents */
	cents: number;
	/** Currency code (default: USD) */
	currency?: string;
	className?: string;
};

/**
 * Formats cents as currency with locale-aware formatting on client.
 * Uses a consistent format on server, then switches to user's locale on client.
 */
export function LocalCurrency({
	cents,
	currency = "USD",
	className,
}: LocalCurrencyProps) {
	// SSR-safe fallback: simple dollar format
	const fallback = `$${(cents / 100).toFixed(2)}`;

	const [formatted, setFormatted] = useState(fallback);

	useEffect(() => {
		setFormatted(
			new Intl.NumberFormat(undefined, {
				style: "currency",
				currency,
			}).format(cents / 100),
		);
	}, [cents, currency]);

	return <span className={className}>{formatted}</span>;
}
