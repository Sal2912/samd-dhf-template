---
title: "Model Card"
section: ai-model-card
version: 1.0
status: draft
owner: ml-engineering
last_reviewed: 2026-06-03
review_interval_days: 30
tags: [ai, model-card, transparency, fairness]
linked_requirements: [REQ-002]
linked_hazards: [H-002]
---

# Model Card

> Required for AI/ML-enabled SaMD. Follows Google Model Card standard adapted for regulatory use. Reference: FDA AI/ML Action Plan, EU AI Act Article 13 (transparency).

---

## 1. Model Overview

| Attribute | Details |
|---|---|
| Model name | `[Model name and version]` |
| Model type | [CNN / Transformer / Gradient Boosting / LLM / etc.] |
| Task | [Classification / Regression / Segmentation / Generation] |
| Clinical purpose | [One sentence — must match intended use statement] |
| Framework | [PyTorch / TensorFlow / scikit-learn / etc.] |
| Model version | v1.0 |
| Release date | [Date] |

---

## 2. Training Data

| Attribute | Details |
|---|---|
| Dataset name | `[Dataset name]` |
| Dataset size | [N samples] |
| Data source | [Hospital / Registry / Synthetic / Public dataset] |
| Date range | [Start] to [End] |
| Geographic scope | [Countries / Regions represented] |
| Inclusion criteria | [Description] |
| Exclusion criteria | [Description] |
| Data governance | [IRB approval / Data use agreement / De-identification method] |
| Known gaps | [Underrepresented populations or conditions] |

---

## 3. Validation Data

| Attribute | Details |
|---|---|
| Validation dataset | `[Name — must be independent from training]` |
| Dataset size | [N samples] |
| Holdout method | [Random split / Temporal split / Site-based split] |
| External validation | [Yes/No — if yes, describe] |

---

## 4. Performance Metrics

| Metric | Value | Confidence Interval | Dataset |
|---|---|---|---|
| Sensitivity | [X]% | [CI] | Validation set |
| Specificity | [X]% | [CI] | Validation set |
| AUC-ROC | [X] | [CI] | Validation set |
| [Other relevant metric] | | | |

**Subgroup performance:** *(required — do not leave blank)*

| Subgroup | Metric | Value | Delta vs. Overall |
|---|---|---|---|
| Sex: Female | Sensitivity | [X]% | [+/-X%] |
| Sex: Male | Sensitivity | [X]% | [+/-X%] |
| Age: <40 | AUC | [X] | [+/-X] |
| Age: ≥65 | AUC | [X] | [+/-X] |
| Race/Ethnicity: [Group] | [Metric] | [X] | [+/-X] |

---

## 5. Limitations and Known Failure Modes

- `[Limitation 1 — e.g., performance degrades on low-resolution images]`
- `[Limitation 2 — e.g., not validated outside training site geography]`
- `[Limitation 3 — e.g., not validated for pediatric population]`

---

## 6. Intended Deployment Context

```
[Describe where and how this model is deployed — cloud API, on-device, embedded in EHR, etc.]
```

**Out of scope uses:**
- `[Explicitly list uses the model should NOT be used for]`

---

## 7. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
