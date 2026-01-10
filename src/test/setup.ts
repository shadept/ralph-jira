import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/dom";

// Clean up after each test
afterEach(() => {
	cleanup();
});

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
	signIn: vi.fn(),
	signOut: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
		back: vi.fn(),
	})),
	useSearchParams: vi.fn(() => new URLSearchParams()),
	usePathname: vi.fn(() => "/"),
}));
