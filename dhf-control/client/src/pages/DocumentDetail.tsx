import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Save, History, Tag, Clock, User, Brain } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DhfDocument, DocumentVersion } from "@shared/schema";

function VersionBadge({ v, current }: { v: DocumentVersion; current: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-md border transition-colors ${current ? "border-teal-700 bg-teal-950/30" : "border-border hover:border-border"}`}>
      <div className="flex items-center justify-between">
        <span className="mono text-xs font-medium text-foreground">v{v.version}</span>
        {current && <span className="text-xs text-teal-400">current</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{v.changedBy}</p>
      {v.changeNote && <p className="text-xs text-muted-foreground truncate">{v.changeNote}</p>}
      <p className="text-xs text-muted-foreground mt-0.5 tabular">{v.createdAt.split("T")[0]}</p>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [editContent, setEditContent] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [tab, setTab] = useState<"content" | "meta" | "versions">("content");

  const { data: doc, isLoading } = useQuery<DhfDocument>({
    queryKey: ["/api/documents", id],
    enabled: !!id,
  });

  const { data: versions = [] } = useQuery<DocumentVersion[]>({
    queryKey: ["/api/documents", id, "versions"],
    enabled: !!id && tab === "versions",
  });

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("PATCH", `/api/documents/${id}`, {
        content,
        changeNote,
        changedBy: "Sal2912",
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
      setEditContent(null);
      setChangeNote("");
      toast({ title: "Document saved", description: "Version bumped automatically." });
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;
  if (!doc) return <div className="text-sm text-muted-foreground p-4">Document not found.</div>;

  const tags = JSON.parse(doc.tags || "[]") as string[];
  const linkedReqs = JSON.parse(doc.linkedRequirements || "[]") as string[];
  const linkedHazs = JSON.parse(doc.linkedHazards || "[]") as string[];
  const content = editContent ?? doc.content ?? "";

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/documents" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{doc.title}</h1>
            {doc.isAiAddition && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs badge-ai">
                <Brain size={10} /> AI Addition
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium badge-${doc.status}`}>{doc.status}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium badge-${doc.stalenessStatus}`}>
              {doc.stalenessStatus === "stale" ? `${doc.daysOverdue}d overdue` : "current"}
            </span>
          </div>
          <p className="mono text-xs text-muted-foreground mt-0.5">{doc.filePath}</p>
        </div>
        <span className="mono text-xs text-muted-foreground shrink-0">v{doc.version}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["content", "meta", "versions"] as const).map(t => (
          <button key={t} data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? "border-teal-500 text-teal-400" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content tab */}
      {tab === "content" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Last reviewed: <span className="tabular text-foreground">{doc.lastReviewed || "Never"}</span>
              {" · "}Review every <span className="text-foreground">{doc.reviewIntervalDays}</span> days
            </p>
            {editContent !== null ? (
              <div className="flex gap-2">
                <input
                  value={changeNote}
                  onChange={e => setChangeNote(e.target.value)}
                  placeholder="Change note (optional)"
                  className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground w-48"
                />
                <button
                  data-testid="btn-save"
                  onClick={() => saveMutation.mutate(content)}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition-colors disabled:opacity-50">
                  <Save size={12} /> Save
                </button>
                <button onClick={() => { setEditContent(null); setChangeNote(""); }}
                  className="px-3 py-1.5 rounded bg-muted hover:bg-secondary text-muted-foreground text-xs transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button data-testid="btn-edit"
                onClick={() => setEditContent(doc.content || "")}
                className="px-3 py-1.5 rounded bg-muted hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
                Edit
              </button>
            )}
          </div>

          {editContent !== null ? (
            <textarea
              data-testid="content-editor"
              value={content}
              onChange={e => setEditContent(e.target.value)}
              className="w-full h-96 bg-muted border border-border rounded-lg p-4 text-sm text-foreground mono resize-none focus:outline-none focus:border-teal-600"
              spellCheck={false}
            />
          ) : (
            <div className="bg-muted rounded-lg border border-border p-5">
              <pre className="text-sm text-foreground mono whitespace-pre-wrap leading-relaxed">{doc.content || "No content yet."}</pre>
            </div>
          )}
        </div>
      )}

      {/* Meta tab */}
      {tab === "meta" && (
        <div className="grid grid-cols-2 gap-5">
          <div className="section-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document Info</h3>
            {[
              ["Section", doc.section],
              ["Owner", doc.owner],
              ["Status", doc.status],
              ["Version", doc.version],
              ["Last Reviewed", doc.lastReviewed || "Never"],
              ["Review Interval", `${doc.reviewIntervalDays} days`],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="mono text-foreground">{val}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="section-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Tag size={11} /> Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border mono">{t}</span>
                ))}
              </div>
            </div>

            <div className="section-card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Linked IDs</h3>
              {linkedReqs.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">Requirements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedReqs.map(r => <span key={r} className="mono text-xs px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded">{r}</span>)}
                  </div>
                </div>
              )}
              {linkedHazs.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Hazards</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedHazs.map(h => <span key={h} className="mono text-xs px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded">{h}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Versions tab */}
      {tab === "versions" && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <History size={11} /> Version History
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {versions.map(v => (
              <VersionBadge key={v.id} v={v} current={v.version === doc.version} />
            ))}
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-3">No version history yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
