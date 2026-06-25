import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";

// ── Critical path: eager imports (homepage, auth, lightweight shells) ──────────
import Home, { DemoBanner } from "./pages/Home";
import Landing from "./pages/Landing";
import MeshDashboard from "./pages/MeshDashboard";
import AskScreen from "./pages/AskScreen";
import PitchMirror from "./pages/PitchMirror";
import PitchMirrorShared from "./pages/PitchMirrorShared";
import PitchMirrorLanding from "./pages/PitchMirrorLanding";
import NotFound from "./pages/NotFound";
import PasswordLogin from "./pages/PasswordLogin";
import ChangePassword from "./pages/ChangePassword";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import SecurityPage from "./pages/SecurityPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import BetaAccess from "./pages/BetaAccess";
import Unsubscribe from "./pages/Unsubscribe";
import MeshSidebar from "./components/MeshSidebar";

// ── Lazy imports: heavy pages loaded only when navigated to ───────────────────
const AgentRegistry = lazy(() => import("./pages/AgentRegistry"));
const Build = lazy(() => import("./pages/Build"));
const AnnotationStudio = lazy(() => import("./pages/AnnotationStudio"));
const ResultScreen = lazy(() => import("./pages/ResultScreen"));
const HistoryScreen = lazy(() => import("./pages/HistoryScreen"));
const PortfolioHome = lazy(() => import("./pages/PortfolioHome"));
const PortfolioUpload = lazy(() => import("./pages/PortfolioUpload"));
const PortfolioAnalyzing = lazy(() => import("./pages/PortfolioAnalyzing"));
const PortfolioReport = lazy(() => import("./pages/PortfolioReport"));
const PortfolioVault = lazy(() => import("./pages/PortfolioVault"));
const PortfolioIntel = lazy(() => import("./pages/PortfolioIntel"));
const PortfolioIntelRun = lazy(() => import("./pages/PortfolioIntelRun"));
const PortfolioGuardian = lazy(() => import("./pages/PortfolioGuardian"));
const InsuranceHome = lazy(() => import("./pages/InsuranceHome"));
const InsuranceRun = lazy(() => import("./pages/InsuranceRun"));
const TakafulAlerts = lazy(() => import("./pages/TakafulAlerts"));
const AdMeshHome = lazy(() => import("./pages/AdMeshHome"));
const AdMeshRun = lazy(() => import("./pages/AdMeshRun"));
const SocialMediaHome = lazy(() => import("./pages/SocialMediaHome"));
const SocialMediaRun = lazy(() => import("./pages/SocialMediaRun"));
const OpenClawOverview = lazy(() => import("./pages/OpenClawOverview"));
const DiscoveryPage = lazy(() => import("./pages/DiscoveryPage"));
const BridgePage = lazy(() => import("./pages/BridgePage"));
const PolicyPage = lazy(() => import("./pages/PolicyPage"));
const ManifestsPage = lazy(() => import("./pages/ManifestsPage"));
const TurnaroundHome = lazy(() => import("./pages/TurnaroundHome"));
const TurnaroundUpload = lazy(() => import("./pages/TurnaroundUpload"));
const TurnaroundCommand = lazy(() => import("./pages/TurnaroundCommand"));
const TurnaroundReport = lazy(() => import("./pages/TurnaroundReport"));
const PersonaSelector = lazy(() => import("./pages/PersonaSelector"));
const ForceMajeureAgent = lazy(() => import("./pages/ForceMajeureAgent"));
const GameTheoryAgent = lazy(() => import("./pages/GameTheoryAgent"));
const ETFStudio = lazy(() => import("./pages/ETFStudio"));
const PartnerCRM = lazy(() => import("./pages/PartnerCRM"));
const AdminUsageDashboard = lazy(() => import("./pages/AdminUsageDashboard"));
const AdminEvalsDashboard = lazy(() => import("./pages/AdminEvalsDashboard"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const MeshIntelligence = lazy(() => import("./pages/Intelligence"));
const AdminTreasury = lazy(() => import("./pages/AdminTreasury"));
const DomainAgents = lazy(() => import("./pages/DomainAgents"));
const DomainsPage = lazy(() => import("./pages/DomainsPage"));
const RosieProtocol = lazy(() => import("./pages/RosieProtocol"));
const AdminBetaRequests = lazy(() => import("./pages/AdminBetaRequests"));
const AdminDemoRequests = lazy(() => import("./pages/AdminDemoRequests"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const DealScreener = lazy(() => import("./pages/DealScreener"));
const DealSourcing = lazy(() => import("./pages/DealSourcing"));
const GccEquitiesCouncil = lazy(() => import("./pages/GccEquitiesCouncil"));
const UaeRealEstateCouncil = lazy(() => import("./pages/UaeRealEstateCouncil"));
const PitchTriage = lazy(() => import("./pages/PitchTriage"));
const ProcurementScreener = lazy(() => import("./pages/ProcurementScreener"));
const Contacts = lazy(() => import("./pages/Contacts"));
const DealComparison = lazy(() => import("./pages/DealComparison"));
const SharedReport = lazy(() => import("./pages/SharedReport"));
const ReportsHistory = lazy(() => import("./pages/ReportsHistory"));
const GovernanceSnapshotView = lazy(() => import("./pages/GovernanceSnapshotView"));
const IntelligenceHome = lazy(() => import("./pages/IntelligenceHome"));
const IntelligenceTracking = lazy(() => import("./pages/IntelligenceTracking"));
const IntelligenceBriefs = lazy(() => import("./pages/IntelligenceBriefs"));
const IntelligenceHistory = lazy(() => import("./pages/IntelligenceHistory"));
const IntelligenceAdmin = lazy(() => import("./pages/IntelligenceAdmin"));
const Telco = lazy(() => import("./pages/Telco"));
const ForecastDashboard = lazy(() => import("./pages/ForecastDashboard"));
const ForecastNew = lazy(() => import("./pages/ForecastNew"));
const ForecastDetail = lazy(() => import("./pages/ForecastDetail"));
const KnowledgeVault = lazy(() => import("./pages/KnowledgeVault"));
const SelfLearning = lazy(() => import("./pages/SelfLearning"));
const Pitch = lazy(() => import("./pages/Pitch"));
const AccountBilling = lazy(() => import("./pages/AccountBilling"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const Tracker = lazy(() => import("./pages/Tracker"));
const PortfolioMesh = lazy(() => import("./pages/PortfolioMesh"));
const PortfolioMeshHistory = lazy(() => import("./pages/PortfolioMeshHistory"));
const PortfolioMeshDemo = lazy(() => import("./pages/PortfolioMeshDemo"));
const PortfolioMeshRunDetail = lazy(() => import("./pages/PortfolioMeshRunDetail"));
const PortfolioMeshShare = lazy(() => import("./pages/PortfolioMeshShare"));
const AdminUserCreate = lazy(() => import("./pages/AdminUserCreate"));
const AdminUserList = lazy(() => import("./pages/AdminUserList"));
const OutcomeLedgerAdmin = lazy(() => import("./pages/admin/OutcomeLedger"));
const OutcomeMetrics = lazy(() => import("./pages/admin/OutcomeMetrics"));
const OutcomeAttribution = lazy(() => import("./pages/admin/OutcomeAttribution"));
const OutcomeCalibration = lazy(() => import("./pages/admin/OutcomeCalibration"));
const InstitutionalProof = lazy(() => import("./pages/admin/InstitutionalProof"));
const OutcomeBackfill = lazy(() => import("./pages/admin/OutcomeBackfill"));
const AdminPilots = lazy(() => import("./pages/admin/AdminPilots"));
const PilotLanding = lazy(() => import("./pages/PilotLanding"));
const SgIcDemo = lazy(() => import("./pages/SgIcDemo"));
const JpIcDemo = lazy(() => import("./pages/JpIcDemo"));
const UsIcDemo = lazy(() => import("./pages/UsIcDemo"));
const GccIcDemo = lazy(() => import("./pages/GccIcDemo"));
const MarkazDemo = lazy(() => import("./pages/MarkazDemo"));
const KamcoDemo = lazy(() => import("./pages/KamcoDemo"));
const NbkDemo = lazy(() => import("./pages/NbkDemo"));
const KiaDemo = lazy(() => import("./pages/KiaDemo"));
const AlghanimDemo = lazy(() => import("./pages/AlghanimDemo"));
const ProductDemo = lazy(() => import("./pages/ProductDemo"));
const ProductDemoV2 = lazy(() => import("./pages/ProductDemoV2"));
const Demos = lazy(() => import("./pages/Demos"));
const VoiceDemoAgent = lazy(() => import("./pages/VoiceDemoAgent"));
const DemoGuide = lazy(() => import("./pages/DemoGuide"));
const FounderFleet = lazy(() => import("./pages/FounderFleet"));
// D.1b Batch 1 — /demo/* prospect pages
const StcDemo = lazy(() => import("./pages/StcDemo"));
const TencentDemo = lazy(() => import("./pages/TencentDemo"));
const NbkCapitalDemo = lazy(() => import("./pages/NbkCapitalDemo"));
// D.1b Batch 2 — /demo/* prospect pages (approved 2026-05-17)
const Core42Demo = lazy(() => import("./pages/Core42Demo"));
// D.1b Batch 3 — /demo/rwe (RWE Infrastructure, 2026-06-04)
const RweDemo = lazy(() => import("./pages/RweDemo"));
const AdnocDemo = lazy(() => import("./pages/AdnocDemo"));
const KiaCapitalDemo = lazy(() => import("./pages/KiaCapitalDemo"));
const KamcoInvestDemo = lazy(() => import("./pages/KamcoInvestDemo"));
const SecurityKeysPage = lazy(() => import("./pages/SecurityKeysPage"));
const SADOLanding = lazy(() => import("./pages/sado/SADOLanding"));
const SADOCommandCentre = lazy(() => import("./pages/sado/SADOCommandCentre"));
const SADODiscovery = lazy(() => import("./pages/sado/SADODiscovery"));
const SADOKnowledgeGraph = lazy(() => import("./pages/sado/SADOKnowledgeGraph"));
const SADOGovernance = lazy(() => import("./pages/sado/SADOGovernance"));
const SADOEscalations = lazy(() => import("./pages/sado/SADOEscalations"));
const SADOAuditTrail = lazy(() => import("./pages/sado/SADOAuditTrail"));
const SADOConsensus  = lazy(() => import("./pages/sado/SADOConsensus"));
const SADOArabicRefinement = lazy(() => import("./pages/sado/SadoArabicRefinement"));
const CouncilOf10 = lazy(() => import("./pages/CouncilOf10"));
const InferenceGovernanceDashboard = lazy(() => import("./pages/InferenceGovernanceDashboard"));
const InfraSimDashboard = lazy(() => import("./pages/InfraSimDashboard"));
const InfraSimCase = lazy(() => import("./pages/InfraSimCase"));
const InfraSimRunDetail = lazy(() => import("./pages/InfraSimRunDetail"));
const InfraSimCouncil = lazy(() => import("./pages/InfraSimCouncil"));
const InfraSimMonitor = lazy(() => import("./pages/InfraSimMonitor"));
const PharmaDemoPage = lazy(() => import("./pages/PharmaDemoPage"));
// AROS — Revenue Operating System
const ArosCommandCenter = lazy(() => import("./pages/aros/ArosCommandCenter").then(m => ({ default: m.ArosCommandCenter })));
const ArosCommandCenterV2 = lazy(() => import("./pages/aros/ArosCommandCenterV2"));
const ArosUniverse = lazy(() => import("./pages/aros/ArosUniverse").then(m => ({ default: m.ArosUniverse })));
const ArosOpportunities = lazy(() => import("./pages/aros/ArosOpportunities").then(m => ({ default: m.ArosOpportunities })));
const ArosOutreach = lazy(() => import("./pages/aros/ArosOutreach").then(m => ({ default: m.ArosOutreach })));
const ArosPipeline = lazy(() => import("./pages/aros/ArosPipeline").then(m => ({ default: m.ArosPipeline })));
const ArosTokenRoi = lazy(() => import("./pages/aros/ArosTokenRoi").then(m => ({ default: m.ArosTokenRoi })));
const ArosOperations = lazy(() => import("./pages/aros/ArosOperations"));
const ArosConstitution = lazy(() => import("./pages/aros/ArosConstitution"));
const ArosConstitutionHistory = lazy(() => import("./pages/aros/ArosConstitutionHistory"));
const ArosConstitutionPerformance = lazy(() => import("./pages/aros/ArosConstitutionPerformance"));
const ArosSignificance = lazy(() => import("./pages/aros/ArosSignificance"));
const ArosDailyCycle = lazy(() => import("./pages/aros/ArosDailyCycle"));

// ── Page-level loading fallback ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0B1629",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid #1e2d3d", borderTopColor: "#4a9eff",
          animation: "spin 0.8s linear infinite", margin: "0 auto 10px",
        }} />
        <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0B1629",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "3px solid #E2E8F0",
            borderTopColor: "#7BA3D4",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }} />
          <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
            Initialising Mesh…
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      {/* Governed Decision Infrastructure — primary homepage */}
      <Route path="/" component={Landing} />
      <Route path="/platform" component={Landing} />
      {/* UAE Real Estate Council — moved from / to /real-estate */}
      <Route path="/real-estate">{() => <UaeRealEstateCouncil />}</Route>
      {/* Old landing pages */}
      <Route path="/home" component={Home} />

      {/* 3-Screen MVP — core user journey */}
      <Route path="/ask" component={AskScreen} />
      <Route path="/result/:id" component={ResultScreen} />
      <Route path="/history" component={HistoryScreen} />

      {/* Portfolio Intelligence */}
      <Route path="/portfolio" component={PortfolioHome} />
      <Route path="/portfolio/intel" component={PortfolioIntel} />
      <Route path="/portfolio/intel/run/:runType/:runId" component={PortfolioIntelRun} />
      <Route path="/portfolio/guardian" component={PortfolioGuardian} />
      <Route path="/portfolio-review/upload" component={PortfolioUpload} />
      <Route path="/portfolio-review/analyzing/:id" component={PortfolioAnalyzing} />
      <Route path="/portfolio-review/report/:id" component={PortfolioReport} />
      <Route path="/vault" component={PortfolioVault} />

      {/* Insurance & Reinsurance Intelligence */}
      <Route path="/insurance" component={InsuranceHome} />
      <Route path="/insurance/run/:runType/:runId" component={InsuranceRun} />
      <Route path="/insurance/takaful-alerts" component={TakafulAlerts} />

      {/* AdMesh — AI Creative Intelligence */}
      <Route path="/admesh" component={AdMeshHome} />
      <Route path="/admesh/run/:runId" component={AdMeshRun} />

      {/* Social Media Intelligence */}
      <Route path="/social" component={SocialMediaHome} />
      <Route path="/social/run/:runType/:runId" component={SocialMediaRun} />

      {/* OpenClaw — A2A Integration Console */}
      <Route path="/openclaw" component={OpenClawOverview} />
      <Route path="/openclaw/discovery" component={DiscoveryPage} />
      <Route path="/openclaw/bridge" component={BridgePage} />
      <Route path="/openclaw/policy" component={PolicyPage} />
      <Route path="/openclaw/manifests" component={ManifestsPage} />

      {/* Mesh Identity Layer */}
      <Route path="/persona-setup" component={PersonaSelector} />

      {/* Domains directory + domain agent explorer */}
      <Route path="/domains" component={DomainsPage} />
      <Route path="/domain/:name" component={DomainAgents} />

      {/* Specialist Agents */}
      <Route path="/agents/force-majeure" component={ForceMajeureAgent} />
      <Route path="/agents/game-theory" component={GameTheoryAgent} />
      <Route path="/agents/etf-studio" component={ETFStudio} />
      <Route path="/etf/partners" component={PartnerCRM} />

      {/* Rosie Protocol — Sequential Outcome Engine */}
      <Route path="/rosie" component={RosieProtocol} />
      <Route path="/beta-access" component={BetaAccess} />
      {/* Admin */}
      <Route path="/admin/usage" component={AdminUsageDashboard} />
      <Route path="/admin/evals" component={AdminEvalsDashboard} />
      <Route path="/admin/inference-governance" component={InferenceGovernanceDashboard} />
      <Route path="/admin/beta-requests" component={AdminBetaRequests} />
      <Route path="/admin/demo-requests" component={AdminDemoRequests} />
      <Route path="/admin/treasury" component={AdminTreasury} />
      <Route path="/admin/pilots" component={AdminPilots} />
      <Route path="/pilot/:slug" component={PilotLanding} />
      <Route path="/admin/outcomes/backfill" component={OutcomeBackfill} />
      <Route path="/admin/proof" component={InstitutionalProof} />
      <Route path="/admin/outcomes/calibration" component={OutcomeCalibration} />
      <Route path="/admin/outcomes/attribution" component={OutcomeAttribution} />
      <Route path="/admin/outcomes/metrics" component={OutcomeMetrics} />
      <Route path="/admin/outcomes" component={OutcomeLedgerAdmin} />
      <Route path="/founder-fleet" component={FounderFleet} />
      <Route path="/upgrade" component={Upgrade} />
      <Route path="/upgrade/success" component={Upgrade} />

      {/* 100-Hour Turnaround */}
      <Route path="/turnaround" component={TurnaroundHome} />
      <Route path="/turnaround/upload" component={TurnaroundUpload} />
      <Route path="/turnaround/command/:id" component={TurnaroundCommand} />
      <Route path="/turnaround/report/:id" component={TurnaroundReport} />

      {/* Advanced / power-user section */}
      <Route path="/mesh" component={isAuthenticated ? MeshDashboard : Landing} />
      <Route path="/registry" component={AgentRegistry} />
      <Route path="/build" component={Build} />
      <Route path="/annotate" component={AnnotationStudio} />

      {/* Pitch Triage — Fast 6-agent pre-filter */}
      <Route path="/pitch-triage" component={PitchTriage} />
      {/* PitchMirror — Founder-facing feedback layer */}
      <Route path="/pitchmirror" component={PitchMirror} />
      <Route path="/pitchmirror/r/:token" component={PitchMirrorShared} />
      <Route path="/pitchmirror/landing" component={PitchMirrorLanding} />
      {/* Deal Screener — Council of 10 */}
      <Route path="/deals">{() => <MeshSidebar><DealScreener /></MeshSidebar>}</Route>
      <Route path="/deal-sourcing">{() => <MeshSidebar><DealSourcing /></MeshSidebar>}</Route>
      {/* Council of 10 — GCC Equities */}
      <Route path="/gcc-equities">{() => <MeshSidebar><GccEquitiesCouncil /></MeshSidebar>}</Route>
      {/* UAE Real Estate Council — also accessible at /uae-realestate */}
      <Route path="/uae-realestate">{() => <UaeRealEstateCouncil />}</Route>
      {/* Procurement — Vendor Evaluation Engine */}
      <Route path="/procurement" component={ProcurementScreener} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/deals/compare" component={DealComparison} />
      <Route path="/reports/:token" component={SharedReport} />
      <Route path="/reports/history" component={ReportsHistory} />
      <Route path="/share/governance/:token" component={GovernanceSnapshotView} />

      {/* Intelligence Agent — AI Programme Monitoring */}
      <Route path="/intelligence" component={IntelligenceHome} />
      <Route path="/intelligence/tracking" component={IntelligenceTracking} />
      <Route path="/intelligence/briefs" component={IntelligenceBriefs} />
      <Route path="/intelligence/history" component={IntelligenceHistory} />
      <Route path="/intelligence/admin" component={IntelligenceAdmin} />

      {/* MVNO Intelligence — Kuwait Telco */}
      <Route path="/telco" component={Telco} />

      {/* ForecastMesh — Probability Forecasting Engine */}
      <Route path="/forecast" component={ForecastDashboard} />
      <Route path="/forecast/new" component={ForecastNew} />
      <Route path="/forecast/:id" component={ForecastDetail} />
      <Route path="/forecast/:id/activity" component={ForecastDetail} />
      <Route path="/forecast/:id/actions" component={ForecastDetail} />

      {/* Knowledge Vault — RAG Grounding Layer */}
      <Route path="/knowledge-vault" component={KnowledgeVault} />

      {/* Self-Learning Loop — Council Meritocracy Dashboard */}
      <Route path="/self-learning" component={SelfLearning} />

      {/* Revenue Bridge — Public Pitch Evaluation */}
      <Route path="/pitch" component={Pitch} />

      {/* PortfolioMesh — Institutional Asset Allocation Engine */}
      <Route path="/portfolio-mesh" component={PortfolioMesh} />
      <Route path="/portfolio-mesh/demo" component={PortfolioMeshDemo} />
      <Route path="/portfolio-mesh/history" component={PortfolioMeshHistory} />
      <Route path="/portfolio-mesh/run/:id" component={PortfolioMeshRunDetail} />
      <Route path="/portfolio-mesh/share/:token" component={PortfolioMeshShare} />

      {/* Pricing */}
      <Route path="/pricing" component={Pricing} />
      <Route path="/account/billing" component={AccountBilling} />
      <Route path="/account/payments" component={PaymentHistory} />

      {/* Contact / Book Demo */}
      <Route path="/contact" component={Contact} />

      {/* Email Reply Tracker */}
      <Route path="/tracker" component={Tracker} />

      {/* AgenThink Mesh — Command Center + Intelligence */}
      <Route path="/command-center">{() => <MeshSidebar><CommandCenter /></MeshSidebar>}</Route>
      <Route path="/mesh-intelligence">{() => <MeshSidebar><MeshIntelligence /></MeshSidebar>}</Route>

      {/* Admin provisioning (admin-only, not in public nav) */}
      <Route path="/admin/users/create" component={AdminUserCreate} />
      <Route path="/admin/users" component={AdminUserList} />

      {/* Password-based auth for provisioned users */}
      <Route path="/login/password" component={PasswordLogin} />
      <Route path="/account/change-password" component={ChangePassword} />

      {/* Unsubscribe — public, no auth required */}
      <Route path="/unsubscribe" component={Unsubscribe} />
      {/* Security & Data Policy — public */}
      <Route path="/security" component={SecurityPage} />
      {/* CMK key management — authenticated */}
      <Route path="/security-keys" component={SecurityKeysPage} />
      {/* Legal pages — public */}
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      {/* Demo index + institutional demo pages */}
      <Route path="/demos" component={Demos} />
      <Route path="/sg-ic" component={SgIcDemo} />
      <Route path="/jp-ic" component={JpIcDemo} />
      <Route path="/us-ic" component={UsIcDemo} />
      <Route path="/gcc-ic" component={GccIcDemo} />
      {/* Prospect-specific demo pages */}
      <Route path="/markaz" component={MarkazDemo} />
      <Route path="/kamco" component={KamcoDemo} />
      <Route path="/nbk" component={NbkDemo} />
      <Route path="/kia" component={KiaDemo} />
      <Route path="/alghanim" component={AlghanimDemo} />
      <Route path="/product-demo" component={ProductDemo} />
      <Route path="/product-demo-v2" component={ProductDemoV2} />
      {/* D.1b Batch 1 — /demo/* prospect routes (isolated from Batch 2) */}
      <Route path="/demo/stc" component={StcDemo} />
      <Route path="/demo/tencent" component={TencentDemo} />
      <Route path="/demo/nbk" component={NbkCapitalDemo} />
      {/* D.1b Batch 2 — /demo/* prospect routes (wired 2026-05-17) */}
      <Route path="/demo/core42" component={Core42Demo} />
      <Route path="/demo/adnoc" component={AdnocDemo} />
      <Route path="/demo/kia" component={KiaCapitalDemo} />
      <Route path="/demo/kamco" component={KamcoInvestDemo} />
      {/* D.1b Batch 3 */}
      <Route path="/demo/rwe" component={RweDemo} />
      {/* Guided demo + reference */}
      <Route path="/voice-demo" component={VoiceDemoAgent} />
      <Route path="/demo-guide" component={DemoGuide} />

      {/* SADO — Sovereign AI Data Operations */}
      <Route path="/sado">{() => <MeshSidebar><SADOLanding /></MeshSidebar>}</Route>
      <Route path="/sado/command-centre">{() => <MeshSidebar><SADOCommandCentre /></MeshSidebar>}</Route>
      <Route path="/sado/discovery">{() => <MeshSidebar><SADODiscovery /></MeshSidebar>}</Route>
      <Route path="/sado/knowledge-graph">{() => <MeshSidebar><SADOKnowledgeGraph /></MeshSidebar>}</Route>
      {/* Legacy alias */}
      <Route path="/sado/graph">{() => <MeshSidebar><SADOKnowledgeGraph /></MeshSidebar>}</Route>
      <Route path="/sado/governance">{() => <MeshSidebar><SADOGovernance /></MeshSidebar>}</Route>
      <Route path="/sado/escalations">{() => <MeshSidebar><SADOEscalations /></MeshSidebar>}</Route>
      <Route path="/sado/audit-trail">{() => <MeshSidebar><SADOAuditTrail /></MeshSidebar>}</Route>
      {/* Legacy alias */}
      <Route path="/sado/audit">{() => <MeshSidebar><SADOAuditTrail /></MeshSidebar>}</Route>
      <Route path="/sado/consensus">{() => <MeshSidebar><SADOConsensus /></MeshSidebar>}</Route>
      <Route path="/sado-arabic">{() => <MeshSidebar><SADOArabicRefinement /></MeshSidebar>}</Route>

      {/* Council of 10 — public standalone reflective decision companion */}
      <Route path="/council">{() => <CouncilOf10 />}</Route>

      {/* Governed Infrastructure Stress Simulation v2 */}
      <Route path="/infra-sim">{() => <MeshSidebar><InfraSimDashboard /></MeshSidebar>}</Route>
      <Route path="/infra-sim/case/:id">{() => <MeshSidebar><InfraSimCase /></MeshSidebar>}</Route>
      <Route path="/infra-sim/run/:id">{() => <MeshSidebar><InfraSimRunDetail /></MeshSidebar>}</Route>
      <Route path="/infra-sim/council/:id">{() => <MeshSidebar><InfraSimCouncil /></MeshSidebar>}</Route>
      <Route path="/infra-sim/monitor/:id">{() => <MeshSidebar><InfraSimMonitor /></MeshSidebar>}</Route>

      {/* Pharma Validation Demo */}
      <Route path="/pharma">{() => <PharmaDemoPage />}</Route>

      {/* AROS — Revenue Operating System */}
      <Route path="/aros" component={ArosCommandCenter} />
      <Route path="/aros/universe" component={ArosUniverse} />
      <Route path="/aros/opportunities" component={ArosOpportunities} />
      <Route path="/aros/outreach" component={ArosOutreach} />
      <Route path="/aros/pipeline" component={ArosPipeline} />
      <Route path="/aros/token-roi" component={ArosTokenRoi} />
      <Route path="/aros/command-center" component={ArosCommandCenterV2} />
      <Route path="/aros/operations" component={ArosOperations} />
      <Route path="/aros/constitution" component={ArosConstitution} />
      <Route path="/aros/constitution/history" component={ArosConstitutionHistory} />
      <Route path="/aros/constitution/performance" component={ArosConstitutionPerformance} />
      <Route path="/aros/significance" component={ArosSignificance} />
      <Route path="/aros/daily-cycle" component={ArosDailyCycle} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <DemoBanner />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
