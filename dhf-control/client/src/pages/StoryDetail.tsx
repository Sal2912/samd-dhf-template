import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, CheckCircle, XCircle, MessageSquare, Zap,
  GitBranch, Package, Clock, AlertTriangle, ExternalLink,
  ChevronDown, ChevronUp, Brain, ShieldCheck, Wand2, FileText,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Story, StoryTask, ReviewAction } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────────
interface StoryDetailData {
  story: Story;
  tasks: StoryTask[];
  actions: ReviewAction[];
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  "accumulating":       { label: "Accumulating", cls: "badge-accumulating",  icon: Package },
  "dhf-review-pending": { label: "Pending Review", cls: "badge-dhf-review-pending", icon: Clock },
  "dhf-approved":       { label: "DHF Approved", cls: "badge-dhf-approved", icon: CheckCircle },
  "flag-enabled":       { label: "Flag Live", cls: "badge-flag-enabled",     icon: Zap },
};

const CONF_COLOR: Record<string, string> = {
  high:   "text-green-400 bg-green-950 border-green-800",
  medium: "text-yellow-400 bg-yellow-950 border-yellow-800",
  low:    "text-red-400 bg-red-950 border-red-800",
};

// ── Confidence badge ────────────────────────────────────────────────────────────
function ConfBadge({ level }: { level: string }) {
  const cls = CONF_COLOR[level] || "text-muted-foreground bg-muted border-border";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${cls}`}>
      <Brain size={10} />
      {level.charAt(0).toUpperCase() + level.slice(1)} confidence
    </span>
  );
}

// ── Task row ────────────────────────────────────────────────────────────────────
function TaskRow({ task }: { task: StoryTask }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        data-testid={`task-row-${task.taskId}`}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="mono text-xs text-teal-400 shrink-0">{task.taskId}</span>
        <span className="text-sm text-foreground flex-1 truncate">{task.prTitle || "Untitled PR"}</span>
        {task.prAuthor && (
          <span className="text-xs text-muted-foreground shrink-0">@{task.prAuthor}</span>
        )}
        {task.mergedAt && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            merged {task.mergedAt.split("T")[0]}
          </span>
        )}
        {open ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
          {task.changeSummary && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Change Summary</p>
              <p className="text-sm text-foreground">{task.changeSummary}</p>
            </div>
          )}
          {task.clinicalContext && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Clinical Context</p>
              <p className="text-sm text-foreground">{task.clinicalContext}</p>
            </div>
          )}
          {task.prNumber && (
            <a
              href={`https://github.com/Sal2912/samd-dhf-template/pull/${task.prNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300"
            >
              View PR #{task.prNumber} <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Review action timeline ──────────────────────────────────────────────────────
function ActionTimeline({ actions }: { actions: ReviewAction[] }) {
  if (actions.length === 0) return (
    <p className="text-sm text-muted-foreground italic">No review actions yet.</p>
  );

  const ACTION_STYLE: Record<string, { cls: string; icon: any }> = {
    approved:          { cls: "text-green-400", icon: CheckCircle },
    rejected:          { cls: "text-red-400",   icon: XCircle },
    requested_changes: { cls: "text-yellow-400", icon: MessageSquare },
    commented:         { cls: "text-blue-400",  icon: MessageSquare },
  };

  return (
    <div className="space-y-3">
      {actions.map(action => {
        const s = ACTION_STYLE[action.action] || { cls: "text-muted-foreground", icon: MessageSquare };
        const Icon = s.icon;
        return (
          <div key={action.id} data-testid={`action-${action.id}`}
            className="flex gap-3 text-sm">
            <div className="mt-0.5 shrink-0">
              <Icon size={14} className={s.cls} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground">@{action.actor}</span>
              <span className="text-muted-foreground ml-1">{action.action.replace("_", " ")}</span>
              <span className="text-muted-foreground ml-2 text-xs">{action.createdAt.split("T")[0]}</span>
              {action.comment && (
                <p className="text-muted-foreground mt-1 text-sm">{action.comment}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Approve / request-changes panel ────────────────────────────────────────────
function ReviewPanel({ storyId, status }: { storyId: string; status: string }) {
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState<"approve" | "changes" | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ updated: string[]; skipped: string[] } | null>(null);

  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/trigger/story/${storyId}`, {}),
    onSuccess: (data: any) => {
      setTriggerResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "DHF docs updated", description: `Updated: ${data.updated?.join(", ") || "none"}` });
    },
    onError: () => toast({ title: "Trigger failed", description: "Could not run doc update. Check API keys.", variant: "destructive" }),
  });
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/stories/${storyId}/approve`, { actor: "Sal2912", comment: comment || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stories", storyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "DHF approved", description: "Story marked as DHF-approved. LaunchDarkly flag PR is now unblocked." });
      setComment("");
      setShowCommentBox(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to approve. Try again.", variant: "destructive" }),
  });

  const changesMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/stories/${storyId}/request-changes`, { actor: "Sal2912", comment: comment || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stories", storyId] });
      toast({ title: "Changes requested", description: "Comment logged. Bot will re-draft on next trigger." });
      setComment("");
      setShowCommentBox(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to submit. Try again.", variant: "destructive" }),
  });

  const flagMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/stories/${storyId}/enable-flag`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stories", storyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Flag enabled", description: "LaunchDarkly flag marked as live in production." });
    },
    onError: (err: any) => {
      const msg = err?.message || "Must approve DHF before enabling flag.";
      toast({ title: "Cannot enable flag", description: msg, variant: "destructive" });
    },
  });

  if (status === "flag-enabled") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-green-950 border border-green-800">
        <Zap size={14} className="text-green-400" />
        <span className="text-sm text-green-300 font-medium">LaunchDarkly flag is live in production.</span>
      </div>
    );
  }

  if (status === "dhf-approved") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-teal-950 border border-teal-800">
          <ShieldCheck size={14} className="text-teal-400" />
          <span className="text-sm text-teal-300 font-medium">DHF approved. Enable the LaunchDarkly flag when ready to ship.</span>
        </div>
        <button
          data-testid="btn-enable-flag"
          onClick={() => flagMutation.mutate()}
          disabled={flagMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Zap size={14} />
          {flagMutation.isPending ? "Enabling…" : "Enable LaunchDarkly Flag"}
        </button>
      </div>
    );
  }

  if (status !== "dhf-review-pending") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-md bg-muted border border-border">
        <Package size={14} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Story is still accumulating tasks. Review panel unlocks when Jira story → Done.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      {!showCommentBox && (
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="btn-approve"
            onClick={() => setShowCommentBox("approve")}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium transition-colors"
          >
            <CheckCircle size={14} />
            Approve DHF
          </button>
          <button
            data-testid="btn-request-changes"
            onClick={() => setShowCommentBox("changes")}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-yellow-700 text-yellow-400 hover:bg-yellow-950 text-sm font-medium transition-colors"
          >
            <MessageSquare size={14} />
            Request Changes
          </button>
        </div>
      )}

      {/* Comment box */}
      {showCommentBox && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {showCommentBox === "approve"
              ? "Optional: add an approval comment (will be logged in the audit trail)."
              : "Describe what needs to be revised. Claude will use this context on the next re-draft."}
          </p>
          <textarea
            data-testid="review-comment"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={showCommentBox === "approve"
              ? "Approved — all DHF sections are accurate and complete."
              : "Section 04 V&V test IDs are missing for the new model path…"}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
          <div className="flex gap-2">
            {showCommentBox === "approve" ? (
              <button
                data-testid="btn-confirm-approve"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle size={14} />
                {approveMutation.isPending ? "Approving…" : "Confirm Approval"}
              </button>
            ) : (
              <button
                data-testid="btn-confirm-changes"
                onClick={() => changesMutation.mutate()}
                disabled={changesMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                <MessageSquare size={14} />
                {changesMutation.isPending ? "Submitting…" : "Submit Changes Request"}
              </button>
            )}
            <button
              data-testid="btn-cancel-review"
              onClick={() => { setShowCommentBox(null); setComment(""); }}
              className="px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DHF Doc Trigger */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-teal-600" />
            <span className="text-sm font-medium text-foreground">Auto-update DHF Documents</span>
          </div>
          <button
            data-testid="btn-trigger-docs"
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Wand2 size={12} />
            {triggerMutation.isPending ? "Updating docs…" : "Trigger Doc Update"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Claude Haiku fetches this story from Jira + GitHub and updates SRS, Traceability Matrix, and Risk Analysis.
        </p>
        {triggerResult && (
          <div className="rounded-md bg-muted border border-border px-3 py-2 text-xs space-y-1">
            <div className="flex items-center gap-1 text-green-600 font-medium">
              <CheckCircle size={11} /> Updated: {triggerResult.updated.join(", ") || "none"}
            </div>
            {triggerResult.skipped.length > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText size={11} /> Skipped: {triggerResult.skipped.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────
export default function StoryDetail() {
  const { storyId } = useParams<{ storyId: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<StoryDetailData>({
    queryKey: ["/api/stories", storyId],
  });

  if (isLoading) return (
    <div className="space-y-4 max-w-3xl">
      <div className="h-5 bg-muted rounded w-48 animate-pulse" />
      <div className="h-32 bg-muted rounded animate-pulse" />
      <div className="h-24 bg-muted rounded animate-pulse" />
    </div>
  );

  if (isError || !data) return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate("/stories")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Back to stories
      </button>
      <div className="section-card p-6 flex items-center gap-3 text-red-400">
        <AlertTriangle size={16} />
        <span className="text-sm">Story not found.</span>
      </div>
    </div>
  );

  const { story, tasks, actions } = data;
  const st = STATUS_CONFIG[story.status] || { label: story.status, cls: "badge-draft", icon: GitBranch };
  const StatusIcon = st.icon;
  const reqIds  = JSON.parse(story.allReqIds  || "[]") as string[];
  const hazIds  = JSON.parse(story.allHazIds  || "[]") as string[];
  const testIds = JSON.parse(story.allTestIds || "[]") as string[];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Back breadcrumb */}
      <Link href="/stories" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={14} /> All stories
      </Link>

      {/* Story header */}
      <div className="section-card p-5">
        <div className="flex items-start gap-3 justify-between flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="mono text-sm text-teal-400 font-semibold">{story.storyId}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                <StatusIcon size={10} />
                {st.label}
              </span>
            </div>
            <h1 className="text-base font-semibold text-foreground">{story.title || "Untitled story"}</h1>
          </div>
          <div className="text-xs text-muted-foreground text-right shrink-0">
            <p>{story.taskCount} task{story.taskCount !== 1 ? "s" : ""}</p>
            <p>Updated {story.updatedAt.split("T")[0]}</p>
          </div>
        </div>

        {/* Meta tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {story.claudeConfidence && <ConfBadge level={story.claudeConfidence} />}
          {story.flagKey && (
            <span className="mono text-xs px-2 py-0.5 rounded border border-purple-800 bg-purple-950 text-purple-300">
              {story.flagKey}
            </span>
          )}
          {story.issueUrl && (
            <a href={story.issueUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 px-2 py-0.5 rounded border border-teal-900 bg-teal-950">
              GitHub Issue <ExternalLink size={9} />
            </a>
          )}
          {story.approvedBy && (
            <span className="text-xs px-2 py-0.5 rounded border border-teal-800 bg-teal-950 text-teal-300">
              Approved by @{story.approvedBy} on {story.approvedAt?.split("T")[0]}
            </span>
          )}
        </div>
      </div>

      {/* Claude reasoning */}
      {story.claudeReasoning && (
        <div className="section-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-foreground">Claude Haiku — Reasoning Summary</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{story.claudeReasoning}</p>

          {/* Traceability IDs */}
          {(reqIds.length > 0 || hazIds.length > 0 || testIds.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {reqIds.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Requirements</p>
                  <div className="flex flex-wrap gap-1">
                    {reqIds.map(r => <span key={r} className="mono text-xs px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">{r}</span>)}
                  </div>
                </div>
              )}
              {hazIds.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Hazards</p>
                  <div className="flex flex-wrap gap-1">
                    {hazIds.map(h => <span key={h} className="mono text-xs px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">{h}</span>)}
                  </div>
                </div>
              )}
              {testIds.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Test IDs</p>
                  <div className="flex flex-wrap gap-1">
                    {testIds.map(t => <span key={t} className="mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review & approval */}
      <div className="section-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShieldCheck size={14} className="text-teal-400" />
          DHF Review &amp; Approval
        </h2>
        <ReviewPanel storyId={story.storyId} status={story.status} />
      </div>

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="section-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <GitBranch size={14} className="text-teal-400" />
            Tasks in this story ({tasks.length})
          </h2>
          <div className="space-y-2">
            {tasks.map(task => <TaskRow key={task.id} task={task} />)}
          </div>
        </div>
      )}

      {/* Review timeline */}
      <div className="section-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock size={14} className="text-teal-400" />
          Review Timeline
        </h2>
        <ActionTimeline actions={actions} />
      </div>

    </div>
  );
}
