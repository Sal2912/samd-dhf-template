---
title: "Predetermined Change Control Plan (PCCP) / Algorithm Change Protocol"
section: ai-pccp
version: 1.0
status: draft
owner: regulatory
last_reviewed: 2026-06-03
review_interval_days: 60
tags: [ai, pccp, algorithm-change, fda, continuous-learning]
linked_requirements: [REQ-002]
linked_hazards: [H-001, H-002]
---

# Predetermined Change Control Plan (PCCP)

> Required for AI/ML-based SaMD that may update its algorithm post-market. Reference: FDA Guidance "Artificial Intelligence and Machine Learning Software as a Medical Device Action Plan" and draft PCCP Guidance (2023).

---

## 1. Purpose

This PCCP defines:
1. The types of algorithm modifications anticipated post-approval
2. The methodology for implementing those modifications
3. The performance benchmarks that must be maintained
4. The conditions under which a new regulatory submission is required vs. not

---

## 2. Planned Modifications

| Change Type | Description | Anticipated Frequency | Submission Required? |
|---|---|---|---|
| Retrain on new data | Periodic retraining with additional labeled data | Quarterly | No — if within performance bounds |
| Hyperparameter tuning | Adjusting model hyperparameters for performance | Ad hoc | No — if within performance bounds |
| Architecture change | Changing model architecture (e.g., new backbone) | Annually | Yes — new 510(k) / PMA supplement |
| Input data format change | Change to accepted input types or preprocessing | Ad hoc | Regulatory assessment required |
| Output change | Change to output format or clinical interpretation | Any | Yes — new submission |

---

## 3. Performance Boundaries

> Changes that stay within these boundaries do not require a new regulatory submission.

| Metric | Baseline | Minimum Acceptable | Maximum Acceptable Change |
|---|---|---|---|
| Sensitivity | [X]% | [X-Y]% | No more than [Z]% degradation |
| Specificity | [X]% | [X-Y]% | No more than [Z]% degradation |
| AUC-ROC | [X] | [X-Y] | No more than [Z] degradation |
| Subgroup delta | [X]% | Max [Y]% gap between any subgroup | — |

**If a metric falls outside the boundary:** Change must be escalated to regulatory team and a new submission evaluated.

---

## 4. Modification Methodology

For each planned modification:

1. **Data governance** — Source, labeling, de-identification, and IRB documentation
2. **Training protocol** — Reproducible training script with version control
3. **Evaluation protocol** — Independent validation dataset, metrics, and subgroup analysis
4. **Comparison report** — Performance delta vs. baseline, documented in model card
5. **Risk review** — Updated risk management file entry
6. **Deployment gate** — All benchmarks must pass before production deployment

---

## 5. Change Log

| Change ID | Date | Change Type | Performance Delta | Submission Required | Outcome |
|---|---|---|---|---|---|
| CHG-001 | [Date] | [Type] | [Delta] | [Yes/No] | [Deployed/Rejected] |

---

## 6. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
