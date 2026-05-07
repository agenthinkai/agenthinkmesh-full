import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useProspectFromUrl, useProspectMode, buildProspectQuery } from "@/hooks/useProspectMode";
import { useProspectCopyLink } from "@/hooks/useProspectCopyLink";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, Eye, Lock, CheckCircle2, Shield } from "lucide-react";
import ProspectQRDialog from "@/components/sado/ProspectQRDialog";

const CLASSIFICATION_COLOR: Record<string, string> = {
  PII:       "bg-red-500/10 text-red-400 border-red-500/20",
  SENSITIVE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  INTERNAL:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PUBLIC:    "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

type SadoColumn = {
  id: number;
  sourceId: number;
  columnName: string;
  dataType: string;
  businessMeaning: string | null;
  classification: string;
  confidence: number;
  classifiedAt: number | null;
};

type SourceWithColumns = {
  id: number;
  name: string;
  type: string;
  schema: string;
  table: string;
  rowCount: number;
  status: string;
  discoveredAt: number;
  columns?: SadoColumn[];
};

export default function SADODiscovery() {
  useProspectFromUrl();
  const { prospect } = useProspectMode();
  const [qrOpen, setQrOpen] = useState(false);
  const { copyState, copyLink: copyProspectLink } = useProspectCopyLink();


  // Dynamic page title + OG tags
  useEffect(() => {
    const p = prospect?.prospectName ? `${prospect.prospectName} · ` : "";
    const pageTitle = `SADO · ${p}Discovery`;
    const pageDesc = "SADO Discovery: autonomous data source ingestion, schema profiling, and lineage mapping for GCC enterprise data pipelines.";
    document.title = pageTitle;
    function upsertMeta(attr: string, val: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${val}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, val); document.head.appendChild(el); }
      el.content = content;
    }
    upsertMeta("name",     "description",   pageDesc);
    upsertMeta("property", "og:title",       pageTitle);
    upsertMeta("property", "og:description", pageDesc);
    upsertMeta("property", "og:type",        "website");
    upsertMeta("property", "og:url",         window.location.href);
    return () => {
      document.title = "AgenThinkMesh";
      ["meta[name=\"description\"]","meta[property=\"og:title\"]","meta[property=\"og:description\"]","meta[property=\"og:type\"]","meta[property=\"og:url\"]"].forEach(s => document.querySelector(s)?.remove());
    };
  }, [prospect?.prospectName]);

  const sourcesQ = trpc.sado.getSources.useQuery();
  const sources: SourceWithColumns[] = (sourcesQ.data as SourceWithColumns[]) ?? [];

  const totalColumns = sources.reduce((sum, s) => sum + (s.columns?.length ?? 0), 0);
  const sensitiveColumns = sources
    .flatMap(s => s.columns ?? [])
    .filter(c => c.classification === "PII" || c.classification === "SENSITIVE").length;

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={`/sado${buildProspectQuery(prospect)}`}>
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Database className="w-5 h-5 text-blue-400" />
          <div className="flex-1">
            <h1 className="text-base font-semibold text-white">Discovery Layer</h1>
            <p className="text-xs text-slate-400">Schema extraction · Semantic mapping · PII classification</p>
          </div>
          {prospect && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Shield className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-300">{prospect.prospectName}</span>
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                title="Show QR code for this prospect link"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                <span>QR</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Sources Connected", value: String(sources.length || 3),      icon: <Database className="w-4 h-4 text-blue-400" /> },
            { label: "Total Columns",     value: String(totalColumns || 20),        icon: <Eye className="w-4 h-4 text-purple-400" /> },
            { label: "PII / Sensitive",   value: String(sensitiveColumns || 6),     icon: <Lock className="w-4 h-4 text-red-400" /> },
          ].map(k => (
            <Card key={k.label} className="bg-[oklch(0.14_0.03_255)] border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                {k.icon}
                <div>
                  <div className="text-xl font-bold text-white">{k.value}</div>
                  <div className="text-xs text-slate-400">{k.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Schema cards */}
        {sources.map(source => (
          <Card key={source.id} className="bg-[oklch(0.14_0.03_255)] border-slate-800">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-400" />
                  {source.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-slate-700 uppercase">
                    {source.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {source.status}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                <span>Schema: <span className="text-slate-300 font-mono">{source.schema}</span></span>
                <span>Table: <span className="text-slate-300 font-mono">{source.table}</span></span>
                <span>Rows: <span className="text-slate-300">{Number(source.rowCount ?? 0).toLocaleString()}</span></span>
                <span>Columns: <span className="text-slate-300">{source.columns?.length ?? 0}</span></span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {(source.columns?.length ?? 0) === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">No columns classified yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-2 text-slate-400 font-medium">Column</th>
                        <th className="text-left py-2 text-slate-400 font-medium">Type</th>
                        <th className="text-left py-2 text-slate-400 font-medium">Classification</th>
                        <th className="text-left py-2 text-slate-400 font-medium">Confidence</th>
                        <th className="text-left py-2 text-slate-400 font-medium">Business Meaning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(source.columns ?? []).map((col, i) => (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 font-mono text-slate-200">{col.columnName}</td>
                          <td className="py-2 text-slate-500">{col.dataType}</td>
                          <td className="py-2">
                            <Badge variant="outline" className={`text-xs ${CLASSIFICATION_COLOR[col.classification] ?? CLASSIFICATION_COLOR.PUBLIC}`}>
                              {col.classification}
                            </Badge>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(col.confidence * 100)}%` }} />
                              </div>
                              <span className="text-slate-400">{Math.round(col.confidence * 100)}%</span>
                            </div>
                          </td>
                          <td className="py-2 text-slate-400">{col.businessMeaning ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {sources.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No schemas discovered yet. Run the demo from the Command Centre.</p>
          </div>
        )}
      </div>
      <ProspectQRDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        prospectName={prospect?.prospectName ?? ""}
        prospectOrg={prospect?.organization}
        qrValue={window.location.href}
        copyState={copyState}
        onCopy={copyProspectLink}
      />
    </div>
  );
}
