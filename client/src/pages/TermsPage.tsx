import { Link } from "wouter";
import { FileText, ArrowLeft } from "lucide-react";

const LAST_UPDATED = "April 2026";
const CONTACT_EMAIL = "legal@agenthink.ai";
const COMPANY = "AgenThink Ltd";
const PRODUCT = "AgenThinkMesh";
const GOVERNING_LAW = "the Dubai International Financial Centre (DIFC)";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080B14] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#080B14]/90 backdrop-blur-xl border-b border-white/5 px-6 md:px-12 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white/80">Terms of Service</span>
        </div>
        <div className="w-16" />
      </nav>

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400 tracking-widest uppercase">Terms of Service</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-sm text-white/40 font-mono">Last updated: {LAST_UPDATED}</p>
          <p className="mt-4 text-white/60 text-sm leading-relaxed">
            These terms govern your use of {PRODUCT}, operated by {COMPANY}. By creating an account or using the platform, you agree to these terms. If you do not agree, do not use the platform.
          </p>
        </div>

        <div className="space-y-12 text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">1. The service</h2>
            <p className="text-white/60">
              {PRODUCT} is a structured AI analysis platform that routes tasks through specialist AI agents to produce decision-ready outputs. The platform is provided as-is for the purposes described in these terms. We reserve the right to modify, suspend, or discontinue any part of the service with reasonable notice.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">2. Eligibility and accounts</h2>
            <div className="space-y-3 text-white/60">
              <p>You must be at least 18 years old and have the legal capacity to enter into a binding agreement to use the platform. If you are using the platform on behalf of an organisation, you represent that you have authority to bind that organisation to these terms.</p>
              <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">{CONTACT_EMAIL}</a> if you suspect unauthorised access.</p>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">3. Acceptable use</h2>
            <div className="space-y-3 text-white/60">
              <p>You may use the platform for lawful business and research purposes. You must not:</p>
              <ul className="space-y-1.5 pl-4 list-disc marker:text-white/30">
                <li>Submit content that is illegal, fraudulent, defamatory, or infringes third-party intellectual property rights.</li>
                <li>Attempt to reverse-engineer, scrape, or extract the underlying AI models or platform infrastructure.</li>
                <li>Use the platform to generate content intended to deceive, manipulate, or harm others.</li>
                <li>Circumvent rate limits, authentication, or access controls.</li>
                <li>Resell or sublicense access to the platform without our written consent.</li>
                <li>Submit personally identifiable information about third parties without a lawful basis for doing so.</li>
              </ul>
              <p>We reserve the right to suspend or terminate accounts that violate these restrictions without prior notice.</p>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">4. Your content</h2>
            <div className="space-y-3 text-white/60">
              <p>You retain ownership of all content you submit to the platform. By submitting content, you grant us a limited, non-exclusive licence to process it for the sole purpose of providing the service to you.</p>
              <p>You are responsible for ensuring you have the right to submit any content you upload, including documents, data, and text. We do not review content for accuracy or legality before processing it.</p>
              <p>AI-generated outputs are provided for informational purposes only. They do not constitute legal, financial, medical, or professional advice. You are solely responsible for any decisions made on the basis of platform outputs.</p>
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">5. Intellectual property</h2>
            <p className="text-white/60">
              {COMPANY} owns all rights in the {PRODUCT} platform, including its software, design, agent architecture, and documentation. Nothing in these terms transfers any intellectual property rights to you. You may not copy, modify, or distribute any part of the platform without our written consent.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">6. No warranty</h2>
            <div className="space-y-3 text-white/60">
              <p>The platform is provided <strong className="text-white/80">"as is"</strong> and <strong className="text-white/80">"as available"</strong> without warranty of any kind, express or implied. We do not warrant that the platform will be uninterrupted, error-free, or that AI outputs will be accurate, complete, or fit for any particular purpose.</p>
              <p>We disclaim all implied warranties, including merchantability, fitness for a particular purpose, and non-infringement, to the fullest extent permitted by applicable law.</p>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">7. Limitation of liability</h2>
            <div className="space-y-3 text-white/60">
              <p>To the fullest extent permitted by applicable law, {COMPANY} and its officers, employees, and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of or inability to use the platform.</p>
              <p>Our total aggregate liability to you for any claims arising under these terms will not exceed the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) USD 100.</p>
              <p>Nothing in these terms excludes liability for fraud, wilful misconduct, or any liability that cannot be excluded under applicable law.</p>
            </div>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">8. Indemnification</h2>
            <p className="text-white/60">
              You agree to indemnify and hold harmless {COMPANY} and its officers, employees, and agents from any claims, damages, or expenses (including reasonable legal fees) arising from your use of the platform, your violation of these terms, or your infringement of any third-party rights.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">9. Termination</h2>
            <p className="text-white/60">
              Either party may terminate the agreement at any time. You may close your account from your account settings. We may suspend or terminate your access immediately if you violate these terms or if we discontinue the service. On termination, your right to use the platform ceases and your data will be deleted in accordance with our retention policy described in the Privacy Policy.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">10. Governing law and disputes</h2>
            <div className="space-y-3 text-white/60">
              <p>These terms are governed by the laws of {GOVERNING_LAW}. Any dispute arising from these terms will be subject to the exclusive jurisdiction of the DIFC Courts.</p>
              <p>Before initiating formal proceedings, both parties agree to attempt to resolve disputes in good faith through direct negotiation for at least 30 days.</p>
            </div>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">11. Changes to these terms</h2>
            <p className="text-white/60">
              We may update these terms from time to time. We will notify registered users by email of material changes at least 14 days before they take effect. Continued use of the platform after the effective date constitutes acceptance of the revised terms.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">12. Contact</h2>
            <p className="text-white/60">
              For legal enquiries, contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">{CONTACT_EMAIL}</a>.
            </p>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-white/8 flex flex-wrap gap-6 text-xs text-white/30">
          <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
          <Link href="/security" className="hover:text-white/60 transition-colors">Data &amp; Security</Link>
          <Link href="/" className="hover:text-white/60 transition-colors">← Back to home</Link>
        </div>
      </main>
    </div>
  );
}
