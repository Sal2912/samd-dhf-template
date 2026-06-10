import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { syncAll, syncJira, syncGitHub, syncState } from "./sync";
import { handleStoryClosed, handleEpicClosed } from "./doc-updater";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  storage.seedIfEmpty();

  // ── Documents ────────────────────────────────────────────────────────────────
  app.get("/api/documents", (_req, res) => {
    res.json(storage.getAllDocuments());
  });

  app.get("/api/documents/:id", (req, res) => {
    const doc = storage.getDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  });

  app.patch("/api/documents/:id", (req, res) => {
    const id = Number(req.params.id);
    const doc = storage.getDocument(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    const { changeNote, ...updates } = req.body;
    const updated = storage.updateDocument(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    // Save version if content changed
    if (updates.content && updates.content !== doc.content) {
      const newVersion = bumpVersion(doc.version);
      storage.updateDocument(id, { version: newVersion });
      storage.createVersion({
        documentId: id,
        version: newVersion,
        content: updates.content,
        changedBy: req.body.changedBy || "reviewer",
        changeNote: changeNote || null,
        storyId: req.body.storyId || null,
        createdAt: new Date().toISOString(),
      });
    }

    res.json(updated);
  });

  // ── Versions ─────────────────────────────────────────────────────────────────
  app.get("/api/documents/:id/versions", (req, res) => {
    res.json(storage.getVersions(Number(req.params.id)));
  });

  // ── Stories ───────────────────────────────────────────────────────────────────
  app.get("/api/stories", (_req, res) => {
    res.json(storage.getAllStories());
  });

  app.get("/api/stories/:storyId", (req, res) => {
    const story = storage.getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: "Not found" });
    const tasks = storage.getStoryTasks(req.params.storyId);
    const actions = storage.getReviewActions(req.params.storyId);
    res.json({ story, tasks, actions });
  });

  app.post("/api/stories/:storyId/approve", (req, res) => {
    const { actor, comment } = req.body;
    const story = storage.getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: "Not found" });

    storage.updateStory(req.params.storyId, {
      status: "dhf-approved",
      approvedBy: actor || "reviewer",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    storage.createReviewAction({
      storyId: req.params.storyId,
      documentId: null,
      action: "approved",
      actor: actor || "reviewer",
      comment: comment || null,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true });
  });

  app.post("/api/stories/:storyId/request-changes", (req, res) => {
    const { actor, comment } = req.body;
    const story = storage.getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: "Not found" });

    storage.createReviewAction({
      storyId: req.params.storyId,
      documentId: null,
      action: "requested_changes",
      actor: actor || "reviewer",
      comment: comment || null,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true });
  });

  app.post("/api/stories/:storyId/enable-flag", (req, res) => {
    const story = storage.getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: "Not found" });
    if (story.status !== "dhf-approved") {
      return res.status(400).json({ error: "DHF not yet approved" });
    }

    storage.updateStory(req.params.storyId, {
      status: "flag-enabled",
      flagEnabledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true });
  });

  // ── Sync ──────────────────────────────────────────────────────────────────────
  // GET /api/sync/status — last sync timestamps + any errors
  app.get("/api/sync/status", (_req, res) => {
    res.json({
      jiraLastSync:   syncState.jiraLastSync,
      githubLastSync: syncState.githubLastSync,
      jiraError:      syncState.jiraError,
      githubError:    syncState.githubError,
      jiraConfigured:   !!(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN),
      githubConfigured: !!(process.env.GITHUB_TOKEN),
    });
  });

  // POST /api/sync/all — trigger both syncs in parallel
  app.post("/api/sync/all", async (_req, res) => {
    const result = await syncAll();
    res.json(result);
  });

  // POST /api/sync/jira — trigger Jira sync only
  app.post("/api/sync/jira", async (_req, res) => {
    const result = await syncJira();
    res.json(result);
  });

  // POST /api/sync/github — trigger GitHub sync only
  app.post("/api/sync/github", async (_req, res) => {
    const result = await syncGitHub();
    res.json(result);
  });

  // ── Jira Webhook ──────────────────────────────────────────────────────────────
  // POST /api/webhook/jira — receives Jira issue transitions
  app.post("/api/webhook/jira", async (req, res) => {
    try {
      const event = req.body;
      const issueType = event?.issue?.fields?.issuetype?.name?.toLowerCase() || "";
      const status = event?.issue?.fields?.status?.name?.toLowerCase() || "";
      const issueKey = event?.issue?.key || "";
      const transition = event?.transition?.to?.name?.toLowerCase() || "";

      const isClosed = status.includes("done") || status.includes("closed") || status.includes("resolved")
        || transition.includes("done") || transition.includes("closed");

      if (!issueKey || !isClosed) {
        return res.json({ ignored: true, reason: "Not a close event" });
      }

      // Respond immediately — processing happens async
      res.json({ received: true, issueKey, issueType });

      if (issueType === "epic") {
        console.log(`[webhook] Epic closed: ${issueKey}`);
        handleEpicClosed(issueKey).then(r => console.log(`[webhook] Epic ${issueKey} done:`, r)).catch(console.error);
      } else if (issueType === "story" || issueType === "bug" || issueType === "task") {
        console.log(`[webhook] Story closed: ${issueKey}`);
        handleStoryClosed(issueKey).then(r => console.log(`[webhook] Story ${issueKey} done:`, r)).catch(console.error);
      }
    } catch (e: any) {
      console.error("[webhook] Error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/trigger/story/:storyId — manual trigger for testing
  app.post("/api/trigger/story/:storyId", async (req, res) => {
    const { storyId } = req.params;
    try {
      const result = await handleStoryClosed(storyId);
      res.json({ success: true, storyId, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/trigger/epic/:epicId — manual trigger for testing
  app.post("/api/trigger/epic/:epicId", async (req, res) => {
    const { epicId } = req.params;
    try {
      const result = await handleEpicClosed(epicId);
      res.json({ success: true, epicId, ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Dashboard stats ───────────────────────────────────────────────────────────
  app.get("/api/stats", (_req, res) => {
    const docs = storage.getAllDocuments();
    const storyList = storage.getAllStories();

    res.json({
      totalDocuments:  docs.length,
      staleDocuments:  docs.filter(d => d.stalenessStatus === "stale").length,
      activeDocuments: docs.filter(d => d.status === "active").length,
      draftDocuments:  docs.filter(d => d.status === "draft").length,
      aiDocuments:     docs.filter(d => d.isAiAddition).length,
      totalStories:    storyList.length,
      pendingReview:   storyList.filter(s => s.status === "dhf-review-pending").length,
      approved:        storyList.filter(s => s.status === "dhf-approved").length,
      flagEnabled:     storyList.filter(s => s.status === "flag-enabled").length,
    });
  });

  return httpServer;
}

function bumpVersion(version: string): string {
  const parts = version.split(".");
  const minor = parseInt(parts[1] || "0") + 1;
  return `${parts[0]}.${minor}`;
}
