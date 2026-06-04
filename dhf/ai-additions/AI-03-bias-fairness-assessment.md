---
title: "Bias and Fairness Assessment"
section: ai-bias-fairness
version: 1.0
status: draft
owner: ml-engineering
last_reviewed: 2026-06-03
review_interval_days: 60
tags: [ai, bias, fairness, equity, subgroup-analysis]
linked_requirements: [REQ-002]
linked_hazards: [H-002]
---

# Bias and Fairness Assessment

> Reference: FDA "Artificial Intelligence and Machine Learning in Software as a Medical Device" discussion paper; EU AI Act Article 10 (data governance); NIST AI RMF — BIAS.

---

## 1. Protected Attributes Assessed

| Attribute | Categories Analyzed | Data Available? |
|---|---|---|
| Sex | Female, Male, Other/Unknown | [Yes/No] |
| Age group | <18, 18–40, 41–65, >65 | [Yes/No] |
| Race/Ethnicity | [List groups present in dataset] | [Yes/No] |
| Socioeconomic status | [If applicable] | [Yes/No] |
| Geographic region | [Countries/regions represented] | [Yes/No] |
| Primary language | [If applicable] | [Yes/No] |

---

## 2. Bias Assessment Methodology

```
[Describe the method used — e.g., disparate impact analysis, equalized odds, demographic parity, etc.]
```

**Fairness metric used:** `[Equalized Odds / Demographic Parity / Equal Opportunity / other]`

**Threshold for acceptable disparity:** No subgroup metric may differ from overall metric by more than `[X]%`

---

## 3. Findings

| Subgroup | Metric | Value | Overall Metric | Disparity | Acceptable? |
|---|---|---|---|---|---|
| Female | Sensitivity | [X]% | [Y]% | [+/-Z%] | [Yes/No] |
| Male | Sensitivity | [X]% | [Y]% | [+/-Z%] | [Yes/No] |
| Age <40 | AUC | [X] | [Y] | [+/-Z] | [Yes/No] |
| Age ≥65 | AUC | [X] | [Y] | [+/-Z] | [Yes/No] |
| [Race group] | [Metric] | [X] | [Y] | [+/-Z] | [Yes/No] |

---

## 4. Root Cause Analysis for Identified Disparities

| Subgroup | Disparity Found | Likely Root Cause | Mitigation Applied |
|---|---|---|---|
| [Group] | [Metric, delta] | [Under-representation / Label noise / Feature bias] | [Resampling / Reweighting / Additional data collection] |

---

## 5. Residual Bias and Limitations

```
[Document any disparities that could not be fully mitigated and their clinical implications.
Include this in the Instructions for Use / labeling.]
```

---

## 6. Ongoing Monitoring Plan

- Subgroup performance will be re-evaluated at every model update (see PCCP)
- Field complaints will be analyzed by patient demographic where available
- Annual review of subgroup performance against real-world use data

---

## 7. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
