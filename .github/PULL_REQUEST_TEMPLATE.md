## Summary

<!-- What does this PR do? 1–3 sentences. -->

## Type of Change

- [ ] Bug fix
- [ ] New feature / capability
- [ ] Algorithm / model change
- [ ] Data processing change
- [ ] Dependency update
- [ ] Refactor (no functional change)
- [ ] Documentation only

---

## DHF Impact

<!--
  Fill this section if your change affects software behavior, inputs/outputs,
  algorithm logic, security, performance, or patient-facing functionality.

  The DHF Sync Bot will read this block, send it to Claude Haiku (AI model),
  and automatically:
    → Draft regulatory-grade requirement and hazard language
    → Update or create entries in the DHF documents
    → Open a review Issue for @Sal2912 to approve before merge
    → Update the traceability matrix
    → Commit all changes back to this branch

  Leave the entire ## DHF Impact section out ONLY for:
    - Pure style/formatting changes
    - Internal refactors with zero functional change
    - Docs-only changes

  ID FORMAT:
    REQ: REQ-001          ← existing requirement this change affects
    REQ: NEW              ← Claude will draft a new requirement
    RISK: H-002           ← existing hazard this change relates to
    RISK: NEW             ← Claude will draft a new hazard (requires risk assessment)
    RISK: NONE            ← no risk — provide RISK_JUSTIFICATION below
    TEST: TEST-005        ← test(s) that verify this change

  CONTEXT FOR CLAUDE (more detail = better drafts):
    CHANGE:               One sentence — what changed and why
    CLINICAL_CONTEXT:     What clinical task does this support? Who is the user?
    NEW_REQ:              If REQ: NEW — full requirement you have in mind (Claude refines it)
    REQ_CATEGORY:         Functional | Performance | Security | Usability | Interface
    REQ_SOURCE:           Clinical evidence | Standard | Regulation | Engineering
    RISK_JUSTIFICATION:   If RISK: NONE — why does no new hazard exist?
-->

REQ: <!-- REQ-XXX or NEW -->
RISK: <!-- H-XXX or NEW or NONE -->
TEST: <!-- TEST-XXX, TEST-XXX — leave blank if not yet written -->

CHANGE: <!-- One sentence: what this code change does -->
CLINICAL_CONTEXT: <!-- What clinical scenario or user does this affect? -->
NEW_REQ: <!-- Full requirement text if REQ: NEW — Claude will refine the language -->
REQ_CATEGORY: <!-- Functional | Performance | Security | Usability | Interface -->
REQ_SOURCE: <!-- Clinical evidence | Standard | Regulation | Engineering -->
RISK_JUSTIFICATION: <!-- Required if RISK: NONE — why does this change not introduce a new hazard? -->

---

## Testing

- [ ] Unit tests added or updated
- [ ] Integration tests pass locally
- [ ] No performance regression
- [ ] No new dependency with unreviewed security posture

## Merge Checklist

- [ ] DHF Impact block filled in (or confirmed not applicable)
- [ ] Self-review complete
- [ ] CI passes (traceability check, unit tests)
- [ ] DHF review Issue approved by @Sal2912 (bot will create it automatically)
