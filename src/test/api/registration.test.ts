import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
	orgRegistrationStep1Schema,
	orgRegistrationStep2Schema,
	orgRegistrationSchema,
} from "@/lib/auth/registration";

// Mock prisma for testing
vi.mock("@/lib/db", () => ({
	prisma: {
		organization: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		plan: {
			findUnique: vi.fn(),
			create: vi.fn(),
		},
		organizationMember: {
			create: vi.fn(),
		},
		subscription: {
			create: vi.fn(),
		},
		$transaction: vi.fn((callback) => callback({
			plan: { findUnique: vi.fn(), create: vi.fn() },
			user: { create: vi.fn(() => ({ id: "test-user-id" })) },
			organization: { create: vi.fn(() => ({ id: "test-org-id", slug: "test-org" })) },
			organizationMember: { create: vi.fn() },
			subscription: { create: vi.fn() },
		})),
	},
}));

describe("Organization Registration - Step 1 Validation", () => {
	it("should accept valid organization details", () => {
		const validData = {
			orgName: "Acme Inc",
			orgSlug: "acme-inc",
		};

		const result = orgRegistrationStep1Schema.safeParse(validData);
		expect(result.success).toBe(true);
	});

	it("should reject organization name that is too short", () => {
		const invalidData = {
			orgName: "A",
			orgSlug: "acme",
		};

		const result = orgRegistrationStep1Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.orgName).toBeDefined();
		}
	});

	it("should reject organization name that is too long", () => {
		const invalidData = {
			orgName: "A".repeat(101),
			orgSlug: "acme",
		};

		const result = orgRegistrationStep1Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it("should reject slug with uppercase letters", () => {
		const invalidData = {
			orgName: "Acme Inc",
			orgSlug: "Acme-Inc",
		};

		const result = orgRegistrationStep1Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.orgSlug).toBeDefined();
		}
	});

	it("should reject slug with special characters", () => {
		const invalidData = {
			orgName: "Acme Inc",
			orgSlug: "acme_inc!",
		};

		const result = orgRegistrationStep1Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it("should accept slug with numbers and hyphens", () => {
		const validData = {
			orgName: "Acme 123",
			orgSlug: "acme-123",
		};

		const result = orgRegistrationStep1Schema.safeParse(validData);
		expect(result.success).toBe(true);
	});
});

describe("Organization Registration - Step 2 Validation", () => {
	it("should accept valid user details", () => {
		const validData = {
			email: "john@example.com",
			password: "Password123",
			name: "John Doe",
		};

		const result = orgRegistrationStep2Schema.safeParse(validData);
		expect(result.success).toBe(true);
	});

	it("should reject invalid email", () => {
		const invalidData = {
			email: "not-an-email",
			password: "Password123",
			name: "John Doe",
		};

		const result = orgRegistrationStep2Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.email).toBeDefined();
		}
	});

	it("should reject password without uppercase", () => {
		const invalidData = {
			email: "john@example.com",
			password: "password123",
			name: "John Doe",
		};

		const result = orgRegistrationStep2Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.password).toBeDefined();
		}
	});

	it("should reject password without lowercase", () => {
		const invalidData = {
			email: "john@example.com",
			password: "PASSWORD123",
			name: "John Doe",
		};

		const result = orgRegistrationStep2Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it("should reject password without number", () => {
		const invalidData = {
			email: "john@example.com",
			password: "PasswordOnly",
			name: "John Doe",
		};

		const result = orgRegistrationStep2Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it("should reject password that is too short", () => {
		const invalidData = {
			email: "john@example.com",
			password: "Pass1",
			name: "John Doe",
		};

		const result = orgRegistrationStep2Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});

	it("should reject name that is too short", () => {
		const invalidData = {
			email: "john@example.com",
			password: "Password123",
			name: "J",
		};

		const result = orgRegistrationStep2Schema.safeParse(invalidData);
		expect(result.success).toBe(false);
	});
});

describe("Full Organization Registration Validation", () => {
	it("should accept complete valid registration data", () => {
		const validData = {
			orgName: "Acme Inc",
			orgSlug: "acme-inc",
			email: "john@example.com",
			password: "Password123",
			name: "John Doe",
		};

		const result = orgRegistrationSchema.safeParse(validData);
		expect(result.success).toBe(true);
	});

	it("should reject registration with invalid org and user data", () => {
		const invalidData = {
			orgName: "A", // Too short
			orgSlug: "INVALID", // Uppercase
			email: "not-email", // Invalid email
			password: "weak", // Missing requirements
			name: "", // Empty
		};

		const result = orgRegistrationSchema.safeParse(invalidData);
		expect(result.success).toBe(false);
		if (!result.success) {
			const errors = result.error.flatten().fieldErrors;
			expect(errors.orgName).toBeDefined();
			expect(errors.orgSlug).toBeDefined();
			expect(errors.email).toBeDefined();
			expect(errors.password).toBeDefined();
		}
	});
});
