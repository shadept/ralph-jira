import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
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
					<h1>Privacy Policy</h1>
					<p className="text-muted-foreground">
						Last updated: <span className="text-amber-600">[DATE]</span>
					</p>

					<div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 my-6">
						<p className="text-sm text-amber-700 dark:text-amber-400 m-0">
							This document contains placeholders (marked in amber) that need to
							be filled in with actual legal information before production use.
						</p>
					</div>

					<p className="text-lg">
						We believe in being straightforward about data. Here&apos;s what we
						collect and why.
					</p>

					<h2>The Short Version</h2>
					<ul>
						<li>We collect only what we need to provide the service</li>
						<li>We don&apos;t sell your data</li>
						<li>We don&apos;t show you ads</li>
						<li>You can delete your account and data at any time</li>
					</ul>

					<h2>What We Collect</h2>

					<h3>Account Information</h3>
					<p>When you sign up, we collect:</p>
					<ul>
						<li>Email address (to identify your account)</li>
						<li>Name (optional, for display purposes)</li>
						<li>Password (hashed, we can&apos;t read it)</li>
					</ul>

					<h3>Content You Create</h3>
					<p>
						Your projects, tasks, sprints, and other content you create in
						Ralph. This is your data - we store it to provide the service.
					</p>

					<h3>Usage Information</h3>
					<p>Basic information about how you use the service:</p>
					<ul>
						<li>When you log in</li>
						<li>Features you use (for improving the product)</li>
						<li>Error logs (to fix bugs)</li>
					</ul>

					<h3>AI Processing</h3>
					<p>
						When you use AI features, your task descriptions and project context
						are sent to AI providers (like Anthropic) to generate responses.
						This data is processed according to their privacy policies but is
						not used to train their models.
					</p>

					<h2>What We Don&apos;t Do</h2>
					<ul>
						<li>
							<strong>We don&apos;t sell your data.</strong> Ever.
						</li>
						<li>
							<strong>We don&apos;t show ads.</strong> Your data isn&apos;t used for
							advertising.
						</li>
						<li>
							<strong>We don&apos;t track you across the web.</strong> No
							third-party trackers.
						</li>
						<li>
							<strong>We don&apos;t share with third parties</strong> except as
							needed to run the service (hosting, AI providers).
						</li>
					</ul>

					<h2>How We Protect Your Data</h2>
					<ul>
						<li>Passwords are hashed using bcrypt</li>
						<li>All connections use HTTPS</li>
						<li>Database access is restricted and audited</li>
						<li>
							<span className="text-amber-600">
								[ADDITIONAL SECURITY MEASURES]
							</span>
						</li>
					</ul>

					<h2>Third-Party Services</h2>
					<p>We use the following services to operate Ralph:</p>
					<ul>
						<li>
							<strong>Authentication:</strong> GitHub OAuth (if you choose to
							sign in with GitHub)
						</li>
						<li>
							<strong>AI Processing:</strong> Anthropic (Claude) for AI features
						</li>
						<li>
							<strong>Hosting:</strong>{" "}
							<span className="text-amber-600">[HOSTING PROVIDER]</span>
						</li>
						<li>
							<strong>Payments:</strong>{" "}
							<span className="text-amber-600">[PAYMENT PROVIDER]</span>
						</li>
					</ul>

					<h2>Your Rights</h2>
					<p>You can:</p>
					<ul>
						<li>
							<strong>Access your data</strong> - see what we have stored
						</li>
						<li>
							<strong>Update your data</strong> - edit your profile and content
						</li>
						<li>
							<strong>Delete your data</strong> - remove your account entirely
						</li>
						<li>
							<strong>Export your data</strong> -{" "}
							<span className="text-amber-600">[EXPORT FEATURE TBD]</span>
						</li>
					</ul>

					<h2>Data Retention</h2>
					<p>
						We keep your data while your account is active. When you delete your
						account, we soft-delete your data (mark it as deleted) and may
						permanently delete it after{" "}
						<span className="text-amber-600">[RETENTION PERIOD]</span> days.
					</p>
					<p>
						Some data may be retained longer for legal compliance or legitimate
						business purposes (like billing records).
					</p>

					<h2>Cookies</h2>
					<p>We use only essential cookies:</p>
					<ul>
						<li>Session cookies to keep you logged in</li>
						<li>Security cookies to prevent attacks</li>
					</ul>
					<p>No tracking cookies. No analytics cookies.</p>

					<h2>Children</h2>
					<p>
						Ralph is not intended for children under 13. We do not knowingly
						collect data from children.
					</p>

					<h2>Changes to This Policy</h2>
					<p>
						We&apos;ll notify you of significant changes via email. Minor changes
						will be reflected in the &quot;Last updated&quot; date above.
					</p>

					<h2>Contact</h2>
					<p>
						Questions? Email us at:{" "}
						<span className="text-amber-600">[PRIVACY EMAIL]</span>
					</p>

					<hr />

					<p className="text-sm text-muted-foreground">
						<span className="text-amber-600">[COMPANY NAME]</span>
						<br />
						<span className="text-amber-600">[COMPANY ADDRESS]</span>
						<br />
						<span className="text-amber-600">[DATA PROTECTION OFFICER IF REQUIRED]</span>
					</p>
				</article>
			</div>
		</div>
	);
}
