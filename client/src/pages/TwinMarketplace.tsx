import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Blueprint {
  blueprintId: string;
  name: string;
  slug: string;
  description?: string;
  industry: string;
  organizationType?: string;
  securityProfile: string;
  defaultCouncilPersonaSetId?: string;
  defaultKpiSetId?: string;
  governanceProfileId?: string;
  status: string;
  version: string;
}

// ─── Industry icons (emoji) ───────────────────────────────────────────────────
const INDUSTRY_ICONS: Record<string, string> = {
  Defense: "🛡️",
  Finance: "🏦",
  "Islamic Finance": "☪️",
  Legal: "⚖️",
  "E-Commerce": "🛒",
  Manufacturing: "🏭",
  Automotive: "🚗",
  Healthcare: "🏥",
  "Real Estate": "🏢",
  Energy: "⚡",
  Logistics: "🚚",
  Technology: "💻",
  Retail: "🛍️",
  Education: "📚",
  Telecom: "📡",
  General: "🧠",
};

// ─── Governance badge ─────────────────────────────────────────────────────────
function GovBadge({ profile }: { profile: string }) {
  const styles: Record<string, string> = {
    STANDARD: "bg-slate-700 text-slate-200",
    CONFIDENTIAL: "bg-amber-900/60 text-amber-300 border border-amber-700",
    SOVEREIGN: "bg-emerald-900/60 text-emerald-300 border border-emerald-700",
    CLASSIFIED: "bg-red-900/60 text-red-300 border border-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${styles[profile] ?? styles.STANDARD}`}>
      {profile}
    </span>
  );
}

// ─── Blueprint Card ────────────────────────────────────────────────────────────────────
function BlueprintCard({ bp }: { bp: Blueprint }) {
  const icon = INDUSTRY_ICONS[bp.industry] ?? "🧠";

  return (
    <div className="border border-slate-700 rounded-xl p-5 bg-slate-800/60 hover:bg-slate-800 hover:border-indigo-600/50 transition-all flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{bp.name}</h3>
            <p className="text-slate-400 text-xs">{bp.industry} · v{bp.version}</p>
          </div>
        </div>
        <GovBadge profile={bp.securityProfile} />
      </div>

      {bp.description && (
        <p className="text-slate-400 text-xs leading-relaxed mb-3 flex-1">{bp.description}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-4">
        <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">{bp.organizationType ?? "Enterprise"}</span>
        <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">{bp.status}</span>
      </div>

      <div className="mt-auto pt-3 border-t border-slate-700 flex gap-2">
        <Link href={`/admin/twin-generator?blueprint=${bp.blueprintId}`} className="flex-1">
          <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
            Deploy Twin
          </Button>
        </Link>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 hover:text-white text-xs h-8">
          Preview
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TwinMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [selectedGov, setSelectedGov] = useState<string>("all");

  const { data: blueprints, isLoading } = trpc.twinFactory.blueprints.list.useQuery({});

  const industries = ["all", ...Array.from(new Set((blueprints ?? []).map((b: Blueprint) => b.industry ?? "General")))];
  const govProfiles = ["all", "STANDARD", "CONFIDENTIAL", "SOVEREIGN", "CLASSIFIED"];

  const filtered = (blueprints ?? []).filter((bp: Blueprint) => {
    const matchesSearch =
      !searchQuery ||
      bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bp.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bp.industry ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIndustry = selectedIndustry === "all" || bp.industry === selectedIndustry;
    const matchesGov = selectedGov === "all" || bp.governanceProfileId === selectedGov;
    return matchesSearch && matchesIndustry && matchesGov;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/95 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Twin Blueprint Marketplace</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Pre-built Decision Twin blueprints — deploy in minutes, no code required
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/enterprise">
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white text-xs">
                ← Dashboard
              </Button>
            </Link>
            <Link href="/admin/twin-generator">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                Custom Blueprint
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search blueprints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind === "all" ? "All Industries" : ind}
              </option>
            ))}
          </select>
          <select
            value={selectedGov}
            onChange={(e) => setSelectedGov(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {govProfiles.map((g) => (
              <option key={g} value={g}>
                {g === "all" ? "All Governance" : g}
              </option>
            ))}
          </select>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 mb-6 text-xs text-slate-500">
          <span>{(blueprints ?? []).length} blueprints available</span>
          <span>·</span>
          <span>{filtered.length} matching filters</span>
          <span>·</span>
          <span>Zero cloud dependency</span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-xl p-16 text-center">
            <p className="text-slate-500 text-sm mb-2">No blueprints match your filters</p>
            <p className="text-slate-600 text-xs">
              {(blueprints ?? []).length === 0
                ? "No blueprints registered yet. Use the Twin Generator to create your first blueprint."
                : "Try adjusting your search or filters."}
            </p>
            {(blueprints ?? []).length === 0 && (
              <Link href="/admin/twin-generator">
                <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                  Create Blueprint
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((bp: Blueprint) => (
              <BlueprintCard key={bp.blueprintId} bp={bp} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {(blueprints ?? []).length > 0 && (
          <div className="mt-10 border border-dashed border-slate-700 rounded-xl p-8 text-center">
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Need a custom blueprint?</h3>
            <p className="text-slate-500 text-xs mb-4">
              Use the Twin Generator wizard to compose a Decision Twin tailored to your industry, council, and governance requirements.
            </p>
            <Link href="/admin/twin-generator">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                Open Twin Generator
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
