import type {
	EmailClient,
	EmailTemplate,
	SendEmailOptions,
	SendEmailResult,
	SendTemplateOptions,
} from "./interface";

/**
 * Console email client - logs emails to console instead of sending
 * Use this for development and testing
 */
export class ConsoleEmailClient implements EmailClient {
	private getTemplateContent(
		template: EmailTemplate,
		variables: Record<string, string>,
	): { subject: string; html: string; text: string } {
		switch (template) {
			case "invitation":
				return {
					subject: `You've been invited to join ${variables.orgName} on Ralph`,
					html: `
						<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
							<h1>You're invited!</h1>
							<p>${variables.inviterName} has invited you to join <strong>${variables.orgName}</strong> on Ralph.</p>
							<p>Click the link below to accept the invitation:</p>
							<a href="${variables.inviteUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
								Accept Invitation
							</a>
							<p style="margin-top: 24px; color: #666;">
								This invitation will expire in 7 days.
							</p>
							<p style="color: #666;">
								If you didn't expect this invitation, you can safely ignore this email.
							</p>
						</div>
					`,
					text: `
You're invited!

${variables.inviterName} has invited you to join ${variables.orgName} on Ralph.

Click the link below to accept the invitation:
${variables.inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
					`.trim(),
				};

			case "welcome":
				return {
					subject: `Welcome to Ralph!`,
					html: `
						<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
							<h1>Welcome to Ralph!</h1>
							<p>Hi ${variables.userName},</p>
							<p>Your account has been created successfully. You can now start managing your projects with AI assistance.</p>
							<a href="${variables.loginUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
								Go to Dashboard
							</a>
						</div>
					`,
					text: `
Welcome to Ralph!

Hi ${variables.userName},

Your account has been created successfully. You can now start managing your projects with AI assistance.

Go to Dashboard: ${variables.loginUrl}
					`.trim(),
				};

			case "password-reset":
				return {
					subject: `Reset your password`,
					html: `
						<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
							<h1>Password Reset</h1>
							<p>We received a request to reset your password.</p>
							<p>Click the link below to set a new password:</p>
							<a href="${variables.resetUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
								Reset Password
							</a>
							<p style="margin-top: 24px; color: #666;">
								This link will expire in 1 hour.
							</p>
							<p style="color: #666;">
								If you didn't request a password reset, you can safely ignore this email.
							</p>
						</div>
					`,
					text: `
Password Reset

We received a request to reset your password.

Click the link below to set a new password:
${variables.resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
					`.trim(),
				};

			case "email-verification":
				return {
					subject: `Verify your email address`,
					html: `
						<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
							<h1>Verify your email</h1>
							<p>Please verify your email address by clicking the link below:</p>
							<a href="${variables.verifyUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
								Verify Email
							</a>
							<p style="margin-top: 24px; color: #666;">
								If you didn't create an account, you can safely ignore this email.
							</p>
						</div>
					`,
					text: `
Verify your email

Please verify your email address by clicking the link below:
${variables.verifyUrl}

If you didn't create an account, you can safely ignore this email.
					`.trim(),
				};
		}
	}

	async send(options: SendEmailOptions): Promise<SendEmailResult> {
		console.log("\n========== EMAIL (CONSOLE CLIENT) ==========");
		console.log("To:", options.to);
		console.log("From:", options.from || "noreply@ralph.app");
		console.log("Subject:", options.subject);
		console.log("--- Text Content ---");
		console.log(options.text || "(no text content)");
		console.log("--- HTML Content ---");
		console.log(options.html || "(no html content)");
		console.log("============================================\n");

		return {
			success: true,
			messageId: `console-${Date.now()}`,
		};
	}

	async sendTemplate(options: SendTemplateOptions): Promise<SendEmailResult> {
		const content = this.getTemplateContent(
			options.template,
			options.variables,
		);

		return this.send({
			to: options.to,
			from: options.from,
			replyTo: options.replyTo,
			subject: content.subject,
			html: content.html,
			text: content.text,
		});
	}
}
