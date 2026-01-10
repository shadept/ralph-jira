import { z } from "zod";

// Step 1: Organization details
export const orgRegistrationStep1Schema = z.object({
	orgName: z
		.string()
		.min(2, "Organization name must be at least 2 characters")
		.max(100, "Organization name must be at most 100 characters"),
	orgSlug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.max(50, "Slug must be at most 50 characters")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug can only contain lowercase letters, numbers, and hyphens"
		),
});

// Step 2: Owner (user) details
export const orgRegistrationStep2Schema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[a-z]/, "Password must contain at least one lowercase letter")
		.regex(/[0-9]/, "Password must contain at least one number"),
	name: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be at most 100 characters"),
});

// Combined schema for full registration
export const orgRegistrationSchema = orgRegistrationStep1Schema.merge(
	orgRegistrationStep2Schema
);

export type OrgRegistrationStep1 = z.infer<typeof orgRegistrationStep1Schema>;
export type OrgRegistrationStep2 = z.infer<typeof orgRegistrationStep2Schema>;
export type OrgRegistration = z.infer<typeof orgRegistrationSchema>;
