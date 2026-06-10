import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and } from "drizzle-orm";
import {
  dhfDocuments, documentVersions, stories, storyTasks, reviewActions,
  type DhfDocument, type DocumentVersion, type Story, type StoryTask, type ReviewAction,
  type InsertDhfDocument, type InsertDocumentVersion, type InsertStory,
  type InsertStoryTask, type InsertReviewAction,
} from "@shared/schema";

const DB_PATH = process.env.DB_PATH || "data.db";
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

// ── Migrate ────────────────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS dhf_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    owner TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    version TEXT NOT NULL DEFAULT '1.0',
    last_reviewed TEXT,
    review_interval_days INTEGER NOT NULL DEFAULT 90,
    is_ai_addition INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    linked_requirements TEXT NOT NULL DEFAULT '[]',
    linked_hazards TEXT NOT NULL DEFAULT '[]',
    days_overdue INTEGER DEFAULT 0,
    staleness_status TEXT NOT NULL DEFAULT 'current',
    content TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS document_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    change_note TEXT,
    story_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL UNIQUE,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'accumulating',
    task_count INTEGER NOT NULL DEFAULT 0,
    approved_by TEXT,
    approved_at TEXT,
    issue_url TEXT,
    flag_key TEXT,
    flag_enabled_at TEXT,
    all_req_ids TEXT NOT NULL DEFAULT '[]',
    all_haz_ids TEXT NOT NULL DEFAULT '[]',
    all_test_ids TEXT NOT NULL DEFAULT '[]',
    claude_confidence TEXT,
    claude_reasoning TEXT,
    drafted_req_id TEXT,
    drafted_haz_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS story_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    pr_number TEXT,
    pr_title TEXT,
    pr_author TEXT,
    change_summary TEXT,
    clinical_context TEXT,
    merged_at TEXT
  );

  CREATE TABLE IF NOT EXISTS review_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id TEXT NOT NULL,
    document_id INTEGER,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL
  );
