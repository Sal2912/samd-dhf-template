import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { GitBranch, CheckCircle, Clock, Zap, Package, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Story } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  "accumulating":        { label: "Accumulating",    icon: Package,      cls: "badge-accumulating" },
  "dhf-review-pending":  { label: "Pending Review",  icon: Clock,        cls: "badge-dhf-review-pending" },
  "dhf-approved":        { label: "DHF Approved",    icon: CheckCircle,  cls: "badge-dhf-approved" },
  "flag-enabled":        { label: "Flag Live",        icon: Zap,          cls: "badge-flag-enabled" },
};

const CONF_CONFIG: Record<string, { label: string; cls: string }> = {
  "high":   { label: "High confidence",   cls: "conf-high" },
  "medium": { label: "Medium confidence", cls: "conf-medium" },
  "low":    { label: "Low confidence",    cls: "conf-low" },
};

function StoryCard({ story, indent = false }: { story: Story; indent?: boolean }) {
  const st = STATUS_CONFIG[story.status] || { label: story.status, icon: GitBranch, cls: "badge-draft" };
  const Icon = st.icon;
  const conf = story.claudeConfidence ? CONF_CONFIG[story.claudeConfidence] : null;
  const reqIds = JSON.parse(story.allReqIds || "[]") as string[];
  const hazIds = JSON.parse(story.allHazIds || "[]") as string[];

  return (
    <Link href={`/stories/${story.storyId}`}>
      <div
        data-testid={`story-card-${story.storyId}`}
        className={`section-card p-4 cursor-pointer hover:border-teal-800 transition-all ${indent ? "ml-6 border-l-2 border-l-teal-900" : ""}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono text-xs text-teal-400 shrink-0">{story.storyId}</span>
              <span className="text-sm font-medium text-foreground truncate">{story.title || "Untitled story"}</span>
            </div>
            {story.epicId && (
              <p className="text-xs text-muted-foreground mt-0.5">
                ↳ Epic: <span className="mono text-teal-500">{story.epicId}</span>
                {story.epicTitle && <span className="ml-1 text-muted-foreground">— {story.epicTitle}</span>}
              </p>
            )}
          </div>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>
            <Icon size={10} />
            {st.label}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>{story.taskCount} tasks</span>
          {conf && <span className={conf.cls}>{conf.label}</span>}
          {story.flagKey && <span className="mono bg-muted px-1.5 py-0.5 rounded">{story.flagKey}</span>}
          {reqIds.length > 0 && (
            <span className="flex gap-1">{reqIds.map(r => <span key={r} className="mono px-1 bg-blue-950 text-blue-400 rounded text-xs">{r}</span>)}</span>
          )}
          {hazIds.length > 0 && (
            <span className="flex gap-1">{hazIds.map(h => <span key={h} className="mono px-1 bg-red-950 text-red-400 rounded text-xs">{h}</span>)}</span>
          )}
        </div>

        {story.status === "dhf-approved" && story.approvedBy && (
          <p className="text-xs text-teal-400 mt-2">✓ Approved by @{story.approvedBy} on {story.approvedAt?.split("T")[0]}</p>
        )}
        {story.status === "flag-enabled" && story.flagEnabledAt && (
          <p className="text-xs text-green-400 mt-2">⚡ Flag enabled {story.flagEnabledAt.split("T")[0]}</p>
        )}
      </div>
    </Link>
  );
}

function EpicGroup({ epic, stories }: { epic: Story; stories: Story[] }) {
  const [open, setOpen] = useState(true);
  const st = STATUS_CONFIG[epic.status] || { label: epic.status, icon: GitBranch, cls: "badge-draft" };
  const Icon = st.icon;

  const pendingCount = stories.filter(s => s.status === "dhf-review-pending").length;
  const approvedCount = stories.filter(s => s.status === "dhf-approved" || s.status === "flag-enabled").length;

  return (
    <div className="section-card overflow-hidden">
      {/* Epic header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
          <Layers size={14} className="text-purple-400 shrink-0" />
          <span className="mono text-xs text-purple-400 shrink-0">{epic.storyId}</span>
          <span className="text-sm font-semibold text-foreground truncate">{epic.title || "Untitled epic"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs badge-dhf-review-pending">{pendingCount} pending</span>
          )}
          <span className="text-xs text-muted-foreground">{stories.length} stories</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
            <Icon size={10} />
            {st.label}
          </span>
        </div>
      </div>

      {/* Epic itself — link to epic detail */}
      {open && (
        <div className="border-t border-border px-4 py-2 bg-purple-950/10">
          <Link href={`/stories/${epic.storyId}`}>
            <span className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer">
              View SyRS / Epic doc updates →
            </span>
          </Link>
        </div>
      )}

      {/* Child stories */}
      {open && stories.length > 0 && (
        <div className="px-4 pb-4 pt-2 space-y-2">
          {stories.map(s => <StoryCard key={s.id} story={s} indent />)}
        </div>
      )}

      {open && stories.length === 0 && (
        <p className="px-4 pb-4 text-xs text-muted-foreground">No stories under this epic yet.</p>
      )}
    </div>
  );
}

export default function Stories() {
  const { data: allItems = [], isLoading } = useQuery<Story[]>({ queryKey: ["/api/stories"] });

  // Separate epics from stories
  const epics = allItems.filter(s => s.issueType === "epic");
  const storiesOnly = allItems.filter(s => s.issueType !== "epic");

  // Stories that have no epic parent (orphaned)
  const orphanStories = storiesOnly.filter(s => !s.epicId || !epics.find(e => e.storyId === s.epicId));

  // Status groups for orphaned stories
  const statusGroups = [
    { key: "dhf-review-pending", label: "Pending Your Review" },
    { key: "accumulating",       label: "In Progress (Accumulating Tasks)" },
    { key: "dhf-approved",       label: "DHF Approved" },
    { key: "flag-enabled",       label: "Flag Enabled — Live in Production" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Story Tracker</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Jira epics → system requirements · Stories → SW requirements, TM, RA
        </p>
      </div>

      {/* Pipeline diagram */}
      <div className="section-card p-4">
        <div className="flex items-center gap-2 text-xs overflow-x-auto">
          {[
            { label: "Tasks merge to main", cls: "bg-blue-950 text-blue-400 border-blue-800" },
            { label: "→" },
            { label: "Story → Done in Jira", cls: "bg-muted text-muted-foreground border-border" },
            { label: "→" },
            { label: "Claude drafts DHF", cls: "bg-purple-950 text-purple-400 border-purple-800" },
            { label: "→" },
            { label: "You approve here", cls: "bg-yellow-950 text-yellow-400 border-yellow-800" },
            { label: "→" },
            { label: "Flag enabled", cls: "bg-green-950 text-green-400 border-green-800" },
          ].map((step, i) => (
            step.label === "→"
              ? <span key={i} className="text-muted-foreground">→</span>
              : <span key={i} className={`px-2 py-1 rounded border text-xs font-medium shrink-0 ${step.cls}`}>{step.label}</span>
          ))}
        </div>
      </div>

      {/* Epics with their child stories */}
      {epics.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Epics — System Requirements
          </h2>
          <div className="space-y-3">
            {epics.map(epic => {
              const childStories = storiesOnly.filter(s => s.epicId === epic.storyId);
              return <EpicGroup key={epic.id} epic={epic} stories={childStories} />;
            })}
          </div>
        </div>
      )}

      {/* Orphaned stories (no parent epic in DB yet) grouped by status */}
      {orphanStories.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Stories {epics.length > 0 ? "(No Epic Yet)" : ""}
          </h2>
          <div className="space-y-4">
            {statusGroups.map(({ key, label }) => {
              const groupStories = orphanStories.filter(s => s.status === key);
              if (groupStories.length === 0) return null;
              return (
                <div key={key}>
                  <h3 className="text-xs font-medium text-muted-foreground mb-1.5">{label}</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {groupStories.map(s => <StoryCard key={s.id} story={s} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && allItems.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stories or epics yet. Trigger a story or epic update to populate this view.
        </p>
      )}
    </div>
  );
}
