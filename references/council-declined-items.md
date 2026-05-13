# Council of 10 — Declined and Parked Items

---

## Permanently Declined Items

These items have been explicitly and permanently declined by the project owner.
They must not be re-proposed in any completion report, under any framing or renamed variant.

1. **Shareable verdict URL** — any variant: query parameter, fingerprint hash, encoded question, pre-populated textarea from URL. Declined three times across v1.0, v1.1, and v1.2. Permanently closed.

2. **Heavy-category analytics, logging, or counting** — any form of tracking which sensitive categories are triggered, how often, or by which patterns. Permanently closed.

3. **Wiring the Council to invokeLLM, the Mesh backend, or any model service** — while the Council is in the deterministic-engine architecture, no LLM integration is to be proposed. Permanently closed.

---

## Parked Items

These items are not declined — they are deferred pending a specific future event or decision. They may be revisited when the noted condition is met.

1. **Cloudflare Web Analytics** — cookieless, free-tier page-view tracking for `/council`. Privacy posture verified (no cookies, no fingerprinting, no consent banner required). Implementation blocked on Cloudflare account access and token generation. **Parked until after the Lightbox meeting on May 28, 2026.** Do not re-propose before that date; revisit on owner's initiative after the meeting.

---

*Last updated: 2026-05-13*
*Permanently declined items: non-revisitable. Parked items: revisit when noted condition is met.*
