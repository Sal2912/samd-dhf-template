#!/usr/bin/env python3
"""
DHF Sync Bot — GreyZone AI SaMD DHF Template
=============================================
Triggered on every PR to main. Reads the structured ## DHF Impact block
from the PR description, then automatically:

  1. Updates or creates requirement entries in dhf/03-design-inputs-outputs.md
  2. Updates or creates hazard entries in dhf/02-risk-management-file.md
  3. Links test cases wherever TEST-XXX is referenced
  4. Updates the traceability matrix (dhf/05-traceability-matrix.md)
  5. If no risk is linked and none exists → auto-drafts a new hazard from
     PR context, adds a justification block, and opens a GitHub Issue for review

Environment variables (set by GitHub Actions):
  GITHUB_TOKEN         — for API calls (Issues, PR comments)
  GITHUB_REPOSITORY    — e.g. "Sal2912/samd-dhf-template"
  PR_NUMBER            — the pull request number
  PR_TITLE             — title of the PR
  PR_BODY              — full PR description text
  PR_AUTHOR            — GitHub login of the PR author

Usage:
  python scripts/dhf_sync_bot.py
"""

import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from textwrap import dedent

import requests
import yaml

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DHF = ROOT / "dhf"
REQUIREMENTS_FILE  = DHF / "03-design-inputs-outputs.md"
RISK_FILE          = DHF / "02-risk-management-file.md"
TRACEABILITY_FILE  = DHF / "05-traceability-matrix.md"

# ── GitHub ─────────────────────────────────────────────────────────────────────
GITHUB_TOKEN      = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "Sal2912/samd-dhf-template")
PR_NUMBER         = os.environ.get("PR_NUMBER", "")
PR_TITLE          = os.environ.get("PR_TITLE", "No title")
PR_BODY           = os.environ.get("PR_BODY", "")
PR_AUTHOR         = os.environ.get("PR_AUTHOR", "unknown")
TODAY             = date.today().isoformat()

GH_API = "https://api.github.com"
GH_HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# ── Regex ──────────────────────────────────────────────────────────────────────
REQ_RE   = re.compile(r"\bREQ-\d+\b")
HAZ_RE   = re.compile(r"\bH-\d+\b")
TEST_RE  = re.compile(r"\bTEST-\d+\b")
RC_RE    = re.compile(r"\bRC-\d+\b")


# ═══════════════════════════════════════════════════════════════════════════════
# Data structures
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class DHFImpact:
    """Parsed content of the ## DHF Impact block in a PR description."""
    raw_block: str = ""

    # Explicit IDs referenced
    requirements: list[str] = field(default_factory=list)   # e.g. [REQ-001, REQ-003]
    hazards:      list[str] = field(default_factory=list)   # e.g. [H-002]
    tests:        list[str] = field(default_factory=list)   # e.g. [TEST-007]

    # Free-text fields from the structured block
    change_summary:    str = ""   # What changed and why
    new_req_statement: str = ""   # Text of a new requirement (if REQ is new)
    new_req_category:  str = ""   # Functional | Performance | Security | etc.
    new_req_source:    str = ""   # Clinical evidence | Standard | etc.
    risk_justification: str = "" # Why no new risk / why existing risk covers it

    # Derived
    has_new_req:  bool = False
    has_new_risk: bool = False


@dataclass
class BotResult:
    """Summary of all actions taken by the bot."""
    reqs_updated:  list[str] = field(default_factory=list)
    reqs_created:  list[str] = field(default_factory=list)
    hazards_updated: list[str] = field(default_factory=list)
    hazards_created: list[str] = field(default_factory=list)
    tests_linked:  list[str] = field(default_factory=list)
    traceability_rows_added: int = 0
    issues_opened: list[str] = field(default_factory=list)
    warnings:      list[str] = field(default_factory=list)
    errors:        list[str] = field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════════
# Parsing
# ═══════════════════════════════════════════════════════════════════════════════

