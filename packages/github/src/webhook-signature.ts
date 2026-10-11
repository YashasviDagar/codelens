import crypto from "node:crypto";

/**
 * Verifies a GitHub webhook signature (X-Hub-Signature-256).
 * Uses timing-safe comparison; never trust payloads without this.
 */
export function verifyWebhookSignature(
  payload: Buffer | string,
  signatureHeader: string | undefined,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signPayload(payload: string, webhookSecret: string): string {
  return "sha256=" + crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
}
