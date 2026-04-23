import { Link } from "wouter";
import { Shield, ArrowLeft } from "lucide-react";

const LAST_UPDATED = "April 2026";
const CONTACT_EMAIL = "privacy@agenthink.ai";
const COMPANY = "AgenThink Ltd";
const PRODUCT = "AgenThinkMesh";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080B14] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#080B14]/90 backdrop-blur-xl border-b border-white/5 px-6 md:px-12 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Privacy Policy</span>
        </div>
        <div className="w-16" />
      </nav>

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400 tracking-widest uppercase">Privacy Policy</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-sm text-white/40 font-mono">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 text-white/60 text-sm leading-relaxed">
            This policy explains what data {COMPANY} collects when you use {PRODUCT}, how we use it, how long we keep it, and what rights you have over it. We have written it to be readable, not to obscure what we do.
          </p>
        </div>

        <div className="space-y-12 text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">1. Who we are</h2>
            <p className="text-white/60">
              {COMPANY} operates {PRODUCT}, a structured AI analysis platform for institutional workflows. We are the data controller for all personal data processed through the platform. For data-related enquiries, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">{CONTACT_EMAIL}</a>.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">2. Data we collect</h2>
            <div className="space-y-4 text-white/60">
              <div>
                <p className="font-medium text-white/80 mb-1">Account data</p>
                <p>Name, email address, and profile information provided during sign-up via Manus OAuth. We do not store passwords — authentication is delegated to the OAuth provider.</p>
              </div>
              <div>
                <p className="font-medium text-white/80 mb-1">Usage data</p>
                <p>Tasks submitted, agents invoked, execution times, and workflow history. This data is used to provide the service and improve agent performance.</p>
              </div>
              <div>
                <p className="font-medium text-white/80 mb-1">Content data</p>
                <p>Documents uploaded to the Document Vault, pitch submissions, deal data, and any text you submit for analysis. This content is processed by AI agents to produce the outputs you request.</p>
              </div>
              <div>
                <p className="font-medium text-white/80 mb-1">Technical data</p>
                <p>IP address, browser type, session identifiers, and server logs. Retained for security and operational purposes.</p>
              </div>
              <div>
                <p className="font-medium text-white/80 mb-1">Demo request data</p>
                <p>Name, institution, email address, and use case description submitted via the demo request form. Used solely to respond to your enquiry.</p>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">3. How we use your data</h2>
            <div className="space-y-3 text-white/60">
              <p>We use your data to: provide and operate the {PRODUCT} service; process your analysis requests through AI agents; send transactional emails (account confirmation, trial progress, security alerts); respond to support and demo enquiries; detect and prevent abuse; and improve the platform.</p>
              <p>We do not sell your data to third parties. We do not use your content data to train AI models without your explicit consent.</p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">4. Encryption and security</h2>
            <div className="space-y-3 text-white/60">
              <p>
                All data is transmitted over TLS 1.3. At rest, sensitive content fields (pitch submissions, deal data, vault documents, analysis outputs) are encrypted using AES-256-GCM with a unique per-account data key. Each data key is itself encrypted with a platform master key before storage — a standard envelope encryption pattern.
              </p>
              <p>
                Users can generate, rotate, or permanently revoke their encryption key from the <Link href="/security-keys" className="text-emerald-400 hover:text-emerald-300 transition-colors">Security Keys</Link> page. Revoking a key renders the associated data permanently inaccessible, including to us. Full details of our security architecture are published on the <Link href="/security" className="text-emerald-400 hover:text-emerald-300 transition-colors">Security</Link> page.
              </p>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">5. Retention</h2>
            <div className="space-y-3 text-white/60">
              <p>We retain account data for as long as your account is active. Task history and analysis outputs are retained for 90 days from creation, after which they are permanently deleted from our systems.</p>
              <p>Document Vault files are retained until you delete them or close your account. Demo request data is retained for 12 months or until the enquiry is resolved, whichever comes first.</p>
              <p>Server logs are retained for 30 days for security purposes.</p>
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">6. Third-party processors</h2>
            <p className="text-white/60">
              We use the following sub-processors to operate the platform: Manus (authentication and hosting infrastructure); Anthropic (AI model inference — your content is processed under Anthropic's API terms and is not used to train their models); Resend (transactional email delivery); AWS S3 (file storage). Each processor is bound by a data processing agreement and is not permitted to use your data for their own purposes.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">7. Your rights</h2>
            <div className="space-y-3 text-white/60">
              <p>You have the right to: access the personal data we hold about you; correct inaccurate data; request deletion of your account and associated data; export your data in a portable format; withdraw consent for processing where consent is the legal basis; and object to processing for direct marketing.</p>
              <p>To exercise any of these rights, email <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">{CONTACT_EMAIL}</a>. We will respond within 30 days. Account deletion can also be initiated directly from your account settings.</p>
            </div>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">8. Cookies</h2>
            <p className="text-white/60">
              We use a single session cookie to maintain your authenticated state. We do not use advertising cookies, third-party tracking pixels, or analytics cookies. No cookie consent banner is required because we set only strictly necessary cookies.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">9. Changes to this policy</h2>
            <p className="text-white/60">
              We will notify registered users by email if we make material changes to this policy. The "Last updated" date at the top of this page reflects the most recent revision. Continued use of the platform after notification constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">10. Contact</h2>
            <p className="text-white/60">
              For all privacy-related enquiries, data access requests, or complaints, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">{CONTACT_EMAIL}</a>. We aim to respond within 5 business days.
            </p>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/8 flex flex-wrap gap-6 text-xs text-white/30">
          <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
          <Link href="/security" className="hover:text-white/60 transition-colors">Data &amp; Security</Link>
          <Link href="/security-keys" className="hover:text-white/60 transition-colors">Security Keys</Link>
          <Link href="/" className="hover:text-white/60 transition-colors">← Back to home</Link>
        </div>
      </main>
    </div>
  );
}
