"use client";

import { GithubLogoIcon, RobotIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const rawCallbackUrl = searchParams?.get("callbackUrl");
	const callbackUrl =
		rawCallbackUrl && !rawCallbackUrl.includes("/login")
			? rawCallbackUrl
			: "/project";
	const error = searchParams?.get("error");

	const [loading, setLoading] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setLoading(true);
			try {
				const result = await signIn("credentials", {
					email: value.email,
					password: value.password,
					redirect: false,
				});

				if (result?.error) {
					toast.error("Invalid email or password");
				} else if (result?.ok) {
					toast.success("Welcome back!");
					router.push(callbackUrl);
					router.refresh();
				}
			} catch (err) {
				console.error("[LOGIN] error:", err);
				toast.error("An error occurred during sign in");
			} finally {
				setLoading(false);
			}
		},
	});

	useEffect(() => {
		if (error) {
			toast.error(
				error === "CredentialsSignin"
					? "Invalid email or password"
					: "An error occurred during sign in",
			);
		}
	}, [error]);

	const handleGitHubSignIn = () => {
		signIn("github", { callbackUrl });
	};

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 p-6 md:p-10">
			<div className="w-full max-w-sm md:max-w-4xl">
				<Card className="overflow-hidden p-0">
					<CardContent className="grid p-0 md:grid-cols-2">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								form.handleSubmit();
							}}
							className="p-6 md:p-8"
						>
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
									<h1 className="text-2xl font-bold">Welcome back</h1>
									<p className="text-muted-foreground text-balance text-sm">
										Sign in to your account to continue
									</p>
								</div>

								<div className="grid gap-4">
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
											</div>
										)}
									</form.Field>

									<form.Field name="password">
										{(field) => (
											<div className="grid gap-2">
												<div className="flex items-center">
													<Label htmlFor={field.name}>Password</Label>
													<Link
														href="/forgot-password"
														className="ml-auto text-sm underline-offset-2 hover:underline"
													>
														Forgot password?
													</Link>
												</div>
												<PasswordInput
													id={field.name}
													placeholder="Enter your password"
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													required
												/>
											</div>
										)}
									</form.Field>

									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? "Signing in..." : "Sign in"}
									</Button>
								</div>

								<div className="relative">
									<div className="absolute inset-0 flex items-center">
										<span className="w-full border-t" />
									</div>
									<div className="relative flex justify-center text-xs uppercase">
										<span className="bg-card px-2 text-muted-foreground">
											Or continue with
										</span>
									</div>
								</div>

								<Button
									variant="outline"
									className="w-full"
									onClick={handleGitHubSignIn}
									type="button"
								>
									<GithubLogoIcon className="h-5 w-5" />
									<span className="ml-2">GitHub</span>
								</Button>

								<p className="text-center text-sm text-muted-foreground">
									Don&apos;t have an account?{" "}
									<Link
										href="/register"
										className="underline underline-offset-4 hover:text-primary"
									>
										Sign up
									</Link>
								</p>
							</div>
						</form>

						<div className="bg-primary/5 relative hidden md:block">
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="text-center p-8">
									<RobotIcon
										className="h-32 w-32 text-primary/20 mx-auto mb-6"
										weight="duotone"
									/>
									<h2 className="text-2xl font-bold text-primary/80 mb-2">
										AI-Powered Project Management
									</h2>
									<p className="text-muted-foreground text-sm max-w-xs mx-auto">
										Sprint planning, kanban boards, and autonomous task
										execution - all in one place.
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

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex flex-col items-center justify-center bg-muted/50 p-6 md:p-10">
					<div className="w-full max-w-sm md:max-w-4xl">
						<Card className="overflow-hidden p-0">
							<CardContent className="grid p-0 md:grid-cols-2">
								<div className="p-6 md:p-8">
									<div className="flex flex-col items-center gap-2 text-center">
										<RobotIcon
											className="h-8 w-8 text-primary"
											weight="duotone"
										/>
										<span className="text-xl font-bold">Ralph</span>
										<p className="text-muted-foreground">Loading...</p>
									</div>
								</div>
								<div className="bg-primary/5 relative hidden md:block" />
							</CardContent>
						</Card>
					</div>
				</div>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
