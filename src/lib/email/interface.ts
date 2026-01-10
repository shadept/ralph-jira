/**
 * Email client interface for sending emails
 * Implement this interface with your preferred email provider (SendGrid, AWS SES, etc.)
 */
export interface EmailClient {
	/**
	 * Send a single email
	 */
	send(options: SendEmailOptions): Promise<SendEmailResult>;

	/**
	 * Send a templated email
	 */
	sendTemplate(options: SendTemplateOptions): Promise<SendEmailResult>;
}

export interface SendEmailOptions {
	to: string | string[];
	subject: string;
	text?: string;
	html?: string;
	from?: string;
	replyTo?: string;
}

export interface SendTemplateOptions {
	to: string | string[];
	template: EmailTemplate;
	variables: Record<string, string>;
	from?: string;
	replyTo?: string;
}

export type EmailTemplate =
	| "invitation"
	| "welcome"
	| "password-reset"
	| "email-verification";

export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}
