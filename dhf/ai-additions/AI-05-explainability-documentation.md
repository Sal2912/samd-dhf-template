---
title: "Explainability and Transparency Documentation"
section: ai-explainability
version: 1.0
status: draft
owner: ml-engineering
last_reviewed: 2026-06-03
review_interval_days: 90
tags: [ai, explainability, xai, transparency, eu-ai-act]
linked_requirements: [REQ-001, REQ-002]
linked_hazards: [H-001]
---

# Explainability and Transparency Documentation

> Reference: EU AI Act Article 13 (Transparency), FDA AI/ML discussion paper, NIST AI RMF — EXPLAIN. Required for high-risk AI systems and AI-enabled SaMD that influences clinical decisions.

---

## 1. Explainability Requirement Assessment

| Question | Answer |
|---|---|
| Does the model output influence a clinical decision? | [Yes/No] |
| Is the model a black-box (e.g., deep neural network)? | [Yes/No] |
| Do users need to understand why an output was generated? | [Yes/No] |
| Is explainability required by applicable regulation? | [Yes — EU AI Act / No] |

**Explainability level required:** `[Output-level / Feature-level / Example-based / None]`

---

## 2. Explainability Methods Used

| Method | Type | When Applied | Output Format |
|---|---|---|---|
| [SHAP] | Feature importance | Per inference | Feature contribution scores |
| [LIME] | Local approximation | On request | Local feature weights |
| [Grad-CAM] | Saliency map (image models) | Per inference | Heatmap overlay |
| [Attention visualization] | Attention weights | Per inference | Token/region weights |
| [Counterfactual explanation] | Example-based | On request | "If X were different, output would be Y" |

---

## 3. User-Facing Explanation Design

```
[Describe what explanation is shown to the end user in the UI/UX.
This must be validated in the usability study (VAL-001).]
```

**Explanation format:** `[Text summary / Visual heatmap / Confidence score / Feature list]`

**Cognitive load assessment:** 
- Does the explanation help clinicians, or overwhelm them?
- Result: `[Assessed in usability study — cite VAL-001]`

---

## 4. Limitations of Explainability

```
[Document known limitations of the chosen XAI method — e.g., 
SHAP approximations may not be faithful for all model types, 
saliency maps can highlight spurious correlations.]
```

---

## 5. Instructions for Use (IFU) Requirements

The following must appear in the IFU / labeling:
- [ ] Description of what the model output means
- [ ] What the model does NOT tell the clinician
- [ ] How to interpret the explanation (if provided)
- [ ] Known limitations that affect clinical interpretation
- [ ] Statement that output is decision-support only (if applicable)

---

## 6. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
