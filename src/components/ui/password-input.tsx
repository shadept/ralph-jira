"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

function PasswordInput({ className, ...props }: PasswordInputProps) {
	const [showPassword, setShowPassword] = useState(false);

	return (
		<div className={cn("relative", className)}>
			<Input
				type={showPassword ? "text" : "password"}
				className="pr-10"
				{...props}
			/>
			<button
				type="button"
				onClick={() => setShowPassword(!showPassword)}
				tabIndex={-1}
				className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				aria-label={showPassword ? "Hide password" : "Show password"}
			>
				{showPassword ? (
					<EyeSlashIcon className="h-4 w-4" />
				) : (
					<EyeIcon className="h-4 w-4" />
				)}
			</button>
		</div>
	);
}

export { PasswordInput };
