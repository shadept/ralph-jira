"use client";

import { useEffect, useState } from "react";

const phrases = [
	"Ship faster",
	"Deliver more",
	"Build smarter",
	"Scale effortlessly",
];

export function HeroRotatingText() {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex((prev) => (prev + 1) % phrases.length);
		}, 2500);
		return () => clearInterval(interval);
	}, []);

	return (
		<span
			key={index}
			className="inline-block text-primary animate-in fade-in slide-in-from-bottom-4 duration-500"
		>
			{phrases[index]}
		</span>
	);
}
