import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  GITHUB_WEBHOOK_SECRET: z.string().default(""),
  APP_URL: z.string().default("http://localhost:3000"),
  API_URL: z.string().default("http://localhost:4000"),
  JWT_SECRET: z.string().default("dev-jwt-secret-change-me"),
  ENCRYPTION_KEY: z.string().default("dev-encryption-key-change-me-please"),
  AI_PROVIDER: z.string().default("openai"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().optional(),
  MAX_REVIEW_FILES: z.coerce.number().default(50),
  MAX_REVIEW_LINES: z.coerce.number().default(4000),
  PORT: z.coerce.number().default(4000),
});

export const env = EnvSchema.parse(process.env);
