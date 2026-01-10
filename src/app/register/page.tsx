"use client";

import {
	ArrowLeftIcon,
	ArrowRightIcon,
	BuildingIcon,
	CheckCircleIcon,
	RobotIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

// Setup zxcvbn with dictionaries
const options = {
	translations: zxcvbnEnPackage.translations,
	graphs: zxcvbnCommonPackage.adjacencyGraphs,
	dictionary: {
		...zxcvbnCommonPackage.dictionary,
		...zxcvbnEnPackage.dictionary,
	},
};
zxcvbnOptions.setOptions(options);

type FormErrors = Record<string, string[]>;

type PasswordStrength = {
	score: number;
	label: string;
	color: string;
};

function getPasswordStrength(password: string): PasswordStrength {
	if (!password) {
		return { score: 0, label: "", color: "bg-muted" };
	}

	if (password.length < 8) {
		return { score: 0, label: "Too short", color: "bg-muted" };
	}

	const result = zxcvbn(password);

	const levels: Record<number, { label: string; color: string }> = {
		0: { label: "Very weak", color: "bg-destructive" },
		1: { label: "Weak", color: "bg-destructive" },
		2: { label: "Fair", color: "bg-amber-500" },
		3: { label: "Strong", color: "bg-emerald-500" },
		4: { label: "Very strong", color: "bg-emerald-600" },
	};

	return { score: result.score, ...levels[result.score] };
}

export default function RegisterPage() {
	const router = useRouter();
	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});

	const form = useForm({
		defaultValues: {
			orgName: "",
			orgSlug: "",
			name: "",
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setLoading(true);
			setErrors({});

			try {
				const res = await fetch("/api/register", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(value),
				});

				const data = await res.json();

				if (!data.success) {
					setErrors(data.errors || {});
					if (data.errors?.orgName || data.errors?.orgSlug) {
						setStep(1);
					}
					return;
				}

				toast.success("Registration successful! Signing you in...");

				const signInResult = await signIn("credentials", {
					email: value.email,
					password: value.password,
					redirect: false,
				});

				if (signInResult?.error) {
					toast.error(
						"Account created but couldn't sign in. Please log in manually.",
					);
					router.push("/login");
				} else {
					router.push("/project");
				}
			} catch {
				toast.error("An error occurred. Please try again.");
			} finally {
				setLoading(false);
			}
		},
	});

	const handleOrgNameChange = (value: string) => {
		form.setFieldValue("orgName", value);
		// Auto-generate slug from name
		const slug = value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		form.setFieldValue("orgSlug", slug);
	};

	const validateStep1 = async (): Promise<boolean> => {
		setLoading(true);
		setErrors({});

		const orgName = form.getFieldValue("orgName");
		const orgSlug = form.getFieldValue("orgSlug");

		try {
			const res = await fetch("/api/register/validate-step1", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ orgName, orgSlug }),
			});

			const data = await res.json();

			if (!data.success) {
				setErrors(data.errors || {});
				return false;
			}

			return true;
		} catch {
			toast.error("An error occurred. Please try again.");
			return false;
		} finally {
			setLoading(false);
		}
	};

	const handleStep1Submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const isValid = await validateStep1();
		if (isValid) {
			setStep(2);
		}
	};

	const getFieldError = (field: string) => errors[field]?.[0];

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 p-6 md:p-10">
			<div className="w-full max-w-sm md:max-w-4xl">
				<Card className="overflow-hidden p-0">
					<CardContent className="grid p-0 md:grid-cols-2">
						<div className="p-6 md:p-8">
							<div className="flex flex-col gap-6">
								<div className="flex flex-col items-center gap-2 text-center">
									<Link
										href="/"
										className="inline-flex items-center justify-center gap-2"
									>
										<RobotIcon
											className="h-8 w-8 text-primary"
											weight="duotone"
										/>
										<span className="text-xl font-bold">Ralph</span>
									</Link>
									<h1 className="text-2xl font-bold">Create your account</h1>
									<p className="text-muted-foreground text-balance text-sm">
										{step === 1
											? "First, tell us about your organization"
											: "Now, create your admin account"}
									</p>
								</div>

								<div className="flex items-center justify-center gap-2">
									<div
										className={`flex items-center justify-center w-8 h-8 rounded-full ${
											step >= 1
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground"
										}`}
									>
										{step > 1 ? (
											<CheckCircleIcon className="w-5 h-5" weight="fill" />
										) : (
											<BuildingIcon className="w-4 h-4" />
										)}
									</div>
									<div
										className={`w-12 h-1 rounded ${step > 1 ? "bg-primary" : "bg-muted"}`}
									/>
									<div
										className={`flex items-center justify-center w-8 h-8 rounded-full ${
											step >= 2
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground"
										}`}
									>
										<UserIcon className="w-4 h-4" />
									</div>
								</div>

								{step === 1 ? (
									<form onSubmit={handleStep1Submit} className="grid gap-4">
										<form.Field name="orgName">
											{(field) => (
												<div className="grid gap-2">
													<Label htmlFor={field.name}>Organization Name</Label>
													<Input
														id={field.name}
														type="text"
														placeholder="Acme Inc"
														value={field.state.value}
														onChange={(e) =>
															handleOrgNameChange(e.target.value)
														}
														required
													/>
													{getFieldError("orgName") && (
														<p className="text-sm text-destructive">
															{getFieldError("orgName")}
														</p>
													)}
													{getFieldError("orgSlug") && (
														<p className="text-sm text-destructive">
															{getFieldError("orgSlug")}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<Button type="submit" className="w-full" disabled={loading}>
											{loading ? (
												"Checking..."
											) : (
												<>
													Continue
													<ArrowRightIcon className="ml-2 h-4 w-4" />
												</>
											)}
										</Button>
									</form>
								) : (
									<form
										onSubmit={(e) => {
											e.preventDefault();
											form.handleSubmit();
										}}
										className="grid gap-4"
									>
										<form.Field name="name">
											{(field) => (
												<div className="grid gap-2">
													<Label htmlFor={field.name}>Your Name</Label>
													<Input
														id={field.name}
														type="text"
														placeholder="John Doe"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														required
													/>
													{getFieldError("name") && (
														<p className="text-sm text-destructive">
															{getFieldError("name")}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<form.Field name="email">
											{(field) => (
												<div className="grid gap-2">
													<Label htmlFor={field.name}>Email</Label>
													<Input
														id={field.name}
														type="email"
														placeholder="you@example.com"
														value={field.state.value}
														onChange={(e) => field.handleChange(e.target.value)}
														required
													/>
													{getFieldError("email") && (
														<p className="text-sm text-destructive">
															{getFieldError("email")}
														</p>
													)}
												</div>
											)}
										</form.Field>

										<form.Field name="password">
											{(field) => {
												const strength = getPasswordStrength(field.state.value);
												return (
													<div className="grid gap-2">
														<Label htmlFor={field.name}>Password</Label>
														<PasswordInput
															id={field.name}
															placeholder="Min 8 characters"
															value={field.state.value}
															onChange={(e) =>
																field.handleChange(e.target.value)
															}
															required
														/>
														<div className="space-y-1">
															<div className="flex gap-1">
																{[1, 2, 3, 4].map((level) => (
																	<div
																		key={level}
																		className={`h-1 flex-1 rounded-full transition-colors ${
																			level <= strength.score
																				? strength.color
																				: "bg-muted"
																		}`}
																	/>
																))}
															</div>
															<p className="text-xs text-muted-foreground h-4">
																{strength.label}
															</p>
														</div>
														{getFieldError("password") && (
															<p className="text-sm text-destructive">
																{getFieldError("password")}
															</p>
														)}
													</div>
												);
											}}
										</form.Field>

										{getFieldError("_form") && (
											<p className="text-sm text-destructive text-center">
												{getFieldError("_form")}
											</p>
										)}

										<div className="flex gap-3">
											<Button
												type="button"
												variant="outline"
												onClick={() => setStep(1)}
												disabled={loading}
											>
												<ArrowLeftIcon className="mr-2 h-4 w-4" />
												Back
											</Button>
											<Button
												type="submit"
												className="flex-1"
												disabled={loading}
											>
												{loading ? "Creating account..." : "Create Account"}
											</Button>
										</div>
									</form>
								)}

								<p className="text-center text-sm text-muted-foreground">
									Already have an account?{" "}
									<Link
										href="/login"
										className="underline underline-offset-4 hover:text-primary"
									>
										Sign in
									</Link>
								</p>
							</div>
						</div>

						<div className="bg-primary/5 relative hidden md:block">
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="text-center p-8">
									<RobotIcon
										className="h-32 w-32 text-primary/20 mx-auto mb-6"
										weight="duotone"
									/>
									<h2 className="text-2xl font-bold text-primary/80 mb-2">
										Get Started with Ralph
									</h2>
									<p className="text-muted-foreground text-sm max-w-xs mx-auto">
										Create your organization and start managing projects with
										AI-powered assistance.
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<p className="mt-4 px-6 text-center text-xs text-muted-foreground">
					By continuing, you agree to our{" "}
					<Link
						href="/terms"
						className="underline underline-offset-4 hover:text-primary"
					>
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link
						href="/privacy"
						className="underline underline-offset-4 hover:text-primary"
					>
						Privacy Policy
					</Link>
					.
				</p>
			</div>
		</div>
	);
}
