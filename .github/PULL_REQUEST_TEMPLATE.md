## Summary

<!-- What does this PR do? One to three sentences. -->

## Type of Change

- [ ] Bug fix
- [ ] New feature / capability
- [ ] Algorithm / model change
- [ ] Dependency update
- [ ] Refactor (no functional change)
- [ ] Documentation only

---

## DHF Impact

<!-- 
  REQUIRED if this change affects software behavior, algorithm logic,
  data processing, inputs/outputs, security, or performance.
  Leave this section out only if this is a pure documentation or style change.

  The DHF Sync Bot reads this block and automatically:
    - Updates or creates requirement entries
    - Updates or creates hazard entries in the risk file
    - Links test cases
    - Updates the traceability matrix
    - Opens a review Issue if a new risk is introduced

  ID FORMAT:
    REQ: REQ-001                   ← existing requirement
    REQ: NEW                       ← bot will assign next available ID
    RISK: H-002                    ← existing hazard
    RISK: NEW                      ← bot will auto-draft a new hazard
    TEST: TEST-005, TEST-006       ← test case(s) that cover this change

  FREE-TEXT FIELDS (used by bot to auto-draft documents):
    CHANGE:             One sentence describing what changed and why
    NEW_REQ:            Full text of the new requirement (if REQ: NEW)
    REQ_CATEGORY:       Functional | Performance | Security | Usability | Interface
    REQ_SOURCE:         Clinical evidence | Standard | Regulation | Engineering
    RISK_JUSTIFICATION: Why no new risk is introduced (if no RISK: NEW)
-->

REQ: <!-- e.g. REQ-003 or NEW -->
RISK: <!-- e.g. H-002 or NEW -->
TEST: <!-- e.g. TEST-005, TEST-006 — or leave blank if not yet written -->

CHANGE: <!-- One sentence: what this change does and why -->
NEW_REQ: <!-- Full requirement statement if REQ: NEW — delete if not needed -->
REQ_CATEGORY: <!-- Functional | Performance | Security | Usability | Interface -->
REQ_SOURCE: <!-- Clinical evidence | Standard | Regulation | Engineering -->
RISK_JUSTIFICATION: <!-- Why no new risk? Delete if RISK: NEW -->

---

## Testing

- [ ] Unit tests added / updated
- [ ] Integration tests pass
- [ ] Usability implications considered
- [ ] No regression in model performance (if ML change)

## Checklist

- [ ] DHF Impact block filled in (or confirmed not applicable)
- [ ] Self-review complete
- [ ] Linked Issues updated
