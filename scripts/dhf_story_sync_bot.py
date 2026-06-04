#!/usr/bin/env python3
"""
DHF Story Sync Bot — GreyZone AI SaMD DHF Template
====================================================
Triggered by the Jira webhook when a story is marked Done.
Reads all accumulated task context for that story, sends the
full picture to Claude Haiku, and drafts a single coherent
DHF update covering the complete story.

This is the ONLY script that writes to DHF documents.
Task PRs never touch DHF docs — only this script does.

Environment variables:
  ANTHROPIC_API_KEY  — Claude API key (GitHub Secret)
  JIRA_API_TOKEN     — Jira API token (GitHub Secret)
  JIRA_EMAIL         — Jira account email (GitHub Secret)
  GITHUB_TOKEN       — for Issues and commits
  GITHUB_REPOSITORY  — e.g. "Sal2912/samd-dhf-template"
  STORY_ID           — e.g. "DHF-42" (passed by webhook handler)
  JIRA_BASE_URL      — e.g. "https://dhfgeneration.atlassian.net"
"""

import json
import os
import re
import sys
from datetime import date
from pathlib import Path
from textwrap import dedent

import anthropic
import requests
from requests.auth import HTTPBasicAuth

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT              = Path(__file__).parent.parent
DHF               = ROOT / "dhf"
STORY_CONTEXT_DIR = DHF / ".story-context"
REQUIREMENTS_FILE = DHF / "03-design-inputs-outputs.md"
RISK_FILE         = DHF / "02-risk-management-file.md"
TRACEABILITY_FILE = DHF / "05-traceability-matrix.md"

# ── Environment ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
JIRA_API_TOKEN     = os.environ.get("JIRA_API_TOKEN", "")
JIRA_EMAIL         = os.environ.get("JIRA_EMAIL", "")
GITHUB_TOKEN       = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPOSITORY  = os.environ.get("GITHUB_REPOSITORY", "Sal2912/samd-dhf-template")
STORY_ID           = os.environ.get("STORY_ID", "")
JIRA_BASE_URL      = os.environ.get("JIRA_BASE_URL", "https://dhfgeneration.atlassian.net")
TODAY              = date.today().isoformat()
REVIEWER           = "Sal2912"

GH_API     = "https://api.github.com"
GH_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept":        "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

REQ_RE = re.compile(r"\bREQ-\d+\b")
HAZ_RE = re.compile(r"\bH-\d+\b")
TEST_RE = re.compile(r"\bTEST-\d+\b")


# ═══════════════════════════════════════════════════════════════════════════════
# Jira helpers
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_jira_story(story_id: str) -> dict:
    """Fetch story title, description, and acceptance criteria from Jira."""
    if not JIRA_API_TOKEN or not JIRA_EMAIL:
        print("  ⚠️  No Jira credentials — using context file only")
        return {}

    url  = f"{JIRA_BASE_URL}/rest/api/3/issue/{story_id}"
    auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)
    resp = requests.get(url, auth=auth, timeout=10)

    if not resp.ok:
        print(f"  ⚠️  Jira API error {resp.status_code} — using context file only")
        return {}

    data   = resp.json()
    fields = data.get("fields", {})

    # Extract acceptance criteria from description (Atlassian Document Format)
    desc_raw = fields.get("description", {})
    desc_text = extract_adf_text(desc_raw) if isinstance(desc_raw, dict) else str(desc_raw or "")

    return {
        "story_id":              story_id,
        "title":                 fields.get("summary", ""),
        "description":           desc_text,
        "story_points":          fields.get("story_points") or fields.get("customfield_10016"),
        "priority":              fields.get("priority", {}).get("name", ""),
        "labels":                fields.get("labels", []),
        "components":            [c["name"] for c in fields.get("components", [])],
        "fix_versions":          [v["name"] for v in fields.get("fixVersions", [])],
        "acceptance_criteria":   extract_acceptance_criteria(desc_text),
    }


