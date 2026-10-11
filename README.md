# CodeLens — AI-Powered Code Review Platform

Automated PR code review: GitHub webhook -> async pipeline (diff parsing,
AST analysis, metrics, rule engine, validated AI analysis) -> PR comments +
developer dashboard with analytics and feedback.

## Monorepo layout

```
apps/api            Fastify REST API, OAuth, webhooks
apps/web            Next.js dashboard (Tailwind, Recharts)
workers/review-worker  BullMQ pipeline worker
packages/types      shared Zod schemas + types
packages/github     OAuth, HMAC, GitHub API client
packages/analyzer   diff parser, AST, metrics
packages/rules      rule engine + RULE001..007
packages/ai         provider abstraction, OpenAI adapter, hallucination gates
packages/config     .codelens.yml + ignore handling
prisma/             PostgreSQL schema
tests/              vitest: analysis, AI validation, evaluation dataset
```

## Quick start

1. **Infra** (requires Docker Desktop):
   ```
   docker compose up -d postgres redis
   ```
2. **Env**: copy `.env.example` to `.env`, fill `GITHUB_CLIENT_ID/SECRET`,
   `GITHUB_WEBHOOK_SECRET`, `JWT_SECRET`, `ENCRYPTION_KEY`, `OPENAI_API_KEY`.
3. **Database**:
   ```
   npm install
   npm run db:migrate
   ```
4. **Run** (3 terminals):
   ```
   npm run dev:api      # http://localhost:4000
   npm run dev:worker
   npm run dev:web      # http://localhost:3000
   ```
5. **GitHub app setup**: create an OAuth App (callback
   `{API_URL}/auth/github/callback`) and a webhook
   (`{API_URL}/webhooks/github`, events: pull_request).

## Commands

| Command | Purpose |
|---|---|
| `npm run test` | vitest suite (analysis, AI guards, evaluation) |
| `npm run typecheck` | tsc over the whole monorepo |
| `npm run db:studio` | Prisma Studio |

## Docs

- [Architecture](docs/architecture.md)
- [AI pipeline & hallucination guards](docs/ai-pipeline.md)
- [Security](docs/security.md)
- [Evaluation methodology](docs/evaluation.md)

## Repository config

`.codelens.yml` in a repo root controls review behavior (see
packages/config); `.codelensignore` excludes paths.

## Local development notes

- `.env` is gitignored. Secrets (`JWT_SECRET`, `ENCRYPTION_KEY`,
  `GITHUB_WEBHOOK_SECRET`) can be any random string, e.g.
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Set `AI_PROVIDER=mock` to run without an OpenAI key. Without
  `OPENAI_API_KEY` the AI layer is skipped and only deterministic rules run.
- No Docker? Point `DATABASE_URL` / `REDIS_URL` at any local or hosted
  PostgreSQL 16 and Redis 7 instead, then run `npx prisma migrate deploy`.
- The initial migration lives in `prisma/migrations/`. After editing
  `schema.prisma` use `npm run db:migrate` to create a new one.
- The test suite needs no database, Redis or network: Prisma, the queue and
  the GitHub client are mocked (`tests/pipeline.test.ts`,
  `tests/api-webhook.test.ts`).
- To receive real webhooks locally, expose the API with a tunnel (e.g. ngrok)
  and use `{tunnel-url}/api/webhooks/github` as the webhook URL.
