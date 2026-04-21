import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Landing from "./pages/Landing";
import MeshDashboard from "./pages/MeshDashboard";
import AgentRegistry from "./pages/AgentRegistry";
import Build from "./pages/Build";
import AnnotationStudio from "./pages/AnnotationStudio";
import AskScreen from "./pages/AskScreen";
import ResultScreen from "./pages/ResultScreen";
import HistoryScreen from "./pages/HistoryScreen";
import PortfolioHome from "./pages/PortfolioHome";
import PortfolioUpload from "./pages/PortfolioUpload";
import PortfolioAnalyzing from "./pages/PortfolioAnalyzing";
import PortfolioReport from "./pages/PortfolioReport";
import PortfolioVault from "./pages/PortfolioVault";
import PortfolioIntel from "./pages/PortfolioIntel";
import PortfolioIntelRun from "./pages/PortfolioIntelRun";
import PortfolioGuardian from "./pages/PortfolioGuardian";
import InsuranceHome from "./pages/InsuranceHome";
import InsuranceRun from "./pages/InsuranceRun";
import TakafulAlerts from "./pages/TakafulAlerts";
import AdMeshHome from "./pages/AdMeshHome";
import AdMeshRun from "./pages/AdMeshRun";
import SocialMediaHome from "./pages/SocialMediaHome";
import SocialMediaRun from "./pages/SocialMediaRun";
import OpenClawOverview from "./pages/OpenClawOverview";
import DiscoveryPage from "./pages/DiscoveryPage";
import BridgePage from "./pages/BridgePage";
import PolicyPage from "./pages/PolicyPage";
import ManifestsPage from "./pages/ManifestsPage";
import TurnaroundHome from "./pages/TurnaroundHome";
import TurnaroundUpload from "./pages/TurnaroundUpload";
import TurnaroundCommand from "./pages/TurnaroundCommand";
import TurnaroundReport from "./pages/TurnaroundReport";
import PersonaSelector from "./pages/PersonaSelector";
import ForceMajeureAgent from "./pages/ForceMajeureAgent";
import GameTheoryAgent from "./pages/GameTheoryAgent";
import ETFStudio from "./pages/ETFStudio";
import PartnerCRM from "./pages/PartnerCRM";
import AdminUsageDashboard from "./pages/AdminUsageDashboard";
import CommandCenter from "./pages/CommandCenter";
import MeshIntelligence from "./pages/Intelligence";
import MeshSidebar from "./components/MeshSidebar";
import AdminTreasury from "./pages/AdminTreasury";
import DomainAgents from "./pages/DomainAgents";
import DomainsPage from "./pages/DomainsPage";
import BetaAccess from "./pages/BetaAccess";
import RosieProtocol from "./pages/RosieProtocol";
import AdminBetaRequests from "./pages/AdminBetaRequests";
import Upgrade from "./pages/Upgrade";
import NotFound from "./pages/NotFound";
import DealScreener from "./pages/DealScreener";
import PitchTriage from "./pages/PitchTriage";
import PitchMirror from "./pages/PitchMirror";
import PitchMirrorShared from "./pages/PitchMirrorShared";
import PitchMirrorLanding from "./pages/PitchMirrorLanding";
import ProcurementScreener from "./pages/ProcurementScreener";
import Contacts from "./pages/Contacts";
import DealComparison from "./pages/DealComparison";
import SharedReport from "./pages/SharedReport";
import ReportsHistory from "./pages/ReportsHistory";
import IntelligenceHome from "./pages/IntelligenceHome";
import IntelligenceTracking from "./pages/IntelligenceTracking";
import IntelligenceBriefs from "./pages/IntelligenceBriefs";
import IntelligenceHistory from "./pages/IntelligenceHistory";
import IntelligenceAdmin from "./pages/IntelligenceAdmin";
import Telco from "./pages/Telco";
import ForecastDashboard from "./pages/ForecastDashboard";
import ForecastNew from "./pages/ForecastNew";
import ForecastDetail from "./pages/ForecastDetail";
import KnowledgeVault from "./pages/KnowledgeVault";
import SelfLearning from "./pages/SelfLearning";
import Pitch from "./pages/Pitch";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import AccountBilling from "./pages/AccountBilling";
import PaymentHistory from "./pages/PaymentHistory";
import { DemoBanner } from "./pages/Home";
import { useAuth } from "./_core/hooks/useAuth";
import Tracker from "./pages/Tracker";
import PortfolioMesh from "./pages/PortfolioMesh";
import PortfolioMeshHistory from "./pages/PortfolioMeshHistory";
import PortfolioMeshDemo from "./pages/PortfolioMeshDemo";
import PortfolioMeshRunDetail from "./pages/PortfolioMeshRunDetail";
import PortfolioMeshShare from "./pages/PortfolioMeshShare";
import AdminUserCreate from "./pages/AdminUserCreate";
import AdminUserList from "./pages/AdminUserList";
import PasswordLogin from "./pages/PasswordLogin";
import ChangePassword from "./pages/ChangePassword";

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
    <Switch>
      {/* Public landing page */}
      <Route path="/" component={Landing} />

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
      <Route path="/admin/beta-requests" component={AdminBetaRequests} />
      <Route path="/admin/treasury" component={AdminTreasury} />
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
      {/* Procurement — Vendor Evaluation Engine */}
      <Route path="/procurement" component={ProcurementScreener} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/deals/compare" component={DealComparison} />
      <Route path="/reports/:token" component={SharedReport} />
      <Route path="/reports/history" component={ReportsHistory} />

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

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
