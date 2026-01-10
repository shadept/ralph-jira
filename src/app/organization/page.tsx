"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import {
	Buildings,
	Crown,
	Shield,
	User,
	UserPlus,
	Trash,
	FloppyDisk,
	FolderOpen,
	GitBranch,
	ArrowRight,
	Warning,
	CreditCard,
} from "@phosphor-icons/react";

import { AppLayout } from "@/components/layout/app-layout";
import { useProjectContext } from "@/components/projects/project-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type Organization = {
	id: string;
	name: string;
	slug: string;
	logoUrl: string | null;
	createdAt: string;
	updatedAt: string;
	projectCount: number;
};

type Member = {
	id: string;
	userId: string;
	role: "owner" | "admin" | "member";
	joinedAt: string;
	user: {
		id: string;
		name: string | null;
		email: string;
		image: string | null;
	};
};

type Project = {
	id: string;
	name: string;
	description: string | null;
	path: string;
	createdAt: string;
	updatedAt: string;
};

type OrgData = {
	organization: Organization;
	projects: Project[];
	members: Member[];
	limits: {
		maxUsers: number | null;
		maxProjects: number | null;
	};
	currentUserRole: "owner" | "admin" | "member";
};

const roleIcons = {
	owner: Crown,
	admin: Shield,
	member: User,
};

const roleColors = {
	owner: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	admin: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
	member: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
};

function OrgSettingsForm({
	organization,
	onSave,
	saving,
	disabled,
}: {
	organization: Organization;
	onSave: (data: { name: string }) => Promise<void>;
	saving: boolean;
	disabled: boolean;
}) {
	const form = useForm({
		defaultValues: {
			name: organization.name,
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
						<Label htmlFor={field.name}>Organization Name</Label>
						<Input
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							disabled={disabled}
							className="mt-1"
						/>
					</div>
				)}
			</form.Field>

			{!disabled && (
				<Button type="submit" disabled={saving}>
					<FloppyDisk className="w-4 h-4 mr-2" />
					{saving ? "Saving..." : "Save Changes"}
				</Button>
			)}
		</form>
	);
}

