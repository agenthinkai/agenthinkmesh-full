import { toast } from "sonner";
/**
 * AROS Universe — 10,000-company target universe
 * Lists all companies with filtering, scoring, and actions
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radar, Search, RefreshCw, Zap, Brain, ChevronLeft, ChevronRight } from "lucide-react";


const SECTORS = ["Banks", "Infrastructure Investors", "Telecom Operators", "Asset Managers", "Energy Companies"];
const COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "Singapore", "UAE", "Germany", "France", "Japan"];
const PAGE_SIZE = 50;

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : score >= 75 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
    : score >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{score}</span>;
}

export function ArosUniverse() {
  
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [page, setPage] = useState(0);
  const [startingRun, setStartingRun] = useState(false);
  const [generatingTwin, setGeneratingTwin] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.arosDiscovery.listCompanies.useQuery({
    search: search || undefined,
    sector: sector !== "all" ? sector : undefined,
    country: country !== "all" ? country : undefined,
    minScore: parseInt(minScore) || 0,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    orderBy: "opportunityScore",
  });

  const { data: stats } = trpc.arosDiscovery.getUniverseStats.useQuery();

  const startRunMutation = trpc.arosDiscovery.startRun.useMutation({
    onSuccess: (result) => {
      setStartingRun(false);
      toast.success("Discovery Run Started: Run ID: ${result.runId}");
      setTimeout(() => refetch(), 3000);
    },
    onError: (err) => {
      setStartingRun(false);
      toast.error(`Error: `);
    },
  });

  const generateTwinMutation = trpc.arosIntelligence.generateDecisionTwin.useMutation({
    onSuccess: () => {
      setGeneratingTwin(null);
      toast.success("Decision Twin Generated");
      refetch();
    },
    onError: (err) => {
      setGeneratingTwin(null);
      toast.error(`Error: `);
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Radar className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">AROS Universe</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {stats?.total.toLocaleString() ?? "..."} companies monitored
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setStartingRun(true);
              startRunMutation.mutate({
                sectors: ["Banks", "Asset Managers", "Energy Companies", "Telecom Operators", "Infrastructure Investors"],
                geographies: ["United States", "United Kingdom", "Canada", "Australia", "Singapore"],
                targetCount: 100,
              });
            }}
            disabled={startingRun}
          >
            {startingRun ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Running...</> : <><Zap className="h-4 w-4 mr-1" /> Discover 100</>}
          </Button>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="flex flex-wrap gap-2">
            {stats.byTier.map(t => (
              <Badge key={t.tier} variant="outline" className="text-xs">
                {t.tier}: {t.count.toLocaleString()}
              </Badge>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-8 h-9"
            />
          </div>
          <Select value={sector} onValueChange={v => { setSector(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All Sectors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sectors</SelectItem>
              {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={v => { setCountry(v); setPage(0); }}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={minScore} onValueChange={v => { setMinScore(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Min Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All Scores</SelectItem>
              <SelectItem value="60">Score ≥ 60</SelectItem>
              <SelectItem value="75">Score ≥ 75</SelectItem>
              <SelectItem value="90">Score ≥ 90</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Sector</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Country</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">CEO</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Opp Score</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Fit Score</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Initiative</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">Loading...</td></tr>
                  ) : !data?.rows.length ? (
                    <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No companies found. Run a Discovery to populate the universe.</td></tr>
                  ) : (
                    data.rows.map(co => (
                      <tr key={co.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{co.companyName}</p>
                            {co.revenueUsdBn && <p className="text-xs text-muted-foreground">${co.revenueUsdBn}B revenue</p>}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{co.sector}</td>
                        <td className="p-3 text-muted-foreground">{co.country}</td>
                        <td className="p-3 text-muted-foreground">{co.ceoName ?? "—"}</td>
                        <td className="p-3 text-center"><ScoreBadge score={co.opportunityScore} /></td>
                        <td className="p-3 text-center"><ScoreBadge score={co.agenthinkFitScore} /></td>
                        <td className="p-3 max-w-xs">
                          <p className="text-xs text-muted-foreground truncate">{co.keyDecisionDomain ?? "—"}</p>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={generatingTwin === co.id}
                            onClick={() => {
                              setGeneratingTwin(co.id);
                              generateTwinMutation.mutate({ companyId: co.id });
                            }}
                          >
                            {generatingTwin === co.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-muted-foreground">
                  {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0).toLocaleString()} of {(data?.total ?? 0).toLocaleString()}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