def parse_dhf_impact_block(pr_body: str) -> DHFImpact | None:
    """
    Extract and parse the ## DHF Impact section from a PR description.
    Returns None if no DHF Impact block is found (non-DHF PR — bot does nothing).
    """
    # Find the block between ## DHF Impact and the next ## heading (or end)
    match = re.search(
        r"##\s+DHF\s+Impact\s*\n(.*?)(?=\n##|\Z)",
        pr_body,
        re.DOTALL | re.IGNORECASE,
    )
    if not match:
        return None

    block = match.group(1).strip()
    impact = DHFImpact(raw_block=block)

    # Parse structured key: value lines
    def extract_field(key: str) -> str:
        m = re.search(rf"^\s*{key}\s*:\s*(.+)$", block, re.MULTILINE | re.IGNORECASE)
        return m.group(1).strip() if m else ""

    # IDs
    req_raw  = extract_field("REQ")
    haz_raw  = extract_field("RISK")
    test_raw = extract_field("TEST")

    impact.requirements = [r.strip() for r in REQ_RE.findall(req_raw)] if req_raw else []
    impact.hazards      = [h.strip() for h in HAZ_RE.findall(haz_raw)] if haz_raw else []
    impact.tests        = [t.strip() for t in TEST_RE.findall(test_raw)] if test_raw else []

    # Free-text fields
    impact.change_summary     = extract_field("CHANGE")
    impact.new_req_statement  = extract_field("NEW_REQ")
    impact.new_req_category   = extract_field("REQ_CATEGORY") or "Functional"
    impact.new_req_source     = extract_field("REQ_SOURCE") or "Engineering"
    impact.risk_justification = extract_field("RISK_JUSTIFICATION")

    # Detect "NEW" keywords
    impact.has_new_req  = bool(re.search(r"\bNEW\b", req_raw,  re.IGNORECASE)) if req_raw  else False
    impact.has_new_risk = bool(re.search(r"\bNEW\b", haz_raw, re.IGNORECASE)) if haz_raw else False

    return impact


# ═══════════════════════════════════════════════════════════════════════════════
# ID generation helpers
# ═══════════════════════════════════════════════════════════════════════════════

def get_next_req_id(content: str) -> str:
    existing = REQ_RE.findall(content)
    nums = [int(r.split("-")[1]) for r in existing] if existing else [0]
    return f"REQ-{max(nums) + 1:03d}"


def get_next_hazard_id(content: str) -> str:
    existing = HAZ_RE.findall(content)
    nums = [int(h.split("-")[1]) for h in existing] if existing else [0]
    return f"H-{max(nums) + 1:03d}"


def req_exists(req_id: str, content: str) -> bool:
    return bool(re.search(rf"\b{re.escape(req_id)}\b", content))


def hazard_exists(haz_id: str, content: str) -> bool:
    return bool(re.search(rf"\b{re.escape(haz_id)}\b", content))


# ═══════════════════════════════════════════════════════════════════════════════
# DHF document updaters
# ═══════════════════════════════════════════════════════════════════════════════

def add_requirement_row(req_id: str, impact: DHFImpact) -> None:
    """Append a new requirement row to the design inputs table."""
    content = REQUIREMENTS_FILE.read_text()
    linked_hazards = ", ".join(impact.hazards) if impact.hazards else "—"
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "code change"

    new_row = (
        f"| {req_id} "
        f"| {impact.new_req_category} "
        f"| {impact.new_req_statement or impact.change_summary or f'[Auto-created from {pr_ref}: {PR_TITLE}]'} "
        f"| {impact.new_req_source} "
        f"| Must-have "
        f"| {linked_hazards} |\n"
    )

    # Insert before the "Requirement categories:" line or at end of table
    anchor = "**Requirement categories:**"
    if anchor in content:
        content = content.replace(anchor, new_row + anchor)
    else:
        # Fallback: append before review history
        content = content.replace(
            "## 5. Review History",
            f"<!-- Auto-added by DHF Sync Bot: {TODAY} -->\n{new_row}\n## 5. Review History",
        )

    # Update frontmatter last_reviewed
    content = update_frontmatter_date(content)
    REQUIREMENTS_FILE.write_text(content)
    print(f"  ✅ Created requirement {req_id} in design inputs doc")


