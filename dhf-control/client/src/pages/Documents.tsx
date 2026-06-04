import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle, Brain, Filter } from "lucide-react";
import type { DhfDocument } from "@shared/schema";

function DocRow({ doc }: { doc: DhfDocument }) {
  const tags = JSON.parse(doc.tags || "[]") as string[];
  return (
    <Link href={`/documents/${doc.id}`}>
      <div data-testid={`doc-row-${doc.id}`}
        className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:border-teal-800 hover:bg-card transition-all cursor-pointer">
        {/* Status icon */}
        <div className="shrink-0">
          {doc.stalenessStatus === "stale"
            ? <AlertTriangle size={14} className="text-red-400" />
            : <CheckCircle size={14} className="text-green-400" />}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{doc.title}</span>
            {doc.isAiAddition && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs badge-ai shrink-0">
                <Brain size={10} /> AI
              </span>
            )}
          </div>
          <p className="mono text-xs text-muted-foreground mt-0.5">{doc.filePath}</p>
        </div>

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs">
          <span className="text-muted-foreground">{doc.owner}</span>
          <span className={`px-2 py-0.5 rounded-full font-medium badge-${doc.status}`}>{doc.status}</span>
          <span className={`px-2 py-0.5 rounded-full font-medium badge-${doc.stalenessStatus}`}>
            {doc.stalenessStatus === "stale" ? `${doc.daysOverdue}d overdue` : "current"}
          </span>
          <span className="mono text-muted-foreground">v{doc.version}</span>
          <span className="text-muted-foreground">{doc.reviewIntervalDays}d cycle</span>
        </div>
      </div>
    </Link>
  );
}

export default function Documents() {
  const { data: docs = [], isLoading } = useQuery<DhfDocument[]>({ queryKey: ["/api/documents"] });
  const [filter, setFilter] = useState<"all" | "stale" | "ai" | "active">("all");

  const filtered = docs.filter(d => {
    if (filter === "stale") return d.stalenessStatus === "stale";
    if (filter === "ai") return d.isAiAddition;
    if (filter === "active") return d.status === "active";
    return true;
  });

  const coreCount = docs.filter(d => !d.isAiAddition).length;
  const aiCount   = docs.filter(d => d.isAiAddition).length;
  const staleCount = docs.filter(d => d.stalenessStatus === "stale").length;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">DHF Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{coreCount} core sections · {aiCount} AI additions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-muted-foreground" />
        {(["all", "stale", "ai", "active"] as const).map(f => (
          <button key={f} data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? "bg-teal-900 text-teal-300 border border-teal-700"
                : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
            }`}>
            {f === "all" ? `All (${docs.length})` :
             f === "stale" ? `Stale (${staleCount})` :
             f === "ai" ? `AI Additions (${aiCount})` :
             `Active (${docs.filter(d => d.status === "active").length})`}
          </button>
        ))}
      </div>

      {/* Section groups */}
      {["Core SaMD", "AI/ML Additions"].map(group => {
        const groupDocs = filtered.filter(d =>
          group === "Core SaMD" ? !d.isAiAddition : d.isAiAddition
        );
        if (groupDocs.length === 0) return null;
        return (
          <div key={group}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
              {group === "AI/ML Additions" && <Brain size={11} className="text-purple-400" />}
              {group}
            </h2>
            <div className="space-y-1.5">
              {groupDocs.map(d => <DocRow key={d.id} doc={d} />)}
            </div>
          </div>
        );
      })}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
    </div>
  );
}
