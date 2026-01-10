import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function TermsPage() {
	return (
		<div className="min-h-screen bg-muted/50 py-12 px-4">
			<div className="max-w-2xl mx-auto">
				<Button variant="ghost" size="sm" asChild className="mb-8">
					<Link href="/login">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Login
					</Link>
				</Button>

				<article className="prose prose-neutral dark:prose-invert max-w-none">
					<h1>Terms of Service</h1>
					<p className="text-muted-foreground">
						Last updated: <span className="text-amber-600">[DATE]</span>
					</p>

					<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 my-6">
						<p className="text-sm text-amber-700 dark:text-amber-400 m-0">
							This document contains placeholders (marked in amber) that need to
							be filled in with actual legal information before production use.
						</p>
					</div>

					<h2>1. Agreement to Terms</h2>
					<p>
						By accessing or using Ralph (the &quot;Service&quot;), provided by{" "}
						<span className="text-amber-600">[COMPANY NAME]</span> (&quot;we&quot;, &quot;us&quot;,
						or &quot;our&quot;), you agree to be bound by these Terms of Service.
					</p>

					<h2>2. Description of Service</h2>
					<p>
						Ralph is an AI-powered project management platform that provides
						sprint planning, kanban boards, and task management features. The
						Service may include AI-assisted task execution capabilities.
					</p>

					<h2>3. User Accounts</h2>
					<ul>
						<li>You must provide accurate information when creating an account</li>
						<li>You are responsible for maintaining the security of your account</li>
						<li>You must notify us immediately of any unauthorized access</li>
						<li>One person or entity per account (no shared accounts)</li>
					</ul>

					<h2>4. Acceptable Use</h2>
					<p>You agree not to:</p>
					<ul>
						<li>Use the Service for any illegal purpose</li>
						<li>Attempt to gain unauthorized access to any part of the Service</li>
						<li>Interfere with or disrupt the Service</li>
						<li>Upload malicious code or content</li>
						<li>Use the Service to harm others</li>
					</ul>

					<h2>5. Your Content</h2>
					<p>
						You retain ownership of any content you create using the Service.
						We do not claim ownership of your projects, tasks, or any other
						content you create.
					</p>
					<p>
						You grant us a limited license to store and process your content
						solely for the purpose of providing the Service to you.
					</p>

					<h2>6. AI Features</h2>
					<p>
						The Service includes AI-powered features. While we strive for
						accuracy, AI-generated content may contain errors. You are
						responsible for reviewing and validating any AI-generated output
						before use.
					</p>

					<h2>7. Payment Terms</h2>
					<p>
						<span className="text-amber-600">[PAYMENT TERMS TO BE ADDED]</span>
					</p>

					<h2>8. Termination</h2>
					<p>
						You may delete your account at any time. We may suspend or terminate
						your access if you violate these terms. Upon termination, your data
						will be handled according to our Privacy Policy.
					</p>

					<h2>9. Disclaimers</h2>
					<p>
						The Service is provided &quot;as is&quot; without warranties of any kind,
						either express or implied. We do not guarantee that the Service will
						be uninterrupted, secure, or error-free.
					</p>

					<h2>10. Limitation of Liability</h2>
					<p>
						To the maximum extent permitted by law,{" "}
						<span className="text-amber-600">[COMPANY NAME]</span> shall not be
						liable for any indirect, incidental, special, consequential, or
						punitive damages resulting from your use of the Service.
					</p>

					<h2>11. Changes to Terms</h2>
					<p>
						We may update these terms from time to time. We will notify you of
						significant changes via email or through the Service. Continued use
						after changes constitutes acceptance.
					</p>

					<h2>12. Contact</h2>
					<p>
						For questions about these Terms, contact us at:{" "}
						<span className="text-amber-600">[CONTACT EMAIL]</span>
					</p>

					<hr />

					<p className="text-sm text-muted-foreground">
						<span className="text-amber-600">[COMPANY NAME]</span>
						<br />
						<span className="text-amber-600">[COMPANY ADDRESS]</span>
					</p>
				</article>
			</div>
		</div>
	);
}
