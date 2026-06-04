---
title: "Risk Management File"
section: risk-management
version: 1.0
status: draft
owner: quality
last_reviewed: 2026-06-03
review_interval_days: 60
tags: [risk, iso-14971, hazard-analysis, post-market]
linked_requirements: []
linked_hazards: [H-001, H-002, H-003]
---

# Risk Management File

> Follows ISO 14971:2019. For AI/ML products, also reference IEC TR 62304 and FDA AI/ML Action Plan.

---

## 1. Risk Management Plan Summary

| Attribute | Value |
|---|---|
| Risk management standard | ISO 14971:2019 |
| Acceptable risk criteria | [Define — e.g., residual risk < 1×10⁻⁴ per use] |
| Risk management team | [Names / Roles] |
| Review frequency | Every `60` days or upon any design change |

---

## 2. Hazard Register

> Each hazard must map to at least one requirement and one verification test.

| Hazard ID | Hazard | Foreseeable Sequence of Events | Hazardous Situation | Harm | Severity | Probability | Risk Level | Control | Residual Risk |
|---|---|---|---|---|---|---|---|---|---|
| H-001 | [Hazard description] | [How it occurs] | [Situation] | [Patient / User harm] | [1-5] | [1-5] | [S×P] | [Control measure] | [Acceptable / ALARP / Unacceptable] |
| H-002 | | | | | | | | | |
| H-003 | | | | | | | | | |

**Risk scoring guide:**
- Severity: 1 = Negligible, 2 = Minor, 3 = Serious, 4 = Critical, 5 = Catastrophic
- Probability: 1 = Improbable, 2 = Remote, 3 = Occasional, 4 = Probable, 5 = Frequent

---

## 3. Risk Controls Summary

| Control ID | Type | Description | Linked Hazard(s) | Verified By |
|---|---|---|---|---|
| RC-001 | Design | [Description] | H-001 | [Test ID] |
| RC-002 | Labeling | [Description] | H-002 | [Test ID] |

---

## 4. Benefit-Risk Determination

```
[Summarize the overall benefit-risk conclusion. Reference clinical evidence or performance data.]
```

---

## 5. Post-Market Risk Updates

| Date | Trigger | Hazard(s) Affected | Action Taken |
|---|---|---|---|
| [Date] | [Complaint / CAPA / Field signal] | [H-XXX] | [Update risk level / Add control] |

---

## 6. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
