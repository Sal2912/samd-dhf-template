/**
 * doc-updater.ts — AI-powered document updater
 *
 * When a Jira story or epic closes, this module:
 *  1. Fetches story/epic details + linked PRs from Jira + GitHub
 *  2. Sends context to Claude Haiku
 *  3. Claude returns updated sections for SRS, TM, and optionally RA
 *  4. Saves draft updates to DB with status "draft" flagged for human review
 *
 * Story close  → updates: SRS, TM, RA (if Claude detects risk)
 * Epic close   → updates: SyRS, SRS, TM, RA
 */

import { storage } from "./storage";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ── Config ─────────────────────────────────────────────────────────────────────
const JIRA_BASE    = (process.env.JIRA_BASE_URL   || "https://dhfgeneration.atlassian.net").replace(/\/$/, "");
const JIRA_EMAIL   = process.env.JIRA_EMAIL        || "";
const JIRA_TOKEN   = process.env.JIRA_API_TOKEN    || "";
const GH_TOKEN     = process.env.GITHUB_TOKEN      || "";
const GH_REPO      = process.env.GITHUB_REPO       || "Sal2912/samd-dhf-template";
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = "claude-haiku-4-5";

// ── Template loader ────────────────────────────────────────────────────────────
function loadTemplate(name: string): string {
  try {
    // Templates live at repo root /dhf-templates/
    const p = join(process.cwd(), "..", "dhf-templates", name);
    return readFileSync(p, "utf-8");
  } catch {
    return `# ${name}\n\n{{CONTENT}}\n`;
  }
}

// ── Jira helpers ───────────────────────────────────────────────────────────────
function jiraAuth(): string {
  return "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");
}

