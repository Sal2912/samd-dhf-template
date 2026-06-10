/**
 * sync.ts — Real data sync from Jira + GitHub
 *
 * Reads credentials from environment variables:
 *   JIRA_BASE_URL   = https://dhfgeneration.atlassian.net
 *   JIRA_EMAIL      = your Atlassian login email
 *   JIRA_API_TOKEN  = API token from id.atlassian.com
 *   GITHUB_TOKEN    = personal access token (read:repo scope)
 *   GITHUB_REPO     = Sal2912/samd-dhf-template
 *
 * All values default to safe no-ops if missing — the app works without them.
 */

import { storage } from "./storage";

// ── Config ─────────────────────────────────────────────────────────────────────
const JIRA_BASE   = (process.env.JIRA_BASE_URL   || "https://dhfgeneration.atlassian.net").replace(/\/$/, "");
const JIRA_EMAIL  = process.env.JIRA_EMAIL        || "";
const JIRA_TOKEN  = process.env.JIRA_API_TOKEN    || "";
const GH_TOKEN    = process.env.GITHUB_TOKEN      || "";
const GH_REPO     = process.env.GITHUB_REPO       || "Sal2912/samd-dhf-template";
const JIRA_PROJECT = process.env.JIRA_PROJECT_KEY || "DHF";

