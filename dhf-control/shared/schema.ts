import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── DHF Documents ──────────────────────────────────────────────────────────────
export const dhfDocuments = sqliteTable("dhf_documents", {
  id:                  integer("id").primaryKey({ autoIncrement: true }),
  section:             text("section").notNull(),          // e.g. "risk-management"
  title:               text("title").notNull(),
  filePath:            text("file_path").notNull(),
  owner:               text("owner").notNull(),
  status:              text("status").notNull(),            // draft | active | archived
  version:             text("version").notNull(),
  lastReviewed:        text("last_reviewed"),
  reviewIntervalDays:  integer("review_interval_days").notNull().default(90),
  isAiAddition:        integer("is_ai_addition", { mode: "boolean" }).notNull().default(false),
  tags:                text("tags").notNull().default("[]"), // JSON array
  linkedRequirements:  text("linked_requirements").notNull().default("[]"),
  linkedHazards:       text("linked_hazards").notNull().default("[]"),
  daysOverdue:         integer("days_overdue").default(0),
  stalenessStatus:     text("staleness_status").notNull().default("current"), // current | stale | unknown
  content:             text("content"),                    // full markdown content
  updatedAt:           text("updated_at").notNull(),
});

// ── Document Versions ──────────────────────────────────────────────────────────
export const documentVersions = sqliteTable("document_versions", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  documentId: integer("document_id").notNull(),
  version:    text("version").notNull(),
  content:    text("content").notNull(),
  changedBy:  text("changed_by").notNull(),
  changeNote: text("change_note"),
  storyId:    text("story_id"),
  createdAt:  text("created_at").notNull(),
});

// ── Stories ────────────────────────────────────────────────────────────────────
export const stories = sqliteTable("stories", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  storyId:         text("story_id").notNull().unique(),    // e.g. DHF-42
  title:           text("title"),
  issueType:       text("issue_type").notNull().default("story"), // story | epic
  epicId:          text("epic_id"),          // parent epic Jira key (null for epics)
  epicTitle:       text("epic_title"),       // parent epic title (for display)
  status:          text("status").notNull().default("accumulating"),
  // accumulating | dhf-review-pending | dhf-approved | flag-enabled
  taskCount:       integer("task_count").notNull().default(0),
  approvedBy:      text("approved_by"),
  approvedAt:      text("approved_at"),
  issueUrl:        text("issue_url"),
  flagKey:         text("flag_key"),
  flagEnabledAt:   text("flag_enabled_at"),
  allReqIds:       text("all_req_ids").notNull().default("[]"),
  allHazIds:       text("all_haz_ids").notNull().default("[]"),
  allTestIds:      text("all_test_ids").notNull().default("[]"),
  claudeConfidence: text("claude_confidence"),
  claudeReasoning:  text("claude_reasoning"),
  draftedReqId:    text("drafted_req_id"),
  draftedHazId:    text("drafted_haz_id"),
  createdAt:       text("created_at").notNull(),
  updatedAt:       text("updated_at").notNull(),
});

// ── Story Tasks ────────────────────────────────────────────────────────────────
export const storyTasks = sqliteTable("story_tasks", {
  id:              integer("id").primaryKey({ autoIncrement: true }),
  storyId:         text("story_id").notNull(),
  taskId:          text("task_id").notNull(),
  prNumber:        text("pr_number"),
  prTitle:         text("pr_title"),
  prAuthor:        text("pr_author"),
  changeSummary:   text("change_summary"),
  clinicalContext: text("clinical_context"),
  mergedAt:        text("merged_at"),
});

// ── Review Actions ─────────────────────────────────────────────────────────────
export const reviewActions = sqliteTable("review_actions", {
  id:         integer("id").primaryKey({ autoIncrement: true }),
  storyId:    text("story_id").notNull(),
  documentId: integer("document_id"),
  action:     text("action").notNull(),  // approved | rejected | commented | requested_changes
  actor:      text("actor").notNull(),
  comment:    text("comment"),
  createdAt:  text("created_at").notNull(),
});

// ── Insert schemas ─────────────────────────────────────────────────────────────
export const insertDhfDocumentSchema = createInsertSchema(dhfDocuments).omit({ id: true });
export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({ id: true });
export const insertStorySchema = createInsertSchema(stories).omit({ id: true });
export const insertStoryTaskSchema = createInsertSchema(storyTasks).omit({ id: true });
export const insertReviewActionSchema = createInsertSchema(reviewActions).omit({ id: true });

// ── Types ──────────────────────────────────────────────────────────────────────
export type DhfDocument    = typeof dhfDocuments.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type Story          = typeof stories.$inferSelect;
export type StoryTask      = typeof storyTasks.$inferSelect;
export type ReviewAction   = typeof reviewActions.$inferSelect;

export type InsertDhfDocument    = z.infer<typeof insertDhfDocumentSchema>;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;
export type InsertStory          = z.infer<typeof insertStorySchema>;
export type InsertStoryTask      = z.infer<typeof insertStoryTaskSchema>;
export type InsertReviewAction   = z.infer<typeof insertReviewActionSchema>;
