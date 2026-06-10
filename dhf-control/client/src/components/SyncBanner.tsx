import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { RefreshCw, CheckCircle, AlertTriangle, GitBranch, Trello, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncStatus {
  jiraLastSync:     string | null;
  githubLastSync:   string | null;
  jiraError:        string | null;
  githubError:      string | null;
  jiraConfigured:   boolean;
  githubConfigured: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SyncBanner() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const { data: status } = useQuery<SyncStatus>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 60_000,   // re-check every minute
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sync/all", {}),
    onMutate:   () => setSyncing(true),
    onSettled:  () => setSyncing(false),
    onSuccess: async (res) => {
      const data = await res.json();
      const jiraN   = data.jira?.synced   ?? 0;
      const githubN = data.github?.synced ?? 0;
      const errs    = [...(data.jira?.errors || []), ...(data.github?.errors || [])].filter(Boolean);

      queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      if (errs.length) {
        toast({
          title: "Sync completed with warnings",
          description: errs[0],
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync complete",
          description: `Jira: ${jiraN} stories · GitHub: ${githubN} PRs/issues`,
        });
      }
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Check server logs.", variant: "destructive" });
    },
  });

  if (!status) return null;

  const hasError = status.jiraError || status.githubError;
  const notConfigured = !status.jiraConfigured && !status.githubConfigured;

  return (
    <div
      data-testid="sync-banner"
      className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-md border text-xs
        ${hasError
          ? "bg-red-950 border-red-800 text-red-300"
          : notConfigured
          ? "bg-muted border-border text-muted-foreground"
          : "bg-teal-950 border-teal-800 text-teal-300"}`}
    >
      {/* Left side — status indicators */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Jira indicator */}
        <div className="flex items-center gap-1.5">
          {status.jiraConfigured
            ? (status.jiraError
                ? <AlertTriangle size={11} className="text-red-400" />
                : <CheckCircle size={11} className="text-teal-400" />)
            : <WifiOff size={11} className="text-muted-foreground" />}
          <span className="font-medium">Jira</span>
          {status.jiraConfigured
            ? <span className="text-muted-foreground">· {timeAgo(status.jiraLastSync)}</span>
            : <span className="text-muted-foreground">· not configured</span>}
          {status.jiraError && (
            <span className="text-red-400 truncate max-w-xs" title={status.jiraError}>
              · {status.jiraError.slice(0, 60)}{status.jiraError.length > 60 ? "…" : ""}
            </span>
          )}
        </div>

        {/* GitHub indicator */}
        <div className="flex items-center gap-1.5">
          <GitBranch size={11} className={status.githubConfigured ? "text-teal-400" : "text-muted-foreground"} />
          <span className="font-medium">GitHub</span>
          {status.githubConfigured
            ? <span className="text-muted-foreground">· {timeAgo(status.githubLastSync)}</span>
            : <span className="text-muted-foreground">· no token</span>}
          {status.githubError && (
            <span className="text-red-400 truncate max-w-xs" title={status.githubError}>
              · {status.githubError.slice(0, 60)}{status.githubError.length > 60 ? "…" : ""}
            </span>
          )}
        </div>

        {/* Not configured hint */}
        {notConfigured && (
          <span className="text-muted-foreground italic">
            Set JIRA_EMAIL, JIRA_API_TOKEN, GITHUB_TOKEN env vars to enable live sync
          </span>
        )}
      </div>

      {/* Right side — Sync Now button */}
      <button
        data-testid="btn-sync-now"
        onClick={() => syncMutation.mutate()}
        disabled={syncing || syncMutation.isPending}
        className="flex items-center gap-1.5 px-3 py-1 rounded border border-teal-700 bg-teal-900 hover:bg-teal-800
          text-teal-200 font-medium transition-colors disabled:opacity-50 shrink-0"
      >
        <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
    </div>
  );
}
