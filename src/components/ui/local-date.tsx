"use client";

import { type ComponentProps, useMemo } from "react";

type LocalDateTimeProps = ComponentProps<"time"> & {
	date: string | Date | null | undefined;
	options?: Intl.DateTimeFormatOptions;
	fallback?: string;
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
	year: "numeric",
	month: "short",
	day: "numeric",
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
	...DATE_OPTIONS,
	hour: "numeric",
	minute: "2-digit",
};

function LocalDateTimeBase({
	date,
	options,
	fallback = "Never",
	className,
	...props
}: LocalDateTimeProps & { options: Intl.DateTimeFormatOptions }) {
	const { dateObj, formattedDate } = useMemo(() => {
		if (!date) return { dateObj: null, formattedDate: "" };
		const dateObj = typeof date === "string" ? new Date(date) : date;
		return {
			dateObj,
			formattedDate: dateObj.toLocaleString(undefined, options),
		};
	}, [date, options]);

	if (!dateObj) {
		return <span className={className}>{fallback}</span>;
	}

	return (
		<time dateTime={dateObj.toISOString()} className={className} {...props}>
			{formattedDate}
		</time>
	);
}

export function LocalDate(props: LocalDateTimeProps) {
	return (
		<LocalDateTimeBase {...props} options={props.options ?? DATE_OPTIONS} />
	);
}

export function LocalDateTime(props: LocalDateTimeProps) {
	return (
		<LocalDateTimeBase {...props} options={props.options ?? DATETIME_OPTIONS} />
	);
}
