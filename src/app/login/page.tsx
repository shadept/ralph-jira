"use client";

import {
	Envelope,
	Eye,
	EyeSlash,
	GithubLogo,
	Lock,
	Robot,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
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

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const rawCallbackUrl = searchParams?.get("callbackUrl");
	const callbackUrl =
		rawCallbackUrl && !rawCallbackUrl.includes("/login")
			? rawCallbackUrl
			: "/project";
	const error = searchParams?.get("error");

	const [showPassword, setShowPassword] = useState(false);
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
					<CardTitle className="text-2xl">Welcome back</CardTitle>
					<CardDescription>Sign in to your account to continue</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<Button
						variant="outline"
						className="w-full"
						onClick={handleGitHubSignIn}
						type="button"
					>
						<GithubLogo className="mr-2 h-5 w-5" />
						Continue with GitHub
					</Button>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-card px-2 text-muted-foreground">
								Or continue with email
							</span>
						</div>
					</div>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
						className="space-y-4"
					>
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
								</div>
							)}
						</form.Field>

						<form.Field name="password">
							{(field) => (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label htmlFor={field.name} className="text-sm font-medium">
											Password
										</label>
										<Link
											href="/forgot-password"
											className="text-sm text-primary hover:underline"
										>
											Forgot password?
										</Link>
									</div>
									<div className="relative">
										<Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
										<Input
											id={field.name}
											type={showPassword ? "text" : "password"}
											placeholder="Enter your password"
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
								</div>
							)}
						</form.Field>

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? "Signing in..." : "Sign in"}
						</Button>
					</form>

					<p className="text-center text-sm text-muted-foreground">
						Don't have an account?{" "}
						<Link href="/register" className="text-primary hover:underline">
							Sign up
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
					<Card className="w-full max-w-md">
						<CardHeader className="text-center">
							<div className="inline-flex items-center justify-center gap-2 mb-4">
								<Robot className="h-10 w-10 text-primary" weight="duotone" />
								<span className="text-2xl font-bold">Ralph</span>
							</div>
							<CardTitle className="text-2xl">Loading...</CardTitle>
						</CardHeader>
					</Card>
				</div>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