async function jiraGet(path: string): Promise<any> {
  const res = await fetch(`${JIRA_BASE}/rest/api/3${path}`, {
    headers: { Authorization: jiraAuth(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jira ${res.status} ${path}`);
  return res.json();
}

function extractText(adf: any): string {
  if (!adf) return "";
  if (typeof adf === "string") return adf;
  if (adf.type === "text") return adf.text || "";
  if (Array.isArray(adf.content)) return adf.content.map(extractText).join(" ");
  return "";
}

async function getJiraStory(storyId: string): Promise<any> {
  try {
    const issue = await jiraGet(`/issue/${storyId}?fields=summary,description,status,issuetype,parent,subtasks,labels,priority,acceptanceCriteria,customfield_10014`);
    return {
      id: storyId,
      title: issue.fields.summary,
      description: extractText(issue.fields.description),
      status: issue.fields.status?.name,
      type: issue.fields.issuetype?.name,
      epicId: issue.fields.parent?.key || issue.fields.customfield_10014 || null,
      epicTitle: issue.fields.parent?.fields?.summary || null,
      labels: issue.fields.labels || [],
      priority: issue.fields.priority?.name || "Medium",
    };
  } catch (e: any) {
    console.error("getJiraStory error:", e.message);
    return null;
  }
}

async function getJiraEpic(epicId: string): Promise<any> {
  try {
    const issue = await jiraGet(`/issue/${epicId}?fields=summary,description,status,subtasks`);
    // Get all stories under this epic
    const search = await jiraGet(`/search?jql=project=DHF AND "Epic Link"=${epicId} OR parent=${epicId}&fields=summary,status,issuetype`);
    const stories = (search.issues || []).map((i: any) => ({
      id: i.key,
      title: i.fields.summary,
      status: i.fields.status?.name,
      type: i.fields.issuetype?.name,
    }));
    return {
      id: epicId,
      title: issue.fields.summary,
      description: extractText(issue.fields.description),
      status: issue.fields.status?.name,
      stories,
    };
  } catch (e: any) {
    console.error("getJiraEpic error:", e.message);
    return null;
  }
}

// ── GitHub helpers ─────────────────────────────────────────────────────────────
function ghHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
  };
}

async function ghGet(path: string): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function getPRsForStory(storyId: string): Promise<any[]> {
  try {
    // Search merged PRs mentioning this story ID
    const data = await ghGet(`/search/issues?q=repo:${GH_REPO}+is:pr+is:merged+${storyId}&per_page=20`);
    if (!data?.items) return [];
    return data.items.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      url: pr.html_url,
      mergedAt: pr.pull_request?.merged_at,
    }));
  } catch {
    return [];
  }
}

// ── Claude Haiku call ──────────────────────────────────────────────────────────
async function callClaude(prompt: string): Promise<string> {
  if (!CLAUDE_KEY) return "<!-- Claude API key not configured -->";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Document section helpers ───────────────────────────────────────────────────

function getOrCreateDoc(section: string, title: string, filePath: string, owner: string): number {
  const all = storage.getAllDocuments();
  const existing = all.find(d => d.section === section);
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const created = storage.createDocument({
    section, title, filePath, owner,
    status: "draft",
    version: "0.1",
    reviewIntervalDays: 90,
    isAiAddition: false,
    tags: "[]",
    linkedRequirements: "[]",
    linkedHazards: "[]",
    daysOverdue: 0,
    stalenessStatus: "current",
    content: loadTemplate(filePath.split("/").pop() || ""),
    updatedAt: now,
  });
  return created.id;
}

function bumpVersion(v: string): string {
  const parts = v.split(".");
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  return parts.join(".");
}

// ── Story-close handler ────────────────────────────────────────────────────────

export async function handleStoryClosed(storyId: string): Promise<{ updated: string[]; skipped: string[] }> {
  const updated: string[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  // 1. Fetch Jira story details
  const story = await getJiraStory(storyId);
  if (!story) { skipped.push("all — could not fetch Jira story"); return { updated, skipped }; }

  // 2. Fetch linked GitHub PRs
  const prs = await getPRsForStory(storyId);
  const prSummary = prs.map(p => `PR #${p.number}: ${p.title}\n${p.body?.slice(0, 300) || ""}`).join("\n\n");

  const context = `
Story: ${story.id} — ${story.title}
Epic: ${story.epicId || "N/A"} — ${story.epicTitle || "N/A"}
Description: ${story.description || "No description"}
Priority: ${story.priority}
Labels: ${story.labels.join(", ") || "none"}

Merged PRs:
${prSummary || "No merged PRs found"}
`.trim();

  // 3. Update SRS — add/update story entry
  const srsTpl = loadTemplate("SRS-software-requirements.md");
  const srsPrompt = `You are a medical device documentation assistant helping maintain a Software Requirements Specification (SRS) for a SaMD product regulated under IEC 62304 and ISO 13485.

A Jira story has just been closed. Add or update the entry for this story in the SRS document.

STORY CONTEXT:
${context}

CURRENT SRS TEMPLATE:
${srsTpl}

Instructions:
- Write ONLY the new story block to insert/update under the correct Epic section
- Use the Jira story ID (${storyId}) as the requirement ID
- Fill in Requirement Statement from the story description
- Fill in Acceptance Criteria from any "acceptance criteria" or "done" criteria you can infer
- Set Type to Functional, Non-Functional, Safety, or Interface based on context
- Keep it concise — 3-5 sentences max per field
- Return ONLY the markdown block for this story, no extra explanation

Format:
#### ${storyId} — ${story.title}

| Field | Value |
|---|---|
| Requirement ID | ${storyId} |
| Type | [type] |
| Priority | ${story.priority} |
| Status | Draft |
| Source | https://dhfgeneration.atlassian.net/browse/${storyId} |

**Requirement Statement:**
[statement]

**Acceptance Criteria:**
[criteria]

**Notes / Constraints:**
[notes or "None"]`;

  const srsBlock = await callClaude(srsPrompt);

  // Get or create SRS doc
  const srsId = getOrCreateDoc("srs", "Software Requirements Specification", "dhf-templates/SRS-software-requirements.md", "regulatory");
  const srsDoc = storage.getDocument(srsId)!;
  const srsContent = (srsDoc.content || srsTpl) + "\n\n---\n\n<!-- AI Draft — Story " + storyId + " -->\n" + srsBlock;
  const srsNewVer = bumpVersion(srsDoc.version);
  storage.updateDocument(srsId, { content: srsContent, version: srsNewVer, status: "draft", updatedAt: now });
  storage.createVersion({ documentId: srsId, version: srsNewVer, content: srsContent, changedBy: "claude-haiku", changeNote: `[AI] Auto-updated from story ${storyId} closure`, storyId, createdAt: now });
  storage.createReviewAction({ storyId, documentId: srsId, action: "ai_drafted", actor: "claude-haiku", comment: `Auto-drafted SRS entry for ${storyId}. Requires human review.`, createdAt: now });
  updated.push("SRS");

  // 4. Update Traceability Matrix — get existing rows first, then regenerate full table
  const tmId = getOrCreateDoc("traceability-matrix", "Traceability Matrix", "dhf-templates/TM-traceability-matrix.md", "quality");
  const tmDoc = storage.getDocument(tmId)!;

  // Extract existing data rows (lines starting with | but not header/separator)
  const existingTmRows = (tmDoc.content || "")
    .split("\n")
    .filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Sys Req") && !l.includes("SysReqID") && !l.includes("{{")
      && l.replace(/\|/g, "").trim().length > 0);

  const tmPrompt = `You are a medical device documentation assistant maintaining a Traceability Matrix for a SaMD product (IEC 62304, ISO 13485).

Generate a complete, clean Traceability Matrix document in markdown.

STORY BEING ADDED:
${context}

EXISTING TABLE ROWS (preserve these exactly, add new row for ${storyId}):
${existingTmRows.join("\n") || "(none yet)"}

Instructions:
- Output the COMPLETE document — header, overview, full table, coverage summary, gaps section
- For ${storyId}: infer System Req ID from Epic (${story.epicId || "SYS-TBD"}), extract PR numbers from context, set Test IDs to ⚠ TBD, set Hazard IDs to none unless clearly mentioned
- Verification Status = Pending for new rows
- Coverage summary: count rows and calculate percentages
- Keep existing rows intact
- Use clean pipe-table syntax with | aligned columns
- Do NOT include any {{PLACEHOLDER}} text
- Mark AI-generated fields with [AI] tag

Today's date: ${now.split("T")[0]}
Product: GreyZone AI SaMD`;

  const tmContent = await callClaude(tmPrompt);
  const tmNewVer = bumpVersion(tmDoc.version);
  storage.updateDocument(tmId, { content: tmContent, version: tmNewVer, status: "draft", updatedAt: now });
  storage.createVersion({ documentId: tmId, version: tmNewVer, content: tmContent, changedBy: "claude-haiku", changeNote: `[AI] Traceability row added for ${storyId}`, storyId, createdAt: now });
  storage.createReviewAction({ storyId, documentId: tmId, action: "ai_drafted", actor: "claude-haiku", comment: `Auto-drafted TM row for ${storyId}. Verify test IDs and hazard links.`, createdAt: now });
  updated.push("TM");

  // 5. Risk Analysis — only if Claude detects a risk signal
  const riskCheckPrompt = `You are a SaMD risk analyst. Based on the following story context, does this change introduce or modify a clinical/patient safety risk that should be documented in the Risk Analysis?

STORY CONTEXT:
${context}

Reply with ONLY: YES or NO, then one sentence explanation.`;

  const riskCheck = await callClaude(riskCheckPrompt);
  const needsRisk = riskCheck.trim().toUpperCase().startsWith("YES");

  if (needsRisk) {
    const raId = getOrCreateDoc("risk-analysis", "Risk Analysis", "dhf-templates/RA-risk-analysis.md", "quality");
    const raDoc = storage.getDocument(raId)!;

    // Extract existing risk rows
    const existingRaRows = (raDoc.content || "")
      .split("\n")
      .filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Hazard ID") && !l.includes("{{")
        && l.replace(/\|/g, "").trim().length > 0);

    const raPrompt = `You are a medical device risk analyst. Generate a complete, clean Risk Analysis document per ISO 14971:2019.

STORY THAT TRIGGERED THIS UPDATE:
${context}

RISK ASSESSMENT: ${riskCheck}

EXISTING RISK ROWS (preserve these exactly, add new row for ${storyId}):
${existingRaRows.join("\n") || "(none yet)"}

Instructions:
- Output the COMPLETE document — all sections: General Info, Scope, Severity scale table, Probability scale table, Risk Level Matrix, Risk Register, AI Evaluation section, Risk-Benefit Summary, Revision History
- For ${storyId}: create hazard ID H-${storyId}, fill all columns based on clinical context
- Severity/probability: be conservative (patient safety first)
- Risk Level = Severity × Probability mapped to Low/Medium/High/Critical
- Use clean pipe-table syntax with | aligned columns
- Do NOT include any {{PLACEHOLDER}} text — fill every field with real content or "N/A"
- Mark AI-generated fields with [AI]
- Risk Level cells: use bold for High/Critical (**High**, **Critical**)

Today's date: ${now.split("T")[0]}
Product: GreyZone AI SaMD
Version: ${bumpVersion(raDoc.version)}`;

    const raContent = await callClaude(raPrompt);
    const raNewVer = bumpVersion(raDoc.version);
    storage.updateDocument(raId, { content: raContent, version: raNewVer, status: "draft", updatedAt: now });
    storage.createVersion({ documentId: raId, version: raNewVer, content: raContent, changedBy: "claude-haiku", changeNote: `[AI] Risk row added for ${storyId}: ${riskCheck.slice(0, 100)}`, storyId, createdAt: now });
    storage.createReviewAction({ storyId, documentId: raId, action: "ai_drafted", actor: "claude-haiku", comment: `Risk detected: ${riskCheck}. AI-drafted entry requires review.`, createdAt: now });
    updated.push("RA");
  } else {
    skipped.push("RA — no clinical risk detected");
  }

  return { updated, skipped };
}

// ── Epic-close handler ─────────────────────────────────────────────────────────

export async function handleEpicClosed(epicId: string): Promise<{ updated: string[]; skipped: string[] }> {
  const updated: string[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  // 1. Fetch epic + all stories
  const epic = await getJiraEpic(epicId);
  if (!epic) { skipped.push("all — could not fetch Jira epic"); return { updated, skipped }; }

  const storyList = epic.stories.map((s: any) => `- ${s.id}: ${s.title} (${s.status})`).join("\n");

  // 2. Fetch PRs for all stories
  const allPRs: any[] = [];
  for (const s of epic.stories) {
    const prs = await getPRsForStory(s.id);
    allPRs.push(...prs);
  }
  const prSummary = allPRs.map(p => `PR #${p.number}: ${p.title}`).join("\n");

  const context = `
Epic: ${epic.id} — ${epic.title}
Description: ${epic.description || "No description"}
Stories (${epic.stories.length}):
${storyList}

Merged PRs:
${prSummary || "No PRs found"}
`.trim();

  // 3. Update SyRS
  const syrsTpl = loadTemplate("SyRS-system-requirements.md");
  const syrsPrompt = `You are a medical device documentation assistant maintaining a System Requirements Specification (SyRS) per ISO 13485.

A Jira Epic has just been closed. Add or update the Epic entry in the SyRS.

EPIC CONTEXT:
${context}

Instructions:
- Return ONLY the Epic block (header + requirements table) to insert
- Use the Epic ID (${epicId}) as the grouping header
- Derive 2-4 system-level requirements from the epic description and stories
- Each requirement gets ID: ${epicId}-SYS-01, ${epicId}-SYS-02, etc.
- Keep requirements at SYSTEM level (what, not how)
- Set Linked Stories to the story IDs listed above

Format:
### ${epicId} — ${epic.title}

**Epic Description:** [description]
**Priority:** [High/Medium/Low]
**Status:** Closed
**Jira Link:** https://dhfgeneration.atlassian.net/browse/${epicId}

#### System Requirements

| Req ID | Requirement Statement | Type | Priority | Acceptance Criteria | Linked Stories |
|---|---|---|---|---|---|
| ${epicId}-SYS-01 | [req] | [type] | [priority] | [criteria] | [story IDs] |`;

  const syrsBlock = await callClaude(syrsPrompt);
  const syrsId = getOrCreateDoc("system-requirements", "System Requirements Specification", "dhf-templates/SyRS-system-requirements.md", "regulatory");
  const syrsDoc = storage.getDocument(syrsId)!;
  const syrsContent = (syrsDoc.content || syrsTpl) + "\n\n---\n\n<!-- AI Draft — Epic " + epicId + " -->\n" + syrsBlock;
  const syrsNewVer = bumpVersion(syrsDoc.version);
  storage.updateDocument(syrsId, { content: syrsContent, version: syrsNewVer, status: "draft", updatedAt: now });
  storage.createVersion({ documentId: syrsId, version: syrsNewVer, content: syrsContent, changedBy: "claude-haiku", changeNote: `[AI] SyRS updated for epic ${epicId}`, storyId: epicId, createdAt: now });
  storage.createReviewAction({ storyId: epicId, documentId: syrsId, action: "ai_drafted", actor: "claude-haiku", comment: `Auto-drafted SyRS section for epic ${epicId}.`, createdAt: now });
  updated.push("SyRS");

  // 4. Run story-level updates for each closed story in the epic
  for (const s of epic.stories) {
    if (s.status?.toLowerCase().includes("done") || s.status?.toLowerCase().includes("closed")) {
      const result = await handleStoryClosed(s.id);
      updated.push(...result.updated.map(d => `${d}(${s.id})`));
      skipped.push(...result.skipped.map(d => `${d}(${s.id})`));
    }
  }

  return { updated, skipped };
}
