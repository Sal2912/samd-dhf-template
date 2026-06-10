import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle, Clock, FileText, GitBranch, Shield, Zap } from "lucide-react";
import type { DhfDocument, Story } from "@shared/schema";
import { SyncBanner } from "@/components/SyncBanner";

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div className="section-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`tabular text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function StaleAlert({ doc }: { doc: DhfDocument }) {
  return (
    <Link href={`/documents/${doc.id}`}>
      <div className="flex items-center justify-between px-3 py-2 rounded-md bg-red-950/40 border border-red-900 hover:border-red-700 transition-colors cursor-pointer">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <span className="text-sm text-foreground truncate">{doc.title}</span>
          {doc.isAiAddition && <span className="px-1.5 py-0.5 rounded text-xs badge-ai shrink-0">AI</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="mono text-xs text-muted-foreground">{doc.owner}</span>
          <span className="tabular text-xs text-red-400">{doc.daysOverdue}d overdue</span>
        </div>
      </div>
    </Link>
  );
}

function StoryRow({ story }: { story: Story }) {
  const statusLabels: Record<string, string> = {
    "accumulating": "Accumulating",
    "dhf-review-pending": "Pending Review",
    "dhf-approved": "Approved",
    "flag-enabled": "Flag Enabled",
  };
  const statusClass: Record<string, string> = {
    "accumulating": "badge-accumulating",
    "dhf-review-pending": "badge-dhf-review-pending",
    "dhf-approved": "badge-dhf-approved",
    "flag-enabled": "badge-flag-enabled",
  };

  return (
    <Link href={`/stories/${story.storyId}`}>
      <div className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className="mono text-xs text-teal-400 shrink-0">{story.storyId}</span>
          <span className="text-sm text-foreground truncate">{story.title || "Untitled"}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-muted-foreground">{story.taskCount} tasks</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[story.status] || "badge-draft"}`}>
            {statusLabels[story.status] || story.status}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/stats"] });
  const { data: docs = [] } = useQuery<DhfDocument[]>({ queryKey: ["/api/documents"] });
  const { data: storyList = [] } = useQuery<Story[]>({ queryKey: ["/api/stories"] });

  const staleDocs = docs.filter(d => d.stalenessStatus === "stale");
  const pendingStories = storyList.filter(s => s.status === "dhf-review-pending");
  const recentStories = [...storyList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Document Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">GreyZone AI · SaMD DHF · Live status</p>
        </div>
      </div>

      {/* Sync status banner */}
      <SyncBanner />

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Sections" value={stats?.totalDocuments || 0} sub="DHF + AI additions" />
        <StatCard label="Stale" value={stats?.staleDocuments || 0} color={stats?.staleDocuments > 0 ? "text-red-400" : undefined} sub="Past review window" />
        <StatCard label="Pending Review" value={stats?.pendingReview || 0} color={stats?.pendingReview > 0 ? "text-yellow-400" : undefined} sub="Awaiting approval" />
        <StatCard label="Flag-Enabled" value={stats?.flagEnabled || 0} color="text-teal-400" sub="Live in production" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Stale documents */}
        <div className="section-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">Stale Documents</h2>
            </div>
            <Link href="/documents" className="text-xs text-teal-400 hover:text-teal-300">View all →</Link>
          </div>
          {staleDocs.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-green-400" />
              All documents are current
            </div>
          ) : (
            <div className="space-y-1.5">
              {staleDocs.map(d => <StaleAlert key={d.id} doc={d} />)}
            </div>
          )}
        </div>

        {/* Pending reviews */}
        <div className="section-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-yellow-400" />
              <h2 className="text-sm font-semibold text-foreground">Pending Your Review</h2>
            </div>
            <Link href="/stories" className="text-xs text-teal-400 hover:text-teal-300">View all →</Link>
          </div>
          {pendingStories.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-green-400" />
              No stories pending review
            </div>
          ) : (
            <div className="space-y-1">
              {pendingStories.map(s => <StoryRow key={s.id} story={s} />)}
            </div>
          )}
        </div>

        {/* DHF coverage */}
        <div className="section-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-teal-400" />
            <h2 className="text-sm font-semibold text-foreground">DHF Coverage</h2>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Core SaMD sections", count: docs.filter(d => !d.isAiAddition).length, total: 6 },
              { label: "AI/ML additions", count: docs.filter(d => d.isAiAddition).length, total: 5 },
              { label: "Active documents", count: stats?.activeDocuments || 0, total: stats?.totalDocuments || 1 },
              { label: "AI documents", count: stats?.aiDocuments || 0, total: stats?.totalDocuments || 1 },
            ].map(({ label, count, total }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular text-foreground">{count}/{total}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${(count / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent stories */}
        <div className="section-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={14} className="text-teal-400" />
            <h2 className="text-sm font-semibold text-foreground">Recent Stories</h2>
          </div>
          <div className="space-y-0.5">
            {recentStories.map(s => <StoryRow key={s.id} story={s} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
