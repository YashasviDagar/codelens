# Security

## Authentication & authorization
- GitHub OAuth (state cookie, timing-safe compare) -> server-side session cookie
  (httpOnly, sameSite=lax, hashed token in DB, 7-day expiry).
- All dashboard/API data access goes through repository-membership checks
  (`requireRepoAccess`) — users cannot read repos/reviews they do not belong to.

## Webhooks
- `x-hub-signature-256` verified with HMAC-SHA256 over the **raw request bytes**,
  timing-safe comparison. Invalid signatures are rejected with 401.
- Payloads are validated with Zod before any persistence.

## Secrets
- GitHub tokens stored AES-256-GCM encrypted (`ENCRYPTION_KEY`, scrypt-derived).
- No secrets in the frontend; the web app proxies API calls server-side.
- Webhook endpoint exempt from rate limiting (signature is its gate); all other
  endpoints rate-limited (300/min).

## Data handling
- No repository cloning. File contents fetched per changed file via the GitHub
  contents API and held in memory only for the duration of the review.
- Least-privilege OAuth scope: `read:user user:email repo`.

## Threat model (summary)
| Threat | Mitigation |
|---|---|
| Forged webhook | HMAC verify over raw bytes |
| Replay of webhook | job dedupe on (repo,pr,commit) |
| Token theft from DB | AES-256-GCM at rest |
| Cross-tenant read | membership checks on every route |
| Prompt injection from code | AI output schema-validated; findings anchored to diff; no repo mutation |
