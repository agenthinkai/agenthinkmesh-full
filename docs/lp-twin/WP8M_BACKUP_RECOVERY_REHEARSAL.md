# LP Twin v1 — Backup and Recovery Rehearsal

**Version:** 1.0.0
**Status:** REHEARSAL SCRIPT READY
**Last Updated:** 2026-08-07

---

## Backup Architecture

LP Twin v1 uses the AgenThinkMesh platform's managed database (MySQL/TiDB).
Backup and recovery is handled by the platform provider.

| Component | Backup method | Frequency | Retention |
|---|---|---|---|
| Database (all LP Twin tables) | Managed platform backup | Daily (minimum) | Platform policy |
| Application code | Git repository (`agenthinkai/agenthinkmesh-full`) | Every commit | Indefinite |
| Checkpoints | Manus checkpoint system | On demand | Platform policy |

---

## Data at Risk

The following LP Twin data is stored in the database and would be lost if the database
were corrupted without a backup:

| Table | Data | Criticality |
|---|---|---|
| `lp_twin_funds` | Fund profiles | HIGH — user-created data |
| `lp_twin_sessions` | Simulation sessions | HIGH — user-created data |
| `lp_twin_segment_results` | Simulation results | HIGH — computed results |
| `lp_twin_scenarios` | Scenario definitions | MEDIUM |
| `lp_twin_scenario_results` | Scenario results | MEDIUM |
| `lp_twin_exports` | Export audit records | LOW — audit trail only |
| `lp_twin_actual_meetings` | Actual meeting records | HIGH — real data |
| `lp_twin_validation_participants` | Participant registry | HIGH — consent records |
| `lp_twin_human_responses` | Human validator responses | CRITICAL — validation data |
| `lp_twin_synthetic_snapshots` | Frozen synthetic snapshots | HIGH — comparison baseline |
| `lp_twin_validation_comparisons` | Comparison results | MEDIUM |
| `lp_twin_calibration_candidates` | Calibration proposals | MEDIUM |

---

## Recovery Procedure

### Scenario 1: Application code regression

**Trigger:** A deployment breaks LP Twin functionality.

**Recovery steps:**
1. Identify the last known-good checkpoint using `manus-webdev-logs` and the checkpoint history.
2. Roll back to the last known-good checkpoint using the Manus Management UI → Version history.
3. Verify the full LP Twin test suite passes (222/222) on the restored version.
4. Confirm the pen-test suite passes (35/35).
5. Notify affected users.

**Expected recovery time:** < 15 minutes

### Scenario 2: Database schema migration failure

**Trigger:** A schema migration partially applies and leaves the database in an inconsistent state.

**Recovery steps:**
1. Do not apply further migrations.
2. Contact the platform provider to restore the database to the pre-migration backup.
3. Verify all 13 LP Twin tables exist and have the correct schema.
4. Re-apply the migration using `webdev_execute_sql` with the corrected SQL.
5. Run the full LP Twin test suite to verify recovery.

**Expected recovery time:** 30–60 minutes (depends on platform backup restoration time)

### Scenario 3: Accidental data deletion

**Trigger:** A user accidentally archives or deletes a fund or session.

**Recovery steps:**
1. All LP Twin deletions are soft deletes (`archivedAt` or `deletedAt` columns).
2. Restore the record by setting `archivedAt = NULL` or `deletedAt = NULL` using `webdev_execute_sql`.
3. Verify the record is visible in the LP Twin UI.

**Expected recovery time:** < 5 minutes

### Scenario 4: Participant consent revocation

**Trigger:** A validation participant revokes consent and requests data deletion.

**Recovery steps:**
1. Use the `deleteParticipant` procedure (or the validation dashboard) to anonymize the participant.
2. Verify the participant's PII is replaced with anonymized values.
3. Verify linked human responses are anonymized.
4. Confirm the participant cannot be re-identified from the remaining data.

**Expected recovery time:** < 5 minutes

---

## Rehearsal Checklist

- [ ] Verify database backup is enabled and recent (< 24 hours old)
- [ ] Verify Git repository is up to date with latest feature branch
- [ ] Verify Manus checkpoint history shows at least 3 recent checkpoints
- [ ] Test Scenario 3 (soft delete recovery) on a test record
- [ ] Confirm `webdev_execute_sql` access is available for emergency recovery
- [ ] Document the platform provider's backup SLA

---

## Recovery Rehearsal Attestation

```
RECOVERY_REHEARSAL_ATTESTATION
  Rehearsal date:
  Rehearsal operator:
  Scenario 3 tested: YES / NO
  Backup confirmed recent: YES / NO
  Git repository verified: YES / NO
  Checkpoint history verified: YES / NO
  Operator signature or typed confirmation:
END_RECOVERY_REHEARSAL_ATTESTATION
```

