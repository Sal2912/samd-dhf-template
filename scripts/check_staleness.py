#!/usr/bin/env python3
"""
Staleness Check — GreyZone AI SaMD DHF Template
=================================================
Runs nightly via GitHub Actions scheduled workflow.
Reads YAML frontmatter from every DHF document and checks whether
'last_reviewed' + 'review_interval_days' has been exceeded.

For each stale document, opens a GitHub Issue via the GitHub API.
Requires: GITHUB_TOKEN, GITHUB_REPOSITORY environment variables (set by Actions).

Outputs: staleness-report.json (dashboard-ready)
"""

import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import requests
import yaml

DHF_DIR = Path(__file__).parent.parent / "dhf"
OUTPUT_FILE = Path(__file__).parent.parent / "staleness-report.json"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "greyzone-ai/samd-dhf-template")
GITHUB_API = "https://api.github.com"


def parse_frontmatter(file_path: Path) -> dict | None:
    """Parse YAML frontmatter from a markdown file."""
    text = file_path.read_text()
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    try:
        return yaml.safe_load(parts[1])
    except yaml.YAMLError:
        return None


def get_all_dhf_files() -> list[Path]:
    """Return all markdown files in the dhf/ directory tree."""
    return sorted(DHF_DIR.rglob("*.md"))


def check_staleness(meta: dict, file_path: Path) -> dict:
    """Check if a document is stale. Returns a staleness record."""
    today = date.today()
    last_reviewed = meta.get("last_reviewed")
    interval = meta.get("review_interval_days", 90)

    if isinstance(last_reviewed, (date, datetime)):
        last_reviewed_date = last_reviewed if isinstance(last_reviewed, date) else last_reviewed.date()
    else:
        try:
            last_reviewed_date = date.fromisoformat(str(last_reviewed))
        except (ValueError, TypeError):
            last_reviewed_date = None

    if last_reviewed_date is None:
        status = "unknown"
        days_overdue = None
        due_date = None
    else:
        due_date = last_reviewed_date + timedelta(days=interval)
        days_overdue = (today - due_date).days if today > due_date else 0
        status = "stale" if days_overdue > 0 else "current"

    return {
        "file": str(file_path.relative_to(DHF_DIR.parent)),
        "title": meta.get("title", file_path.stem),
        "section": meta.get("section", "unknown"),
        "owner": meta.get("owner", "unassigned"),
        "status": meta.get("status", "unknown"),
        "last_reviewed": str(last_reviewed_date) if last_reviewed_date else None,
        "review_interval_days": interval,
        "due_date": str(due_date) if due_date else None,
        "days_overdue": days_overdue,
        "staleness_status": status,
        "tags": meta.get("tags", []),
        "version": meta.get("version", "unknown"),
        "checked_at": str(today),
    }


def open_github_issue(record: dict) -> bool:
    """Open a GitHub Issue for a stale document. Returns True if successful."""
    if not GITHUB_TOKEN:
        print(f"  ⚠️  No GITHUB_TOKEN — skipping issue creation for {record['title']}")
        return False

    title = f"📋 DHF Review Due: {record['title']}"
    body = f"""## DHF Section Review Required

| Field | Value |
|---|---|
| **Section** | `{record['section']}` |
| **File** | `{record['file']}` |
| **Owner** | {record['owner']} |
| **Last Reviewed** | {record['last_reviewed']} |
| **Review Interval** | {record['review_interval_days']} days |
| **Due Date** | {record['due_date']} |
| **Days Overdue** | {record['days_overdue']} days |

### Action Required
1. Review this DHF section for accuracy and completeness
2. Update the content as needed
3. Update `last_reviewed` in the YAML frontmatter to today's date
4. Commit and push — this issue will close automatically on the next staleness check if no longer stale

*Opened automatically by the GreyZone AI SaMD DHF staleness monitor.*
"""

    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    # Check if issue already exists (avoid duplicates)
    search_url = f"{GITHUB_API}/search/issues"
    search_params = {
        "q": f'repo:{GITHUB_REPOSITORY} is:open is:issue "{record["title"]}" in:title label:dhf-review',
    }
    search_resp = requests.get(search_url, headers=headers, params=search_params, timeout=10)
    if search_resp.ok and search_resp.json().get("total_count", 0) > 0:
        print(f"  ℹ️  Issue already exists for {record['title']} — skipping")
        return False

    # Create the issue
    issues_url = f"{GITHUB_API}/repos/{GITHUB_REPOSITORY}/issues"
    payload = {
        "title": title,
        "body": body,
        "labels": ["dhf-review", "automated"],
    }
    resp = requests.post(issues_url, headers=headers, json=payload, timeout=10)
    if resp.ok:
        issue_url = resp.json().get("html_url", "")
        print(f"  ✅ Issue opened: {issue_url}")
        return True
    else:
        print(f"  ❌ Failed to open issue: {resp.status_code} {resp.text}")
        return False


def main():
    print("=" * 60)
    print("SaMD DHF Staleness Check — GreyZone AI")
    print("=" * 60)

    files = get_all_dhf_files()
    records = []
    stale_count = 0

    for file_path in files:
        meta = parse_frontmatter(file_path)
        if not meta:
            print(f"  ⚠️  No frontmatter: {file_path.name}")
            continue

        record = check_staleness(meta, file_path)
        records.append(record)

        status_icon = "🔴" if record["staleness_status"] == "stale" else "🟢"
        print(f"  {status_icon} {record['title']} — {record['staleness_status'].upper()}", end="")
        if record["days_overdue"]:
            print(f" ({record['days_overdue']} days overdue)", end="")
        print()

        if record["staleness_status"] == "stale":
            stale_count += 1
            open_github_issue(record)

    # Write dashboard-ready JSON
    output = {
        "generated_at": str(date.today()),
        "repository": GITHUB_REPOSITORY,
        "summary": {
            "total_sections": len(records),
            "stale": stale_count,
            "current": len(records) - stale_count,
        },
        "sections": records,
    }
    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"\n📄 Staleness report saved to: {OUTPUT_FILE.name}")

    print(f"\n{'=' * 60}")
    print(f"Summary: {stale_count} stale / {len(records)} total sections")
    if stale_count > 0:
        print("GitHub Issues opened for all stale sections.")
    print("=" * 60)


if __name__ == "__main__":
    main()
