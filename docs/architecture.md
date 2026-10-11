# CodeLens Architecture

## System overview

```
GitHub --webhook--> apps/api (Fastify)
                     |  HMAC verify, Zod validate, dedupe
                     v
                  Redis (BullMQ)  <-- queue: codelens-review
                     |
                     v
             workers/review-worker
               1. cache check (commitSha + configHash)
               2. fetch PR diff -> parse unified diff
               3. fetch changed file sources
               4. AST analysis (ts-morph / regex-py)
               5. rule engine (deterministic)
               6. AI layer (validated, clamped)
               7. aggregation (dedupe, severity policy)
               8. persist (Prisma/PostgreSQL)
               9. GitHub comments (summary + inline)
                     |
                     v
                apps/web (Next.js dashboard)
```

## Layers of analysis

| Layer | What it does | Package |
|---|---|---|
| Diff | exact added/removed/context lines, hunks | packages/analyzer/diff-parser |
| AST | functions, classes, await-in-loop, empty catch | packages/analyzer/ast-* |
| Metrics | complexity, length, nesting, duplication, score | packages/analyzer/metrics |
| Rules | deterministic detectors (RULE001..007) | packages/rules |
| AI | higher-level reasoning, structured JSON | packages/ai |

The AI layer receives structured context (diff hunks + changed-symbol
snippets + static findings), never the whole repository.

## Key invariants

- No webhook payload is trusted without HMAC verification (timing-safe).
- Review jobs are deduped per (repo, PR, commit).
- AI findings must pass the hallucination gate (see ai-pipeline.md).
- Severity from AI is clamped to MEDIUM unless corroborated by static evidence.
- Repositories are never cloned/persisted; only fetched file contents in memory.
