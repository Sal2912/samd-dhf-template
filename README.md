# SaMD DHF Template — GreyZone AI

A **living** Design History File (DHF) template for Software as a Medical Device (SaMD) and AI/ML-enabled medical software. Built and maintained by [GreyZone AI](https://greyzone-ai.com).

> This is not a static checklist. Every document carries metadata that drives automated staleness checks, traceability validation, and dashboard exports.

---

## What's Inside

| Folder | Contents |
|---|---|
| `dhf/` | Core SaMD DHF sections (intended use, risk, design, V&V, traceability) |
| `dhf/ai-additions/` | AI/ML-specific additions (model card, PCCP, bias assessment, drift plan, explainability) |
| `scripts/` | Staleness checker, traceability validator, metadata exporter |
| `.github/workflows/` | CI on push + nightly scheduled automation |
| `docs/` | Usage guide and dashboard integration notes |

---

## How the Living Document System Works

Each DHF document has YAML frontmatter:

```yaml
---
title: "Risk Management File"
section: risk-management
version: 1.2
status: active          # active | draft | archived
owner: quality-team
last_reviewed: 2026-06-03
review_interval_days: 60
tags: [risk, iso-14971, post-market]
---
```

### Automation Triggers

| Trigger | What Happens |
|---|---|
| Push to `main` | Traceability check — ensures every requirement links to a test and a hazard |
| Nightly (00:00 UTC) | Staleness check — opens a GitHub Issue for any section past its `review_interval_days` |
| Manual dispatch | Metadata export — outputs `metadata-export.json` and `metadata-export.csv` |

---

## Quick Start

1. Fork this repo into your organization
2. Update YAML frontmatter in each `dhf/` file to reflect your product
3. Set `review_interval_days` per section to match your product's risk profile
4. Enable GitHub Actions (Actions tab → Enable)
5. Check the Issues tab — staleness alerts will appear automatically

---

## Dashboard Integration

Run `scripts/export_metadata.py` to generate `metadata-export.json` and `metadata-export.csv`. These files are structured for import into:
- GitHub Pages (built-in dashboard — see `docs/dashboard.md`)
- Notion databases
- Any BI tool (Tableau, Power BI, Streamlit)

---

## Blog Series

This repo accompanies the GreyZone AI blog series on SaMD:
- [Blog 1: What Most Teams Get Wrong About SaMD](https://greyzoneai.substack.com/p/digital-health-teams-are-great-at)
- Blog 2: A SaMD DHF That Actually Stays Alive *(coming soon)*
- Blog 3: Living Documents — How to Automate Your Entire QMS *(coming soon)*

---

## License

MIT — fork freely, adapt to your product, contribute back.
