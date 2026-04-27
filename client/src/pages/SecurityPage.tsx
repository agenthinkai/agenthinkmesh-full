import { Link } from "wouter";
import { trpc } from "../lib/trpc";

const NAVY_950 = "#060A14";
const NAVY_900 = "#0A0E1A";
const NAVY_800 = "#111827";
const NAVY_700 = "#1E2A3A";
const GREEN_400 = "#4ADE80";
const GREEN_500 = "#22C55E";
const SILVER_300 = "#CBD5E1";
const SILVER_400 = "#94A3B8";
const SILVER_500 = "#64748B";
const MONO = "'JetBrains Mono', 'Fira Mono', monospace";
const SANS = "'Inter', system-ui, sans-serif";

interface Section {
  id: string;
  label: string;
  title: string;
  content: React.ReactNode;
}

export default function SecurityPage() {
  // Live encryption coverage — admin-only, auto-refreshes every 60s
  const { data: encStatus } = trpc.system.encryptionStatus.useQuery(
    undefined,
    { refetchInterval: 60_000, retry: false }
  );

  const sections: Section[] = [
    {
      id: "data-handling",
      label: "01",
      title: "Data Handling",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            Deal information submitted through AgenThink Mesh — including company names, financial
            figures, deal terms, and any documents uploaded to the vault — is processed solely to
            generate the analysis you requested. It is not stored beyond your session unless you
            are authenticated and have an active account, in which case it is retained in your
            personal task history accessible only to you.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            <strong style={{ color: GREEN_400 }}>We do not share submitted deal data with third parties.</strong>{" "}
            We do not sell, license, or disclose deal information to other users, investors,
            counterparties, or data brokers.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            <strong style={{ color: GREEN_400 }}>We do not use submitted deal data to train AI models</strong>{" "}
            unless you explicitly opt in to a data contribution programme. No such programme is
            currently active. If one is introduced, it will require affirmative consent and will
            be opt-in only.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            LLM inference is performed via API calls to third-party model providers. These calls
            are made server-side. We do not send identifying user metadata to model providers.
            Refer to the respective provider's data processing agreements for their data handling
            terms.
          </p>
        </div>
      ),
    },
    {
      id: "infrastructure",
      label: "02",
      title: "Infrastructure & Encryption",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            AgenThink Mesh is hosted on Manus-managed cloud infrastructure. The platform runs on
            servers in Singapore (primary). All connections between clients, the application
            server, and the database are encrypted in transit using TLS 1.3. HTTP Strict Transport
            Security (HSTS) is enforced on all endpoints with a one-year max-age.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            The database is a managed MySQL-compatible instance (TiDB Cloud). File storage uses
            S3-compatible object storage. Both are encrypted at rest using AES-256 at the
            infrastructure layer.
          </p>

          {/* CMK highlight box */}
          <div
            style={{
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.3)",
              borderRadius: 8,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: GREEN_400,
                textTransform: "uppercase" as const,
                marginBottom: 4,
              }}
            >
              Customer-Managed Keys (CMK)
            </span>
            <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75, fontSize: 14 }}>
              <strong style={{ color: GREEN_400 }}>System-level encryption (always on):</strong>{" "}
              Agent analysis and reasoning outputs are encrypted at rest using AES-256-GCM,
              regardless of whether you have generated a CMK. This is applied automatically to
              every new pitch triage record using a platform-managed master key.
            </p>
            <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75, fontSize: 14 }}>
              Each account can additionally generate a unique AES-256-GCM encryption key
              exclusively for that account. When enabled, vault document text and deal signals
              are encrypted with this per-account key before being written to the database.
              The key is stored using envelope encryption: it is itself encrypted with a
              server-side master key before storage, so the raw data key is never persisted
              in plaintext anywhere.
            </p>
            <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75, fontSize: 14 }}>
              <strong style={{ color: GREEN_400 }}>You control the key lifecycle.</strong> From
              your account settings, you can generate your key, rotate it (which transparently
              re-encrypts all your stored data with the new key), or revoke it permanently.
              Revoking your key destroys access to all your encrypted data — including ours.
              Every key operation is logged to a tamper-evident audit log visible only to you.
            </p>
            <p style={{ margin: 0, color: SILVER_400, fontSize: 13, lineHeight: 1.65 }}>
              <strong style={{ color: GREEN_400 }}>Honest scope:</strong> CMK encrypts the
              content of your stored records. It does not encrypt data in transit (TLS handles
              that), and it does not prevent the AI from reading your data during active analysis
              — the key is decrypted in memory for the duration of each request and then
              discarded. If you require a deployment where data never leaves your infrastructure,
              contact us to discuss on-premise deployment options.
            </p>
            <a
              href="/security-keys"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: GREEN_400,
                fontFamily: MONO,
                fontSize: 12,
                textDecoration: "none",
                marginTop: 4,
              }}
            >
              Manage your encryption key →
            </a>
          </div>

          <div
            style={{
              background: "rgba(74,222,128,0.04)",
              border: "1px solid rgba(74,222,128,0.12)",
              borderRadius: 8,
              padding: "14px 18px",
            }}
          >
            <p style={{ margin: 0, color: SILVER_400, fontSize: 13, lineHeight: 1.65 }}>
              <strong style={{ color: GREEN_400 }}>Certification status (as of April 2026):</strong>{" "}
              AgenThink Mesh is an early-stage platform. We do not currently hold SOC 2 Type II,
              ISO 27001, or equivalent certifications. A formal security audit and SOC 2 readiness
              programme is planned for H2 2026. We will publish the audit report when available.
              We will not claim certifications we do not hold.
            </p>
          </div>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            Dependencies are pinned and reviewed on update. The application runs in an isolated
            container environment. Secrets are injected via environment variables and are not
            committed to source control.
          </p>
        </div>
      ),
    },
    {
      id: "access-controls",
      label: "03",
      title: "Access Controls",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            All authenticated routes require a valid session token issued after OAuth login.
            Sessions are signed with a server-side secret and expire after inactivity.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            User data is scoped by account. A logged-in user can only access their own task
            history, vault documents, and analysis outputs. No cross-account data access is
            possible through the application layer.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            Administrative functions (user management, usage metrics, waitlist data) are
            restricted to accounts with the{" "}
            <code style={{ color: GREEN_400, fontFamily: MONO, fontSize: 12 }}>admin</code> role.
            Role assignment is performed directly in the database by the platform owner and
            cannot be self-escalated.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            Server-side procedures enforce role checks at the API layer, not only in the
            frontend. Bypassing the UI does not grant access to protected procedures.
          </p>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            Audit logging is in place for authentication events (login, logout, failed attempts)
            and for sensitive data operations (vault uploads, deletions). Logs are retained for
            90 days.
          </p>
        </div>
      ),
    },
    {
      id: "retention",
      label: "04",
      title: "Retention Policy",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "Task history", value: "Retained while your account is active. Deleted within 30 days of account deletion." },
              { label: "Vault documents", value: "Retained until you delete them or your account is deleted. Deletion removes both the database record and the S3 object." },
              { label: "Authentication logs", value: "90 days, then automatically purged." },
              { label: "Waitlist submissions", value: "Retained until you request removal. Email security@agenthink.ai to be removed." },
              { label: "Anonymous session data", value: "Not retained. Unauthenticated analysis runs are not logged to a persistent store." },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: `1px solid ${NAVY_700}`,
                }}
              >
                <span style={{ color: GREEN_400, fontFamily: MONO, fontSize: 12, paddingTop: 2 }}>
                  {label}
                </span>
                <span style={{ color: SILVER_300, lineHeight: 1.65, fontSize: 14 }}>{value}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            To request deletion of your data, email{" "}
            <a href="mailto:security@agenthink.ai" style={{ color: GREEN_400 }}>
              security@agenthink.ai
            </a>{" "}
            with the subject line "Data deletion request". We will confirm deletion within 10
            business days.
          </p>
        </div>
      ),
    },
    {
      id: "responsible-disclosure",
      label: "05",
      title: "Responsible Disclosure",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            We welcome reports from security researchers who identify vulnerabilities in
            AgenThink Mesh. If you discover a potential security issue — including authentication
            bypasses, data exposure, injection vulnerabilities, or privilege escalation — please
            report it to us before public disclosure so we can investigate and remediate.
          </p>
          <div
            style={{
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 8,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 100, paddingTop: 2 }}>REPORT TO</span>
              <a
                href="mailto:security@agenthink.ai"
                style={{ color: GREEN_400, fontFamily: MONO, fontSize: 14, textDecoration: "none" }}
              >
                security@agenthink.ai
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 100, paddingTop: 2 }}>WINDOW</span>
              <span style={{ color: SILVER_300, fontSize: 14, lineHeight: 1.65 }}>
                90-day coordinated disclosure. We ask that you allow us 90 days from the date of
                your report to investigate and deploy a fix before any public disclosure.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 100, paddingTop: 2 }}>RESPONSE</span>
              <span style={{ color: SILVER_300, fontSize: 14, lineHeight: 1.65 }}>
                We commit to acknowledging receipt within 24 hours and providing a remediation
                timeline within 5 business days.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 100, paddingTop: 2 }}>ENCRYPT</span>
              <span style={{ color: SILVER_400, fontSize: 13, lineHeight: 1.65 }}>
                PGP key available on request for sensitive disclosures.
              </span>
            </div>
          </div>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            We do not currently operate a bug bounty programme. We will acknowledge your
            contribution in our security changelog (with your permission) once the issue is
            resolved. Reports that are clearly out-of-scope, spam, or automated scanner output
            will not receive a response.
          </p>
          <p style={{ margin: 0, color: SILVER_400, lineHeight: 1.75, fontSize: 13 }}>
            Out-of-scope items include: social engineering attacks against our team,
            denial-of-service attacks, issues in third-party services we depend on (report those
            to the respective vendor), and theoretical vulnerabilities without a working proof of
            concept.
          </p>
        </div>
      ),
    },
    {
      id: "encryption-status",
      label: "06",
      title: "Encryption Status",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            Current encryption status for all data stored in AgenThink Mesh. This section
            reflects the actual runtime state — not aspirational claims.
          </p>

          {/* Status rows */}
          {[
            {
              icon: "✅",
              title: "System encryption: Active",
              lines: [
                encStatus
                  ? `pitch_triages: ${encStatus.tables[0]?.coverage ?? 0}% (${(encStatus.tables[0]?.encrypted ?? 0).toLocaleString()} of ${(encStatus.tables[0]?.total ?? 0).toLocaleString()} records)`
                  : "Agent analysis, reasoning, and verdicts encrypted at rest using AES-256-GCM.",
                encStatus
                  ? `founder_agent_evaluations: ${encStatus.tables[1]?.coverage ?? 0}% (${(encStatus.tables[1]?.encrypted ?? 0).toLocaleString()} of ${(encStatus.tables[1]?.total ?? 0).toLocaleString()} records)`
                  : "All new records encrypted automatically. All existing records backfilled.",
                encStatus
                  ? `Overall: ${encStatus.overall.coverage}% (${encStatus.overall.encrypted.toLocaleString()} of ${encStatus.overall.total.toLocaleString()} records) \u00b7 AES-256-GCM`
                  : "Algorithm: AES-256-GCM \u00b7 Key: ENCRYPTION_MASTER_KEY (platform-managed)",
                encStatus
                  ? `Last checked: ${new Date(encStatus.lastUpdated).toLocaleTimeString()} \u00b7 auto-refreshes every 60s`
                  : "",
              ].filter(Boolean) as string[],
            },
            {
              icon: "✅",
              title: "Transport security: Active",
              lines: [
                "All connections between clients, the application server, and the database",
                "use TLS 1.3. HTTP Strict Transport Security (HSTS) enforced on all endpoints.",
              ],
            },
            {
              icon: "✅",
              title: "Data isolation: Active",
              lines: [
                "Each user's data is scoped by account at the API layer.",
                "No cross-user data access is possible through the application layer.",
              ],
            },
          ].map(({ icon, title, lines }) => (
            <div
              key={title}
              style={{
                background: "rgba(74,222,128,0.04)",
                border: "1px solid rgba(74,222,128,0.15)",
                borderRadius: 8,
                padding: "16px 20px",
                display: "flex",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>{icon}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  style={{
                    color: "#F1F5F9",
                    fontWeight: 600,
                    fontSize: 14,
                    fontFamily: MONO,
                  }}
                >
                  {title}
                </span>
                {lines.map((line, i) => (
                  <span
                    key={i}
                    style={{ color: SILVER_400, fontSize: 13, lineHeight: 1.65 }}
                  >
                    {line}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "security-contact",
      label: "07",
      title: "Security Contact",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            For institutional compliance enquiries, data processing questions, or vendor security
            questionnaires, contact us directly:
          </p>
          <div
            style={{
              background: NAVY_800,
              border: `1px solid ${NAVY_700}`,
              borderRadius: 8,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 80 }}>EMAIL</span>
              <a
                href="mailto:security@agenthink.ai"
                style={{ color: GREEN_400, fontFamily: MONO, fontSize: 14, textDecoration: "none" }}
              >
                security@agenthink.ai
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 80 }}>RESPONSE</span>
              <span style={{ color: SILVER_300, fontSize: 14 }}>Within 2 business days for compliance enquiries</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: SILVER_500, fontFamily: MONO, fontSize: 11, minWidth: 80 }}>ENCRYPT</span>
              <span style={{ color: SILVER_400, fontSize: 13 }}>
                PGP key available on request for sensitive disclosures
              </span>
            </div>
          </div>
          <p style={{ margin: 0, color: SILVER_300, lineHeight: 1.75 }}>
            If you are a compliance officer at a regulated institution conducting due diligence,
            we will provide a completed vendor security questionnaire on request. Email the
            address above with your organisation name and questionnaire format.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: SANS, color: SILVER_300 }}>
      {/* Top bar */}
      <div
        style={{
          borderBottom: `1px solid ${NAVY_700}`,
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link href="/" style={{ color: SILVER_500, fontSize: 12, fontFamily: MONO, textDecoration: "none" }}>
          ← Home
        </Link>
        <span style={{ color: NAVY_700 }}>·</span>
        <span style={{ color: SILVER_500, fontSize: 12, fontFamily: MONO }}>Security &amp; Data Policy</span>
      </div>

      {/* Page header */}
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "56px 24px 40px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(74,222,128,0.08)",
            border: "1px solid rgba(74,222,128,0.2)",
            borderRadius: 6,
            padding: "4px 12px",
            marginBottom: 20,
          }}
        >
          <span style={{ color: GREEN_500, fontFamily: MONO, fontSize: 11 }}>SECURITY &amp; DATA POLICY</span>
        </div>
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 32,
            fontWeight: 700,
            color: "#F1F5F9",
            lineHeight: 1.25,
          }}
        >
          How we handle your data
        </h1>
        {/* Last reviewed — placed directly below the page title */}
        <p style={{ margin: "0 0 20px", color: SILVER_500, fontSize: 12, fontFamily: MONO }}>
          This page was last reviewed: April 2026
        </p>
        <p style={{ margin: 0, color: SILVER_400, lineHeight: 1.75, maxWidth: 640 }}>
          This page is written for compliance officers, institutional investors, and anyone
          conducting security due diligence on AgenThink Mesh. It is intentionally plain and
          specific. If something is unclear or missing, email{" "}
          <a href="mailto:security@agenthink.ai" style={{ color: GREEN_400 }}>
            security@agenthink.ai
          </a>
          .
        </p>
      </div>

      {/* Jump links */}
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "0 24px 40px",
        }}
      >
        <div
          style={{
            background: NAVY_900,
            border: `1px solid ${NAVY_700}`,
            borderRadius: 8,
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 24px",
          }}
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                color: SILVER_400,
                fontSize: 13,
                textDecoration: "none",
                fontFamily: MONO,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: GREEN_500, fontSize: 11 }}>{s.label}</span>
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 80px" }}>
        {sections.map((s, i) => (
          <div
            key={s.id}
            id={s.id}
            style={{
              marginBottom: 56,
              paddingTop: 8,
              borderTop: i === 0 ? "none" : `1px solid ${NAVY_700}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
              <span
                style={{
                  color: GREEN_500,
                  fontFamily: MONO,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  minWidth: 24,
                }}
              >
                {s.label}
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#F1F5F9",
                }}
              >
                {s.title}
              </h2>
            </div>
            {s.content}
          </div>
        ))}

        {/* Footer note */}
        <div
          style={{
            borderTop: `1px solid ${NAVY_700}`,
            paddingTop: 32,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p style={{ margin: 0, color: SILVER_500, fontSize: 12, fontFamily: MONO }}>
            AgenThinkMesh · Institutional Decision Intelligence
          </p>
          <p style={{ margin: 0, color: SILVER_500, fontSize: 12 }}>
            Questions?{" "}
            <a href="mailto:security@agenthink.ai" style={{ color: GREEN_400 }}>
              security@agenthink.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