`);

export interface IStorage {
  // Documents
  getAllDocuments(): DhfDocument[];
  getDocument(id: number): DhfDocument | undefined;
  getDocumentBySection(section: string): DhfDocument | undefined;
  createDocument(doc: InsertDhfDocument): DhfDocument;
  updateDocument(id: number, updates: Partial<InsertDhfDocument>): DhfDocument | undefined;

  // Versions
  getVersions(documentId: number): DocumentVersion[];
  createVersion(v: InsertDocumentVersion): DocumentVersion;

  // Stories
  getAllStories(): Story[];
  getStory(storyId: string): Story | undefined;
  createStory(s: InsertStory): Story;
  updateStory(storyId: string, updates: Partial<InsertStory>): Story | undefined;

  // Story tasks
  getStoryTasks(storyId: string): StoryTask[];
  createStoryTask(t: InsertStoryTask): StoryTask;

  // Review actions
  getReviewActions(storyId: string): ReviewAction[];
  createReviewAction(a: InsertReviewAction): ReviewAction;

  // Seed
  seedIfEmpty(): void;
}

export const storage: IStorage = {
  // ── Documents ────────────────────────────────────────────────────────────────
  getAllDocuments() {
    return db.select().from(dhfDocuments).all();
  },
  getDocument(id) {
    return db.select().from(dhfDocuments).where(eq(dhfDocuments.id, id)).get();
  },
  getDocumentBySection(section) {
    return db.select().from(dhfDocuments).where(eq(dhfDocuments.section, section)).get();
  },
  createDocument(doc) {
    return db.insert(dhfDocuments).values(doc).returning().get();
  },
  updateDocument(id, updates) {
    return db.update(dhfDocuments).set(updates).where(eq(dhfDocuments.id, id)).returning().get();
  },

  // ── Versions ─────────────────────────────────────────────────────────────────
  getVersions(documentId) {
    return db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .all();
  },
  createVersion(v) {
    return db.insert(documentVersions).values(v).returning().get();
  },

  // ── Stories ───────────────────────────────────────────────────────────────────
  getAllStories() {
    return db.select().from(stories).all();
  },
  getStory(storyId) {
    return db.select().from(stories).where(eq(stories.storyId, storyId)).get();
  },
  createStory(s) {
    return db.insert(stories).values(s).returning().get();
  },
  updateStory(storyId, updates) {
    return db.update(stories).set(updates).where(eq(stories.storyId, storyId)).returning().get();
  },

  // ── Story tasks ───────────────────────────────────────────────────────────────
  getStoryTasks(storyId) {
    return db.select().from(storyTasks).where(eq(storyTasks.storyId, storyId)).all();
  },
  createStoryTask(t) {
    return db.insert(storyTasks).values(t).returning().get();
  },

  // ── Review actions ────────────────────────────────────────────────────────────
  getReviewActions(storyId) {
    return db.select().from(reviewActions)
      .where(eq(reviewActions.storyId, storyId))
      .all();
  },
  createReviewAction(a) {
    return db.insert(reviewActions).values(a).returning().get();
  },

  // ── Seed ─────────────────────────────────────────────────────────────────────
  seedIfEmpty() {
    // Seed data removed — app starts empty and populates via Jira/GitHub sync
    return;

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    const docs: InsertDhfDocument[] = [
      { section: "intended-use", title: "Intended Use and Indications for Use", filePath: "dhf/01-intended-use.md", owner: "regulatory", status: "active", version: "1.2", lastReviewed: "2026-04-15", reviewIntervalDays: 90, isAiAddition: false, tags: '["intended-use","classification"]', linkedRequirements: '[]', linkedHazards: '[]', daysOverdue: 0, stalenessStatus: "current", content: "# Intended Use\n\nThis document defines the intended use for the SaMD product.", updatedAt: now },
      { section: "risk-management", title: "Risk Management File", filePath: "dhf/02-risk-management-file.md", owner: "quality", status: "active", version: "2.1", lastReviewed: "2026-03-10", reviewIntervalDays: 60, isAiAddition: false, tags: '["risk","iso-14971"]', linkedRequirements: '["REQ-001","REQ-002"]', linkedHazards: '["H-001","H-002","H-003"]', daysOverdue: 55, stalenessStatus: "stale", content: "# Risk Management File\n\nISO 14971:2019 compliant risk register.", updatedAt: now },
      { section: "design-inputs-outputs", title: "Design Inputs and Outputs", filePath: "dhf/03-design-inputs-outputs.md", owner: "engineering", status: "active", version: "1.5", lastReviewed: "2026-05-01", reviewIntervalDays: 60, isAiAddition: false, tags: '["design-controls","requirements"]', linkedRequirements: '["REQ-001","REQ-002","REQ-003"]', linkedHazards: '["H-001","H-002"]', daysOverdue: 0, stalenessStatus: "current", content: "# Design Inputs and Outputs\n\nRequirements and design outputs for the SaMD.", updatedAt: now },
      { section: "verification-validation", title: "Verification and Validation", filePath: "dhf/04-verification-validation.md", owner: "engineering", status: "active", version: "1.3", lastReviewed: "2026-05-15", reviewIntervalDays: 60, isAiAddition: false, tags: '["vv","testing"]', linkedRequirements: '["REQ-001","REQ-002","REQ-003"]', linkedHazards: '["H-001","H-002","H-003"]', daysOverdue: 0, stalenessStatus: "current", content: "# Verification and Validation\n\nV&V records for the SaMD product.", updatedAt: now },
      { section: "traceability-matrix", title: "Traceability Matrix", filePath: "dhf/05-traceability-matrix.md", owner: "quality", status: "active", version: "1.4", lastReviewed: "2026-05-20", reviewIntervalDays: 30, isAiAddition: false, tags: '["traceability","audit-ready"]', linkedRequirements: '["REQ-001","REQ-002","REQ-003"]', linkedHazards: '["H-001","H-002","H-003"]', daysOverdue: 0, stalenessStatus: "current", content: "# Traceability Matrix\n\nMaster traceability linking requirements, hazards, and tests.", updatedAt: now },
      { section: "post-market-surveillance", title: "Post-Market Surveillance Plan", filePath: "dhf/06-post-market-surveillance.md", owner: "quality", status: "active", version: "1.1", lastReviewed: "2026-02-28", reviewIntervalDays: 90, isAiAddition: false, tags: '["post-market","pms"]', linkedRequirements: '[]', linkedHazards: '["H-001","H-002","H-003"]', daysOverdue: 30, stalenessStatus: "stale", content: "# Post-Market Surveillance Plan\n\nPMS strategy and KPI definitions.", updatedAt: now },
      { section: "ai-model-card", title: "Model Card", filePath: "dhf/ai-additions/AI-01-model-card.md", owner: "ml-engineering", status: "draft", version: "1.0", lastReviewed: "2026-05-28", reviewIntervalDays: 30, isAiAddition: true, tags: '["ai","model-card","fairness"]', linkedRequirements: '["REQ-002"]', linkedHazards: '["H-002"]', daysOverdue: 0, stalenessStatus: "current", content: "# Model Card\n\nAI/ML model documentation including training data and performance metrics.", updatedAt: now },
      { section: "ai-pccp", title: "Predetermined Change Control Plan (PCCP)", filePath: "dhf/ai-additions/AI-02-pccp-algorithm-change-protocol.md", owner: "regulatory", status: "draft", version: "1.0", lastReviewed: "2026-04-20", reviewIntervalDays: 60, isAiAddition: true, tags: '["ai","pccp","algorithm-change"]', linkedRequirements: '["REQ-002"]', linkedHazards: '["H-001","H-002"]', daysOverdue: 0, stalenessStatus: "current", content: "# PCCP\n\nPredetermined change control plan for AI/ML model updates.", updatedAt: now },
      { section: "ai-bias-fairness", title: "Bias and Fairness Assessment", filePath: "dhf/ai-additions/AI-03-bias-fairness-assessment.md", owner: "ml-engineering", status: "draft", version: "1.0", lastReviewed: "2026-05-10", reviewIntervalDays: 60, isAiAddition: true, tags: '["ai","bias","fairness"]', linkedRequirements: '["REQ-002"]', linkedHazards: '["H-002"]', daysOverdue: 0, stalenessStatus: "current", content: "# Bias and Fairness\n\nSubgroup performance analysis and bias mitigation.", updatedAt: now },
      { section: "ai-drift-monitoring", title: "Data and Concept Drift Monitoring Plan", filePath: "dhf/ai-additions/AI-04-data-drift-monitoring-plan.md", owner: "ml-engineering", status: "draft", version: "1.0", lastReviewed: "2026-05-01", reviewIntervalDays: 30, isAiAddition: true, tags: '["ai","drift","post-market"]', linkedRequirements: '["REQ-002"]', linkedHazards: '["H-001","H-002"]', daysOverdue: 3, stalenessStatus: "stale", content: "# Drift Monitoring\n\nData and concept drift detection and response protocol.", updatedAt: now },
      { section: "ai-explainability", title: "Explainability Documentation", filePath: "dhf/ai-additions/AI-05-explainability-documentation.md", owner: "ml-engineering", status: "draft", version: "1.0", lastReviewed: "2026-05-25", reviewIntervalDays: 90, isAiAddition: true, tags: '["ai","explainability","eu-ai-act"]', linkedRequirements: '["REQ-001","REQ-002"]', linkedHazards: '["H-001"]', daysOverdue: 0, stalenessStatus: "current", content: "# Explainability\n\nXAI methods and transparency documentation.", updatedAt: now },
    ];

    for (const doc of docs) {
      const created = storage.createDocument(doc);
      // Seed a version for each
      storage.createVersion({
        documentId: created.id,
        version: doc.version,
        content: doc.content || "",
        changedBy: doc.owner,
        changeNote: "Initial version",
        storyId: null,
        createdAt: now,
      });
    }

    // Seed stories
    const storyData: InsertStory[] = [
      { storyId: "DHF-42", title: "Confidence Threshold Filter", status: "dhf-review-pending", taskCount: 3, approvedBy: null, approvedAt: null, issueUrl: "https://github.com/Sal2912/samd-dhf-template/issues/1", flagKey: "confidence-threshold-v2", flagEnabledAt: null, allReqIds: '["REQ-002"]', allHazIds: '["H-002"]', allTestIds: '["TEST-004","TEST-005"]', claudeConfidence: "high", claudeReasoning: "The confidence threshold change directly affects model output distribution and requires validation of sensitivity/specificity tradeoffs. Risk is bounded to performance degradation rather than safety-critical failure.", draftedReqId: "REQ-004", draftedHazId: "H-004", createdAt: now, updatedAt: now },
      { storyId: "DHF-38", title: "DICOM Input Validation", status: "dhf-approved", taskCount: 4, approvedBy: "Sal2912", approvedAt: "2026-05-28", issueUrl: "https://github.com/Sal2912/samd-dhf-template/issues/2", flagKey: "dicom-v3-parser", flagEnabledAt: "2026-05-30", allReqIds: '["REQ-003"]', allHazIds: '["H-003"]', allTestIds: '["TEST-003","TEST-006","TEST-007"]', claudeConfidence: "high", claudeReasoning: "DICOM validation is a security and data integrity control. Existing H-003 covers data corruption hazards. Tests TEST-003 and TEST-006 provide adequate coverage.", draftedReqId: "REQ-003", draftedHazId: "H-003", createdAt: now, updatedAt: now },
      { storyId: "DHF-35", title: "API Rate Limiting", status: "accumulating", taskCount: 2, approvedBy: null, approvedAt: null, issueUrl: null, flagKey: "api-rate-limit", flagEnabledAt: null, allReqIds: '["REQ-003"]', allHazIds: '[]', allTestIds: '["TEST-008"]', claudeConfidence: null, claudeReasoning: null, draftedReqId: null, draftedHazId: null, createdAt: now, updatedAt: now },
    ];

    for (const s of storyData) {
      const created = storage.createStory(s);
      if (s.storyId === "DHF-42") {
        storage.createStoryTask({ storyId: "DHF-42", taskId: "DHF-87", prNumber: "24", prTitle: "feat: add threshold config parameter", prAuthor: "dev1", changeSummary: "Added configurable confidence threshold to inference pipeline", clinicalContext: "Affects false positive rate for primary diagnosis output", mergedAt: "2026-06-01T10:00:00Z" });
        storage.createStoryTask({ storyId: "DHF-42", taskId: "DHF-91", prNumber: "26", prTitle: "feat: wire threshold into model inference", prAuthor: "dev2", changeSummary: "Connected threshold parameter to model output filtering", clinicalContext: "Controls sensitivity/specificity tradeoff for clinical workflow", mergedAt: "2026-06-02T14:00:00Z" });
        storage.createStoryTask({ storyId: "DHF-42", taskId: "DHF-95", prNumber: "28", prTitle: "test: threshold behavior unit tests", prAuthor: "dev1", changeSummary: "Added TEST-004 and TEST-005 covering threshold edge cases", clinicalContext: null, mergedAt: "2026-06-03T09:00:00Z" });
      }
      if (s.storyId === "DHF-38") {
        storage.createReviewAction({ storyId: "DHF-38", documentId: null, action: "approved", actor: "Sal2912", comment: "Reviewed Claude's draft. Hazard statement and requirement are accurate. Tests provide sufficient coverage.", createdAt: "2026-05-28T11:30:00Z" });
      }
    }
  },
};