// Track last sync timestamps in-memory (persisted across calls in same process)
export const syncState = {
  jiraLastSync:  null as string | null,
  githubLastSync: null as string | null,
  jiraError:     null as string | null,
  githubError:   null as string | null,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function jiraAuthHeader(): string {
  const creds = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");
  return `Basic ${creds}`;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (GH_TOKEN) h["Authorization"] = `Bearer ${GH_TOKEN}`;
  return h;
}

async function jiraFetch(path: string): Promise<any> {
  const url = `${JIRA_BASE}/rest/api/3${path}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": jiraAuthHeader(),
      "Accept": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function ghFetch(path: string): Promise<any> {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── Jira status → our status ───────────────────────────────────────────────────
function mapJiraStatus(jiraStatus: string): string {
  const s = jiraStatus.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return "dhf-review-pending";
  if (s.includes("progress") || s.includes("review") || s.includes("sprint")) return "accumulating";
  return "accumulating";
}

// ── Main sync functions ────────────────────────────────────────────────────────

/**
 * syncJira — fetches all stories from the DHF Jira project and upserts them
 * into SQLite. Only updates fields that Jira owns (title, status, taskCount).
 * DHF-specific fields (claudeReasoning, approvedBy, etc.) are never overwritten.
 */
export async function syncJira(): Promise<{ synced: number; errors: string[] }> {
  if (!JIRA_EMAIL || !JIRA_TOKEN) {
    const msg = "JIRA_EMAIL and JIRA_API_TOKEN env vars not set — Jira sync skipped";
    syncState.jiraError = msg;
    return { synced: 0, errors: [msg] };
  }

  const errors: string[] = [];
  let synced = 0;
  let startAt = 0;
  const maxResults = 50;

  try {
    while (true) {
      const data = await jiraFetch(`/search/jql?jql=${encodeURIComponent(`project = ${JIRA_PROJECT} AND issuetype = Story ORDER BY created DESC`)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,status,subtasks,assignee,priority,created,updated`);

      for (const issue of data.issues || []) {
        try {
          const storyId   = issue.key as string;                      // e.g. DHF-42
          const title     = issue.fields?.summary as string || storyId;
          const jiraStatusName = issue.fields?.status?.name as string || "To Do";
          const jiraStatus = mapJiraStatus(jiraStatusName);
          const subtasks   = (issue.fields?.subtasks || []) as any[];
          const taskCount  = subtasks.length;
          const updatedAt  = new Date().toISOString();

          const existing = storage.getStory(storyId);

          if (existing) {
            // Only update fields Jira owns — never overwrite DHF approval state
            const updates: Record<string, any> = {
              title,
              updatedAt,
              // Promote to dhf-review-pending only if Jira is Done AND we're still accumulating
              ...(jiraStatus === "dhf-review-pending" && existing.status === "accumulating"
                ? { status: "dhf-review-pending" }
                : {}),
              // Always update taskCount from Jira
              taskCount: Math.max(taskCount, existing.taskCount),
            };
            storage.updateStory(storyId, updates);
          } else {
            // New story — create with Jira-derived defaults
            storage.createStory({
              storyId,
              title,
              status: jiraStatus,
              taskCount,
              approvedBy: null,
              approvedAt: null,
              issueUrl: null,
              flagKey: null,
              flagEnabledAt: null,
              allReqIds: "[]",
              allHazIds: "[]",
              allTestIds: "[]",
              claudeConfidence: null,
              claudeReasoning: null,
              draftedReqId: null,
              draftedHazId: null,
              createdAt: issue.fields?.created || updatedAt,
              updatedAt,
            });
          }

          // Upsert subtasks as StoryTask rows
          for (const sub of subtasks) {
            const existing_tasks = storage.getStoryTasks(storyId);
            const alreadyExists = existing_tasks.some(t => t.taskId === sub.key);
            if (!alreadyExists) {
              storage.createStoryTask({
                storyId,
                taskId: sub.key,
                prNumber: null,
                prTitle: sub.fields?.summary || null,
                prAuthor: null,
                changeSummary: null,
                clinicalContext: null,
                mergedAt: null,
              });
            }
          }

          synced++;
        } catch (e: any) {
          errors.push(`Story ${issue.key}: ${e.message}`);
        }
      }

      if (data.issues.length < maxResults) break;
      startAt += maxResults;
    }

    syncState.jiraLastSync = new Date().toISOString();
    syncState.jiraError = null;
  } catch (e: any) {
    syncState.jiraError = e.message;
    errors.push(e.message);
  }

  return { synced, errors };
}

/**
 * syncGitHub — fetches:
 *  1. Issues labelled "dhf-review" → linked as issueUrl on matching stories
 *  2. Merged PRs → upsert as StoryTask rows, parse STORY: tag from PR body
 */
export async function syncGitHub(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    // ── 1. Issues: find DHF review issues ──────────────────────────────────────
    const issues = await ghFetch(
      `/repos/${GH_REPO}/issues?state=open&labels=dhf-review&per_page=50`
    ).catch(() => [] as any[]);

    for (const issue of issues) {
      // Try to extract story ID from issue title, e.g. "[DHF-42] Confidence Threshold Filter"
      const match = issue.title?.match(/\[?(DHF-\d+)\]?/i);
      if (!match) continue;
      const storyId = match[1].toUpperCase();
      const existing = storage.getStory(storyId);
      if (existing && !existing.issueUrl) {
        storage.updateStory(storyId, {
          issueUrl: issue.html_url,
          updatedAt: new Date().toISOString(),
        });
        synced++;
      }
    }

    // ── 2. Merged PRs: parse STORY: tag from PR body ───────────────────────────
    const prs = await ghFetch(
      `/repos/${GH_REPO}/pulls?state=closed&per_page=100&sort=updated&direction=desc`
    ).catch(() => [] as any[]);

    for (const pr of prs) {
      if (!pr.merged_at) continue;  // skip unmerged

      // Parse the STORY: line from our PR template
      const body = pr.body || "";
      const storyMatch  = body.match(/^STORY:\s*(DHF-\d+)/m);
      const taskMatch   = body.match(/^TASK:\s*(DHF-\d+)/m);
      const changeMatch = body.match(/^CHANGE:\s*(.+)/m);
      const clinMatch   = body.match(/^CLINICAL_CONTEXT:\s*(.+)/m);

      const storyId = storyMatch?.[1]?.toUpperCase();
      const taskId  = taskMatch?.[1]?.toUpperCase() || `PR-${pr.number}`;

      if (!storyId) continue;

      // Ensure story exists (might have been created by Jira sync or may already exist)
      if (!storage.getStory(storyId)) {
        storage.createStory({
          storyId,
          title: storyId,
          status: "accumulating",
          taskCount: 0,
          approvedBy: null, approvedAt: null,
          issueUrl: null, flagKey: null, flagEnabledAt: null,
          allReqIds: "[]", allHazIds: "[]", allTestIds: "[]",
          claudeConfidence: null, claudeReasoning: null,
          draftedReqId: null, draftedHazId: null,
          createdAt: pr.created_at,
          updatedAt: new Date().toISOString(),
        });
      }

      // Upsert task — skip if already present
      const existingTasks = storage.getStoryTasks(storyId);
      const taskAlreadyExists = existingTasks.some(
        t => t.prNumber === String(pr.number) || t.taskId === taskId
      );

      if (!taskAlreadyExists) {
        storage.createStoryTask({
          storyId,
          taskId,
          prNumber: String(pr.number),
          prTitle: pr.title,
          prAuthor: pr.user?.login || null,
          changeSummary: changeMatch?.[1]?.trim() || null,
          clinicalContext: clinMatch?.[1]?.trim() || null,
          mergedAt: pr.merged_at,
        });

        // Update taskCount on the story
        const story = storage.getStory(storyId)!;
        storage.updateStory(storyId, {
          taskCount: story.taskCount + 1,
          updatedAt: new Date().toISOString(),
        });

        synced++;
      }
    }

    // ── 3. Issues with label "dhf-approved": auto-approve stories ─────────────
    const approvedIssues = await ghFetch(
      `/repos/${GH_REPO}/issues?state=closed&labels=dhf-approved&per_page=50`
    ).catch(() => [] as any[]);

    for (const issue of approvedIssues) {
      const match = issue.title?.match(/\[?(DHF-\d+)\]?/i);
      if (!match) continue;
      const storyId = match[1].toUpperCase();
      const story = storage.getStory(storyId);
      if (story && story.status === "dhf-review-pending") {
        storage.updateStory(storyId, {
          status: "dhf-approved",
          approvedBy: issue.closed_by?.login || "github",
          approvedAt: issue.closed_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        synced++;
      }
    }

    syncState.githubLastSync = new Date().toISOString();
    syncState.githubError = null;
  } catch (e: any) {
    syncState.githubError = e.message;
    errors.push(e.message);
  }

  return { synced, errors };
}

/**
 * syncAll — runs both syncs in parallel and returns combined results
 */
export async function syncAll() {
  const [jira, github] = await Promise.allSettled([syncJira(), syncGitHub()]);
  return {
    jira:   jira.status   === "fulfilled" ? jira.value   : { synced: 0, errors: [(jira as any).reason?.message] },
    github: github.status === "fulfilled" ? github.value : { synced: 0, errors: [(github as any).reason?.message] },
  };
}