def update_requirement_linkage(req_id: str, impact: DHFImpact) -> None:
    """Add hazard and test cross-references to an existing requirement row."""
    content = REQUIREMENTS_FILE.read_text()
    # Annotate the existing row with a comment noting the new linkage
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "code change"
    note = f"\n<!-- Linkage updated by DHF Sync Bot ({TODAY}, {pr_ref}): hazards={impact.hazards}, tests={impact.tests} -->"
    # Insert note after the line containing the req_id
    lines = content.split("\n")
    updated = []
    for line in lines:
        updated.append(line)
        if req_id in line and "|" in line:
            updated.append(note)
    content = "\n".join(updated)
    content = update_frontmatter_date(content)
    REQUIREMENTS_FILE.write_text(content)
    print(f"  🔗 Updated linkage for {req_id} in design inputs doc")


def add_hazard_row(haz_id: str, impact: DHFImpact) -> str:
    """Append a new hazard row to the risk management file. Returns the haz_id."""
    content = RISK_FILE.read_text()
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "code change"

    # Auto-draft hazard statement from PR context
    auto_hazard = (
        impact.change_summary
        or f"Potential hazard introduced by code change: {PR_TITLE}"
    )
    auto_situation = f"[Auto-drafted — review required. Source: {pr_ref}: {PR_TITLE}]"

    new_row = (
        f"| {haz_id} "
        f"| {auto_hazard} "
        f"| {auto_situation} "
        f"| [Hazardous situation — REVIEW REQUIRED] "
        f"| [Harm — REVIEW REQUIRED] "
        f"| [?] | [?] | [?×?] "
        f"| [Control — REVIEW REQUIRED] "
        f"| [Residual — REVIEW REQUIRED] |\n"
        f"<!-- AUTO-DRAFTED by DHF Sync Bot ({TODAY}). "
        f"Assigned to @{PR_AUTHOR} for review via GitHub Issue. -->\n"
    )

    anchor = "**Risk scoring guide:**"
    if anchor in content:
        content = content.replace(anchor, new_row + anchor)
    else:
        content = content.replace(
            "## 3. Risk Controls Summary",
            f"<!-- Auto-added by DHF Sync Bot: {TODAY} -->\n{new_row}\n## 3. Risk Controls Summary",
        )

    # Add justification block if no existing risk covers this
    justification_block = dedent(f"""
        <!-- DHF SYNC BOT — NO EXISTING RISK LINKED ({TODAY})
        PR: #{PR_NUMBER} — {PR_TITLE}
        Author: @{PR_AUTHOR}

        Justification provided:
        {impact.risk_justification or "[No justification provided in PR — review required]"}

        Action required:
        1. Review the auto-drafted hazard entry {haz_id} above
        2. Fill in all [?] and [REVIEW REQUIRED] fields
        3. Assign a risk control (RC-XXX)
        4. Update the traceability matrix
        5. Close the GitHub Issue once complete
        -->
    """).strip()

    content = content.replace(
        "## 7. Review History" if "## 7. Review History" in content else "## 6. Review History",
        justification_block + "\n\n## 6. Review History",
    )

    content = update_frontmatter_date(content)
    RISK_FILE.write_text(content)
    print(f"  ✅ Auto-drafted hazard {haz_id} in risk management file")
    return haz_id


def update_hazard_linkage(haz_id: str, impact: DHFImpact) -> None:
    """Annotate an existing hazard row with new requirement/test linkage."""
    content = RISK_FILE.read_text()
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "code change"
    note = (
        f"\n<!-- Linkage updated by DHF Sync Bot ({TODAY}, {pr_ref}): "
        f"reqs={impact.requirements}, tests={impact.tests} -->"
    )
    lines = content.split("\n")
    updated = []
    for line in lines:
        updated.append(line)
        if haz_id in line and "|" in line:
            updated.append(note)
    content = "\n".join(updated)
    content = update_frontmatter_date(content)
    RISK_FILE.write_text(content)
    print(f"  🔗 Updated linkage for {haz_id} in risk management file")


