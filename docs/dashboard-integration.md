# Dashboard Integration Guide

The metadata export produces two files after every push to `main`:

- `metadata-export.json` — structured, with schema documentation
- `metadata-export.csv` — flat, importable to any tool

---

## Option 1: GitHub Pages (No code needed)

Point a simple static dashboard at `metadata-export.json` using a GitHub Pages site in this repo. The GreyZone AI Blog 3 will include a ready-to-use dashboard template.

---

## Option 2: Notion Database

1. Create a Notion database with columns matching the CSV headers
2. Use the Notion API or [Notion CSV import](https://www.notion.so/help/import-data-into-notion) to import `metadata-export.csv`
3. Set up a Zapier or Make.com automation to re-import on each GitHub Actions run

---

## Option 3: Streamlit / Power BI / Tableau

Load `metadata-export.json` directly:

```python
import json, pandas as pd

with open("metadata-export.json") as f:
    data = json.load(f)

df = pd.DataFrame(data["records"])
```

Key dashboard views to build:
- **Staleness heatmap** — sections by `days_overdue`
- **Coverage matrix** — requirements × hazards × tests
- **Owner workload** — sections per owner, overdue by owner
- **AI vs. SaMD sections** — filter by `is_ai_addition`
- **Version history** — track `version` changes over time

---

## Metadata Fields Reference

| Field | Type | Description |
|---|---|---|
| `file` | string | Relative path to the DHF document |
| `title` | string | Document title |
| `section` | string | Machine-readable section identifier |
| `is_ai_addition` | boolean | True for AI/ML-specific sections |
| `owner` | string | Responsible team or person |
| `status` | string | `draft` / `active` / `archived` |
| `version` | string | Document version |
| `last_reviewed` | ISO date | Last review date |
| `review_interval_days` | integer | Per-section review cadence |
| `linked_requirements` | JSON array | Linked REQ-XXX IDs |
| `linked_hazards` | JSON array | Linked H-XXX IDs |
| `tags` | JSON array | Taxonomy tags |
| `exported_at` | ISO date | Export timestamp |
