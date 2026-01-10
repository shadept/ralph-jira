import { ConsoleEmailClient } from "./console-client";
import type { EmailClient } from "./interface";

export * from "./console-client";
export * from "./interface";

// Factory function to get email client based on environment
export function getEmailClient(): EmailClient {
	// In the future, check for configured email provider
	// e.g., if (process.env.SENDGRID_API_KEY) return new SendGridClient();

	// Default to console client for development
	return new ConsoleEmailClient();
}

// Singleton instance
let emailClient: EmailClient | null = null;

export function email(): EmailClient {
	if (!emailClient) {
		emailClient = getEmailClient();
	}
	return emailClient;
}
