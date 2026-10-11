import { FastifyInstance } from "fastify";
import { buildAuthorizeUrl, exchangeCodeForToken, fetchAuthenticatedUser } from "@codelens/github";
import { prisma } from "../prisma.js";
import { env } from "../env.js";
import { encryptToken } from "../crypto.js";
import { createSession, SESSION_COOKIE, verifyStateCookie } from "../auth.js";
import { randomToken } from "../crypto.js";

export async function oauthRoutes(app: FastifyInstance) {
  app.get("/auth/github", async (request, reply) => {
    const state = randomToken(16);
    reply.setCookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return reply.redirect(
      buildAuthorizeUrl(env.GITHUB_CLIENT_ID, `${env.API_URL}/auth/github/callback`, state)
    );
  });

  app.get("/auth/github/callback", async (request, reply) => {
    const q = request.query as { code?: string; state?: string };
    if (!q.code || !verifyStateCookie(request.cookies.oauth_state, q.state)) {
      return reply.code(400).send({ error: "invalid oauth state" });
    }
    reply.clearCookie("oauth_state", { path: "/" });

    const tokens = await exchangeCodeForToken(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, q.code, `${env.API_URL}/auth/github/callback`);
    const ghUser = await fetchAuthenticatedUser(tokens.access_token);

    const user = await prisma.user.upsert({
      where: { githubId: BigInt(ghUser.id) },
      update: {
        login: ghUser.login,
        name: ghUser.name,
        email: ghUser.email,
        avatarUrl: ghUser.avatar_url,
        githubToken: encryptToken(tokens.access_token),
      },
      create: {
        githubId: BigInt(ghUser.id),
        login: ghUser.login,
        name: ghUser.name,
        email: ghUser.email,
        avatarUrl: ghUser.avatar_url,
        githubToken: encryptToken(tokens.access_token),
      },
    });

    const sessionToken = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    return reply.redirect(`${env.APP_URL}/dashboard`);
  });

  app.post("/auth/logout", async (request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });
}
