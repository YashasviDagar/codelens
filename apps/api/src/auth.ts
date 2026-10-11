import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { hashToken, randomToken } from "./crypto.js";

export const SESSION_COOKIE = "codelens_session";

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  return token;
}

export async function getSessionUser(request: { cookies: Record<string, string | undefined> }) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export function verifyStateCookie(cookieState: string | undefined, queryState: string | undefined): boolean {
  return Boolean(cookieState && queryState && crypto.timingSafeEqual(Buffer.from(cookieState), Buffer.from(queryState)));
}

