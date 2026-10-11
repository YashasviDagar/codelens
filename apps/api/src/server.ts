import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { oauthRoutes } from "./routes/oauth.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { repositoryRoutes } from "./routes/repositories.js";
import { reviewRoutes } from "./routes/reviews.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { prisma } from "./prisma.js";
import { getSessionUser } from "./auth.js";
import { setRawBody } from "./rawbody.js";

const app = Fastify({
  logger: { level: process.env.NODE_ENV === "production" ? "info" : "debug" },
});

await app.register(cors, { origin: env.APP_URL, credentials: true });
await app.register(cookie);
await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
  allowList: ["/api/webhooks/github"],
});

app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (_req, body: Buffer, done) => {
    setRawBody(_req, body);
    try {
      done(null, JSON.parse(body.toString("utf-8")));
    } catch (err) {
      done(err as Error, undefined as any);
    }
  }
);


// All user-facing routes live under /api; the web app proxies /api/* here.
await app.register(oauthRoutes, { prefix: "/api" });
await app.register(webhookRoutes, { prefix: "/api" });
await app.register(repositoryRoutes, { prefix: "/api" });
await app.register(reviewRoutes, { prefix: "/api" });
await app.register(analyticsRoutes, { prefix: "/api" });

app.get("/health", async () => {
  const db = await prisma.$queryRaw`SELECT 1`;
  return { ok: true, db: Boolean(db) };
});

app.get("/api/me", async (request) => {
  const user = await getSessionUser(request);
  if (!user) return { authenticated: false };
  return {
    authenticated: true,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
});

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});



