# AI Pipeline

## Request construction

The worker builds an `AiReviewRequest` containing:
- repository language, PR title/description
- per-file: serialized hunks + snippets of *touched* functions only
- static findings so the model does not duplicate them
- whether tests were touched

## Structured output

The provider (default: OpenAI-compatible `/chat/completions`) is instructed to
return only JSON: `{summary, findings[]}`. The response is parsed with Zod
(`AiReviewResponseSchema`); malformed output raises `AiValidationError`
and the review continues with deterministic findings only (degradation, not failure).

## Hallucination reduction

Every AI finding must pass all gates (packages/ai/src/validate.ts):

1. **File exists** in the diff (path-normalized match).
2. **Line is changed** (within 3 lines of an added line).
3. **Evidence is real** — the quoted code appears in diff/snippets.
4. **No duplicate** of another AI finding or existing static finding.
5. **Severity clamp** — max MEDIUM unless a static finding exists at the same
   file:line (then max CRITICAL, confidence up to 0.95).
6. **Confidence haircut** — uncorroborated AI findings capped at 0.75.

Rejected findings are logged with reasons (`hallucinated file`,
`line not in changed lines`, `evidence not found in file`, ...) for evaluation.

## Privacy

`config.ai.enabled=false` (per-repo) or a missing API key disables the AI
layer entirely; reviews then use static/AST/rules only.