def extract_adf_text(adf: dict) -> str:
    """Recursively extract plain text from Atlassian Document Format."""
    if not adf:
        return ""
    texts = []
    for block in adf.get("content", []):
        for inline in block.get("content", []):
            if inline.get("type") == "text":
                texts.append(inline.get("text", ""))
        texts.append("\n")
    return " ".join(texts).strip()


def extract_acceptance_criteria(description: str) -> str:
    """Extract acceptance criteria section from Jira description."""
    match = re.search(
        r"(?:acceptance criteria|ac|done when)[:\s]*\n(.*?)(?=\n[A-Z]|\Z)",
        description,
        re.IGNORECASE | re.DOTALL,
    )
    return match.group(1).strip() if match else ""


# ═══════════════════════════════════════════════════════════════════════════════
# Claude drafting
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """\
You are a senior regulatory writer specializing in SaMD (Software as a Medical Device) \
documentation under ISO 13485, IEC 62304, ISO 14971, and FDA 21 CFR Part 820.

You are given the complete context of a finished software story — including all task-level \
pull requests, their diffs, and the Jira story description with acceptance criteria. \
Your job is to produce a single, coherent Design History File (DHF) update that covers \
the entire story as one complete regulatory change.

Write precise, unambiguous regulatory language. Never write vague or generic statements. \
Reference the actual functionality implemented. Output only valid JSON — no prose outside it.
"""

def build_story_prompt(ctx: dict, jira: dict) -> str:
    tasks_summary = "\n".join([
        f"  Task {t['task_id']} (PR #{t['pr_number']}): {t['pr_title']}\n"
        f"    Change: {t['change_summary'] or '(not provided)'}\n"
        f"    Clinical context: {t['clinical_context'] or '(not provided)'}\n"
        f"    REQs: {t['req_ids']}  HAZs: {t['haz_ids']}  TESTs: {t['test_ids']}\n"
        f"    New risk flagged: {t['has_new_risk']}  No-risk justification: {t['risk_justification'] or '(none)'}"
        for t in ctx.get("tasks", [])
    ])

    diff_excerpt = ctx.get("combined_diff_excerpt", "")[:5000] or "(no diffs accumulated)"

    return f"""
## Story Context

**Jira Story ID:** {ctx['story_id']}
**Story Title:** {jira.get('title') or ctx['story_id']}
**Story Description / Acceptance Criteria:**
{jira.get('description') or '(not available)'}

**Acceptance Criteria:**
{jira.get('acceptance_criteria') or '(not available)'}

---

## Tasks Completed Under This Story ({ctx.get('task_count', 0)} tasks)

{tasks_summary}

---

## Aggregated DHF Signals Across All Tasks

- All REQ IDs referenced: {ctx.get('all_req_ids', [])}
- All Hazard IDs referenced: {ctx.get('all_haz_ids', [])}
- All Test IDs referenced: {ctx.get('all_test_ids', [])}
- Any task flagged new requirement needed: {ctx.get('has_any_new_req', False)}
- Any task flagged new risk: {ctx.get('has_any_new_risk', False)}
- Combined change summary: {ctx.get('combined_change_summary', '').strip()}
- Combined clinical context: {ctx.get('combined_clinical_context', '').strip()}

---

## Combined Code Diff (all tasks, first 5000 chars)

```diff
{diff_excerpt}
```

---

## Your Task

Produce ONE unified DHF update for this complete story. Do not create separate entries \
per task — synthesize everything into a single coherent regulatory record.

Output ONLY this JSON object:

{{
  "requirement_statement": "The system shall... [precise, testable, unambiguous — covers the full story]",
  "requirement_category": "Functional | Performance | Security | Usability | Interface",
  "requirement_rationale": "One sentence explaining the clinical or safety basis.",
  "linked_req_ids": ["REQ-001"],
  "hazard_statement": "ISO 14971 hazard description covering the full story's risk surface. Write 'NO NEW HAZARD' with justification if truly no new risk.",
  "hazardous_situation": "Circumstances in which a person is exposed to the hazard. 'N/A' if no new hazard.",
  "potential_harm": "Injury or damage to health. 'N/A' if no new hazard.",
  "risk_justification": "If no new risk: regulatory justification. If new risk: 'NEW HAZARD — RISK ASSESSMENT REQUIRED'.",
  "linked_haz_ids": ["H-001"],
  "linked_test_ids": ["TEST-001"],
  "traceability_rationale": "How requirement, hazard, and tests connect for this story.",
  "launchdarkly_flag_note": "One sentence describing what clinical capability this LaunchDarkly flag enables when turned ON — for the DHF record.",
  "reasoning_summary": "3-4 sentences: what you inferred, what assumptions you made, what the reviewer must verify. Be specific about the clinical risk surface.",
  "confidence": "high | medium | low",
  "confidence_reason": "Why you rated confidence at that level — what context was missing or ambiguous?"
}}
"""


