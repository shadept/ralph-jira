"use client";

import {
	CameraIcon,
	FloppyDiskIcon,
	KeyIcon,
	TrashIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalDate, LocalDateTime } from "@/components/ui/local-date";
import { PasswordInput } from "@/components/ui/password-input";
import { getInitials } from "@/lib/utils";

export type UserProfile = {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
	emailVerified: boolean;
	createdAt: string;
	lastLoginAt: string | null;
	hasPassword: boolean;
	isOrgOwner: boolean;
};

function ProfileForm({
	user,
	onSave,
	saving,
}: {
	user: UserProfile;
	onSave: (data: { name: string }) => Promise<void>;
	saving: boolean;
}) {
	const form = useForm({
		defaultValues: {
			name: user.name || "",
		},
		onSubmit: async ({ value }) => {
			await onSave(value);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.Field name="name">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>Display Name</Label>
						<Input
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Your name"
							className="mt-1"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							This is how your name appears across the platform
						</p>
					</div>
				)}
			</form.Field>

			<div>
				<Label>Email Address</Label>
				<Input value={user.email} disabled className="mt-1" />
				<p className="text-xs text-muted-foreground mt-1">
					Email cannot be changed
				</p>
			</div>

			<Button type="submit" disabled={saving}>
				<FloppyDiskIcon className="w-4 h-4 mr-2" />
				{saving ? "Saving..." : "Save Changes"}
			</Button>
		</form>
	);
}

function PasswordForm({
	hasPassword,
	onSave,
	saving,
}: {
	hasPassword: boolean;
	onSave: (data: {
		currentPassword?: string;
		newPassword: string;
	}) => Promise<boolean>;
	saving: boolean;
}) {
	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		onSubmit: async ({ value }) => {
			if (value.newPassword !== value.confirmPassword) {
				toast.error("Passwords do not match");
				return;
			}
			const success = await onSave({
				currentPassword: hasPassword ? value.currentPassword : undefined,
				newPassword: value.newPassword,
			});
			if (success) {
				form.reset();
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			{hasPassword && (
				<form.Field name="currentPassword">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>Current Password</Label>
							<PasswordInput
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="Enter current password"
								className="mt-1"
							/>
						</div>
					)}
				</form.Field>
			)}

			<form.Field name="newPassword">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>
							{hasPassword ? "New Password" : "Password"}
						</Label>
						<PasswordInput
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder={
								hasPassword ? "Enter new password" : "Set a password"
							}
							className="mt-1"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Minimum 8 characters
						</p>
					</div>
				)}
			</form.Field>

			<form.Field name="confirmPassword">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>Confirm Password</Label>
						<PasswordInput
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Confirm password"
							className="mt-1"
						/>
					</div>
				)}
			</form.Field>

			<Button type="submit" disabled={saving}>
				<KeyIcon className="w-4 h-4 mr-2" />
				{saving
					? "Updating..."
					: hasPassword
						? "Update Password"
						: "Set Password"}
			</Button>
		</form>
	);
}

