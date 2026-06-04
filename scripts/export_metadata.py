#!/usr/bin/env python3
"""
Metadata Export — GreyZone AI SaMD DHF Template
================================================
Reads YAML frontmatter from all DHF documents and exports:
  - metadata-export.json  (structured, dashboard-ready)
  - metadata-export.csv   (flat, importable to any BI tool or Notion)

Run manually:    python scripts/export_metadata.py
Run via Actions: workflow_dispatch trigger in export-metadata.yml

Output schema is stable — downstream dashboards can rely on field names.
"""

import csv
import json
from datetime import date, datetime
from pathlib import Path

import yaml

DHF_DIR     = Path(__file__).parent.parent / "dhf"
OUTPUT_JSON = Path(__file__).parent.parent / "metadata-export.json"
OUTPUT_CSV  = Path(__file__).parent.parent / "metadata-export.csv"


def parse_frontmatter(file_path: Path) -> dict | None:
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


def normalize_date(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    try:
        return date.fromisoformat(str(val)).isoformat()
    except (ValueError, TypeError):
        return None


def build_record(meta: dict, file_path: Path) -> dict:
    """Build a normalized, dashboard-ready record from frontmatter metadata."""
    return {
        # Identity
        "file":                  str(file_path.relative_to(DHF_DIR.parent)),
        "title":                 meta.get("title", file_path.stem),
        "section":               meta.get("section", "unknown"),
        "is_ai_addition":        "ai-additions" in str(file_path),

        # Ownership & status
        "owner":                 meta.get("owner", "unassigned"),
        "status":                meta.get("status", "unknown"),
        "version":               str(meta.get("version", "unknown")),

        # Review cadence
        "last_reviewed":         normalize_date(meta.get("last_reviewed")),
        "review_interval_days":  meta.get("review_interval_days", 90),

        # Traceability
        "linked_requirements":   json.dumps(meta.get("linked_requirements", [])),
        "linked_hazards":        json.dumps(meta.get("linked_hazards", [])),

        # Taxonomy
        "tags":                  json.dumps(meta.get("tags", [])),

        # Export timestamp
        "exported_at":           date.today().isoformat(),
    }


def export_json(records: list[dict]) -> None:
    output = {
        "schema_version": "1.0",
        "generated_at":   date.today().isoformat(),
        "description":    "SaMD DHF metadata export — GreyZone AI. Dashboard-ready.",
        "fields": {
            "file":                  "Relative path to the DHF document",
            "title":                 "Document title from frontmatter",
            "section":               "Machine-readable section identifier",
            "is_ai_addition":        "True if this is an AI/ML-specific DHF section",
            "owner":                 "Team or individual responsible for this section",
            "status":                "Document status: draft | active | archived",
            "version":               "Document version",
            "last_reviewed":         "ISO date of last review",
            "review_interval_days":  "How often this section must be reviewed (days)",
            "linked_requirements":   "JSON array of linked requirement IDs",
            "linked_hazards":        "JSON array of linked hazard IDs",
            "tags":                  "JSON array of taxonomy tags",
            "exported_at":           "ISO date this export was generated",
        },
        "records": records,
    }
    OUTPUT_JSON.write_text(json.dumps(output, indent=2))
    print(f"  ✅ JSON export: {OUTPUT_JSON}")


def export_csv(records: list[dict]) -> None:
    if not records:
        return
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    print(f"  ✅ CSV export:  {OUTPUT_CSV}")


def main():
    print("=" * 60)
    print("SaMD DHF Metadata Export — GreyZone AI")
    print("=" * 60)

    files = sorted(DHF_DIR.rglob("*.md"))
    records = []

    for file_path in files:
        meta = parse_frontmatter(file_path)
        if not meta:
            print(f"  ⚠️  Skipping (no frontmatter): {file_path.name}")
            continue
        record = build_record(meta, file_path)
        records.append(record)
        print(f"  📄 {record['title']} [{record['section']}]")

    print(f"\nExporting {len(records)} records...")
    export_json(records)
    export_csv(records)

    print(f"\n{'=' * 60}")
    print(f"Export complete: {len(records)} DHF sections")
    print(f"  JSON → {OUTPUT_JSON.name}")
    print(f"  CSV  → {OUTPUT_CSV.name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