def call_claude(ctx: dict, jira: dict) -> dict:
    """Call Claude Haiku with full story context. Returns parsed JSON dict."""
    if not ANTHROPIC_API_KEY:
        print("  ⚠️  No ANTHROPIC_API_KEY — using placeholders")
        return _placeholder_draft(ctx)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    print("  🤖 Calling Claude Haiku with full story context...")

    try:
        msg = client.messages.create(
            model      = "claude-haiku-4-5",
            max_tokens = 1500,
            system     = SYSTEM_PROMPT,
            messages   = [{"role": "user", "content": build_story_prompt(ctx, jira)}],
        )
        raw = msg.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        draft = json.loads(raw)
        print(f"  ✅ Claude draft complete (confidence: {draft.get('confidence', '?')})")
        return draft
    except Exception as e:
        print(f"  ⚠️  Claude failed: {e} — using placeholders")
        return _placeholder_draft(ctx)


def _placeholder_draft(ctx: dict) -> dict:
    return {
        "requirement_statement":  f"The system shall [REVIEW REQUIRED — Story {ctx['story_id']}]",
        "requirement_category":   "Functional",
        "requirement_rationale":  "[REVIEW REQUIRED]",
        "linked_req_ids":         ctx.get("all_req_ids", []),
        "hazard_statement":       "[REVIEW REQUIRED]",
        "hazardous_situation":    "[REVIEW REQUIRED]",
        "potential_harm":         "[REVIEW REQUIRED]",
        "risk_justification":     "[REVIEW REQUIRED]",
        "linked_haz_ids":         ctx.get("all_haz_ids", []),
        "linked_test_ids":        ctx.get("all_test_ids", []),
        "traceability_rationale": "[REVIEW REQUIRED]",
        "launchdarkly_flag_note": "[REVIEW REQUIRED]",
        "reasoning_summary":      "Claude API key not configured. All fields require manual review.",
        "confidence":             "low",
        "confidence_reason":      "No AI drafting — placeholder only.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DHF document writers (story-level — same pattern as task bot but richer)
# ═══════════════════════════════════════════════════════════════════════════════

def update_frontmatter_date(content: str) -> str:
    return re.sub(r"(last_reviewed:\s*)\S+", rf"\g<1>{TODAY}", content, count=1)

def next_req_id(content: str) -> str:
    nums = [int(r.split("-")[1]) for r in REQ_RE.findall(content)] or [0]
    return f"REQ-{max(nums) + 1:03d}"

def next_haz_id(content: str) -> str:
    nums = [int(h.split("-")[1]) for h in HAZ_RE.findall(content)] or [0]
    return f"H-{max(nums) + 1:03d}"

def id_exists(id_str: str, content: str) -> bool:
    return bool(re.search(rf"\b{re.escape(id_str)}\b", content))


def write_requirement(req_id: str, ctx: dict, draft: dict) -> None:
    content  = REQUIREMENTS_FILE.read_text()
    haz_ids  = ", ".join(draft.get("linked_haz_ids") or []) or "—"
    story_ref = f"Story {ctx['story_id']}"

    new_row = (
        f"| {req_id} "
        f"| {draft['requirement_category']} "
        f"| {draft['requirement_statement']} "
        f"| {story_ref} "
        f"| Must-have "
        f"| {haz_ids} |\n"
        f"<!-- Claude draft · {story_ref} · {TODAY} · "
        f"Rationale: {draft['requirement_rationale']} · "
        f"Confidence: {draft.get('confidence','?')} · "
        f"Awaiting approval @{REVIEWER} -->\n"
    )

    anchor = "**Requirement categories:**"
    content = (
        content.replace(anchor, new_row + anchor)
        if anchor in content
        else content.replace("## 5. Review History", f"{new_row}\n## 5. Review History")
    )
    REQUIREMENTS_FILE.write_text(update_frontmatter_date(content))
    print(f"  ✅ Wrote requirement {req_id}")


def write_hazard(haz_id: str, ctx: dict, draft: dict) -> None:
    content   = RISK_FILE.read_text()
    story_ref = f"Story {ctx['story_id']}"
    no_new    = "NO NEW HAZARD" in draft.get("hazard_statement", "").upper()

    if no_new:
        h_text = f"[No new hazard — {draft['hazard_statement']}]"
        sit    = harm = sev = prob = risk_score = "N/A"
        ctrl   = f"Existing controls sufficient: {draft['risk_justification']}"
        resid  = "Acceptable"
    else:
        h_text     = draft["hazard_statement"]
        sit        = draft["hazardous_situation"]
        harm       = draft["potential_harm"]
        sev = prob = risk_score = "[? — ASSIGN DURING REVIEW]"
        ctrl       = "[RC-XXX — ASSIGN DURING REVIEW]"
        resid      = "[REVIEW REQUIRED]"

    new_row = (
        f"| {haz_id} | {h_text} | {sit} | {sit} | {harm} "
        f"| {sev} | {prob} | {risk_score} | {ctrl} | {resid} |\n"
        f"<!-- Claude draft · {story_ref} · {TODAY} · "
        f"Confidence: {draft.get('confidence','?')} · "
        f"Awaiting approval @{REVIEWER} -->\n"
    )

    justification = dedent(f"""
        <!-- DHF STORY SYNC BOT — RISK RECORD ({TODAY})
        Story: {story_ref} — {ctx.get('task_count',0)} tasks
        Claude's justification: {draft['risk_justification']}
        Claude's reasoning: {draft['reasoning_summary']}
        Confidence: {draft.get('confidence','?')} — {draft.get('confidence_reason','')}
        LaunchDarkly flag note: {draft.get('launchdarkly_flag_note','')}
        Action: @{REVIEWER} must approve via GitHub Issue before flag can be enabled.
        -->
    """).strip()

    anchor = "**Risk scoring guide:**"
    content = (
        content.replace(anchor, new_row + anchor)
        if anchor in content
        else content.replace("## 3. Risk Controls Summary",
                             f"{new_row}\n## 3. Risk Controls Summary")
    )
    review_anchor = "## 6. Review History"
    if review_anchor in content:
        content = content.replace(review_anchor, justification + f"\n\n{review_anchor}")
    RISK_FILE.write_text(update_frontmatter_date(content))
    print(f"  ✅ Wrote hazard {haz_id}")


def write_traceability(req_id: str, haz_id: str, ctx: dict, draft: dict) -> None:
    content   = TRACEABILITY_FILE.read_text()
    story_ref = f"Story {ctx['story_id']}"
    tests_str = ", ".join(draft.get("linked_test_ids") or []) or "[TEST-XXX — REVIEW]"

    new_row = (
        f"| [UN-STORY] | {req_id} | [DO-XXX] | {haz_id} | [RC-XXX] | {tests_str} | [VAL-XXX] |\n"
        f"<!-- {story_ref} · {TODAY} · {draft['traceability_rationale']} · @{REVIEWER} approval required -->\n"
    )

    anchor = "## Traceability Rules"
    content = (
        content.replace(anchor, new_row + anchor)
        if anchor in content
        else content + f"\n{new_row}"
    )
    TRACEABILITY_FILE.write_text(update_frontmatter_date(content))
    print(f"  ✅ Wrote traceability row: {req_id} ↔ {haz_id} ↔ {tests_str}")


# ═══════════════════════════════════════════════════════════════════════════════
# GitHub Issue
# ═══════════════════════════════════════════════════════════════════════════════

def open_review_issue(req_id: str, haz_id: str, ctx: dict, jira: dict, draft: dict) -> str:
    story_ref  = f"Story {ctx['story_id']}"
    no_new     = "NO NEW HAZARD" in draft.get("hazard_statement", "").upper()
    confidence = draft.get("confidence", "?")
    conf_emoji = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(confidence, "⚪")

    task_list = "\n".join([
        f"- [{t['task_id']}] PR #{t['pr_number']}: {t['pr_title']}"
        for t in ctx.get("tasks", [])
    ])

    title = f"📋 DHF Story Review: {ctx['story_id']} — {jira.get('title', req_id)}"

    body = dedent(f"""
        ## DHF Story-Level Review Required

        Jira story **{ctx['story_id']}** has been marked **Done**.
        Claude Haiku has drafted a single DHF update covering all {ctx.get('task_count', 0)} tasks.
        **@{REVIEWER}** — review Claude's draft below and comment `approved` to enable the LaunchDarkly flag.

        ---

        ## Story Summary

        | Field | Value |
        |---|---|
        | **Jira Story** | [{ctx['story_id']}]({JIRA_BASE_URL}/browse/{ctx['story_id']}) |
        | **Title** | {jira.get('title', '—')} |
        | **Tasks completed** | {ctx.get('task_count', 0)} |
        | **Claude confidence** | {conf_emoji} {confidence.upper()} |

        ### Tasks in this story
        {task_list}

        ---

        ## Claude's Reasoning

        > {draft['reasoning_summary']}

        **Confidence:** {conf_emoji} {confidence} — {draft.get('confidence_reason', '')}

        ---

        ## Drafted DHF Content

        ### Requirement — `{req_id}`

        | Field | Claude's Draft |
        |---|---|
        | **Statement** | {draft['requirement_statement']} |
        | **Category** | {draft['requirement_category']} |
        | **Rationale** | {draft['requirement_rationale']} |

        ### Hazard — `{haz_id}`

        | Field | Claude's Draft |
        |---|---|
        | **Hazard statement** | {draft['hazard_statement']} |
        | **Hazardous situation** | {draft['hazardous_situation']} |
        | **Potential harm** | {draft['potential_harm']} |
        | **Risk justification** | {draft['risk_justification']} |

        ### Traceability

        | Field | Value |
        |---|---|
        | **Requirement** | `{req_id}` |
        | **Hazard** | `{haz_id}` |
        | **Tests** | {", ".join(draft.get('linked_test_ids') or []) or "None — add TEST-XXX"} |
        | **Rationale** | {draft['traceability_rationale']} |

        ### LaunchDarkly Flag Note (for DHF record)
        > {draft.get('launchdarkly_flag_note', '[REVIEW REQUIRED]')}

        ---

        ## Reviewer Checklist

        {"**No new hazard drafted** — verify the risk justification is sufficient." if no_new else "**New hazard drafted** — full risk assessment required before flag enable."}

        - [ ] Requirement statement is precise and testable
        - [ ] Hazard statement follows ISO 14971 language
        - [ ] Severity and probability scores assigned in risk file
        - [ ] Risk control (RC-XXX) assigned or confirmed sufficient
        - [ ] All test cases linked (TEST-XXX)
        - [ ] Traceability placeholders resolved (UN-XXX, DO-XXX, VAL-XXX)
        - [ ] LaunchDarkly flag note accurately describes the clinical capability

        ## To Approve and Enable LaunchDarkly Flag

        1. Complete the checklist above
        2. Comment **`approved`** on this Issue
        3. The flag-enable PR will automatically unblock

        ---
        *Drafted by Claude Haiku · {ctx.get('task_count',0)} tasks synthesized · GreyZone AI DHF Sync Bot · {TODAY}*
    """).strip()

    if not GITHUB_TOKEN:
        print("  ⚠️  No GITHUB_TOKEN — skipping Issue creation")
        return ""

    resp = requests.post(
        f"{GH_API}/repos/{GITHUB_REPOSITORY}/issues",
        headers=GH_HEADERS,
        json={
            "title":     title,
            "body":      body,
            "labels":    ["dhf-review", "story-complete", "awaiting-approval", "automated"],
            "assignees": [REVIEWER],
        },
        timeout=10,
    )
    if resp.ok:
        url = resp.json().get("html_url", "")
        print(f"  🔴 Review Issue opened: {url}")
        return url
    else:
        print(f"  ❌ Failed to open Issue: {resp.status_code}")
        return ""


def mark_story_context_done(story_id: str, ctx: dict, issue_url: str) -> None:
    ctx["status"]       = "dhf-review-pending"
    ctx["issue_url"]    = issue_url
    ctx["dhf_updated_at"] = TODAY
    path = STORY_CONTEXT_DIR / f"{story_id}.json"
    path.write_text(json.dumps(ctx, indent=2))
    print(f"  💾 Story context status → dhf-review-pending")


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 60)
    print("DHF Story Sync Bot — GreyZone AI (Claude Haiku)")
    print(f"Story: {STORY_ID}")
    print("=" * 60)

    if not STORY_ID:
        print("❌ No STORY_ID environment variable set. Exiting.")
        sys.exit(1)

    # 1. Load accumulated task context
    ctx_path = STORY_CONTEXT_DIR / f"{STORY_ID}.json"
    if not ctx_path.exists():
        print(f"❌ No context file found for {STORY_ID}.")
        print(f"   Expected: {ctx_path}")
        print("   Ensure task PRs include 'STORY: DHF-XX' in their descriptions.")
        sys.exit(1)

    ctx = json.loads(ctx_path.read_text())
    print(f"\n📋 Loaded context: {ctx.get('task_count', 0)} tasks for {STORY_ID}")

    # 2. Fetch Jira story details
    print("\n🔗 Fetching Jira story details...")
    jira = fetch_jira_story(STORY_ID)
    print(f"   Title: {jira.get('title', '(not fetched)')}")

    # 3. Call Claude with full story context
    draft = call_claude(ctx, jira)

    # 4. Determine DHF IDs
    req_content  = REQUIREMENTS_FILE.read_text()
    risk_content = RISK_FILE.read_text()

    # If existing REQ/HAZ IDs were referenced across tasks, use first ones
    # Otherwise create new ones
    existing_reqs = ctx.get("all_req_ids", [])
    existing_hazs = ctx.get("all_haz_ids", [])

    if existing_reqs and not ctx.get("has_any_new_req"):
        req_id = existing_reqs[0]
        print(f"\n  🔗 Updating existing requirement {req_id}")
    else:
        req_id = next_req_id(req_content)
        print(f"\n  ✅ Creating new requirement {req_id}")

    if existing_hazs and not ctx.get("has_any_new_risk"):
        haz_id = existing_hazs[0]
        print(f"  🔗 Updating existing hazard {haz_id}")
    else:
        haz_id = next_haz_id(risk_content)
        print(f"  ✅ Creating new hazard {haz_id}")

    # 5. Write DHF documents
    print("\n📝 Writing DHF documents...")
    write_requirement(req_id, ctx, draft)
    write_hazard(haz_id, ctx, draft)
    write_traceability(req_id, haz_id, ctx, draft)

    # 6. Open review Issue
    print("\n📬 Opening GitHub review Issue...")
    issue_url = open_review_issue(req_id, haz_id, ctx, jira, draft)

    # 7. Mark story context as pending review
    mark_story_context_done(STORY_ID, ctx, issue_url)

    print(f"\n{'=' * 60}")
    print(f"Story {STORY_ID} DHF update complete.")
    print(f"  Requirement : {req_id}")
    print(f"  Hazard      : {haz_id}")
    print(f"  Issue       : {issue_url}")
    print(f"  Status      : Awaiting @{REVIEWER} approval before LaunchDarkly flag enable")
    print("=" * 60)


if __name__ == "__main__":
    main()
