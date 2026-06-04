#!/usr/bin/env python3
"""
Task Context Accumulator — GreyZone AI SaMD DHF Template
=========================================================
Runs on EVERY task PR merge to main.
Does NOT update any DHF documents.

Reads the STORY: and TASK: fields from the PR description,
then appends task context to dhf/.story-context/<STORY_ID>.json.

This context is later read by dhf_story_sync_bot.py when Jira
marks the parent story as Done.

Environment variables (set by GitHub Actions):
  GITHUB_TOKEN       — for fetching PR diff
  GITHUB_REPOSITORY  — e.g. "Sal2912/samd-dhf-template"
  PR_NUMBER          — pull request number
  PR_TITLE           — pull request title
  PR_BODY            — full PR description
  PR_AUTHOR          — GitHub login of the PR author
  PR_DIFF            — unified diff of the PR
  PR_MERGED_AT       — ISO timestamp of merge
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT            = Path(__file__).parent.parent
STORY_CONTEXT   = ROOT / "dhf" / ".story-context"
STORY_CONTEXT.mkdir(parents=True, exist_ok=True)

# ── Environment ────────────────────────────────────────────────────────────────
GITHUB_TOKEN      = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "Sal2912/samd-dhf-template")
PR_NUMBER         = os.environ.get("PR_NUMBER", "")
PR_TITLE          = os.environ.get("PR_TITLE", "")
PR_BODY           = os.environ.get("PR_BODY", "")
PR_AUTHOR         = os.environ.get("PR_AUTHOR", "")
PR_DIFF           = os.environ.get("PR_DIFF", "")
PR_MERGED_AT      = os.environ.get("PR_MERGED_AT", datetime.now(timezone.utc).isoformat())

# ── Regex ──────────────────────────────────────────────────────────────────────
STORY_RE = re.compile(r"STORY\s*:\s*(DHF-\d+)", re.IGNORECASE)
TASK_RE  = re.compile(r"TASK\s*:\s*(DHF-\d+)", re.IGNORECASE)
REQ_RE   = re.compile(r"\bREQ-\d+\b")
HAZ_RE   = re.compile(r"\bH-\d+\b")
TEST_RE  = re.compile(r"\bTEST-\d+\b")


def parse_pr_body(body: str) -> dict:
    """Extract all structured fields from the PR description."""

    def field(key: str) -> str:
        m = re.search(rf"^\s*{key}\s*:\s*(.+)$", body, re.MULTILINE | re.IGNORECASE)
        return m.group(1).strip() if m else ""

    dhf_block_match = re.search(
        r"##\s+DHF\s+Impact\s*\n(.*?)(?=\n##|\Z)", body, re.DOTALL | re.IGNORECASE
    )
    dhf_block = dhf_block_match.group(1).strip() if dhf_block_match else ""

    return {
        "story_id":          (STORY_RE.search(body) or [None, None])[1] if STORY_RE.search(body) else None,
        "task_id":           (TASK_RE.search(body) or [None, None])[1] if TASK_RE.search(body) else None,
        "dhf_block":         dhf_block,
        "change_summary":    field("CHANGE"),
        "clinical_context":  field("CLINICAL_CONTEXT"),
        "new_req":           field("NEW_REQ"),
        "req_ids":           REQ_RE.findall(dhf_block),
        "haz_ids":           HAZ_RE.findall(dhf_block),
        "test_ids":          TEST_RE.findall(dhf_block),
        "req_category":      field("REQ_CATEGORY") or "Functional",
        "req_source":        field("REQ_SOURCE") or "Engineering",
        "risk_justification":field("RISK_JUSTIFICATION"),
        "has_new_req":       bool(re.search(r"REQ\s*:\s*NEW", dhf_block, re.IGNORECASE)),
        "has_new_risk":      bool(re.search(r"RISK\s*:\s*NEW", dhf_block, re.IGNORECASE)),
        "no_risk":           bool(re.search(r"RISK\s*:\s*NONE", dhf_block, re.IGNORECASE)),
    }


def load_story_context(story_id: str) -> dict:
    """Load existing story context JSON, or initialize empty."""
    path = STORY_CONTEXT / f"{story_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    return {
        "story_id":   story_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status":     "accumulating",
        "tasks":      [],
        # Aggregated fields — updated on every task merge
        "all_req_ids":           [],
        "all_haz_ids":           [],
        "all_test_ids":          [],
        "has_any_new_req":       False,
        "has_any_new_risk":      False,
        "combined_change_summary":    "",
        "combined_clinical_context":  "",
        "combined_diff_excerpt":      "",
    }


def save_story_context(story_id: str, ctx: dict) -> None:
    path = STORY_CONTEXT / f"{story_id}.json"
    path.write_text(json.dumps(ctx, indent=2))
    print(f"  💾 Saved context to {path.relative_to(ROOT)}")


def aggregate(ctx: dict, parsed: dict) -> dict:
    """Merge new task data into the story-level aggregated fields."""
    # Deduplicated ID lists
    ctx["all_req_ids"]  = sorted(set(ctx["all_req_ids"]  + parsed["req_ids"]))
    ctx["all_haz_ids"]  = sorted(set(ctx["all_haz_ids"]  + parsed["haz_ids"]))
    ctx["all_test_ids"] = sorted(set(ctx["all_test_ids"] + parsed["test_ids"]))

    # Boolean flags — once true, stays true
    ctx["has_any_new_req"]  = ctx["has_any_new_req"]  or parsed["has_new_req"]
    ctx["has_any_new_risk"] = ctx["has_any_new_risk"] or parsed["has_new_risk"]

    # Concatenate free-text fields (Claude reads all of them at story-done time)
    task_ref = f"[{parsed['task_id'] or PR_NUMBER}]"
    if parsed["change_summary"]:
        ctx["combined_change_summary"] += f"\n{task_ref} {parsed['change_summary']}"
    if parsed["clinical_context"]:
        ctx["combined_clinical_context"] += f"\n{task_ref} {parsed['clinical_context']}"

    # Accumulate diff excerpt (capped at 8000 chars total across all tasks)
    remaining = max(0, 8000 - len(ctx["combined_diff_excerpt"]))
    if remaining > 0 and PR_DIFF:
        ctx["combined_diff_excerpt"] += (
            f"\n\n--- Task {task_ref} diff ---\n"
            + PR_DIFF[:remaining]
        )

    return ctx


def main() -> None:
    print("=" * 60)
    print("Task Context Accumulator — GreyZone AI")
    print(f"PR #{PR_NUMBER}: {PR_TITLE}")
    print("=" * 60)

    parsed = parse_pr_body(PR_BODY)
    story_id = parsed["story_id"]

    if not story_id:
        print("\nℹ️  No STORY: field in PR description.")
        print("   This PR is not linked to a Jira story — no context saved.")
        print("   Add 'STORY: DHF-XX' to the PR description to enable story-level DHF tracking.\n")
        sys.exit(0)

    task_id = parsed["task_id"] or f"PR-{PR_NUMBER}"
    print(f"\n📋 Story: {story_id}  |  Task: {task_id}")

    # Load existing context
    ctx = load_story_context(story_id)

    # Check for duplicate task (re-run on push)
    existing_task_ids = [t["task_id"] for t in ctx["tasks"]]
    if task_id in existing_task_ids:
        print(f"  ℹ️  Task {task_id} already in context — updating existing entry")
        ctx["tasks"] = [t for t in ctx["tasks"] if t["task_id"] != task_id]

    # Add this task
    task_entry = {
        "task_id":           task_id,
        "pr_number":         PR_NUMBER,
        "pr_title":          PR_TITLE,
        "pr_author":         PR_AUTHOR,
        "merged_at":         PR_MERGED_AT,
        "change_summary":    parsed["change_summary"],
        "clinical_context":  parsed["clinical_context"],
        "dhf_block":         parsed["dhf_block"],
        "req_ids":           parsed["req_ids"],
        "haz_ids":           parsed["haz_ids"],
        "test_ids":          parsed["test_ids"],
        "has_new_req":       parsed["has_new_req"],
        "has_new_risk":      parsed["has_new_risk"],
        "no_risk":           parsed["no_risk"],
        "risk_justification":parsed["risk_justification"],
        "diff_excerpt":      PR_DIFF[:2000] if PR_DIFF else "",
    }
    ctx["tasks"].append(task_entry)

    # Update aggregated fields
    ctx = aggregate(ctx, parsed)
    ctx["last_updated"] = datetime.now(timezone.utc).isoformat()
    ctx["task_count"]   = len(ctx["tasks"])

    save_story_context(story_id, ctx)

    print(f"\n✅ Story {story_id} context updated:")
    print(f"   Tasks accumulated : {ctx['task_count']}")
    print(f"   REQ IDs seen      : {ctx['all_req_ids']}")
    print(f"   Hazard IDs seen   : {ctx['all_haz_ids']}")
    print(f"   Test IDs seen     : {ctx['all_test_ids']}")
    print(f"   New req needed    : {ctx['has_any_new_req']}")
    print(f"   New risk flagged  : {ctx['has_any_new_risk']}")
    print(f"\n⏳ Waiting for Jira to mark {story_id} as Done before DHF update.\n")


if __name__ == "__main__":
    main()
