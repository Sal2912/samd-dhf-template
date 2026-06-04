#!/usr/bin/env python3
"""
DHF Sync Bot — GreyZone AI SaMD DHF Template
Claude Haiku-Powered Edition
=============================================
Triggered on every PR to main. Reads the ## DHF Impact block from the PR
description, uses Claude Haiku to draft regulatory-grade document language,
then automatically:

  1. Updates or creates requirement entries (dhf/03-design-inputs-outputs.md)
  2. Updates or creates hazard entries   (dhf/02-risk-management-file.md)
  3. Links test cases wherever TEST-XXX is referenced
  4. Updates the traceability matrix     (dhf/05-traceability-matrix.md)
  5. If no risk is linked → Claude drafts a hazard statement + justification
     in proper ISO 14971 language, then opens a GitHub Issue for human review
  6. Blocks the merge until a designated reviewer approves via Issue comment

Human review gate:
  - Every new or modified DHF entry opens a GitHub Issue
  - The Issue contains Claude's full draft + reasoning
  - @Sal2912 must comment "approved" (case-insensitive) on the Issue
  - A second workflow (dhf-review-gate.yml) watches for that comment
    and marks the PR check as passed

Environment variables (set by GitHub Actions):
  ANTHROPIC_API_KEY  — Claude API key (stored as GitHub Secret)
  GITHUB_TOKEN       — for Issues and PR comments
  GITHUB_REPOSITORY  — e.g. "Sal2912/samd-dhf-template"
  PR_NUMBER          — pull request number
  PR_TITLE           — pull request title
  PR_BODY            — full PR description
  PR_AUTHOR          — GitHub login of PR author
  PR_DIFF            — unified diff of the PR (passed by workflow)
"""

import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from textwrap import dedent

import anthropic
import requests

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT               = Path(__file__).parent.parent
DHF                = ROOT / "dhf"
REQUIREMENTS_FILE  = DHF / "03-design-inputs-outputs.md"
RISK_FILE          = DHF / "02-risk-management-file.md"
TRACEABILITY_FILE  = DHF / "05-traceability-matrix.md"

# ── Environment ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN       = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPOSITORY  = os.environ.get("GITHUB_REPOSITORY", "Sal2912/samd-dhf-template")
PR_NUMBER          = os.environ.get("PR_NUMBER", "")
PR_TITLE           = os.environ.get("PR_TITLE", "No title")
PR_BODY            = os.environ.get("PR_BODY", "")
PR_AUTHOR          = os.environ.get("PR_AUTHOR", "unknown")
PR_DIFF            = os.environ.get("PR_DIFF", "")
TODAY              = date.today().isoformat()
REVIEWER           = "Sal2912"   # designated DHF reviewer

GH_API     = "https://api.github.com"
GH_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept":        "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# ── Regex ──────────────────────────────────────────────────────────────────────
REQ_RE  = re.compile(r"\bREQ-\d+\b")
HAZ_RE  = re.compile(r"\bH-\d+\b")
TEST_RE = re.compile(r"\bTEST-\d+\b")


# ═══════════════════════════════════════════════════════════════════════════════
# Data structures
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DHFImpact:
    raw_block:         str  = ""
    requirements:      list[str] = field(default_factory=list)
    hazards:           list[str] = field(default_factory=list)
    tests:             list[str] = field(default_factory=list)
    change_summary:    str  = ""
    new_req_statement: str  = ""
    new_req_category:  str  = ""
    new_req_source:    str  = ""
    risk_justification: str = ""
    has_new_req:       bool = False
    has_new_risk:      bool = False


@dataclass
class ClaudeDraft:
    """All content drafted by Claude for a single PR."""
    requirement_statement:  str = ""
    requirement_category:   str = ""
    requirement_rationale:  str = ""
    hazard_statement:       str = ""
    hazardous_situation:    str = ""
    potential_harm:         str = ""
    risk_justification:     str = ""
    traceability_rationale: str = ""
    reasoning_summary:      str = ""   # Claude explains its decisions