def add_traceability_row(req_id: str, haz_id: str, test_ids: list[str], impact: DHFImpact) -> None:
    """Add a row to the master traceability table."""
    content = TRACEABILITY_FILE.read_text()
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "code change"
    tests_str = ", ".join(test_ids) if test_ids else "[TEST-XXX — link required]"

    new_row = (
        f"| [UN-AUTO] "
        f"| {req_id} "
        f"| [DO-XXX] "
        f"| {haz_id} "
        f"| [RC-XXX] "
        f"| {tests_str} "
        f"| [VAL-XXX] |\n"
        f"<!-- Auto-added by DHF Sync Bot ({TODAY}, {pr_ref}) — "
        f"fill [UN-AUTO], [DO-XXX], [RC-XXX], [VAL-XXX] -->\n"
    )

    # Insert before the traceability rules section
    anchor = "## Traceability Rules"
    if anchor in content:
        content = content.replace(anchor, new_row + anchor)
    else:
        content += f"\n{new_row}"

    content = update_frontmatter_date(content)
    TRACEABILITY_FILE.write_text(content)
    print(f"  ✅ Added traceability row: {req_id} ↔ {haz_id} ↔ {tests_str}")


def update_traceability_linkage(req_id: str, haz_id: str, test_ids: list[str]) -> None:
    """Annotate existing traceability rows with new test or hazard linkage."""
    content = TRACEABILITY_FILE.read_text()
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "code change"
    tests_str = ", ".join(test_ids)
    note = (
        f"\n<!-- Traceability updated by DHF Sync Bot ({TODAY}, {pr_ref}): "
        f"added linkage {req_id}↔{haz_id}↔{tests_str} -->"
    )
    # Add note after the row containing req_id
    lines = content.split("\n")
    updated = []
    for line in lines:
        updated.append(line)
        if req_id in line and "|" in line:
            updated.append(note)
    content = "\n".join(updated)
    content = update_frontmatter_date(content)
    TRACEABILITY_FILE.write_text(content)
    print(f"  🔗 Updated traceability linkage for {req_id}")


