---
title: "Data and Concept Drift Monitoring Plan"
section: ai-drift-monitoring
version: 1.0
status: draft
owner: ml-engineering
last_reviewed: 2026-06-03
review_interval_days: 30
tags: [ai, drift, post-market, monitoring, mlops]
linked_requirements: [REQ-002]
linked_hazards: [H-001, H-002]
---

# Data and Concept Drift Monitoring Plan

> Drift in real-world input data or population characteristics can silently degrade model performance without any code change. This plan defines how drift is detected, measured, and acted upon.

---

## 1. Types of Drift Monitored

| Drift Type | Definition | Risk |
|---|---|---|
| Data drift (covariate shift) | Distribution of input features changes over time | Model outputs become unreliable |
| Concept drift | Relationship between inputs and correct outputs changes | Model predictions become incorrect |
| Label drift | Distribution of ground truth labels changes | Performance metrics become misleading |
| Population drift | Patient population shifts away from training population | Subgroup performance degrades |

---

## 2. Monitored Features

| Feature | Monitoring Method | Baseline Distribution | Alert Threshold |
|---|---|---|---|
| [Feature 1 — e.g., age distribution] | KL divergence | [Baseline stats] | KL > [X] |
| [Feature 2 — e.g., image quality score] | PSI (Population Stability Index) | [Baseline stats] | PSI > 0.2 |
| [Feature 3 — e.g., lab value ranges] | Z-score | [Mean ± SD] | |Z| > 3 |
| Model output distribution | Distribution shift | [Baseline output dist.] | PSI > 0.1 |

---

## 3. Monitoring Infrastructure

```
[Describe the MLOps tooling used — e.g., Evidently AI, WhyLogs, AWS SageMaker Model Monitor, custom scripts]
```

**Monitoring frequency:** `[Real-time / Hourly / Daily / Weekly]`

**Data retention for monitoring:** `[X months of inference logs retained]`

---

## 4. Alert and Escalation Protocol

| Severity | Condition | Action | Timeline |
|---|---|---|---|
| Warning | Drift metric approaches threshold | Notify ML team, increase monitoring frequency | Within 24 hrs |
| Alert | Drift metric exceeds threshold | Suspend model updates, initiate investigation | Within 8 hrs |
| Critical | Performance degradation confirmed | Escalate to regulatory, consider field safety notification | Within 4 hrs |

---

## 5. Response Playbook

```
Drift detected
      ↓
Confirm drift is real (not monitoring artifact)
      ↓
Assess clinical impact (which patient population affected?)
      ↓
Update risk file with new/changed hazard
      ↓
Evaluate: retrain / recalibrate / restrict use / field safety action
      ↓
Implement PCCP-approved change if within performance boundaries
      ↓
Document in PCCP change log
```

---

## 6. Review History

| Version | Date | Reviewer | Change Summary |
|---|---|---|---|
| 1.0 | 2026-06-03 | [Name] | Initial draft |