@dataclass
class BotResult:
    reqs_updated:            list[str] = field(default_factory=list)
    reqs_created:            list[str] = field(default_factory=list)
    hazards_updated:         list[str] = field(default_factory=list)
    hazards_created:         list[str] = field(default_factory=list)
    tests_linked:            list[str] = field(default_factory=list)
    traceability_rows_added: int       = 0
    issues_opened:           list[str] = field(default_factory=list)
    warnings:                list[str] = field(default_factory=list)
    errors:                  list[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Claude drafting layer
# ═══════════════════════════════════════════════════════════════════════════════

SYSTEM_PROMPT = """\
You are a regulatory writing assistant specializing in SaMD (Software as a Medical Device) \
documentation under ISO 13485, IEC 62304, ISO 14971, and FDA 21 CFR Part 820.

Your job is to read a software pull request description and code diff, then draft \
regulatory-grade content for the Design History File (DHF). You write precise, \
unambiguous regulatory language — not marketing language, not vague descriptions.

Always output valid JSON matching the schema provided. Never add prose outside the JSON.
"""

def build_claude_prompt(impact: DHFImpact) -> str:
    diff_excerpt = PR_DIFF[:3000] if PR_DIFF else "(no diff provided)"
    return f"""
A software engineer has opened a pull request on a SaMD product. \
Analyze it and draft the required DHF content.

## Pull Request Context

**Title:** {PR_TITLE}
**Author:** {PR_AUTHOR}
**Change summary (engineer-provided):** {impact.change_summary or "(none provided)"}

**DHF Impact block:**
```
{impact.raw_block or "(empty)"}
```

**Code diff (first 3000 chars):**
```diff
{diff_excerpt}
```

**Existing requirement IDs referenced:** {impact.requirements or "none"}
**Existing hazard IDs referenced:** {impact.hazards or "none"}
**Test IDs referenced:** {impact.tests or "none"}
**Engineer stated new requirement needed:** {impact.has_new_req}
**Engineer stated new risk exists:** {impact.has_new_risk}
**Engineer's risk justification:** {impact.risk_justification or "(none provided)"}

## Your Task

Draft the following DHF content in proper regulatory language. \
Output ONLY a JSON object with these exact keys:

{{
  "requirement_statement": "The system shall... [precise, testable, unambiguous]",
  "requirement_category": "Functional | Performance | Security | Usability | Interface",
  "requirement_rationale": "One sentence explaining the clinical or safety basis for this requirement.",
  "hazard_statement": "Description of the hazard introduced or affected by this change. \
Use ISO 14971 language: identify the energy/condition that could cause harm. \
Write 'NO NEW HAZARD' if the change genuinely introduces no new risk, with justification.",
  "hazardous_situation": "The circumstances in which a person is exposed to the hazard. \
Write 'N/A' if hazard_statement is 'NO NEW HAZARD'.",
  "potential_harm": "The injury or damage to health of a patient, user, or third party. \
Write 'N/A' if hazard_statement is 'NO NEW HAZARD'.",
  "risk_justification": "If no new risk: regulatory-grade justification for why existing \
controls are sufficient. If new risk: write 'NEW HAZARD REQUIRES RISK ASSESSMENT'.",
  "traceability_rationale": "One sentence explaining how this change links \
requirement → hazard → test in the traceability matrix.",
  "reasoning_summary": "2-3 sentences explaining your reasoning to the human reviewer. \
What did you infer from the diff? What assumptions did you make? What should the reviewer verify?"
}}

Rules:
- requirement_statement must start with "The system shall"
- hazard_statement must follow ISO 14971 style (energy/condition → situation → harm chain)
- Be specific — reference the actual functionality changed, not generic placeholders
- If the diff is not enough to determine risk, say so explicitly in reasoning_summary
- Do not hallucinate clinical details not present in the PR context
"""


def call_claude(impact: DHFImpact) -> ClaudeDraft:
    """Call Claude Haiku to draft regulatory content. Returns ClaudeDraft."""
    if not ANTHROPIC_API_KEY:
        print("  ⚠️  No ANTHROPIC_API_KEY — falling back to template placeholders")
        return ClaudeDraft(
            requirement_statement  = f"The system shall [REVIEW REQUIRED — no Claude key]: {impact.change_summary or PR_TITLE}",
            requirement_category   = impact.new_req_category or "Functional",
            requirement_rationale  = "[Review required — Claude API key not configured]",
            hazard_statement       = "[REVIEW REQUIRED — Claude API key not configured]",
            hazardous_situation    = "[REVIEW REQUIRED]",
            potential_harm         = "[REVIEW REQUIRED]",
            risk_justification     = impact.risk_justification or "[REVIEW REQUIRED]",
            traceability_rationale = "[REVIEW REQUIRED]",
            reasoning_summary      = "Claude API key not configured. All fields require manual review.",
        )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    print("  🤖 Calling Claude Haiku to draft regulatory content...")
    try:
        message = client.messages.create(
            model      = "claude-haiku-4-5",   # cheapest Claude — ~$0.001 per run
            max_tokens = 1024,
            system     = SYSTEM_PROMPT,
            messages   = [{"role": "user", "content": build_claude_prompt(impact)}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown code fences if Claude wrapped the JSON
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)
        draft = ClaudeDraft(
            requirement_statement  = data.get("requirement_statement", "[REVIEW]"),
            requirement_category   = data.get("requirement_category", "Functional"),
            requirement_rationale  = data.get("requirement_rationale", "[REVIEW]"),
            hazard_statement       = data.get("hazard_statement", "[REVIEW]"),
            hazardous_situation    = data.get("hazardous_situation", "[REVIEW]"),
            potential_harm         = data.get("potential_harm", "[REVIEW]"),
            risk_justification     = data.get("risk_justification", "[REVIEW]"),
            traceability_rationale = data.get("traceability_rationale", "[REVIEW]"),
            reasoning_summary      = data.get("reasoning_summary", "[REVIEW]"),
        )
        print("  ✅ Claude draft complete")
        return draft

    except (json.JSONDecodeError, KeyError, anthropic.APIError) as e:
        print(f"  ⚠️  Claude call failed: {e} — falling back to placeholders")
        return ClaudeDraft(
            requirement_statement  = f"The system shall [REVIEW REQUIRED]: {impact.change_summary or PR_TITLE}",
            requirement_category   = "Functional",
            hazard_statement       = "[REVIEW REQUIRED — Claude call failed]",
            reasoning_summary      = f"Claude call failed: {e}. All fields require manual review.",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Parsing
# ═══════════════════════════════════════════════════════════════════════════════

def parse_dhf_impact_block(pr_body: str) -> DHFImpact | None:
    match = re.search(
        r"##\s+DHF\s+Impact\s*\n(.*?)(?=\n##|\Z)",
        pr_body,
        re.DOTALL | re.IGNORECASE,
    )
    if not match:
        return None

    block = match.group(1).strip()
    impact = DHFImpact(raw_block=block)

    def field(key: str) -> str:
        m = re.search(rf"^\s*{key}\s*:\s*(.+)$", block, re.MULTILINE | re.IGNORECASE)
        return m.group(1).strip() if m else ""

    req_raw  = field("REQ")
    haz_raw  = field("RISK")
    test_raw = field("TEST")

    impact.requirements = REQ_RE.findall(req_raw)  if req_raw  else []
    impact.hazards      = HAZ_RE.findall(haz_raw)  if haz_raw  else []
    impact.tests        = TEST_RE.findall(test_raw) if test_raw else []

    impact.change_summary     = field("CHANGE")
    impact.new_req_statement  = field("NEW_REQ")
    impact.new_req_category   = field("REQ_CATEGORY") or "Functional"
    impact.new_req_source     = field("REQ_SOURCE") or "Engineering"
    impact.risk_justification = field("RISK_JUSTIFICATION")

    impact.has_new_req  = bool(re.search(r"\bNEW\b", req_raw,  re.IGNORECASE)) if req_raw  else False
    impact.has_new_risk = bool(re.search(r"\bNEW\b", haz_raw, re.IGNORECASE)) if haz_raw else False

    return impact


# ═══════════════════════════════════════════════════════════════════════════════
# ID helpers
# ═══════════════════════════════════════════════════════════════════════════════

def next_req_id(content: str) -> str:
    nums = [int(r.split("-")[1]) for r in REQ_RE.findall(content)] or [0]
    return f"REQ-{max(nums) + 1:03d}"

def next_haz_id(content: str) -> str:
    nums = [int(h.split("-")[1]) for h in HAZ_RE.findall(content)] or [0]
    return f"H-{max(nums) + 1:03d}"

def id_exists(id_str: str, content: str) -> bool:
    return bool(re.search(rf"\b{re.escape(id_str)}\b", content))


# ═══════════════════════════════════════════════════════════════════════════════
# DHF document writers
# ═══════════════════════════════════════════════════════════════════════════════

def update_frontmatter_date(content: str) -> str:
    return re.sub(r"(last_reviewed:\s*)\S+", rf"\g<1>{TODAY}", content, count=1)


def add_requirement_row(req_id: str, impact: DHFImpact, draft: ClaudeDraft) -> None:
    content   = REQUIREMENTS_FILE.read_text()
    linked_h  = ", ".join(impact.hazards) if impact.hazards else "—"
    pr_ref    = f"PR #{PR_NUMBER}"

    new_row = (
        f"| {req_id} "
        f"| {draft.requirement_category} "
        f"| {draft.requirement_statement} "
        f"| {impact.new_req_source or draft.requirement_category} "
        f"| Must-have "
        f"| {linked_h} |\n"
        f"<!-- Claude draft ({TODAY}, {pr_ref}). "
        f"Rationale: {draft.requirement_rationale} "
        f"Awaiting approval from @{REVIEWER}. -->\n"
    )

    anchor = "**Requirement categories:**"
    content = (
        content.replace(anchor, new_row + anchor)
        if anchor in content
        else content.replace(
            "## 5. Review History",
            f"{new_row}\n## 5. Review History",
        )
    )
    REQUIREMENTS_FILE.write_text(update_frontmatter_date(content))
    print(f"  ✅ Created {req_id} in design inputs (Claude-drafted)")


def update_requirement_linkage(req_id: str, impact: DHFImpact, draft: ClaudeDraft) -> None:
    content = REQUIREMENTS_FILE.read_text()
    note = (
        f"\n<!-- Linkage updated by DHF Sync Bot ({TODAY}, PR #{PR_NUMBER}): "
        f"hazards={impact.hazards}, tests={impact.tests}. "
        f"Rationale: {draft.traceability_rationale} -->"
    )
    lines = content.split("\n")
    updated = []
    for line in lines:
        updated.append(line)
        if req_id in line and "|" in line:
            updated.append(note)
    REQUIREMENTS_FILE.write_text(update_frontmatter_date("\n".join(updated)))
    print(f"  🔗 Updated linkage for {req_id}")


def add_hazard_row(haz_id: str, impact: DHFImpact, draft: ClaudeDraft) -> None:
    content = RISK_FILE.read_text()
    pr_ref  = f"PR #{PR_NUMBER}"
    no_new_risk = "NO NEW HAZARD" in draft.hazard_statement.upper()

    if no_new_risk:
        hazard_text    = f"[No new hazard — see justification below] {draft.hazard_statement}"
        situation_text = "N/A"
        harm_text      = "N/A"
        sev = prob = risk = "N/A"
        control = f"Existing controls sufficient — {draft.risk_justification}"
        residual = "Acceptable"
    else:
        hazard_text    = draft.hazard_statement
        situation_text = draft.hazardous_situation
        harm_text      = draft.potential_harm
        sev = prob = risk = "[?] — REVIEW REQUIRED"
        control  = "[RC-XXX — REVIEW REQUIRED]"
        residual = "[REVIEW REQUIRED]"

    new_row = (
        f"| {haz_id} "
        f"| {hazard_text} "
        f"| {situation_text} "
        f"| {situation_text} "
        f"| {harm_text} "
        f"| {sev} | {prob} | {risk} "
        f"| {control} "
        f"| {residual} |\n"
        f"<!-- Claude draft ({TODAY}, {pr_ref}). AWAITING APPROVAL from @{REVIEWER}. -->\n"
    )

    justification_block = dedent(f"""
        <!-- DHF SYNC BOT — RISK ASSESSMENT ({TODAY}, {pr_ref})
        Claude's risk justification:
        {draft.risk_justification}

        Claude's reasoning for human reviewer:
        {draft.reasoning_summary}

        Action: @{REVIEWER} must review and approve via GitHub Issue before merge.
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
    content = content.replace(review_anchor, justification_block + f"\n\n{review_anchor}")
    RISK_FILE.write_text(update_frontmatter_date(content))
    print(f"  ✅ Created {haz_id} in risk file (Claude-drafted)")


def update_hazard_linkage(haz_id: str, impact: DHFImpact, draft: ClaudeDraft) -> None:
    content = RISK_FILE.read_text()
    note = (
        f"\n<!-- Linkage updated by DHF Sync Bot ({TODAY}, PR #{PR_NUMBER}): "
        f"reqs={impact.requirements}, tests={impact.tests}. "
        f"Rationale: {draft.traceability_rationale} -->"
    )
    lines = content.split("\n")
    updated = []
    for line in lines:
        updated.append(line)
        if haz_id in line and "|" in line:
            updated.append(note)
    RISK_FILE.write_text(update_frontmatter_date("\n".join(updated)))
    print(f"  🔗 Updated linkage for {haz_id}")


def add_traceability_row(req_id: str, haz_id: str, tests: list[str], draft: ClaudeDraft) -> None:
    content   = TRACEABILITY_FILE.read_text()
    tests_str = ", ".join(tests) if tests else "[TEST-XXX — REVIEW REQUIRED]"
    pr_ref    = f"PR #{PR_NUMBER}"

    new_row = (
        f"| [UN-AUTO — REVIEW] "
        f"| {req_id} "
        f"| [DO-XXX — REVIEW] "
        f"| {haz_id} "
        f"| [RC-XXX — REVIEW] "
        f"| {tests_str} "
        f"| [VAL-XXX — REVIEW] |\n"
        f"<!-- Claude draft ({TODAY}, {pr_ref}). "
        f"Rationale: {draft.traceability_rationale} "
        f"Awaiting approval from @{REVIEWER}. -->\n"
    )

    anchor = "## Traceability Rules"
    content = (
        content.replace(anchor, new_row + anchor)
        if anchor in content
        else content + f"\n{new_row}"
    )
    TRACEABILITY_FILE.write_text(update_frontmatter_date(content))
    print(f"  ✅ Added traceability row: {req_id} ↔ {haz_id} ↔ {tests_str}")


def update_traceability_linkage(req_id: str, haz_id: str, tests: list[str], draft: ClaudeDraft) -> None:
    content   = TRACEABILITY_FILE.read_text()
    tests_str = ", ".join(tests)
    note = (
        f"\n<!-- Traceability updated ({TODAY}, PR #{PR_NUMBER}): "
        f"{req_id}↔{haz_id}↔{tests_str}. "
        f"Rationale: {draft.traceability_rationale} -->"
    )
    lines = content.split("\n")
    updated = []
    for line in lines:
        updated.append(line)
        if req_id in line and "|" in line:
            updated.append(note)
    TRACEABILITY_FILE.write_text(update_frontmatter_date("\n".join(updated)))
    print(f"  🔗 Updated traceability for {req_id}")


# ═══════════════════════════════════════════════════════════════════════════════
# GitHub helpers
# ═══════════════════════════════════════════════════════════════════════════════

def open_review_issue(
    haz_id: str,
    req_id: str,
    impact: DHFImpact,
    draft: ClaudeDraft,
) -> str:
    no_new_risk = "NO NEW HAZARD" in draft.hazard_statement.upper()
    severity    = "🟡 Linkage Update" if no_new_risk else "🔴 New Hazard — Risk Assessment Required"
    pr_ref      = f"PR #{PR_NUMBER}"

    title = f"{severity}: DHF Review — {req_id} / {haz_id} ({pr_ref})"

    body = dedent(f"""
        ## DHF Human Review Required

        The DHF Sync Bot has updated DHF documents for **{pr_ref}: {PR_TITLE}**.
        **@{REVIEWER}** — please review Claude's drafts below and comment `approved` to unblock the merge.

        ---

        ## Claude's Reasoning

        > {draft.reasoning_summary}

        ---

        ## Drafted Content

        ### Requirement — `{req_id}`

        | Field | Claude's Draft |
        |---|---|
        | **Statement** | {draft.requirement_statement} |
        | **Category** | {draft.requirement_category} |
        | **Rationale** | {draft.requirement_rationale} |

        ### Hazard — `{haz_id}`

        | Field | Claude's Draft |
        |---|---|
        | **Hazard statement** | {draft.hazard_statement} |
        | **Hazardous situation** | {draft.hazardous_situation} |
        | **Potential harm** | {draft.potential_harm} |
        | **Risk justification** | {draft.risk_justification} |

        ### Traceability

        | Field | Value |
        |---|---|
        | **Requirement** | `{req_id}` |
        | **Hazard** | `{haz_id}` |
        | **Tests** | {", ".join(impact.tests) or "None linked — add TEST-XXX"} |
        | **Rationale** | {draft.traceability_rationale} |

        ---

        ## Reviewer Checklist

        - [ ] Requirement statement is precise, testable, and unambiguous
        - [ ] Hazard statement follows ISO 14971 language
        - [ ] Hazardous situation and harm are correctly identified
        - [ ] Severity and probability scores assigned in risk file
        - [ ] Risk control (RC-XXX) assigned or confirmed sufficient
        - [ ] Test cases cover this requirement (TEST-XXX linked)
        - [ ] Traceability matrix placeholders resolved

        ## To Approve

        Comment **`approved`** on this Issue. The merge gate will lift automatically.

        ---
        *Drafted by Claude Haiku · Opened by GreyZone AI DHF Sync Bot · {TODAY}*
    """).strip()

    if not GITHUB_TOKEN or not PR_NUMBER:
        print(f"  ⚠️  Missing GITHUB_TOKEN or PR_NUMBER — skipping Issue")
        return ""

    resp = requests.post(
        f"{GH_API}/repos/{GITHUB_REPOSITORY}/issues",
        headers=GH_HEADERS,
        json={
            "title":     title,
            "body":      body,
            "labels":    ["dhf-review", "awaiting-approval", "automated"],
            "assignees": [REVIEWER],
        },
        timeout=10,
    )
    if resp.ok:
        url = resp.json().get("html_url", "")
        print(f"  🔴 Review Issue opened: {url}")
        return url
    else:
        print(f"  ❌ Failed to open Issue: {resp.status_code} — {resp.text}")
        return ""


def post_pr_summary(result: BotResult, draft: ClaudeDraft) -> None:
    if not GITHUB_TOKEN or not PR_NUMBER:
        return

    lines = [
        "## 🤖 DHF Sync Bot Report\n",
        f"*Model: Claude Haiku · {TODAY}*\n",
    ]

    if result.reqs_created:
        lines.append(f"✅ **Requirements created:** {', '.join(result.reqs_created)}")
    if result.reqs_updated:
        lines.append(f"🔗 **Requirements updated:** {', '.join(result.reqs_updated)}")
    if result.hazards_created:
        lines.append(f"⚠️ **Hazards drafted:** {', '.join(result.hazards_created)}")
    if result.hazards_updated:
        lines.append(f"🔗 **Hazards updated:** {', '.join(result.hazards_updated)}")
    if result.tests_linked:
        lines.append(f"🧪 **Tests linked:** {', '.join(result.tests_linked)}")
    if result.traceability_rows_added:
        lines.append(f"📋 **Traceability rows added:** {result.traceability_rows_added}")

    if result.issues_opened:
        lines.append(f"\n### 🔴 Review Required")
        lines.append(f"**@{REVIEWER}** must approve before this PR can merge:")
        for url in result.issues_opened:
            lines.append(f"- {url}")

    lines.append(f"\n**Claude's reasoning:**\n> {draft.reasoning_summary}")
    lines.append(
        "\n---\n*DHF documents updated and committed to this branch. "
        f"Merge is blocked until @{REVIEWER} approves the review Issue(s).*"
    )

    requests.post(
        f"{GH_API}/repos/{GITHUB_REPOSITORY}/issues/{PR_NUMBER}/comments",
        headers=GH_HEADERS,
        json={"body": "\n".join(lines)},
        timeout=10,
    )
    print("  💬 PR summary comment posted")


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 60)
    print("DHF Sync Bot — GreyZone AI (Claude Haiku)")
    print(f"PR #{PR_NUMBER}: {PR_TITLE}")
    print("=" * 60)

    # 1. Parse DHF Impact block
    impact = parse_dhf_impact_block(PR_BODY)
    if impact is None:
        print("\nℹ️  No ## DHF Impact block — bot taking no action.\n")
        sys.exit(0)

    print(f"\n📋 Parsed: REQs={impact.requirements} HAZs={impact.hazards} TESTs={impact.tests}")
    print(f"   new_req={impact.has_new_req}  new_risk={impact.has_new_risk}\n")

    # 2. Call Claude to draft all regulatory content
    draft = call_claude(impact)

    result = BotResult()
    req_content  = REQUIREMENTS_FILE.read_text()
    risk_content = RISK_FILE.read_text()

    # 3. Handle requirements
    final_req_ids = []
    if impact.has_new_req or not impact.requirements:
        new_id = next_req_id(req_content)
        add_requirement_row(new_id, impact, draft)
        result.reqs_created.append(new_id)
        final_req_ids.append(new_id)
        req_content = REQUIREMENTS_FILE.read_text()
    else:
        for req_id in impact.requirements:
            if id_exists(req_id, req_content):
                update_requirement_linkage(req_id, impact, draft)
                result.reqs_updated.append(req_id)
            else:
                add_requirement_row(req_id, impact, draft)
                result.reqs_created.append(req_id)
                req_content = REQUIREMENTS_FILE.read_text()
            final_req_ids.append(req_id)

    # 4. Handle hazards
    final_haz_ids = []
    needs_review  = False

    if impact.has_new_risk or not impact.hazards:
        new_id = next_haz_id(risk_content)
        add_hazard_row(new_id, impact, draft)
        result.hazards_created.append(new_id)
        final_haz_ids.append(new_id)
        needs_review = True
        risk_content = RISK_FILE.read_text()
        for req_id in final_req_ids:
            url = open_review_issue(new_id, req_id, impact, draft)
            if url:
                result.issues_opened.append(url)
    else:
        for haz_id in impact.hazards:
            if id_exists(haz_id, risk_content):
                update_hazard_linkage(haz_id, impact, draft)
                result.hazards_updated.append(haz_id)
            else:
                add_hazard_row(haz_id, impact, draft)
                result.hazards_created.append(haz_id)
                needs_review = True
                risk_content = RISK_FILE.read_text()
                for req_id in final_req_ids:
                    url = open_review_issue(haz_id, req_id, impact, draft)
                    if url:
                        result.issues_opened.append(url)
            final_haz_ids.append(haz_id)

    # Also open a review Issue for linkage-only updates (lighter label)
    if not needs_review and (result.reqs_updated or result.hazards_updated):
        for req_id, haz_id in zip(final_req_ids, final_haz_ids):
            url = open_review_issue(haz_id, req_id, impact, draft)
            if url:
                result.issues_opened.append(url)

    # 5. Tests
    if impact.tests:
        result.tests_linked.extend(impact.tests)

    # 6. Traceability matrix
    for req_id in final_req_ids:
        for haz_id in final_haz_ids:
            existing = TRACEABILITY_FILE.read_text()
            if req_id in existing and haz_id in existing:
                update_traceability_linkage(req_id, haz_id, impact.tests, draft)
            else:
                add_traceability_row(req_id, haz_id, impact.tests, draft)
                result.traceability_rows_added += 1

    # 7. PR comment
    post_pr_summary(result, draft)

    # 8. Summary
    print("\n" + "=" * 60)
    print(f"  REQs created : {result.reqs_created}")
    print(f"  REQs updated : {result.reqs_updated}")
    print(f"  HAZs drafted : {result.hazards_created}")
    print(f"  HAZs updated : {result.hazards_updated}")
    print(f"  Tests linked : {result.tests_linked}")
    print(f"  Trace rows   : {result.traceability_rows_added}")
    print(f"  Issues opened: {len(result.issues_opened)}")
    print("=" * 60)

    # Exit 1 always — merge gate requires human approval
    if result.issues_opened:
        print(f"\n⏸  Merge blocked. @{REVIEWER} must approve the review Issue(s).\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
