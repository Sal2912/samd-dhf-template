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

// ── Product Context (used in all prompts) ──────────────────────────────────────
// Update this block to match your actual product. This context is injected into
// every Claude prompt to ensure domain-accurate, regulatory-grade output.
const PRODUCT_CONTEXT = `
PRODUCT: NeuroScan AI
CATEGORY: Software as a Medical Device (SaMD) — AI/ML-based Computer-Aided Detection (CADe)
FUNCTION: Deep learning model that analyzes brain MRI images (T1, T2, FLAIR sequences) to 
  automatically detect and localize intracranial tumors (gliomas, meningiomas, metastases).
  The system outputs a bounding box overlay, tumor probability score (0-100%), and confidence 
  level for each detected region. Results are presented as a secondary read — the radiologist 
  makes the final diagnostic decision.
INTENDED USE: Assist radiologists in detecting brain tumors in adult patients (18+) undergoing 
  routine or follow-up MRI brain scans in hospital radiology departments.
INTENDED USER: Licensed radiologists and neuroradiologists in clinical settings.
USE ENVIRONMENT: Hospital PACS/RIS integrated workstation, connected to MRI scanner DICOM output.
REGULATORY PATHWAY: FDA 510(k) predicate-based clearance (predicate: existing CADe devices), 
  CE Mark Class IIb under MDR 2017/745, ISO 13485 QMS.
APPLICABLE STANDARDS: IEC 62304 (SW lifecycle), ISO 14971 (risk mgmt), IEC 62366 (usability), 
  ISO 13485 (QMS), DICOM, HL7 FHIR, FDA AI/ML-Based SaMD Action Plan.
KEY SAFETY CONCERNS:
  1. FALSE NEGATIVES — algorithm misses a tumor → delayed diagnosis → patient harm
  2. FALSE POSITIVES — algorithm flags normal tissue → unnecessary biopsy/intervention
  3. ALGORITHM BIAS — underperformance on underrepresented MRI scanners, patient demographics, 
     or rare tumor subtypes
  4. CONFIDENCE MISINTERPRETATION — radiologist over-relies on AI score, abandons independent read
  5. DICOM/PACS INTEGRATION FAILURE — images not transmitted correctly → wrong patient data
  6. MODEL DRIFT — algorithm degrades over time as scanner hardware or protocols change
  7. CYBERSECURITY — unauthorized model access or manipulation of AI output
CRITICAL REQUIREMENT: The system must NEVER suppress or replace the radiologist's independent 
  judgment. All AI outputs are advisory only and must be clearly labeled as such in the UI.
`.trim();

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
  const srsPrompt = `You are a senior regulatory affairs engineer writing a Software Requirements Specification (SRS) for an FDA 510(k) submission under IEC 62304 and ISO 13485.

PRODUCT CONTEXT:
${PRODUCT_CONTEXT}

A Jira story has just been closed. Write the SRS entry for this story.

STORY CONTEXT:
${context}

Instructions:
- Write ONLY the story block for ${storyId} — no preamble, no explanation
- Requirement Statement: precise, testable, written in "The system shall..." format
- Acceptance Criteria: specific, measurable conditions a QA engineer can verify
- Type: Safety if it touches AI output, confidence scoring, DICOM, or patient data; Functional for core features; Interface for PACS/DICOM/HL7; Non-Functional for performance/security
- Consider the product's key safety concerns (false negatives, algorithm bias, DICOM failures) when writing the requirement
- Keep each field to 2-4 sentences. Be precise, not verbose.
- Return ONLY the markdown block, no extra text

#### ${storyId} — ${story.title}

| Field | Value |
|---|---|
| Requirement ID | ${storyId} |
| Type | [Safety / Functional / Interface / Non-Functional] |
| Priority | ${story.priority} |
| Status | Draft |
| Source | https://dhfgeneration.atlassian.net/browse/${storyId} |

**Requirement Statement:**
The system shall [precise, testable requirement derived from story context]

**Acceptance Criteria:**
[2-4 specific, measurable acceptance criteria a QA engineer can verify]

**Notes / Constraints:**
[Any safety constraints, regulatory notes, or algorithm-specific considerations. Reference relevant standard if applicable.]`;

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

  const tmPrompt = `You are a senior regulatory affairs engineer maintaining a bidirectional Traceability Matrix for an FDA 510(k) submission (IEC 62304 §5.1, ISO 13485 §7.3, 21 CFR 820.30).

PRODUCT CONTEXT:
${PRODUCT_CONTEXT}

Generate a complete, professionally formatted Traceability Matrix document in markdown.

STORY BEING ADDED:
${context}

EXISTING TABLE ROWS (preserve exactly, add new row for ${storyId}):
${existingTmRows.join("\n") || "(none yet)"}

Instructions:
- Output the COMPLETE document with all sections
- For ${storyId}:
  * Sys Req ID: derive from Epic ID (${story.epicId || "SYS-TBD"}) + "-SYS-01" format
  * SW Req ID: ${storyId}
  * GitHub PRs: extract numbers from context or write ⚠ TBD
  * Test IDs: reference IEC 62304 unit/integration test naming (UT-${storyId}, IT-${storyId}) — mark as ⚠ TBD until verified
  * Hazard IDs: link to H-${storyId} if risk was detected, else "none"
  * Verification Status: Pending
- Coverage Summary: calculate % based on row count
- Gaps section: flag any missing test IDs or hazard links
- Use clean pipe-table syntax, no {{PLACEHOLDER}} text
- Mark AI-inferred fields with [AI]
- Add a note at the top: "\u26a0 AI-generated draft. Requires QA review before approval."

Today's date: ${now.split("T")[0]}
Document version: ${bumpVersion(tmDoc.version)}`;

  const tmContent = await callClaude(tmPrompt);
  const tmNewVer = bumpVersion(tmDoc.version);
  storage.updateDocument(tmId, { content: tmContent, version: tmNewVer, status: "draft", updatedAt: now });
  storage.createVersion({ documentId: tmId, version: tmNewVer, content: tmContent, changedBy: "claude-haiku", changeNote: `[AI] Traceability row added for ${storyId}`, storyId, createdAt: now });
  storage.createReviewAction({ storyId, documentId: tmId, action: "ai_drafted", actor: "claude-haiku", comment: `Auto-drafted TM row for ${storyId}. Verify test IDs and hazard links.`, createdAt: now });
  updated.push("TM");

  // 5. Risk Analysis — only if Claude detects a risk signal
  const riskCheckPrompt = `You are a senior risk management engineer for an AI-based brain tumor detection SaMD, regulated under ISO 14971:2019 and FDA guidance on AI/ML-based SaMD.

PRODUCT CONTEXT:
${PRODUCT_CONTEXT}

A Jira story was just closed. Determine whether this change introduces or modifies a risk that must be documented in the Risk Analysis.

STORY CONTEXT:
${context}

Evaluate against these specific risk categories for this product:
1. Does it affect AI model output, confidence scores, or detection thresholds? (false negative/positive risk)
2. Does it change how results are displayed to the radiologist? (confidence misinterpretation risk)
3. Does it touch DICOM ingestion, patient data, or image preprocessing? (data integrity / wrong patient risk)
4. Does it modify algorithm behavior, training data, or model versioning? (algorithm bias / model drift risk)
5. Does it affect system access controls or data transmission? (cybersecurity risk)
6. Does it change any safety-critical UI element or workflow step? (use error risk per IEC 62366)

Reply with ONLY: YES or NO, then one precise sentence naming the specific risk category and mechanism.`;

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

    const raPrompt = `You are a senior risk management engineer. Generate a complete, professional Risk Analysis document per ISO 14971:2019 for an FDA 510(k) submission.

PRODUCT CONTEXT:
${PRODUCT_CONTEXT}

STORY THAT TRIGGERED THIS UPDATE:
${context}

RISK ASSESSMENT DECISION: ${riskCheck}

EXISTING RISK ROWS (preserve exactly, add new row for ${storyId}):
${existingRaRows.join("\n") || "(none yet)"}

Instructions:
- Output the COMPLETE document with ALL sections
- For the new hazard (H-${storyId}):
  * Hazard Description: the technical root cause (e.g. "Confidence threshold miscalibration")
  * Hazardous Situation: the clinical scenario (e.g. "Radiologist presented with high-confidence score for false negative detection")
  * Harm: specific patient outcome (e.g. "Delayed diagnosis of malignant glioma leading to disease progression")
  * Severity: use ISO 14971 scale 1-5. Brain tumor misdiagnosis = 4 (Critical) or 5 (Catastrophic) by default
  * Probability: assess based on how often this code path executes in clinical use
  * Risk Level: Severity × Probability → Low / Medium / **High** / **Critical**
  * Mitigation: specific, implementable controls (e.g. "Mandatory confidence threshold warning UI", "Radiologist override required for low-confidence results", "IEC 62304 unit test coverage ≥95%")
  * Residual Risk: after mitigation, reassess level
- All High/Critical risks must have mitigations — no exceptions
- Severity/probability: be conservative. When in doubt, go higher.
- Use bold for **High** and **Critical** risk levels in the table
- Do NOT include any {{PLACEHOLDER}} text — every field must have real content
- Mark AI-generated fields with [AI]
- Add reviewer note: "⚠ AI-generated draft. Risk entries must be reviewed by a qualified risk management engineer before approval."

Today's date: ${now.split("T")[0]}
Document version: ${bumpVersion(raDoc.version)}`;

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
