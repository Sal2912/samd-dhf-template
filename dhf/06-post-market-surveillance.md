---
title: "Post-Market Surveillance Plan"
section: post-market-surveillance
version: 1.0
status: draft
owner: quality
last_reviewed: 2026-06-03
review_interval_days: 90
tags: [post-market, pms, complaint-handling, vigilance, field-safety]
linked_requirements: []
linked_hazards: [H-001, H-002, H-003]
---

# Post-Market Surveillance Plan

> Covers FDA 21 CFR Part 803 MDR reporting, EU MDR Article 83-86 PMS obligations, and software-specific field monitoring.

---

## 1. PMS Objectives

1. Continuously monitor safety and performance in real-world use
2. Detect new or changed risks not identified pre-market
3. Feed field data back into risk management and design changes
4. Meet regulatory reporting obligations

---

## 2. Data Sources

| Source | Type | Collection Method | Frequency |
|---|---|---|---|
| Complaint system | Reactive | User-submitted tickets | Continuous |
| Product telemetry | Proactive | Automated logging | Real-time |
| Literature review | Proactive | Scheduled search | Quarterly |
| Third-party component advisories | Proactive | CVE feed / vendor alerts | Weekly |
| Clinical registry data | Proactive | [If applicable] | Annually |

---

## 3. Key Performance Indicators (KPIs)

> Define thresholds here. Crossing a threshold triggers investigation and potential CAPA.

| KPI | Definition | Threshold | Action if Exceeded |
|---|---|---|---|
| Complaint rate | Complaints per 1,000 uses | >[X]% | CAPA initiation |
| MDR-reportable events | Count of reportable adverse events | >0 | Immediate MDR report |
| Algorithm performance drift | Delta vs. baseline validation accuracy | >[X]% | Design review |
| Critical cybersecurity incidents | High/critical CVEs in dependencies | >0 | Patch within 72 hrs |
| Unplanned downtime | System unavailability per month | >[X] hrs | Root cause analysis |

---

## 4. Reporting Obligations

| Regulation | Report Type | Trigger | Deadline |
|---|---|---|---|
| FDA 21 CFR 803 | MDR | Death or serious injury | 30 days (5 days if imminent hazard) |
| EU MDR | FSCA / FSN | Field safety corrective action | Per national CA timeline |
| EU MDR | Periodic Safety Update Report | Annually (Class IIb/III) | 12 months post-certification |

---

## 5. Signal Escalation Path

```
Field signal detected
        ↓
Quality team review (within 5 business days)
        ↓
Risk file update (if new or changed hazard)
        ↓
Regulatory assessment (reportable? FSCA needed?)
        ↓
CAPA initiated (if systemic issue)
        ↓
Design change (if required) → Back to V&V
```

---

## 6. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