def update_frontmatter_date(content: str) -> str:
    """Update last_reviewed in YAML frontmatter to today."""
    return re.sub(
        r"(last_reviewed:\s*)\S+",
        rf"\g<1>{TODAY}",
        content,
        count=1,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GitHub API helpers
# ═══════════════════════════════════════════════════════════════════════════════

def open_review_issue(haz_id: str, req_id: str, impact: DHFImpact) -> str:
    """Open a GitHub Issue requesting human review of an auto-drafted hazard."""
    pr_ref = f"PR #{PR_NUMBER}" if PR_NUMBER else "a code change"
    title = f"🔴 DHF Review Required: Auto-drafted hazard {haz_id} (from {pr_ref})"
    body = dedent(f"""
        ## Auto-Drafted Hazard Requires Review

        The DHF Sync Bot created a new hazard entry **{haz_id}** because a code change
        was merged that introduced a new requirement **{req_id}** with no existing risk linkage.

        | Field | Value |
        |---|---|
        | **PR** | #{PR_NUMBER} — {PR_TITLE} |
        | **Author** | @{PR_AUTHOR} |
        | **Requirement** | {req_id} |
        | **Auto-drafted hazard** | {haz_id} |
        | **Tests referenced** | {", ".join(impact.tests) or "None"} |
        | **Justification provided** | {impact.risk_justification or "⚠️ None provided"} |

        ## Hazard auto-drafted from PR context

        > {impact.change_summary or PR_TITLE}

        This is a **draft only**. The following fields in `dhf/02-risk-management-file.md` need human review:

        - [ ] Confirm or revise the hazard statement
        - [ ] Define the foreseeable sequence of events
        - [ ] Identify the hazardous situation
        - [ ] Identify the patient/user harm
        - [ ] Assign severity and probability scores
        - [ ] Define a risk control (RC-XXX)
        - [ ] Confirm residual risk is acceptable

        Then update `dhf/05-traceability-matrix.md` to replace `[RC-XXX]`, `[UN-AUTO]`, `[DO-XXX]`, and `[VAL-XXX]` placeholders.

        Close this issue once all fields are complete and reviewed.

        ---
        *Opened automatically by the GreyZone AI DHF Sync Bot.*
    """).strip()

    if not GITHUB_TOKEN or not PR_NUMBER:
        print(f"  ⚠️  No GITHUB_TOKEN or PR_NUMBER — skipping Issue creation for {haz_id}")
        return ""

    resp = requests.post(
        f"{GH_API}/repos/{GITHUB_REPOSITORY}/issues",
        headers=GH_HEADERS,
        json={
            "title": title,
            "body": body,
            "labels": ["dhf-review", "risk-review", "automated"],
            "assignees": [PR_AUTHOR] if PR_AUTHOR != "unknown" else [],
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


def post_pr_summary(result: BotResult) -> None:
    """Post a summary comment to the PR."""
    if not GITHUB_TOKEN or not PR_NUMBER:
        return

    def badge(items: list, label: str) -> str:
        return f"**{label}:** {', '.join(items)}" if items else ""

    lines = ["## 🤖 DHF Sync Bot Report\n"]

    if result.reqs_created:
        lines.append(f"✅ **Requirements created:** {', '.join(result.reqs_created)}")
    if result.reqs_updated:
        lines.append(f"🔗 **Requirements updated:** {', '.join(result.reqs_updated)}")
    if result.hazards_created:
        lines.append(f"⚠️ **Hazards auto-drafted (review required):** {', '.join(result.hazards_created)}")
    if result.hazards_updated:
        lines.append(f"🔗 **Hazards updated:** {', '.join(result.hazards_updated)}")
    if result.tests_linked:
        lines.append(f"🧪 **Tests linked:** {', '.join(result.tests_linked)}")
    if result.traceability_rows_added:
        lines.append(f"📋 **Traceability rows added/updated:** {result.traceability_rows_added}")
    if result.issues_opened:
        lines.append(f"🔴 **Review Issues opened:** {len(result.issues_opened)}")
        for url in result.issues_opened:
            lines.append(f"  - {url}")
    if result.warnings:
        lines.append("\n**Warnings:**")
        for w in result.warnings:
            lines.append(f"  - ⚠️ {w}")
    if result.errors:
        lines.append("\n**Errors:**")
        for e in result.errors:
            lines.append(f"  - ❌ {e}")

    if len(lines) == 1:
        lines.append("No DHF documents required updates for this PR.")

    lines.append(
        "\n---\n*DHF documents updated automatically. "
        "Commit these changes before merging.*"
    )

    body = "\n".join(lines)
    resp = requests.post(
        f"{GH_API}/repos/{GITHUB_REPOSITORY}/issues/{PR_NUMBER}/comments",
        headers=GH_HEADERS,
        json={"body": body},
        timeout=10,
    )
    if resp.ok:
        print(f"  💬 PR summary comment posted")
    else:
        print(f"  ❌ Failed to post PR comment: {resp.status_code}")


# ═══════════════════════════════════════════════════════════════════════════════
# Main orchestration
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 60)
    print("DHF Sync Bot — GreyZone AI")
    print(f"PR #{PR_NUMBER}: {PR_TITLE}")
    print("=" * 60)

    # ── 1. Parse DHF Impact block ───────────────────────────────────────────────
    impact = parse_dhf_impact_block(PR_BODY)
    if impact is None:
        print("\nℹ️  No ## DHF Impact block found in PR description.")
        print("   This PR has no DHF implications — bot taking no action.\n")
        sys.exit(0)

    print(f"\n📋 DHF Impact parsed:")
    print(f"   Requirements : {impact.requirements or ['(none)']}")
    print(f"   Hazards      : {impact.hazards or ['(none)']}")
    print(f"   Tests        : {impact.tests or ['(none)']}")
    print(f"   New REQ?     : {impact.has_new_req}")
    print(f"   New RISK?    : {impact.has_new_risk}")
    print()

    result = BotResult()

    # Read current file contents for ID existence checks
    req_content  = REQUIREMENTS_FILE.read_text()
    risk_content = RISK_FILE.read_text()

    # ── 2. Handle requirements ─────────────────────────────────────────────────
    final_req_ids = []

    if impact.has_new_req or not impact.requirements:
        # Create a brand-new requirement
        new_req_id = get_next_req_id(req_content)
        add_requirement_row(new_req_id, impact)
        result.reqs_created.append(new_req_id)
        final_req_ids.append(new_req_id)
        # Refresh content for subsequent ID checks
        req_content = REQUIREMENTS_FILE.read_text()
    else:
        for req_id in impact.requirements:
            if req_exists(req_id, req_content):
                update_requirement_linkage(req_id, impact)
                result.reqs_updated.append(req_id)
            else:
                # Referenced ID doesn't exist yet — create it
                add_requirement_row(req_id, impact)
                result.reqs_created.append(req_id)
                req_content = REQUIREMENTS_FILE.read_text()
            final_req_ids.append(req_id)

    # ── 3. Handle hazards ──────────────────────────────────────────────────────
    final_haz_ids = []

    if impact.has_new_risk or not impact.hazards:
        # No existing risk linked — auto-draft a new one
        new_haz_id = get_next_hazard_id(risk_content)
        add_hazard_row(new_haz_id, impact)
        result.hazards_created.append(new_haz_id)
        final_haz_ids.append(new_haz_id)
        risk_content = RISK_FILE.read_text()

        # Open a review Issue
        for req_id in final_req_ids:
            issue_url = open_review_issue(new_haz_id, req_id, impact)
            if issue_url:
                result.issues_opened.append(issue_url)
    else:
        for haz_id in impact.hazards:
            if hazard_exists(haz_id, risk_content):
                update_hazard_linkage(haz_id, impact)
                result.hazards_updated.append(haz_id)
            else:
                # Referenced hazard ID doesn't exist — create it
                add_hazard_row(haz_id, impact)
                result.hazards_created.append(haz_id)
                risk_content = RISK_FILE.read_text()
                # Open review Issue for new hazard
                for req_id in final_req_ids:
                    issue_url = open_review_issue(haz_id, req_id, impact)
                    if issue_url:
                        result.issues_opened.append(issue_url)
            final_haz_ids.append(haz_id)

    # ── 4. Handle tests ────────────────────────────────────────────────────────
    if impact.tests:
        result.tests_linked.extend(impact.tests)

    # ── 5. Update traceability matrix ──────────────────────────────────────────
    for req_id in final_req_ids:
        for haz_id in final_haz_ids:
            existing_trace = TRACEABILITY_FILE.read_text()
            if req_id in existing_trace and haz_id in existing_trace:
                # Row likely exists — update linkage
                update_traceability_linkage(req_id, haz_id, impact.tests)
            else:
                # Add new row
                add_traceability_row(req_id, haz_id, impact.tests, impact)
                result.traceability_rows_added += 1

    # ── 6. Post PR summary comment ─────────────────────────────────────────────
    post_pr_summary(result)

    # ── 7. Print final summary ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("DHF Sync Bot complete.")
    print(f"  Requirements created : {result.reqs_created}")
    print(f"  Requirements updated : {result.reqs_updated}")
    print(f"  Hazards auto-drafted : {result.hazards_created}")
    print(f"  Hazards updated      : {result.hazards_updated}")
    print(f"  Tests linked         : {result.tests_linked}")
    print(f"  Traceability rows    : {result.traceability_rows_added}")
    print(f"  Review Issues opened : {len(result.issues_opened)}")
    print("=" * 60)

    # Exit 1 if new hazards were created (require human review before merge)
    if result.hazards_created:
        print(
            "\n⚠️  New hazards were auto-drafted. "
            "Review Issues have been opened. "
            "Complete the risk assessment before merging.\n"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