function InviteMemberDialog({
	open,
	onOpenChange,
	onInvite,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onInvite: (email: string, role: "admin" | "member") => Promise<void>;
	loading: boolean;
}) {
	const form = useForm({
		defaultValues: {
			email: "",
			role: "member" as "admin" | "member",
		},
		onSubmit: async ({ value }) => {
			await onInvite(value.email, value.role);
		},
	});

	useEffect(() => {
		if (open) {
			form.reset();
		}
	}, [open, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invite Member</DialogTitle>
					<DialogDescription>
						Send an invitation to join your organization
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<form.Field name="email">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Email Address</Label>
								<Input
									id={field.name}
									type="email"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="colleague@example.com"
									className="mt-1"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="role">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>Role</Label>
								<Select
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(value as "admin" | "member")
									}
								>
									<SelectTrigger className="mt-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="member">Member</SelectItem>
										<SelectItem value="admin">Admin</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground mt-1">
									Admins can invite members and manage projects
								</p>
							</div>
						)}
					</form.Field>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? "Sending..." : "Send Invitation"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function TransferOwnershipDialog({
	open,
	onOpenChange,
	members,
	currentUserId,
	onTransfer,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	members: Member[];
	currentUserId: string;
	onTransfer: (newOwnerId: string) => Promise<void>;
	loading: boolean;
}) {
	const [selectedMemberId, setSelectedMemberId] = useState<string>("");
	const [confirmStep, setConfirmStep] = useState(false);

	const eligibleMembers = members.filter(
		(m) => m.userId !== currentUserId && m.role !== "owner"
	);

	const selectedMember = eligibleMembers.find((m) => m.id === selectedMemberId);

	useEffect(() => {
		if (open) {
			setSelectedMemberId("");
			setConfirmStep(false);
		}
	}, [open]);

	const handleContinue = () => {
		if (selectedMemberId) {
			setConfirmStep(true);
		}
	};

	const handleBack = () => {
		setConfirmStep(false);
	};

	const handleTransfer = async () => {
		if (selectedMemberId) {
			await onTransfer(selectedMemberId);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				{!confirmStep ? (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Crown className="w-5 h-5 text-amber-500" />
								Transfer Ownership
							</DialogTitle>
							<DialogDescription>
								Select a member to become the new owner of this organization.
								You will be demoted to Admin.
							</DialogDescription>
						</DialogHeader>

						<div className="py-4">
							<Label>New Owner</Label>
							<Select
								value={selectedMemberId}
								onValueChange={setSelectedMemberId}
							>
								<SelectTrigger className="mt-1">
									<SelectValue placeholder="Select a member..." />
								</SelectTrigger>
								<SelectContent>
									{eligibleMembers.map((member) => (
										<SelectItem key={member.id} value={member.id}>
											<div className="flex items-center gap-2">
												<span>{member.user.name || member.user.email}</span>
												<span className="text-muted-foreground text-xs">
													({member.role})
												</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{eligibleMembers.length === 0 && (
								<p className="text-sm text-muted-foreground mt-2">
									No eligible members. Invite someone first.
								</p>
							)}
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button
								onClick={handleContinue}
								disabled={!selectedMemberId}
							>
								Continue
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-destructive">
								<Warning className="w-5 h-5" weight="fill" />
								Confirm Ownership Transfer
							</DialogTitle>
						</DialogHeader>

						<div className="py-4 space-y-4">
							<div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3">
								<p className="font-semibold text-destructive">
									This action is irreversible!
								</p>
								<p className="text-sm">
									You are about to transfer ownership to{" "}
									<strong>{selectedMember?.user.name || selectedMember?.user.email}</strong>.
								</p>
								<ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
									<li>You will be demoted to Admin</li>
									<li>Only the new owner can transfer ownership back to you</li>
									<li>The new owner will have full control over this organization</li>
								</ul>
							</div>

							<p className="text-sm text-center text-muted-foreground">
								Are you absolutely sure you want to proceed?
							</p>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={handleBack} disabled={loading}>
								Back
							</Button>
							<Button
								variant="destructive"
								onClick={handleTransfer}
								disabled={loading}
							>
								{loading ? "Transferring..." : "Transfer Ownership"}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default function OrganizationPage() {
	const router = useRouter();
	const { selectProject } = useProjectContext();
	const { data: session, status: sessionStatus } = useSession();
	const [data, setData] = useState<OrgData | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
	const [inviting, setInviting] = useState(false);
	const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
	const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
	const [transferDialogOpen, setTransferDialogOpen] = useState(false);
	const [transferring, setTransferring] = useState(false);

	const loadOrganization = useCallback(async () => {
		setLoading(true);
		try {
			// First get user's organizations
			const orgsRes = await fetch("/api/organizations");
			const orgsData = await orgsRes.json();

			if (!orgsData.success || !orgsData.organizations?.length) {
				setData(null);
				return;
			}

			// Load the first organization's details
			const orgId = orgsData.organizations[0].id;
			const res = await fetch(`/api/organizations/${orgId}`);
			const json = await res.json();

			if (json.success) {
				setData(json);
			}
		} catch (error) {
			toast.error("Failed to load organization");
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (sessionStatus === "authenticated") {
			loadOrganization();
		} else if (sessionStatus === "unauthenticated") {
			setLoading(false);
		}
	}, [sessionStatus, loadOrganization]);

	const handleSaveSettings = async (values: { name: string }) => {
		if (!data) return;

		setSaving(true);
		try {
			const res = await fetch(`/api/organizations/${data.organization.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to save settings");
				return;
			}

			toast.success("Settings saved");
			await loadOrganization();
		} catch (error) {
			toast.error("Failed to save settings");
			console.error(error);
		} finally {
			setSaving(false);
		}
	};

	const handleInvite = async (email: string, role: "admin" | "member") => {
		if (!data) return;

		setInviting(true);
		try {
			const res = await fetch(
				`/api/organizations/${data.organization.id}/invitations`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, role }),
				}
			);

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to send invitation");
				return;
			}

			toast.success("Invitation sent");
			setInviteDialogOpen(false);
		} catch (error) {
			toast.error("Failed to send invitation");
			console.error(error);
		} finally {
			setInviting(false);
		}
	};

	const handleRoleChange = async (memberId: string, newRole: string) => {
		if (!data) return;

		try {
			const res = await fetch(
				`/api/organizations/${data.organization.id}/members/${memberId}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ role: newRole }),
				}
			);

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to update role");
				return;
			}

			toast.success("Role updated");
			await loadOrganization();
		} catch (error) {
			toast.error("Failed to update role");
			console.error(error);
		}
	};

	const handleRemoveMember = async () => {
		if (!data || !memberToRemove) return;

		setRemovingMemberId(memberToRemove.id);
		try {
			const res = await fetch(
				`/api/organizations/${data.organization.id}/members/${memberToRemove.id}`,
				{
					method: "DELETE",
				}
			);

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to remove member");
				return;
			}

			toast.success(json.message || "Member removed");
			setConfirmRemoveOpen(false);
			setMemberToRemove(null);
			await loadOrganization();
		} catch (error) {
			toast.error("Failed to remove member");
			console.error(error);
		} finally {
			setRemovingMemberId(null);
		}
	};

	const handleTransferOwnership = async (newOwnerMemberId: string) => {
		if (!data) return;

		setTransferring(true);
		try {
			const res = await fetch(
				`/api/organizations/${data.organization.id}/transfer`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ newOwnerMemberId }),
				}
			);

			const json = await res.json();

			if (!json.success) {
				toast.error(json.error || "Failed to transfer ownership");
				return;
			}

			toast.success("Ownership transferred successfully");
			setTransferDialogOpen(false);
			await loadOrganization();
		} catch (error) {
			toast.error("Failed to transfer ownership");
			console.error(error);
		} finally {
			setTransferring(false);
		}
	};

	const isOwner = data?.currentUserRole === "owner";
	const isAdmin = data?.currentUserRole === "admin" || isOwner;

	const renderContent = () => {
		if (sessionStatus === "loading" || loading) {
			return (
				<div className="flex h-64 items-center justify-center">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			);
		}

		if (sessionStatus === "unauthenticated") {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<p className="text-lg font-semibold">Sign in required</p>
					<p className="text-sm text-muted-foreground">
						Please sign in to view your organization settings.
					</p>
				</div>
			);
		}

		if (!data) {
			return (
				<div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
					<Buildings className="w-12 h-12 text-muted-foreground" />
					<p className="text-lg font-semibold">No organization found</p>
					<p className="text-sm text-muted-foreground">
						You're not a member of any organization.
					</p>
				</div>
			);
		}

		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Organization Settings</CardTitle>
						<CardDescription>
							{isOwner
								? "Manage your organization's name"
								: "View your organization's settings (only owners can edit)"}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<OrgSettingsForm
							key={data.organization.id}
							organization={data.organization}
							onSave={handleSaveSettings}
							saving={saving}
							disabled={!isOwner}
						/>

					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Subscription</CardTitle>
								<CardDescription>
									Manage your plan and billing
								</CardDescription>
							</div>
							<Button variant="outline" onClick={() => router.push("/organization/subscription")}>
								<CreditCard className="w-4 h-4 mr-2" />
								View Subscription
							</Button>
						</div>
					</CardHeader>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Members</CardTitle>
								<CardDescription>
									{data.members.length} member
									{data.members.length !== 1 ? "s" : ""} in this organization
								</CardDescription>
							</div>
							{isAdmin && (
								data.limits.maxUsers !== null && data.members.length >= data.limits.maxUsers ? (
									<span title={`Plan limit reached (${data.limits.maxUsers} users). Upgrade to add more members.`}>
										<Button disabled>
											<UserPlus className="w-4 h-4 mr-2" />
											Invite Member
										</Button>
									</span>
								) : (
									<Button onClick={() => setInviteDialogOpen(true)}>
										<UserPlus className="w-4 h-4 mr-2" />
										Invite Member
									</Button>
								)
							)}
						</div>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{data.members.map((member) => {
								const RoleIcon = roleIcons[member.role];
								const isSelf = member.userId === session?.user?.id;
								const canChangeRole = isOwner && !isSelf && member.role !== "owner";
								const isLastMember = data.members.length === 1;
								const isSelfOwner = isSelf && member.role === "owner";
								const canRemove = (isOwner || isSelf) && !isLastMember && !isSelfOwner;

								return (
									<div
										key={member.id}
										className="flex items-center gap-3 p-3 rounded-lg border"
									>
										<Avatar>
											<AvatarImage src={member.user.image || undefined} />
											<AvatarFallback>
												{(member.user.name || member.user.email)
													.charAt(0)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>

										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">
												{member.user.name || member.user.email}
												{isSelf && (
													<span className="text-muted-foreground ml-2">
														(you)
													</span>
												)}
											</p>
											<p className="text-sm text-muted-foreground truncate">
												{member.user.email}
											</p>
										</div>

										{canChangeRole ? (
											<Select
												value={member.role}
												onValueChange={(value) =>
													handleRoleChange(member.id, value)
												}
											>
												<SelectTrigger className="w-32">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="admin">Admin</SelectItem>
													<SelectItem value="member">Member</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<Badge className={roleColors[member.role]}>
												<RoleIcon className="w-3 h-3 mr-1" />
												{member.role}
											</Badge>
										)}

										{canRemove && (
											<Button
												variant="ghost"
												size="icon"
												onClick={() => {
													setMemberToRemove(member);
													setConfirmRemoveOpen(true);
												}}
												disabled={removingMemberId === member.id}
											>
												<Trash className="w-4 h-4 text-muted-foreground hover:text-destructive" />
											</Button>
										)}
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Projects</CardTitle>
						<CardDescription>
							{data.projects.length} project
							{data.projects.length !== 1 ? "s" : ""} in this organization
						</CardDescription>
					</CardHeader>
					<CardContent>
						{data.projects.length === 0 ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No projects yet. Create one from the project dashboard.
							</p>
						) : (
							<div className="space-y-3">
								{data.projects.map((project) => {
									const isLocalPath = /^([a-zA-Z]:[/\\]|\/|~|\.\.?\/)/.test(project.path);
									const RepoIcon = isLocalPath ? FolderOpen : GitBranch;

									const handleGoToProject = () => {
										selectProject(project.id);
										router.push("/project");
									};

									return (
										<div
											key={project.id}
											className="flex items-center gap-3 p-3 rounded-lg border"
										>
											<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
												<RepoIcon className="w-5 h-5 text-primary" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-medium truncate">{project.name}</p>
												{project.path && (
													<p className="text-sm text-muted-foreground truncate">
														{project.path}
													</p>
												)}
												{!project.path && project.description && (
													<p className="text-sm text-muted-foreground truncate">
														{project.description}
													</p>
												)}
											</div>
											<Button
												variant="ghost"
												size="sm"
												onClick={handleGoToProject}
											>
												Open
												<ArrowRight className="w-4 h-4 ml-1" />
											</Button>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Organization Info</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<dt className="text-muted-foreground">Projects</dt>
								<dd className="font-medium">{data.organization.projectCount}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Members</dt>
								<dd className="font-medium">{data.members.length}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Created</dt>
								<dd className="font-medium">
									{new Date(data.organization.createdAt).toLocaleDateString()}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">Your Role</dt>
								<dd className="font-medium capitalize">
									{data.currentUserRole}
								</dd>
							</div>
						</dl>
					</CardContent>
				</Card>

				{isOwner && data.members.length > 1 && (
					<Card className="border-destructive/50">
						<CardHeader>
							<CardTitle className="text-destructive">Danger Zone</CardTitle>
							<CardDescription>
								Irreversible actions for your organization
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Transfer Ownership</p>
									<p className="text-sm text-muted-foreground">
										Transfer this organization to another member. You will be demoted to Admin.
									</p>
								</div>
								<Button
									variant="destructive"
									onClick={() => setTransferDialogOpen(true)}
								>
									<Crown className="w-4 h-4 mr-2" />
									Transfer Ownership
								</Button>
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		);
	};

	return (
		<AppLayout
			title="Organization"
			description={data?.organization.name || "Manage your organization"}
			backLink={{ href: "/project", label: "Back to Project" }}
		>
			{renderContent()}

			<InviteMemberDialog
				open={inviteDialogOpen}
				onOpenChange={setInviteDialogOpen}
				onInvite={handleInvite}
				loading={inviting}
			/>

			<AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{memberToRemove?.userId === session?.user?.id
								? "Leave organization?"
								: "Remove member?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{memberToRemove?.userId === session?.user?.id
								? "Are you sure you want to leave this organization? You'll lose access to all projects."
								: `Are you sure you want to remove ${memberToRemove?.user.name || memberToRemove?.user.email} from this organization?`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRemoveMember}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{memberToRemove?.userId === session?.user?.id
								? "Leave"
								: "Remove"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{data && session?.user?.id && (
				<TransferOwnershipDialog
					open={transferDialogOpen}
					onOpenChange={setTransferDialogOpen}
					members={data.members}
					currentUserId={session.user.id}
					onTransfer={handleTransferOwnership}
					loading={transferring}
				/>
			)}
		</AppLayout>
	);
}
