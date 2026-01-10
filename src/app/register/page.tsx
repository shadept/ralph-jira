"use client";

import {
	ArrowLeft,
	ArrowRight,
	Building,
	CheckCircle,
	Envelope,
	Eye,
	EyeSlash,
	Lock,
	Robot,
	User,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FormErrors = Record<string, string[]>;

export default function RegisterPage() {
	const router = useRouter();
	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
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
		<div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<Link
						href="/"
						className="inline-flex items-center justify-center gap-2 mb-4"
					>
						<Robot className="h-10 w-10 text-primary" weight="duotone" />
						<span className="text-2xl font-bold">Ralph</span>
					</Link>
					<CardTitle className="text-2xl">Create your account</CardTitle>
					<CardDescription>
						{step === 1
							? "First, tell us about your organization"
							: "Now, create your admin account"}
					</CardDescription>

					<div className="flex items-center justify-center gap-2 mt-4">
						<div
							className={`flex items-center justify-center w-8 h-8 rounded-full ${
								step >= 1
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground"
							}`}
						>
							{step > 1 ? (
								<CheckCircle className="w-5 h-5" weight="fill" />
							) : (
								<Building className="w-4 h-4" />
							)}
						</div>
						<div
							className={`w-12 h-1 ${step > 1 ? "bg-primary" : "bg-muted"}`}
						/>
						<div
							className={`flex items-center justify-center w-8 h-8 rounded-full ${
								step >= 2
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground"
							}`}
						>
							<User className="w-4 h-4" />
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{step === 1 ? (
						<form onSubmit={handleStep1Submit} className="space-y-4">
							<form.Field name="orgName">
								{(field) => (
									<div className="space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											Organization Name
										</label>
										<div className="relative">
											<Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
											<Input
												id={field.name}
												type="text"
												placeholder="Acme Inc"
												value={field.state.value}
												onChange={(e) => handleOrgNameChange(e.target.value)}
												className="pl-10"
												required
											/>
										</div>
										{getFieldError("orgName") && (
											<p className="text-sm text-destructive">
												{getFieldError("orgName")}
											</p>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="orgSlug">
								{(field) => (
									<div className="space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											Organization URL
										</label>
										<div className="flex items-center">
											<span className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-l-md border border-r-0">
												ralph.app/
											</span>
											<Input
												id={field.name}
												type="text"
												placeholder="acme"
												value={field.state.value}
												onChange={(e) =>
													field.handleChange(
														e.target.value
															.toLowerCase()
															.replace(/[^a-z0-9-]/g, ""),
													)
												}
												className="rounded-l-none"
												required
											/>
										</div>
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
										<ArrowRight className="ml-2 h-4 w-4" />
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
							className="space-y-4"
						>
							<form.Field name="name">
								{(field) => (
									<div className="space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											Your Name
										</label>
										<div className="relative">
											<User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
											<Input
												id={field.name}
												type="text"
												placeholder="John Doe"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												className="pl-10"
												required
											/>
										</div>
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
									<div className="space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											Email
										</label>
										<div className="relative">
											<Envelope className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
											<Input
												id={field.name}
												type="email"
												placeholder="you@example.com"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												className="pl-10"
												required
											/>
										</div>
										{getFieldError("email") && (
											<p className="text-sm text-destructive">
												{getFieldError("email")}
											</p>
										)}
									</div>
								)}
							</form.Field>

							<form.Field name="password">
								{(field) => (
									<div className="space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											Password
										</label>
										<div className="relative">
											<Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
											<Input
												id={field.name}
												type={showPassword ? "text" : "password"}
												placeholder="Min 8 chars, 1 uppercase, 1 number"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												className="pl-10 pr-10"
												required
											/>
											<button
												type="button"
												onClick={() => setShowPassword(!showPassword)}
												className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
											>
												{showPassword ? (
													<EyeSlash className="h-5 w-5" />
												) : (
													<Eye className="h-5 w-5" />
												)}
											</button>
										</div>
										{getFieldError("password") && (
											<p className="text-sm text-destructive">
												{getFieldError("password")}
											</p>
										)}
									</div>
								)}
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
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back
								</Button>
								<Button type="submit" className="flex-1" disabled={loading}>
									{loading ? "Creating account..." : "Create Account"}
								</Button>
							</div>
						</form>
					)}

					<p className="text-center text-sm text-muted-foreground mt-6">
						Already have an account?{" "}
						<Link href="/login" className="text-primary hover:underline">
							Sign in
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
