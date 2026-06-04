import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FileText, GitBranch, Shield, ClipboardList,
  ChevronRight, Activity
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const nav = [
  { href: "/",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/documents", icon: FileText,         label: "DHF Documents" },
  { href: "/stories",   icon: GitBranch,        label: "Story Tracker" },
  { href: "/audit",     icon: ClipboardList,    label: "Audit Trail" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/stats"],
    refetchInterval: 30000,
  });

  return (
    <div className="dashboard" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gridTemplateRows: "auto 1fr", height: "100dvh" }}>

      {/* Sidebar */}
      <aside style={{ gridRow: "1 / -1", borderRight: "1px solid hsl(var(--border))" }}
        className="flex flex-col bg-card overflow-y-auto overscroll-contain">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-border flex items-center gap-3">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="GreyZone AI">
            <rect width="32" height="32" rx="6" fill="hsl(var(--primary))" fillOpacity="0.15"/>
            <rect x="7" y="9" width="11" height="2.5" rx="1.25" fill="hsl(var(--primary))"/>
            <rect x="7" y="14.75" width="18" height="2.5" rx="1.25" fill="hsl(var(--primary))"/>
            <rect x="7" y="20.5" width="14" height="2.5" rx="1.25" fill="hsl(var(--primary))"/>
          </svg>
          <div>
            <p className="text-xs font-semibold text-foreground leading-tight">DHF Control</p>
            <p className="text-xs text-muted-foreground leading-tight">GreyZone AI</p>
          </div>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="px-3 py-3 border-b border-border grid grid-cols-2 gap-2">
            <div className="bg-muted rounded p-2 text-center">
              <p className="tabular text-sm font-bold text-foreground">{stats.totalDocuments}</p>
              <p className="text-xs text-muted-foreground">Docs</p>
            </div>
            <div className={`rounded p-2 text-center ${stats.staleDocuments > 0 ? 'bg-red-950' : 'bg-muted'}`}>
              <p className={`tabular text-sm font-bold ${stats.staleDocuments > 0 ? 'text-red-400' : 'text-foreground'}`}>{stats.staleDocuments}</p>
              <p className="text-xs text-muted-foreground">Stale</p>
            </div>
            <div className={`rounded p-2 text-center ${stats.pendingReview > 0 ? 'bg-yellow-950' : 'bg-muted'}`}>
              <p className={`tabular text-sm font-bold ${stats.pendingReview > 0 ? 'text-yellow-400' : 'text-foreground'}`}>{stats.pendingReview}</p>
              <p className="text-xs text-muted-foreground">Review</p>
            </div>
            <div className="bg-muted rounded p-2 text-center">
              <p className="tabular text-sm font-bold text-foreground">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-teal-950 text-teal-400 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}>
                <Icon size={15} />
                {label}
                {active && <ChevronRight size={12} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-teal-400" />
            <span className="text-xs text-muted-foreground">Claude Haiku active</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 mono">v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ gridColumn: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }} className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
