# Master Key Rotation Runbook

This document describes the procedure for rotating `ENCRYPTION_MASTER_KEY`, the AES-256-GCM system-level encryption key used to protect `agentOutputs`, `keySignals`, `missingInfo` in `pitch_triages` and `strengths`, `concerns`, `flags`, `recommendedAction` in `founder_agent_evaluations`.

---

## When to rotate

- **Suspected key compromise** — any indication that `ENCRYPTION_MASTER_KEY` may have been exposed (e.g. leaked in logs, committed to source control, visible in an error trace)
- **Quarterly security review** — routine rotation as part of the security calendar
- **Team member offboarding** — when a team member with access to production secrets leaves

---

## Steps

### 1. Generate a new key

Using OpenSSL (recommended):

```bash
openssl rand -hex 32
```

Or in a browser console:

```js
Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')
```

The output is a 64-character hex string. Keep it secret — do not paste it into chat, email, or any unencrypted channel.

---

### 2. Dry run (verify row count)

Run the rotation script with `--dry-run` to confirm the number of rows that will be re-encrypted, without making any changes:

```bash
NEW_ENCRYPTION_MASTER_KEY=<new-key> \
node server/scripts/rotate-master-key.mjs \
--dry-run
```

Expected output:

```
[DRY RUN] Would rotate 985 rows
Dry run complete — no changes made.
```

Confirm the row count matches expectations before proceeding.

---

### 3. Live rotation

Run the rotation script without `--dry-run`. The script is atomic: it decrypts every row with the old key and re-encrypts with the new key in a single transaction. If any row fails, the script aborts and no changes are committed.

```bash
NEW_ENCRYPTION_MASTER_KEY=<new-key> \
node server/scripts/rotate-master-key.mjs
```

Expected output:

```
Rotating 985 rows...
Rotation complete — 985 rows re-encrypted, 0 errors.
```

---

### 4. Update the secret

1. Go to **Manus Settings → Secrets**
2. Find `ENCRYPTION_MASTER_KEY`
3. Replace the value with the new key
4. Click **Save**
5. **Deploy / Publish** the project so the running server picks up the new key

> **Important:** Do not discard the old key until after you have verified coverage in step 5. If the deployment fails, the old key is still valid and no data has been lost.

---

### 5. Verify

After deployment, check that encryption coverage remains at 100%:

1. Navigate to `/security` (must be logged in as admin)
2. Open the **Encryption Status** section (06)
3. Confirm:
   - `pitch_triages: 100%`
   - `founder_agent_evaluations: 100%`
   - `Overall: 100%`

Or query the `system.encryptionStatus` tRPC endpoint directly.

---

## Rollback

If the rotation script fails mid-way:

- The script aborts automatically — the transaction is rolled back
- The old key is still valid — no data has been lost or corrupted
- No action is needed to restore service
- Investigate the error in the script output or server logs
- Retry the rotation when the root cause is resolved

> The rotation script uses an all-or-nothing approach: either all rows are re-encrypted successfully, or none are. There is no partial state to recover from.

---

## Notes

- The rotation script only covers `pitch_triages` (fields: `agentOutputs`, `keySignals`, `missingInfo`). If `founder_agent_evaluations` fields are added to the rotation scope in future, update both the script and this runbook.
- `recommended_action` in `founder_agent_evaluations` is also encrypted. Ensure the rotation script is extended to cover it when it is added.
- `pitchPreview` in `pitch_triages` and `recommended_action` (legacy plaintext rows) are **not** encrypted — they are short label fields stored as plaintext. The rotation script does not touch them.