function DeleteAccountDialog({
	open,
	onOpenChange,
	hasPassword,
	onDelete,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	hasPassword: boolean;
	onDelete: (password: string, confirmation: string) => Promise<void>;
	loading: boolean;
}) {
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");

	const handleOpenChange = (newOpen: boolean) => {
		if (newOpen) {
			setPassword("");
			setConfirmation("");
		}
		onOpenChange(newOpen);
	};

	const handleDelete = () => {
		onDelete(password, confirmation);
	};

	const isValid =
		confirmation === "DELETE" && (!hasPassword || password.length > 0);

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2 text-destructive">
						<WarningIcon className="w-5 h-5" weight="fill" />
						Delete Account
					</AlertDialogTitle>
					<AlertDialogDescription>
						This action is permanent and cannot be undone. All your data will be
						deleted.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="space-y-4 py-4">
					<div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
						<p className="text-sm font-medium text-destructive">
							What will be deleted:
						</p>
						<ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
							<li>Your user account and profile</li>
							<li>Your organization memberships</li>
							<li>Tasks you created will become unassigned</li>
						</ul>
					</div>

					{hasPassword && (
						<div>
							<Label htmlFor="delete-password">Password</Label>
							<PasswordInput
								id="delete-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter your password"
								className="mt-1"
							/>
						</div>
					)}

					<div>
						<Label htmlFor="delete-confirmation">
							Type <span className="font-mono font-bold">DELETE</span> to
							confirm
						</Label>
						<Input
							id="delete-confirmation"
							value={confirmation}
							onChange={(e) => setConfirmation(e.target.value)}
							placeholder="DELETE"
							className="mt-1"
						/>
					</div>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={loading || !isValid}
					>
						{loading ? "Deleting..." : "Delete Account"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

type ProfileClientProps = {
	initialUser: UserProfile;
};

export function ProfileClient({ initialUser }: ProfileClientProps) {
	const router = useRouter();
	const [user, setUser] = useState<UserProfile>(initialUser);
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const handleSaveProfile = async (values: { name: string }) => {
		setSavingProfile(true);
		try {
			const res = await fetch("/api/user/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to save profile");
				return;
			}

			setUser(json.user);
			router.refresh();
			toast.success("Profile saved");
		} catch (error) {
			toast.error("Failed to save profile");
			console.error(error);
		} finally {
			setSavingProfile(false);
		}
	};

	const handleSavePassword = async (values: {
		currentPassword?: string;
		newPassword: string;
	}): Promise<boolean> => {
		setSavingPassword(true);
		try {
			const res = await fetch("/api/user/password", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to update password");
				return false;
			}

			setUser((prev) => ({ ...prev, hasPassword: true }));
			toast.success("Password updated");
			return true;
		} catch (error) {
			toast.error("Failed to update password");
			console.error(error);
			return false;
		} finally {
			setSavingPassword(false);
		}
	};

	const handleDeleteAccount = async (
		password: string,
		confirmation: string,
	) => {
		setDeleting(true);
		try {
			const res = await fetch("/api/user/delete", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password, confirmation }),
			});

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to delete account");
				return;
			}

			toast.success("Account deleted");
			setDeleteDialogOpen(false);
			signOut({ callbackUrl: "/" });
		} catch (error) {
			toast.error("Failed to delete account");
			console.error(error);
		} finally {
			setDeleting(false);
		}
	};

	const initials = getInitials(user.name, user.email);
	const displayName = user.name || user.email;

	return (
		<>
			<PageHeader
				title="Profile"
				description="Manage your personal settings"
				backLink={{ href: "/project", label: "Back to Project" }}
			/>
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-4">
							<button
								type="button"
								disabled
								className="relative group cursor-not-allowed"
								title="Image upload coming soon"
							>
								<Avatar className="h-16 w-16">
									<AvatarImage src={user.avatarUrl || undefined} />
									<AvatarFallback className="text-lg bg-primary/10 text-primary">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-50 transition-opacity">
									<CameraIcon className="w-6 h-6 text-white" />
								</div>
							</button>
							<div>
								<CardTitle>{displayName}</CardTitle>
								<CardDescription>{user.email}</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<dt className="text-muted-foreground">Member since</dt>
								<dd className="font-medium">
									<LocalDate date={user.createdAt} />
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Last login</dt>
								<dd className="font-medium">
									<LocalDateTime date={user.lastLoginAt} />
								</dd>
							</div>
						</dl>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Profile Settings</CardTitle>
						<CardDescription>Update your personal information</CardDescription>
					</CardHeader>
					<CardContent>
						<ProfileForm
							key={user.id}
							user={user}
							onSave={handleSaveProfile}
							saving={savingProfile}
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Security</CardTitle>
						<CardDescription>
							{user.hasPassword
								? "Change your password"
								: "Set a password to enable password-based login"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<PasswordForm
							hasPassword={user.hasPassword}
							onSave={handleSavePassword}
							saving={savingPassword}
						/>
					</CardContent>
				</Card>

				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="text-destructive">Danger Zone</CardTitle>
						<CardDescription>
							Permanently delete your account and all associated data
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium">Delete Account</p>
								<p className="text-sm text-muted-foreground">
									{user.isOrgOwner
										? "Transfer organization ownership first"
										: "Once deleted, your account cannot be recovered"}
								</p>
							</div>
							<Button
								variant="destructive"
								onClick={() => setDeleteDialogOpen(true)}
								disabled={user.isOrgOwner}
							>
								<TrashIcon className="w-4 h-4 mr-2" />
								Delete Account
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<DeleteAccountDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				hasPassword={user.hasPassword}
				onDelete={handleDeleteAccount}
				loading={deleting}
			/>
		</>
	);
}
