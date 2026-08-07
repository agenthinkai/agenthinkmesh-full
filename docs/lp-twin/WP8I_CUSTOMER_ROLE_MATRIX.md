# LP Twin v1 — Customer Role Matrix

**Version:** 1.0.0
**Status:** READY FOR USE
**Last Updated:** 2026-08-07

---

## Role Definitions

LP Twin v1 uses the existing AgenThinkMesh enterprise membership model.
All LP Twin access is gated by active enterprise membership in the user's organisation.

| Role | Access Level | LP Twin Capabilities |
|---|---|---|
| **Org Admin** | Full | All LP Twin features including calibration candidate review, export, and participant management |
| **Org Member** | Standard | Fund creation, simulation, meeting preparation, scenario testing, pipeline management, reports |
| **Unauthenticated** | None | No access to any LP Twin feature |
| **Suspended Member** | None | Access denied even if org membership record exists |
| **Cross-Tenant User** | None | Structurally impossible — all data is org-scoped at the database level |

---

## Feature Access by Role

| Feature | Org Admin | Org Member | Notes |
|---|---|---|---|
| Create fund profile | ✓ | ✓ | |
| Edit fund profile | ✓ | ✓ | |
| Archive fund | ✓ | ✓ | Soft delete only |
| Duplicate fund | ✓ | ✓ | |
| Run simulation | ✓ | ✓ | |
| View session results | ✓ | ✓ | |
| Ask-an-LP | ✓ | ✓ | |
| Delete session | ✓ | ✓ | Soft delete only |
| Export session | ✓ | ✓ | Audit record written |
| Create scenario | ✓ | ✓ | |
| Compute scenario | ✓ | ✓ | |
| Generate sequence | ✓ | ✓ | |
| Run market stress | ✓ | ✓ | |
| Run sensitivity | ✓ | ✓ | |
| Get recommended config | ✓ | ✓ | |
| Generate meeting brief | ✓ | ✓ | |
| Objection rehearsal | ✓ | ✓ | |
| LP panel simulation | ✓ | ✓ | |
| Generate report | ✓ | ✓ | |
| Record actual meeting | ✓ | ✓ | |
| Manage pipeline | ✓ | ✓ | |
| View LP Agent Bank | ✓ | ✓ | Read-only |
| Create validation participant | ✓ | ✓ | |
| Update participant consent | ✓ | ✓ | |
| Delete participant | ✓ | ✓ | Anonymizes PII |
| Submit human response | ✓ | ✓ | Requires participant consent |
| Create synthetic snapshot | ✓ | ✓ | |
| Compare with snapshot | ✓ | ✓ | |
| Create calibration candidate | ✓ | ✓ | |
| **Review calibration candidate** | **✓** | **✓** | v1: all members; v2: admin only |
| View validation dashboard | ✓ | ✓ | |
| Import validation data | ✓ | ✓ | |

---

## Known Role Limitation (v1)

In LP Twin v1, calibration candidate review (approving or rejecting proposed agent bank
changes) is available to all org members, not just admins. This is a known limitation
documented in the WP8 security audit.

**Rationale:** For the founding validation engagement, all users are trusted founding
customer representatives. Restricting calibration review to admins will be implemented
in LP Twin v2 when the calibration workflow is used in production.

**Documented in:** `server/routers/lpTwin.wp8.pentest.test.ts` test PT19.

---

## Tenant Isolation Guarantee

Every LP Twin procedure is gated by `enterpriseProcedure`, which:

1. Verifies the user has an active session (JWT)
2. Verifies the user has an active (non-suspended) enterprise membership in the requested org
3. Injects `ctx.orgId` from the verified membership — never from client input
4. All database queries include `eq(table.orgId, ctx.orgId)` — cross-tenant access is structurally impossible

This guarantee is verified by 35 automated penetration tests in
`server/routers/lpTwin.wp8.pentest.test.ts` and must pass before every release.

