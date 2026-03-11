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
import NotFound from "./pages/NotFound";
import { useAuth } from "./_core/hooks/useAuth";

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
      <Route path="/portfolio-review/upload" component={PortfolioUpload} />
      <Route path="/portfolio-review/analyzing/:id" component={PortfolioAnalyzing} />
      <Route path="/portfolio-review/report/:id" component={PortfolioReport} />
      <Route path="/vault" component={PortfolioVault} />

      {/* Advanced / power-user section */}
      <Route path="/mesh" component={isAuthenticated ? MeshDashboard : Landing} />
      <Route path="/registry" component={AgentRegistry} />
      <Route path="/build" component={Build} />
      <Route path="/annotate" component={AnnotationStudio} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
